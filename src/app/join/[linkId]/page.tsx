'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { 
  MessageSquare, 
  Users, 
  LogIn, 
  UserPlus,
  CheckCircle,
  XCircle,
  Clock,
  ExternalLink
} from 'lucide-react';
import { LoginForm } from '@/components/auth/login-form';
import { RegisterForm } from '@/components/auth/register-form';
import { User, ConversationLink, AuthMode } from '@/types';
import { toast } from 'sonner';
import { buildApiUrl, API_ENDPOINTS } from '@/lib/config';

export default function JoinConversationPage() {
  const params = useParams();
  const router = useRouter();
  const linkId = params?.linkId as string;
  
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [conversationLink, setConversationLink] = useState<ConversationLink | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('welcome');
  const [linkError, setLinkError] = useState<string | null>(null);

  useEffect(() => {
    const initializePage = async () => {
      try {
        // Vérifier l'authentification
        const token = localStorage.getItem('auth_token');
        if (token) {
          const authResponse = await fetch(buildApiUrl(API_ENDPOINTS.AUTH.ME), {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          if (authResponse.ok) {
            const userData = await authResponse.json();
            setCurrentUser(userData);
          } else {
            localStorage.removeItem('auth_token');
          }
        }

        // Charger les informations du lien
        const linkResponse = await fetch(`${buildApiUrl('/conversation/link')}/${linkId}`);
        
        if (linkResponse.ok) {
          const linkData = await linkResponse.json();
          setConversationLink(linkData);
          
          // Vérifier si le lien est valide
          if (!linkData.isActive) {
            setLinkError('Ce lien de conversation n\'est plus actif');
          } else if (linkData.expiresAt && new Date(linkData.expiresAt) < new Date()) {
            setLinkError('Ce lien de conversation a expiré');
          } else if (linkData.maxUses && linkData.currentUses >= linkData.maxUses) {
            setLinkError('Ce lien de conversation a atteint sa limite d\'utilisation');
          }
        } else {
          setLinkError('Lien de conversation invalide ou introuvable');
        }
      } catch (error) {
        console.error('Erreur initialisation:', error);
        setLinkError('Erreur lors du chargement du lien');
      } finally {
        setIsLoading(false);
      }
    };

    if (linkId) {
      initializePage();
    }
  }, [linkId]);

  const handleAuthSuccess = (user: User, token: string) => {
    localStorage.setItem('auth_token', token);
    setCurrentUser(user);
    setAuthMode('welcome');
  };

  const joinConversation = async () => {
    if (!currentUser || !conversationLink || linkError) return;

    setIsJoining(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${buildApiUrl('/conversation/join')}/${linkId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
      });

      if (response.ok) {
        toast.success('Vous avez rejoint la conversation !');
        router.push(`/chat/${conversationLink.conversationId}`);
      } else {
        const error = await response.json();
        toast.error(error.message || 'Erreur lors de la jointure');
      }
    } catch (error) {
      console.error('Erreur jointure:', error);
      toast.error('Erreur de connexion');
    } finally {
      setIsJoining(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (linkError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <CardTitle className="text-xl text-red-700">Lien invalide</CardTitle>
            <CardDescription className="text-red-600">
              {linkError}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => router.push('/')}
              className="w-full"
            >
              Retourner à l&apos;accueil
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!conversationLink) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Conversation introuvable</CardTitle>
            <CardDescription>
              Le lien que vous essayez d&apos;utiliser n&apos;existe pas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => router.push('/')}
              className="w-full"
            >
              Retourner à l&apos;accueil
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="h-8 w-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
              <MessageSquare className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">Meeshy</span>
          </div>
          
          {!currentUser && (
            <div className="flex items-center space-x-2">
              <Dialog open={authMode === 'login'} onOpenChange={(open) => setAuthMode(open ? 'login' : 'welcome')}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <LogIn className="h-4 w-4 mr-2" />
                    Se connecter
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Se connecter</DialogTitle>
                    <DialogDescription>
                      Connectez-vous pour rejoindre la conversation
                    </DialogDescription>
                  </DialogHeader>
                  <LoginForm onSuccess={handleAuthSuccess} />
                </DialogContent>
              </Dialog>
              
              <Dialog open={authMode === 'register'} onOpenChange={(open) => setAuthMode(open ? 'register' : 'welcome')}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <UserPlus className="h-4 w-4 mr-2" />
                    S&apos;inscrire
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Créer un compte</DialogTitle>
                    <DialogDescription>
                      Créez votre compte pour rejoindre la conversation
                    </DialogDescription>
                  </DialogHeader>
                  <RegisterForm onSuccess={handleAuthSuccess} />
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto">
          <Card className="shadow-xl">
            <CardHeader className="text-center">
              <div className="h-16 w-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                {conversationLink.conversation?.type === 'GROUP' ? (
                  <Users className="h-8 w-8 text-blue-600" />
                ) : (
                  <MessageSquare className="h-8 w-8 text-blue-600" />
                )}
              </div>
              
              <CardTitle className="text-2xl">
                Rejoindre la conversation
              </CardTitle>
              <CardDescription className="text-lg">
                Vous êtes invité(e) à rejoindre &quot;{conversationLink.conversation?.title || 'Conversation sans nom'}&quot;
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-6">
              {/* Informations sur la conversation */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Type:</span>
                  <Badge variant={conversationLink.conversation?.type === 'GROUP' ? "default" : "secondary"}>
                    {conversationLink.conversation?.type === 'GROUP' ? 'Groupe' : 'Conversation privée'}
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Participants:</span>
                  <span className="text-sm text-gray-600">
                    {conversationLink.conversation?.participants?.length || 0} membre(s)
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Créée le:</span>
                  <span className="text-sm text-gray-600">
                    {conversationLink.conversation?.createdAt ? new Date(conversationLink.conversation.createdAt).toLocaleDateString() : 'N/A'}
                  </span>
                </div>

                {conversationLink.expiresAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Expire le:</span>
                    <span className="text-sm text-gray-600 flex items-center">
                      <Clock className="h-4 w-4 mr-1" />
                      {new Date(conversationLink.expiresAt).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>

              {/* Actions */}
              {currentUser ? (
                <div className="space-y-4">
                  <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-medium text-green-900">
                        Connecté en tant que {currentUser.firstName || currentUser.displayName || currentUser.username} {currentUser.lastName || ''}
                      </p>
                      <p className="text-sm text-green-700">@{currentUser.username}</p>
                    </div>
                  </div>
                  
                  <Button 
                    onClick={joinConversation}
                    disabled={isJoining}
                    size="lg"
                    className="w-full"
                  >
                    {isJoining ? 'Connexion...' : 'Rejoindre la conversation'}
                    <ExternalLink className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-center text-gray-600">
                    <p className="mb-4">Vous devez être connecté pour rejoindre cette conversation</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <Dialog open={authMode === 'login'} onOpenChange={(open) => setAuthMode(open ? 'login' : 'welcome')}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="lg">
                          <LogIn className="h-4 w-4 mr-2" />
                          Se connecter
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Se connecter</DialogTitle>
                          <DialogDescription>
                            Connectez-vous pour rejoindre la conversation
                          </DialogDescription>
                        </DialogHeader>
                        <LoginForm onSuccess={handleAuthSuccess} />
                      </DialogContent>
                    </Dialog>
                    
                    <Dialog open={authMode === 'register'} onOpenChange={(open) => setAuthMode(open ? 'register' : 'welcome')}>
                      <DialogTrigger asChild>
                        <Button size="lg">
                          <UserPlus className="h-4 w-4 mr-2" />
                          S&apos;inscrire
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Créer un compte</DialogTitle>
                          <DialogDescription>
                            Créez votre compte pour rejoindre la conversation
                          </DialogDescription>
                        </DialogHeader>
                        <RegisterForm onSuccess={handleAuthSuccess} />
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
