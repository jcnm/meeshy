'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LinkConversationService } from '@/services/link-conversation.service';
import { BubbleStreamPage } from '@/components/common/bubble-stream-page';
import { useAuth } from '@/hooks/use-auth';
import { Header } from '@/components/layout/Header';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RegisterForm } from '@/components/auth/register-form';
import { LoginForm } from '@/components/auth/login-form';
import { AccessDenied } from '@/components/ui/access-denied';

interface ConversationData {
  conversation: {
    id: string;
    title: string;
    description?: string;
    type: string;
  };
  link: {
    id: string;
    linkId: string;
    name?: string;
    description?: string;
    allowViewHistory: boolean;
    allowAnonymousMessages: boolean;
    allowAnonymousFiles: boolean;
    allowAnonymousImages: boolean;
    requireEmail: boolean;
    requireNickname: boolean;
    expiresAt?: string | null;
    isActive: boolean;
  };
  userType: 'member' | 'anonymous';
  messages: any[];
  stats: {
    totalMessages: number;
    totalMembers: number;
    totalAnonymousParticipants: number;
    onlineAnonymousParticipants: number;
    hasMore: boolean;
  };
  members: any[];
  anonymousParticipants: any[];
  currentUser: {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
    language: string;
    isMeeshyer: boolean;
    permissions?: {
      canSendMessages: boolean;
      canSendFiles: boolean;
      canSendImages: boolean;
    };
  };
}

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isAnonymous, token } = useAuth();
  const [conversationData, setConversationData] = useState<ConversationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<'welcome' | 'login' | 'register' | 'join'>('welcome');

  const conversationShareLinkId = params.conversationShareLinkId as string;

  // Fonctions pour gérer les actions d'authentification
  const handleAuthModeChange = (mode: 'welcome' | 'login' | 'register' | 'join') => {
    if (mode === 'login') {
      // Afficher la modal de connexion
      setAuthMode('login');
    } else if (mode === 'register') {
      // Afficher la modal d'inscription
      setAuthMode('register');
    } else {
      setAuthMode('welcome');
    }
  };

  useEffect(() => {
    async function loadConversationData() {
      if (!conversationShareLinkId) {
        setError('ID de lien manquant');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        // Debug: Afficher les informations d'authentification
        console.log('[CHAT_PAGE] Debug auth:', {
          user,
          isAnonymous,
          localStorage: {
            auth_token: localStorage.getItem('auth_token'),
            anonymous_session_token: localStorage.getItem('anonymous_session_token'),
            anonymous_participant: localStorage.getItem('anonymous_participant')
          }
        });
        
        // Préparer les options d'authentification
        const options: any = {};
        
        console.log('[CHAT_PAGE] User object:', user);
        console.log('[CHAT_PAGE] Token from authState:', token);
        console.log('[CHAT_PAGE] Is anonymous:', isAnonymous);
        
        if (isAnonymous && token) {
          // Session anonyme
          options.sessionToken = token;
          console.log('[CHAT_PAGE] Utilisation sessionToken:', token);
        } else if (user && typeof user === 'object' && user.id) {
          // Utilisateur authentifié
          const authToken = localStorage.getItem('auth_token');
          if (authToken) {
            options.authToken = authToken;
            console.log('[CHAT_PAGE] Utilisation authToken');
          }
        } else {
          console.log('[CHAT_PAGE] Aucune authentification détectée');
        }
        
        const data = await LinkConversationService.getConversationData(conversationShareLinkId, options);
        console.log('[CHAT_PAGE] Données reçues:', {
          hasData: !!data,
          hasCurrentUser: !!data?.currentUser,
          currentUser: data?.currentUser,
          userType: data?.userType,
          conversationId: data?.conversation?.id
        });
        setConversationData(data);
      } catch (err) {
        console.error('Erreur lors du chargement:', err);
        setError(err instanceof Error ? err.message : 'Erreur inconnue');
      } finally {
        setLoading(false);
      }
    }

    loadConversationData();
  }, [conversationShareLinkId, user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-blue-600 font-medium">Chargement de la conversation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    // Déterminer le type d'erreur pour choisir la variante appropriée
    let variant: 'forbidden' | 'unauthorized' | 'not-found' | 'error' = 'error';
    let title = "Erreur";
    let description = error;

    if (error.includes('403') || error.includes('Forbidden') || error.includes('Accès non autorisé')) {
      variant = 'forbidden';
      title = "Accès interdit";
      description = "Vous n'avez pas les permissions nécessaires pour accéder à cette conversation.";
    } else if (error.includes('401') || error.includes('Unauthorized')) {
      variant = 'unauthorized';
      title = "Authentification requise";
      description = "Vous devez être connecté pour accéder à cette conversation.";
    } else if (error.includes('404') || error.includes('Not Found') || error.includes('introuvable')) {
      variant = 'not-found';
      title = "Conversation introuvable";
      description = "Cette conversation n'existe pas ou le lien est invalide.";
    }

    return (
      <AccessDenied
        variant={variant}
        title={title}
        description={description}
        showBackButton={true}
        showHomeButton={true}
      />
    );
  }

  if (!conversationData) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Aucune donnée de conversation disponible</p>
        </div>
      </div>
    );
  }

  // Vérifier que currentUser existe seulement après le chargement
  if (!conversationData.currentUser) {
    return (
      <AccessDenied
        variant="unauthorized"
        title="Erreur d'authentification"
        description="Impossible de récupérer les informations de l'utilisateur. Veuillez vous reconnecter."
        showBackButton={true}
        showHomeButton={true}
      />
    );
  }

  // Créer un objet utilisateur compatible avec BubbleStreamPage
  const bubbleUser = {
    id: conversationData.currentUser.id,
    username: conversationData.currentUser.username,
    firstName: conversationData.currentUser.firstName,
    lastName: conversationData.currentUser.lastName,
    displayName: `${conversationData.currentUser.firstName} ${conversationData.currentUser.lastName}`,
    email: '',
    role: 'MEMBER' as const,
    systemLanguage: conversationData.currentUser.language,
    regionalLanguage: conversationData.currentUser.language,
    autoTranslateEnabled: true,
    translateToSystemLanguage: true,
    translateToRegionalLanguage: false,
    useCustomDestination: false,
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
    isOnline: true,
    lastSeen: new Date(),
    lastActiveAt: new Date(),
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header avec lien de partage */}
      <Header 
        mode="chat"
        conversationTitle={conversationData.conversation.title}
        shareLink={`${window.location.origin}/join/${conversationData.link.linkId}`}
        user={conversationData.currentUser ? {
          id: conversationData.currentUser.id,
          username: conversationData.currentUser.username,
          firstName: conversationData.currentUser.firstName,
          lastName: conversationData.currentUser.lastName,
          displayName: conversationData.currentUser.firstName + ' ' + conversationData.currentUser.lastName,
          isAnonymous: isAnonymous
        } : null}
        authMode={authMode}
        onAuthModeChange={handleAuthModeChange}
        onLogout={() => {
          // Logique de déconnexion pour les utilisateurs authentifiés
          localStorage.removeItem('auth_token');
          router.push('/');
        }}
        onClearAnonymousSession={() => {
          // Logique d'effacement de session anonyme
          localStorage.removeItem('anonymous_session_token');
          localStorage.removeItem('anonymous_participant');
          localStorage.removeItem('anonymous_current_link_id');
          localStorage.removeItem('anonymous_current_share_link');
          toast.success('Session anonyme effacée');
          router.push('/');
        }}
      />

      {/* Contenu principal */}
      <div className="pt-16">
        <BubbleStreamPage
          user={bubbleUser}
          conversationId={conversationData.conversation.id}
          isAnonymousMode={isAnonymous}
          linkId={conversationData.link.linkId}
          // Passer les participants depuis les données de la conversation partagée
          initialParticipants={isAnonymous ? [
            ...conversationData.members.map(member => ({
              id: member.user.id,
              username: member.user.username,
              firstName: member.user.firstName,
              lastName: member.user.lastName,
              displayName: member.user.displayName,
              avatar: member.user.avatar,
              isOnline: false,
              lastSeen: member.joinedAt,
              // Propriétés requises pour SocketIOUser
              email: member.user.email || '',
              role: member.user.role || 'MEMBER',
              lastActiveAt: member.joinedAt,
              systemLanguage: member.user.language || 'fr',
              regionalLanguage: member.user.language || 'fr',
              autoTranslateEnabled: true,
              translateToSystemLanguage: true,
              translateToRegionalLanguage: false,
              useCustomDestination: false,
              isActive: true,
              createdAt: member.joinedAt,
              updatedAt: member.joinedAt,
              isAnonymous: false,
              isMeeshyer: true
            })),
            ...conversationData.anonymousParticipants.map(participant => ({
              id: participant.id,
              username: participant.username,
              firstName: participant.firstName,
              lastName: participant.lastName,
              displayName: undefined,
              avatar: undefined,
              isOnline: participant.isOnline,
              lastSeen: participant.joinedAt,
              // Propriétés requises pour SocketIOUser
              email: '',
              role: 'MEMBER',
              lastActiveAt: participant.joinedAt,
              systemLanguage: 'fr',
              regionalLanguage: 'fr',
              autoTranslateEnabled: true,
              translateToSystemLanguage: true,
              translateToRegionalLanguage: false,
              useCustomDestination: false,
              isActive: true,
              createdAt: participant.joinedAt,
              updatedAt: participant.joinedAt,
              isAnonymous: true,
              isMeeshyer: false
            }))
          ] : undefined}
        />
      </div>

      {/* Modal d'inscription */}
      <Dialog open={authMode === 'register'} onOpenChange={(open) => setAuthMode(open ? 'register' : 'welcome')}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Créer un compte</DialogTitle>
            <DialogDescription>
              Rejoignez Meeshy et communiquez sans barrières
            </DialogDescription>
          </DialogHeader>
          <RegisterForm onSuccess={() => {
            // Fermer la modale après inscription réussie
            setAuthMode('welcome');
            // Recharger la page pour mettre à jour l'état d'authentification
            window.location.reload();
          }} />
        </DialogContent>
      </Dialog>

      {/* Modal de connexion */}
      <Dialog open={authMode === 'login'} onOpenChange={(open) => setAuthMode(open ? 'login' : 'welcome')}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Se connecter</DialogTitle>
            <DialogDescription>
              Connectez-vous à votre compte Meeshy
            </DialogDescription>
          </DialogHeader>
          <LoginForm onSuccess={() => {
            // Fermer la modale après connexion réussie
            setAuthMode('welcome');
            // Recharger la page pour mettre à jour l'état d'authentification
            window.location.reload();
          }} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
