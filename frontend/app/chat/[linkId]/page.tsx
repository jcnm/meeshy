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
import { AnonymousChat } from '@/components/chat/anonymous-chat';
import { RegisterForm } from '@/components/auth/register-form';
import { toast } from 'sonner';
import { buildApiUrl } from '@/lib/config';

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
  
  const [chatData, setChatData] = useState<AnonymousChatData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  useEffect(() => {
    const initializeAnonymousChat = async () => {
      try {
        // Vérifier si on a une session anonyme valide
        const sessionToken = localStorage.getItem('anonymous_session_token');
        const participantData = localStorage.getItem('anonymous_participant');
        
        if (!sessionToken || !participantData) {
          // Pas de session, rediriger vers la page de join
          router.push(`/join/${linkId}`);
          return;
        }

        // Valider la session auprès du serveur
        const refreshResponse = await fetch(buildApiUrl('/anonymous/refresh'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ sessionToken })
        });

        if (!refreshResponse.ok) {
          // Session invalide, nettoyer et rediriger
          localStorage.removeItem('anonymous_session_token');
          localStorage.removeItem('anonymous_participant');
          router.push(`/join/${linkId}`);
          return;
        }

        const refreshResult = await refreshResponse.json();
        
        if (refreshResult.success) {
          // Session valide, configurer les données de chat
          setChatData({
            participant: refreshResult.data.participant,
            conversation: refreshResult.data.conversation,
            linkId: linkId
          });
          
          // Mettre à jour les données locales
          localStorage.setItem('anonymous_participant', JSON.stringify(refreshResult.data.participant));
        } else {
          throw new Error(refreshResult.message || 'Session invalide');
        }

      } catch (error) {
        console.error('Erreur initialisation chat anonyme:', error);
        setError('Erreur lors de l\'initialisation de la session');
        
        // En cas d'erreur, nettoyer et rediriger
        localStorage.removeItem('anonymous_session_token');
        localStorage.removeItem('anonymous_participant');
        router.push(`/join/${linkId}`);
      } finally {
        setIsLoading(false);
      }
    };

    if (linkId) {
      initializeAnonymousChat();
    }
  }, [linkId, router]);

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
    const sessionToken = localStorage.getItem('anonymous_session_token');
    
    if (sessionToken) {
      try {
        await fetch(buildApiUrl('/anonymous/leave'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ sessionToken })
        });
      } catch (error) {
        console.error('Erreur logout anonyme:', error);
      }
    }
    
    // Nettoyer le localStorage
    localStorage.removeItem('anonymous_session_token');
    localStorage.removeItem('anonymous_participant');
    
    // Rediriger vers la page de join
    router.push(`/join/${linkId}`);
  };

  // Fonction pour gérer la création de compte
  const handleAccountCreation = (user: any, token: string) => {
    // Stocker le token d'authentification
    localStorage.setItem('auth_token', token);
    
    // Nettoyer la session anonyme
    localStorage.removeItem('anonymous_session_token');
    localStorage.removeItem('anonymous_participant');
    
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



  return (
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

      {/* Contenu principal avec AnonymousChat */}
      <div className="pt-16 h-screen">
        <AnonymousChat 
          linkId={linkId}
          participant={chatData.participant}
          conversation={chatData.conversation}
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
            prefilledData={{
              firstName: chatData.participant.firstName,
              lastName: chatData.participant.lastName,
              username: chatData.participant.nickname
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
