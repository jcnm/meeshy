'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useRef } from 'react';
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
  const { user, isAnonymous, token, isChecking } = useAuth();
  const [conversationData, setConversationData] = useState<ConversationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<'welcome' | 'login' | 'register' | 'join'>('welcome');
  const [shouldRedirect, setShouldRedirect] = useState<string | null>(null);
  const isMountedRef = useRef(true);
  const { t } = useTranslations('chatPage');

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

  // Fonction pour charger les données de conversation
  const loadConversationData = useCallback(async () => {
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
        token,
        isChecking,
        localStorage: {
          auth_token: localStorage.getItem('auth_token'),
          anonymous_session_token: localStorage.getItem('anonymous_session_token'),
          anonymous_participant: localStorage.getItem('anonymous_participant')
        }
      });
      
      // Préparer les options d'authentification pour l'API
      const options: any = {};
      
      console.log('[CHAT_PAGE] User object:', user);
      console.log('[CHAT_PAGE] Token from authState:', token);
      console.log('[CHAT_PAGE] Is anonymous:', isAnonymous);
      
      // Utiliser les données d'authentification du hook useAuth
      console.log('[CHAT_PAGE] Évaluation des conditions d\'authentification:');
      console.log('[CHAT_PAGE] - isAnonymous:', isAnonymous, 'token:', !!token, 'user:', !!user);
      console.log('[CHAT_PAGE] - Condition 1 (isAnonymous && token):', isAnonymous && token);
      console.log('[CHAT_PAGE] - Condition 2 (user && token && !isAnonymous):', user && token && !isAnonymous);
      
      if (isAnonymous && token) {
        // Session anonyme - utiliser le token de la session
        options.sessionToken = token;
        console.log('[CHAT_PAGE] ✅ Utilisation du sessionToken pour l\'API');
      } else if (user && token && !isAnonymous) {
        // Utilisateur authentifié - utiliser le token JWT
        options.authToken = token;
        console.log('[CHAT_PAGE] ✅ Utilisation du authToken pour l\'API');
      } else {
        console.log('[CHAT_PAGE] ❌ Aucune authentification détectée - Conditions non remplies');
        
        // Vérifier si l'utilisateur vient de rejoindre (flag temporaire)
        const justJoined = localStorage.getItem('anonymous_just_joined');
        if (justJoined === 'true') {
          console.log('[CHAT_PAGE] Utilisateur vient de rejoindre, nettoyer le flag et continuer');
          // Nettoyer le flag pour éviter les boucles
          localStorage.removeItem('anonymous_just_joined');
          // Continuer le chargement normalement
        }
        
        // Pour les utilisateurs anonymes, rediriger vers la page de jointure
        if (conversationShareLinkId.startsWith('mshy_')) {
          // C'est un linkId, rediriger vers /join
          setShouldRedirect(`/join/${conversationShareLinkId}`);
          return;
        } else {
          // C'est un conversationShareLinkId, essayer de récupérer le linkId
          const storedLinkId = localStorage.getItem('anonymous_current_link_id');
          if (storedLinkId) {
            setShouldRedirect(`/join/${storedLinkId}`);
            return;
          } else {
            setError(t('sessionExpired'));
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
      let errorMessage = t('errorLoading');
      let shouldRedirect = false;
      let redirectPath = '';
      
      if (err instanceof Error) {
        if (err.message.includes('403') || err.message.includes('Forbidden')) {
          errorMessage = t('accessDenied');
        } else if (err.message.includes('404') || err.message.includes('Not Found') || err.message.includes('Lien de partage non trouvé')) {
          errorMessage = t('conversationNotFound');
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
          errorMessage = t('sessionExpiredReconnect');
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
        setShouldRedirect(redirectPath);
      }
    } finally {
      setLoading(false);
    }
  }, [conversationShareLinkId, user, isAnonymous, token, router, t]);

  // useEffect pour charger les données au montage du composant
  useEffect(() => {
    // Ne charger que si l'authentification n'est plus en cours de vérification
    if (!isChecking) {
      console.log('[CHAT_PAGE] Authentification vérifiée, chargement des données');
      loadConversationData();
    } else {
      console.log('[CHAT_PAGE] Authentification en cours, attente...');
    }
  }, [loadConversationData, isChecking]);

  // useEffect de nettoyage au démontage du composant
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // useEffect séparé pour gérer les redirections de manière sûre
  useEffect(() => {
    if (shouldRedirect && isMountedRef.current) {
      console.log('[CHAT_PAGE] Redirection vers:', shouldRedirect);
      // Utiliser setTimeout pour éviter les conflits avec le cycle de vie React
      const timer = setTimeout(() => {
        if (isMountedRef.current) {
          router.push(shouldRedirect);
          // Nettoyer l'état de redirection après la navigation
          setShouldRedirect(null);
        }
      }, 0);
      
      return () => clearTimeout(timer);
    }
  }, [shouldRedirect, router]);

  // Attendre que l'authentification soit vérifiée
  if (isChecking) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-blue-600 font-medium">{t('verifyingAuth')}</p>
        </div>
      </div>
    );
  }

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
          // Recharger les données sans recharger la page
          loadConversationData();
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
          <p className="text-gray-600">{t('noConversationData')}</p>
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
        title={t('incompleteData')}
        description={t('incompleteDataDescription')}
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
      id: isAnonymous ? (user?.id || 'anonymous-user') : (user?.id || 'default-user'),
      username: isAnonymous ? (user?.username || t('defaultAnonymous')) : (user?.username || t('defaultUser')),
      firstName: isAnonymous ? (user?.firstName || t('defaultUser')) : (user?.firstName || t('defaultUser')),
      lastName: isAnonymous ? (user?.lastName || t('defaultAnonymous')) : (user?.lastName || t('defaultAnonymous')),
      displayName: isAnonymous ? (user?.displayName || `${user?.firstName || t('defaultUser')} ${user?.lastName || t('defaultAnonymous')}`.trim()) : (user?.displayName || `${user?.firstName || t('defaultUser')} ${user?.lastName || t('defaultAnonymous')}`.trim()),
      language: isAnonymous ? ((user as any)?.language || 'fr') : ((user as any)?.language || 'fr'),
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
    firstName: conversationData.currentUser.firstName || 'Utilisateur',
    lastName: conversationData.currentUser.lastName || 'Anonyme',
    displayName: `${conversationData.currentUser.firstName || 'Utilisateur'} ${conversationData.currentUser.lastName || 'Anonyme'}`.trim(),
    email: '',
    role: 'MEMBER' as const,
    systemLanguage: conversationData.currentUser.language || 'fr',
    regionalLanguage: conversationData.currentUser.language || 'fr',
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
          firstName: conversationData.currentUser.firstName || 'Utilisateur',
          lastName: conversationData.currentUser.lastName || 'Anonyme',
          displayName: `${conversationData.currentUser.firstName || 'Utilisateur'} ${conversationData.currentUser.lastName || 'Anonyme'}`.trim(),
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
          toast.success(t('anonymousSessionCleared'));
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
            <DialogTitle>{t('createAccount')}</DialogTitle>
            <DialogDescription>
              {t('createAccountDescription')}
            </DialogDescription>
          </DialogHeader>
          <RegisterForm onSuccess={() => {
            // Fermer la modale après inscription réussie
            setAuthMode('welcome');
            // Recharger les données de conversation
            loadConversationData();
          }} />
        </DialogContent>
      </Dialog>

      {/* Modal de connexion */}
      <Dialog open={authMode === 'login'} onOpenChange={(open) => setAuthMode(open ? 'login' : 'welcome')}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('login')}</DialogTitle>
            <DialogDescription>
              {t('loginDescription')}
            </DialogDescription>
          </DialogHeader>
          <LoginForm onSuccess={() => {
            // Fermer la modale après connexion réussie
            setAuthMode('welcome');
            // Recharger les données de conversation
            loadConversationData();
          }} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
