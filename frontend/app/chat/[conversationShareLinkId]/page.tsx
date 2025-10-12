'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LinkConversationService, LinkConversationData } from '@/services/link-conversation.service';
import { BubbleStreamPage } from '@/components/common/bubble-stream-page';
import { useAuth } from '@/hooks/use-auth';
import { Header } from '@/components/layout/Header';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RegisterForm } from '@/components/auth/register-form';
import { LoginForm } from '@/components/auth/login-form';
import { AccessDenied } from '@/components/ui/access-denied';
import { useI18n } from '@/hooks/useI18n';

// Utiliser directement le type importé
type ConversationData = LinkConversationData;

export default function ChatLinkPage() {
  const params = useParams();
  const linkId = params.conversationShareLinkId as string;
  const { user } = useAuth();
  const { t } = useI18n('chat');
  
  const [conversationData, setConversationData] = useState<ConversationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('register');

  useEffect(() => {
    const loadConversation = async () => {
      try {
        setIsLoading(true);
        const data = await LinkConversationService.getConversationData(linkId);
        
        if (!data.link.isActive) {
          setError('This link is no longer active');
          return;
        }

        if (data.link.expiresAt && new Date(data.link.expiresAt) < new Date()) {
          setError('This link has expired');
          return;
        }

        setConversationData(data);
      } catch (err) {
        console.error('Failed to load conversation:', err);
        setError('Failed to load conversation');
      } finally {
        setIsLoading(false);
      }
    };

    if (linkId) {
      loadConversation();
    }
  }, [linkId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <AccessDenied description={error} />
      </div>
    );
  }

  if (!conversationData) {
    return null;
  }

  const isAnonymous = conversationData.userType === 'anonymous';
  const conversationId = conversationData.conversation.id;

  return (
    <>
      <Header 
        mode="chat"
        conversationTitle={conversationData.conversation.title}
        shareLink={`${window.location.origin}/join/${linkId}`}
        user={{
          ...conversationData.currentUser,
          isAnonymous
        }}
        onLogout={() => {
          // Pour les utilisateurs anonymes, effacer la session
          if (isAnonymous) {
            localStorage.removeItem('anonymous_session_token');
            localStorage.removeItem('anonymous_participant');
            localStorage.removeItem('anonymous_current_share_link');
            localStorage.removeItem('anonymous_current_link_id');
            window.location.href = '/';
          } else {
            // Pour les utilisateurs authentifiés, rediriger vers logout
            window.location.href = '/login';
          }
        }}
        onClearAnonymousSession={() => {
          localStorage.removeItem('anonymous_session_token');
          localStorage.removeItem('anonymous_participant');
          localStorage.removeItem('anonymous_current_share_link');
          localStorage.removeItem('anonymous_current_link_id');
          window.location.href = '/';
        }}
      />
      
      <BubbleStreamPage 
        user={{
          ...conversationData.currentUser,
          email: '',
          role: 'USER' as const,
          permissions: {
            canAccessAdmin: false,
            canManageUsers: false,
            canManageGroups: false,
            canManageConversations: false,
            canViewAnalytics: false,
            canModerateContent: false,
            canViewAuditLogs: false,
            canManageNotifications: false,
            canManageTranslations: false,
            ...conversationData.currentUser.permissions
          },
          systemLanguage: conversationData.currentUser.language,
          regionalLanguage: conversationData.currentUser.language,
          autoTranslateEnabled: true,
          translateToSystemLanguage: true,
          translateToRegionalLanguage: false,
          useCustomDestination: false,
          isOnline: true,
          lastSeen: new Date(),
          lastActiveAt: new Date(),
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }}
        conversationId={conversationId}
        isAnonymousMode={isAnonymous}
        linkId={linkId}
        initialParticipants={[
          ...conversationData.members.map(member => ({
            id: member.user.id,
            username: member.user.username,
            firstName: member.user.firstName,
            lastName: member.user.lastName,
            displayName: member.user.displayName,
            email: '',
            avatar: member.user.avatar,
            role: 'USER' as const,
            permissions: {
              canAccessAdmin: false,
              canManageUsers: false,
              canManageGroups: false,
              canManageConversations: false,
              canViewAnalytics: false,
              canModerateContent: false,
              canViewAuditLogs: false,
              canManageNotifications: false,
              canManageTranslations: false,
            },
            systemLanguage: 'fr',
            regionalLanguage: 'fr',
            autoTranslateEnabled: true,
            translateToSystemLanguage: true,
            translateToRegionalLanguage: false,
            useCustomDestination: false,
            isOnline: member.user.isOnline,
            lastSeen: new Date(member.user.lastSeen),
            lastActiveAt: new Date(member.user.lastSeen),
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
          })),
          ...conversationData.anonymousParticipants.map(participant => ({
            id: participant.id,
            username: participant.username,
            firstName: participant.firstName,
            lastName: participant.lastName,
            displayName: participant.username,
            email: '',
            avatar: '',
            role: 'USER' as const,
            permissions: {
              canAccessAdmin: false,
              canManageUsers: false,
              canManageGroups: false,
              canManageConversations: false,
              canViewAnalytics: false,
              canModerateContent: false,
              canViewAuditLogs: false,
              canManageNotifications: false,
              canManageTranslations: false,
            },
            systemLanguage: participant.language || 'fr',
            regionalLanguage: participant.language || 'fr',
            autoTranslateEnabled: true,
            translateToSystemLanguage: true,
            translateToRegionalLanguage: false,
            useCustomDestination: false,
            isOnline: participant.isOnline,
            lastSeen: new Date(participant.lastActiveAt),
            lastActiveAt: new Date(participant.lastActiveAt),
            isActive: true,
            createdAt: new Date(participant.joinedAt),
            updatedAt: new Date(participant.lastActiveAt)
          }))
        ]}
      />

      {/* Auth Dialog for anonymous users */}
      <Dialog open={showAuthDialog} onOpenChange={setShowAuthDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {authMode === 'login' ? 'Sign In' : 'Create Account'}
            </DialogTitle>
            <DialogDescription>
              {authMode === 'login' ? 'Sign in to your account' : 'Create an account to continue'}
            </DialogDescription>
          </DialogHeader>
          
          {authMode === 'login' ? (
            <LoginForm onSuccess={() => setShowAuthDialog(false)} />
          ) : (
            <RegisterForm onSuccess={() => setShowAuthDialog(false)} />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}