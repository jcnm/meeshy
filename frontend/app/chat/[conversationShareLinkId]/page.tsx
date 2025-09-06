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
import { AnonymousChatErrorHandler } from '@/components/chat/anonymous-chat-error-handler';
import { useTranslations } from '@/hooks/useTranslations';

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
  const { t } = useTranslations('anonymousChat');

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
        setError(t('missingLinkId'));
        setLoading(false);
        return;
      }

      console.log('[CHAT_PAGE] Tentative de chargement avec identifiant:', conversationShareLinkId);
      console.log('[CHAT_PAGE] Type d\'identifiant:', conversationShareLinkId.startsWith('mshy_') ? 'linkId' : 'conversationShareLinkId');
      console.log('[CHAT_PAGE] Longueur de l\'identifiant:', conversationShareLinkId.length);
      console.log('[CHAT_PAGE] Format de l\'identifiant:', {
        startsWithMshy: conversationShareLinkId.startsWith('mshy_'),
        containsHyphens: conversationShareLinkId.includes('-'),
        isAlphanumeric: /^[a-zA-Z0-9_-]+$/.test(conversationShareLinkId)
      });

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
        
        // Validation améliorée de l'authentification
        const options: any = {};
        let hasValidAuth = false;
        
        console.log('[CHAT_PAGE] User object:', user);
        console.log('[CHAT_PAGE] Token from authState:', token);
        console.log('[CHAT_PAGE] Is anonymous:', isAnonymous);
        
        if (isAnonymous && token) {
          // Session anonyme - vérifier que le token est valide
          const sessionToken = localStorage.getItem('anonymous_session_token');
          const participant = localStorage.getItem('anonymous_participant');
          
          if (sessionToken && participant) {
            try {
              const participantData = JSON.parse(participant);
              if (participantData.id && participantData.username) {
                options.sessionToken = sessionToken;
                hasValidAuth = true;
                console.log('[CHAT_PAGE] Session anonyme valide détectée');
              }
            } catch (e) {
              console.error('[CHAT_PAGE] Erreur parsing participant:', e);
            }
          }
        } else if (user && typeof user === 'object' && user.id) {
          // Utilisateur authentifié
          const authToken = localStorage.getItem('auth_token');
          if (authToken) {
            options.authToken = authToken;
            hasValidAuth = true;
            console.log('[CHAT_PAGE] Utilisateur authentifié valide détecté');
          }
        }
        
        if (!hasValidAuth) {
          console.log('[CHAT_PAGE] Aucune authentification valide détectée');
          // Pour les utilisateurs anonymes, rediriger vers la page de jointure
          if (conversationShareLinkId.startsWith('mshy_')) {
            // C'est un linkId, rediriger vers /join
            router.push(`/join/${conversationShareLinkId}`);
            return;
          } else {
            // C'est un conversationShareLinkId, essayer de récupérer le linkId
            const storedLinkId = localStorage.getItem('anonymous_current_link_id');
            if (storedLinkId) {
              router.push(`/join/${storedLinkId}`);
              return;
            } else {
              setError('Session expirée. Veuillez rejoindre la conversation à nouveau.');
              setLoading(false);
              return;
            }
          }
        }
        
        const data = await LinkConversationService.getConversationData(conversationShareLinkId, options);
        console.log('[CHAT_PAGE] Données reçues:', {
          hasData: !!data,
          hasCurrentUser: !!data?.currentUser,
          currentUser: data?.currentUser,
          userType: data?.userType,
          conversationId: data?.conversation?.id,
          fullData: data // Log complet pour debug
        });
        setConversationData(data);
      } catch (err) {
        console.error('[CHAT_PAGE] Erreur chargement conversation:', err);
        
        // Gestion d'erreur améliorée
        let errorMessage = 'Erreur lors du chargement de la conversation';
        let shouldRedirect = false;
        let redirectPath = '';
        
        if (err instanceof Error) {
          if (err.message.includes('403') || err.message.includes('Forbidden')) {
            errorMessage = 'Accès non autorisé à cette conversation';
          } else if (err.message.includes('404') || err.message.includes('Not Found') || err.message.includes('Lien de partage non trouvé')) {
            errorMessage = 'Conversation introuvable';
            // Essayer avec un format différent
            console.log('[CHAT_PAGE] Tentative de fallback avec format différent...');
            
            try {
              // Préparer les options d'authentification pour le fallback
              const fallbackOptions: any = {};
              
              if (isAnonymous && token) {
                fallbackOptions.sessionToken = token;
              } else if (user && typeof user === 'object' && user.id) {
                const authToken = localStorage.getItem('auth_token');
                if (authToken) {
                  fallbackOptions.authToken = authToken;
                }
              }
              
              // Si l'identifiant ne commence pas par 'mshy_', essayer d'ajouter le préfixe
              let fallbackIdentifier = conversationShareLinkId;
              if (!conversationShareLinkId.startsWith('mshy_')) {
                fallbackIdentifier = `mshy_${conversationShareLinkId}`;
                console.log('[CHAT_PAGE] Essai avec préfixe mshy_:', fallbackIdentifier);
              } else {
                // Si l'identifiant commence par 'mshy_', essayer sans le préfixe
                fallbackIdentifier = conversationShareLinkId.replace('mshy_', '');
                console.log('[CHAT_PAGE] Essai sans préfixe mshy_:', fallbackIdentifier);
              }
              
              const fallbackData = await LinkConversationService.getConversationData(fallbackIdentifier, fallbackOptions);
              console.log('[CHAT_PAGE] Données reçues avec fallback:', {
                hasData: !!fallbackData,
                hasCurrentUser: !!fallbackData?.currentUser,
                userType: fallbackData?.userType,
                conversationId: fallbackData?.conversation?.id
              });
              setConversationData(fallbackData);
              return; // Succès avec fallback
            } catch (fallbackErr) {
              console.error('Erreur lors du fallback:', fallbackErr);
            }
          } else if (err.message.includes('401') || err.message.includes('Unauthorized')) {
            errorMessage = 'Session expirée. Veuillez vous reconnecter.';
            shouldRedirect = true;
            // Rediriger vers la page de jointure pour les sessions anonymes
            if (isAnonymous) {
              const storedLinkId = localStorage.getItem('anonymous_current_link_id');
              if (storedLinkId) {
                redirectPath = `/join/${storedLinkId}`;
              } else {
                redirectPath = '/';
              }
            } else {
              redirectPath = '/login';
            }
          } else {
            errorMessage = err.message;
          }
        }
        
        setError(errorMessage);
        
        // Redirection si nécessaire
        if (shouldRedirect && redirectPath) {
          setTimeout(() => {
            router.push(redirectPath);
          }, 2000); // Attendre 2 secondes pour que l'utilisateur voie le message d'erreur
        }
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
          <p className="mt-4 text-blue-600 font-medium">{t('loadingConversation')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <AnonymousChatErrorHandler
        error={error}
        identifier={conversationShareLinkId}
        isAnonymous={isAnonymous}
        onRetry={() => {
          setError(null);
          setLoading(true);
          // Recharger les données
          window.location.reload();
        }}
        onRedirect={(path) => {
          router.push(path);
        }}
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

  // Vérifier que les propriétés essentielles existent
  if (!conversationData.conversation || !conversationData.link) {
    console.error('[CHAT_PAGE] Données de conversation incomplètes:', {
      hasConversation: !!conversationData.conversation,
      hasLink: !!conversationData.link,
      conversationData: conversationData
    });
    
    return (
      <AccessDenied
        variant="error"
        title="Données incomplètes"
        description="Les données de la conversation sont incomplètes. Veuillez réessayer."
        showBackButton={true}
        showHomeButton={true}
      />
    );
  }

  // Vérifier que currentUser existe seulement après le chargement
  if (!conversationData.currentUser) {
    console.log('[CHAT_PAGE] currentUser est null, création d\'un utilisateur par défaut');
    
    // Créer un utilisateur par défaut basé sur l'état d'authentification
    const defaultUser = {
      id: isAnonymous ? 'anonymous-user' : (user?.id || 'default-user'),
      username: isAnonymous ? 'Utilisateur Anonyme' : (user?.username || 'Utilisateur'),
      firstName: isAnonymous ? 'Utilisateur' : (user?.firstName || 'Utilisateur'),
      lastName: isAnonymous ? 'Anonyme' : (user?.lastName || ''),
      displayName: isAnonymous ? 'Utilisateur Anonyme' : (user?.displayName || 'Utilisateur'),
      language: 'fr',
      isMeeshyer: !isAnonymous,
      permissions: {
        canSendMessages: true,
        canSendFiles: true,
        canSendImages: true
      }
    };
    
    // Mettre à jour conversationData avec l'utilisateur par défaut
    conversationData.currentUser = defaultUser;
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
