'use client';

import { useEffect, useState } from 'react';
import { BubbleStreamPage } from '@/components/common/bubble-stream-page';
import { ConversationLayoutResponsive } from '@/components/conversations/ConversationLayoutResponsive';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Header } from '@/components/layout/Header';
import { useAuth } from '@/hooks/use-auth';
import { useUser } from '@/context/UnifiedProvider';
import type { User, ConversationLink } from '@shared/types';

interface UnifiedConversationViewProps {
  // Mode de conversation
  mode: 'home' | 'chat' | 'conversations';
  
  // Pour le mode chat
  conversationData?: {
    conversation: {
      id: string;
      title: string;
      description?: string;
      type: string;
    };
    link?: ConversationLink;
    userType: 'member' | 'anonymous';
    currentUser: User;
    members?: any[];
    anonymousParticipants?: any[];
  };
  linkId?: string;
  
  // Pour le mode conversations
  selectedConversationId?: string;
}

export function UnifiedConversationView({
  mode,
  conversationData,
  linkId,
  selectedConversationId
}: UnifiedConversationViewProps) {
  const { user, isAuthChecking } = useUser();
  const { isAnonymous, logout, leaveAnonymousSession } = useAuth();
  const [displayLayout, setDisplayLayout] = useState<'dashboard' | 'standalone'>('dashboard');

  useEffect(() => {
    // Déterminer le layout à utiliser
    if (mode === 'home' && user && !isAnonymous) {
      setDisplayLayout('dashboard');
    } else if (mode === 'conversations') {
      setDisplayLayout('dashboard');
    } else if (mode === 'chat') {
      setDisplayLayout('standalone');
    } else {
      setDisplayLayout('standalone');
    }
  }, [mode, user, isAnonymous]);

  // Gestion du logout unifié
  const handleLogout = () => {
    if (isAnonymous) {
      leaveAnonymousSession();
    } else {
      logout();
    }
  };

  // Gestion de l'effacement de session anonyme
  const handleClearAnonymousSession = () => {
    localStorage.removeItem('anonymous_session_token');
    localStorage.removeItem('anonymous_participant');
    localStorage.removeItem('anonymous_current_share_link');
    localStorage.removeItem('anonymous_current_link_id');
    window.location.href = '/';
  };

  // Pour le mode home avec utilisateur authentifié
  if (mode === 'home' && user && !isAnonymous) {
    return (
      <DashboardLayout title="Accueil">
        <div className="h-full">
          <BubbleStreamPage user={user} />
        </div>
      </DashboardLayout>
    );
  }

  // Pour le mode conversations - Uniquement pour les utilisateurs authentifiés
  if (mode === 'conversations') {
    // Les utilisateurs anonymes ne devraient jamais arriver ici grâce à AuthGuard
    // mais ajoutons une protection supplémentaire
    if (isAnonymous) {
      window.location.href = '/';
      return null;
    }
    return <ConversationLayoutResponsive selectedConversationId={selectedConversationId} />;
  }

  // Pour le mode chat
  if (mode === 'chat' && conversationData) {
    const isAnonymousChat = conversationData.userType === 'anonymous';
    const shareLink = linkId ? `${window.location.origin}/join/${linkId}` : undefined;

    return (
      <>
        <Header 
          mode="chat"
          conversationTitle={conversationData.conversation.title}
          shareLink={shareLink}
          user={{
            ...conversationData.currentUser,
            isAnonymous: isAnonymousChat
          }}
          onLogout={handleLogout}
          onClearAnonymousSession={handleClearAnonymousSession}
        />
        
        <BubbleStreamPage 
          user={conversationData.currentUser}
          conversationId={conversationData.conversation.id}
          isAnonymousMode={isAnonymousChat}
          linkId={linkId}
          initialParticipants={[
            ...(conversationData.members || []),
            ...(conversationData.anonymousParticipants || [])
          ]}
        />
      </>
    );
  }

  // Fallback
  return null;
}
