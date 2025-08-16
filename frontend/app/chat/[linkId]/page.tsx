'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  MessageSquare, 
  Share2, 
  LogIn, 
  UserPlus,
  LogOut,
  Settings,
  ChevronDown,
  Copy,
  ExternalLink
} from 'lucide-react';
import { BubbleStreamPage } from '@/components/common/bubble-stream-page';
import { RegisterForm } from '@/components/auth/register-form';
import { toast } from 'sonner';
import { buildApiUrl, API_ENDPOINTS } from '@/lib/config';
import { SocketIOUser } from '@/shared/types';
import { useAuth } from '@/hooks/use-auth';
import { AuthGuard } from '@/components/auth/auth-guard';
import { LinkConversationService } from '@/services/link-conversation.service';

interface AnonymousParticipant {
  id: string;
  nickname: string;
  firstName: string;
  lastName: string;
  language: string;
  canSendMessages: boolean;
  canSendFiles: boolean;
  canSendImages: boolean;
}

interface ConversationInfo {
  id: string;
  title: string;
  type: string;
  allowViewHistory: boolean;
}

interface AnonymousChatData {
  participant: AnonymousParticipant;
  conversation: ConversationInfo;
  linkId: string;
}

export default function AnonymousChatPage() {
  const params = useParams();
  const router = useRouter();
  const linkId = params?.linkId as string;
  const { user, leaveAnonymousSession, login } = useAuth();
  
  const [chatData, setChatData] = useState<AnonymousChatData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  useEffect(() => {
    const initializeAnonymousChat = async () => {
      try {
        // Si l'utilisateur n'est pas connecté, rediriger vers la page de join
        if (!user) {
          router.push(`/join/${linkId}`);
          return;
        }

        // Préparer les options d'authentification
        const options: any = {};
        
        if (user && typeof user === 'object' && 'token' in user) {
          // Session anonyme
          options.sessionToken = user.token as string;
        } else if (user && typeof user === 'object' && 'id' in user) {
          // Utilisateur authentifié
          const authToken = localStorage.getItem('auth_token');
          if (authToken) {
            options.authToken = authToken;
          }
        }

        // Charger les données de conversation via le service
        const data = await LinkConversationService.getConversationData(linkId, options);
        
        // Adapter les données au format attendu par le composant
        const participant = data.currentUser.type === 'anonymous' ? {
          id: data.currentUser.id,
          nickname: data.currentUser.nickname || '',
          firstName: data.currentUser.firstName,
          lastName: data.currentUser.lastName,
          language: data.currentUser.language,
          canSendMessages: data.currentUser.permissions?.canSendMessages || false,
          canSendFiles: data.currentUser.permissions?.canSendFiles || false,
          canSendImages: data.currentUser.permissions?.canSendImages || false
        } : {
          id: data.currentUser.id,
          nickname: data.currentUser.username || '',
          firstName: data.currentUser.firstName,
          lastName: data.currentUser.lastName,
          language: data.currentUser.language,
          canSendMessages: true,
          canSendFiles: true,
          canSendImages: true
        };

        const conversation = {
          id: data.conversation.id,
          title: data.conversation.title,
          type: data.conversation.type,
          allowViewHistory: data.link.allowViewHistory
        };
        
        setChatData({
          participant,
          conversation,
          linkId: linkId
        });

      } catch (error) {
        console.error('Erreur initialisation chat anonyme:', error);
        setError('Erreur lors de l\'initialisation de la session');
        router.push(`/join/${linkId}`);
      } finally {
        setIsLoading(false);
      }
    };

    if (linkId && user) {
      initializeAnonymousChat();
    }
  }, [linkId, user, router]);

  // Fonction pour partager le lien
  const shareLink = async () => {
    const currentUrl = window.location.origin + `/join/${linkId}`;
    
    try {
      await navigator.clipboard.writeText(currentUrl);
      toast.success('Lien copié dans le presse-papiers !');
    } catch (error) {
      // Fallback si clipboard API pas disponible
      console.error('Erreur copie lien:', error);
      toast.info(`Lien à partager: ${currentUrl}`);
    }
  };

  // Fonction pour se déconnecter
  const handleLogout = async () => {
    // Utiliser le hook d'authentification pour quitter la session
    leaveAnonymousSession();
    
    // Rediriger vers la page de join
    router.push(`/join/${linkId}`);
  };

  // Fonction pour gérer la création de compte
  const handleAccountCreation = (user: any, token: string) => {
    // Utiliser le hook d'authentification pour se connecter
    login(user, token);
    
    toast.success('Compte créé avec succès ! Redirection...');
    
    // Rediriger vers la conversation avec le nouveau compte
    setTimeout(() => {
      router.push(`/conversations/${chatData?.conversation.id}`);
    }, 1000);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error || !chatData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-700 mb-4">Erreur de session</h1>
          <p className="text-red-600 mb-6">{error || 'Session non trouvée'}</p>
          <Button onClick={() => router.push(`/join/${linkId}`)}>
            Retourner à la page de connexion
          </Button>
        </div>
      </div>
    );
  }

  // Créer un objet utilisateur compatible avec BubbleStreamPage
  const anonymousUser: SocketIOUser = {
    id: chatData.participant.id,
    username: chatData.participant.nickname,
    firstName: chatData.participant.firstName,
    lastName: chatData.participant.lastName,
    displayName: `${chatData.participant.firstName} ${chatData.participant.lastName}`,
    email: '',
    role: 'MEMBER',
    systemLanguage: chatData.participant.language,
    regionalLanguage: chatData.participant.language,
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
    <AuthGuard requireAuth={true} allowAnonymous={true}>
      <div className="min-h-screen relative">
        {/* Header spécial pour l'accès anonyme */}
        <header className="fixed top-0 left-0 right-0 z-50 border-b border-gray-200 bg-white/95 backdrop-blur-sm">
          <div className="container mx-auto px-4 py-3 flex items-center justify-between">
            {/* Logo et titre */}
            <div className="flex items-center space-x-3">
              <div className="h-8 w-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-white" />
              </div>
              <div>
                <span className="text-xl font-bold text-gray-900">Meeshy</span>
                <span className="text-sm text-gray-500 ml-2">• Accès invité</span>
              </div>
            </div>
            
            {/* Informations utilisateur et actions */}
            <div className="flex items-center space-x-3">
              {/* Indicateur participant anonyme */}
              <div className="hidden sm:flex items-center space-x-2 px-3 py-1 bg-blue-50 border border-blue-200 rounded-full">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-sm font-medium text-blue-700">
                  {chatData.participant.nickname}
                </span>
              </div>
              
              {/* Actions */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <Settings className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Options</span>
                    <ChevronDown className="h-4 w-4 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-1.5 text-sm font-medium text-gray-900">
                    {chatData.participant.firstName} {chatData.participant.lastName}
                  </div>
                  <div className="px-2 py-1 text-xs text-gray-500">
                    @{chatData.participant.nickname}
                  </div>
                  <DropdownMenuSeparator />
                  
                  <DropdownMenuItem onClick={shareLink}>
                    <Share2 className="h-4 w-4 mr-2" />
                    Partager ce lien
                  </DropdownMenuItem>
                  
                  <DropdownMenuSeparator />
                  
                  <DropdownMenuItem onClick={() => setShowRegisterModal(true)}>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Créer mon compte
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem onClick={() => router.push('/login')}>
                    <LogIn className="h-4 w-4 mr-2" />
                    Se connecter
                  </DropdownMenuItem>
                  
                  <DropdownMenuSeparator />
                  
                  <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                    <LogOut className="h-4 w-4 mr-2" />
                    Quitter la session
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Contenu principal avec BubbleStreamPage */}
        <div className="pt-16 h-screen">
          <BubbleStreamPage 
            user={anonymousUser}
            conversationId={chatData.conversation.id}
            isAnonymousMode={true}
            linkId={linkId}
          />
        </div>

        {/* Modale de création de compte */}
        <Dialog open={showRegisterModal} onOpenChange={setShowRegisterModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Créer votre compte Meeshy</DialogTitle>
              <DialogDescription>
                Transformez votre accès temporaire en compte permanent et gardez l'historique de vos conversations.
              </DialogDescription>
            </DialogHeader>
            
            <RegisterForm
              onSuccess={handleAccountCreation}
            />
          </DialogContent>
        </Dialog>
      </div>
    </AuthGuard>
  );
}
