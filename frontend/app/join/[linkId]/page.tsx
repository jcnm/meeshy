'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  UserMinus,
  CheckCircle,
  XCircle,
  Clock,
  ExternalLink,
  Globe
} from 'lucide-react';
import { LoginForm } from '@/components/auth/login-form';
import { RegisterForm } from '@/components/auth/register-form';
import { User, ConversationLink, AuthMode } from '@/types';
import { toast } from 'sonner';
import { buildApiUrl, API_ENDPOINTS } from '@/lib/config';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/use-auth';

// Langues supportées pour les participants anonymes
const ANONYMOUS_LANGUAGES = [
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'pt', name: 'Português', flag: '🇵🇹' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' }
];

interface AnonymousFormData {
  firstName: string;
  lastName: string;
  nickname: string;
  email: string;
  language: string;
}

export default function JoinConversationPage() {
  const params = useParams();
  const router = useRouter();
  const linkId = params?.linkId as string;
  const { user: currentUser, login, joinAnonymously, isChecking } = useAuth();
  
  const [conversationLink, setConversationLink] = useState<ConversationLink | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('welcome');
  const [linkError, setLinkError] = useState<string | null>(null);
  const [showAnonymousForm, setShowAnonymousForm] = useState(false);
  const [anonymousForm, setAnonymousForm] = useState<AnonymousFormData>({
    firstName: '',
    lastName: '',
    nickname: '',
    email: '',
    language: 'fr'
  });

  // Debug: Log currentUser pour voir ce qu'on a
  useEffect(() => {
    console.log('[JOIN_PAGE] currentUser:', currentUser);
    console.log('[JOIN_PAGE] isChecking:', isChecking);
  }, [currentUser, isChecking]);

  useEffect(() => {
    const initializePage = async () => {
      try {
        // Charger les informations du lien via l'API anonyme
        const linkResponse = await fetch(`${buildApiUrl('/anonymous/link')}/${linkId}`);
        
        if (linkResponse.ok) {
          const result = await linkResponse.json();
          if (result.success) {
            setConversationLink(result.data);
          } else {
            setLinkError(result.message);
          }
        } else {
          const errorResult = await linkResponse.json().catch(() => ({}));
          setLinkError(errorResult.message || 'Lien de conversation invalide ou introuvable');
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
    login(user, token);
    setAuthMode('welcome');
  };

  // Fonction pour générer automatiquement le nickname
  const generateNickname = (firstName: string, lastName: string) => {
    const cleanFirstName = firstName.toLowerCase().replace(/[^a-z]/g, '');
    const lastNameInitials = lastName.toLowerCase().replace(/[^a-z]/g, '').slice(0, 2);
    const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${cleanFirstName}_${lastNameInitials}${randomSuffix}`;
  };

  // Fonction pour mettre à jour le formulaire anonyme
  const updateAnonymousForm = (field: keyof AnonymousFormData, value: string) => {
    setAnonymousForm(prev => {
      const newForm = { ...prev, [field]: value };
      
      // Auto-générer le nickname quand le prénom ou nom change
      if (field === 'firstName' || field === 'lastName') {
        if (newForm.firstName && newForm.lastName && !prev.nickname) {
          newForm.nickname = generateNickname(newForm.firstName, newForm.lastName);
        }
      }
      
      return newForm;
    });
  };

  // Fonction pour rejoindre de manière anonyme
  const handleJoinAnonymously = async () => {
    if (!anonymousForm.firstName.trim() || !anonymousForm.lastName.trim()) {
      toast.error('Le prénom et le nom sont requis');
      return;
    }

    setIsJoining(true);
    try {
      const response = await fetch(`${buildApiUrl('/anonymous/join')}/${linkId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          firstName: anonymousForm.firstName.trim(),
          lastName: anonymousForm.lastName.trim(),
          nickname: anonymousForm.nickname.trim() || generateNickname(anonymousForm.firstName, anonymousForm.lastName),
          email: anonymousForm.email.trim() || undefined,
          language: anonymousForm.language,
          deviceFingerprint: navigator.userAgent // Empreinte basique
        })
      });

      const result = await response.json();
      
      if (response.ok && result.success) {
        // Utiliser le hook d'authentification pour gérer la session anonyme
        joinAnonymously(result.data.participant, result.data.sessionToken);
        
        toast.success(`Bienvenue ${result.data.participant.nickname} !`);
        
        // Rediriger vers la page de chat anonyme
        router.push(`/chat/${linkId}`);
      } else {
        toast.error(result.message || 'Erreur lors de la connexion anonyme');
        
        // Si le nickname est déjà pris, proposer le nickname suggéré
        if (response.status === 409 && result.suggestedNickname) {
          setAnonymousForm(prev => ({ ...prev, nickname: result.suggestedNickname }));
          toast.info(`Nickname suggéré: ${result.suggestedNickname}`);
        }
      }
    } catch (error) {
      console.error('Erreur connexion anonyme:', error);
      toast.error('Erreur de connexion');
    } finally {
      setIsJoining(false);
    }
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
        body: JSON.stringify({
          userId: currentUser.id,
          linkId: linkId
        })
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

  if (isLoading || isChecking) {
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
                      <p className="text-sm text-green-700">
                        @{currentUser.username || currentUser.displayName || 'utilisateur'}
                      </p>
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
                <div className="space-y-6">
                  <div className="text-center text-gray-600">
                    <p className="mb-4">Choisissez comment rejoindre cette conversation</p>
                  </div>
                  
                  {!showAnonymousForm ? (
                    <div className="space-y-4">
                      {/* Options d'accès */}
                      <div className="grid grid-cols-1 gap-3">
                        <Button 
                          size="lg" 
                          className="w-full"
                          onClick={() => setShowAnonymousForm(true)}
                        >
                          <UserMinus className="h-4 w-4 mr-2" />
                          Rejoindre anonymement
                        </Button>
                      </div>
                      
                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <span className="w-full border-t" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                          <span className="bg-white px-2 text-muted-foreground">Ou avec un compte</span>
                        </div>
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
                  ) : (
                    /* Formulaire anonyme */
                    <div className="space-y-4">
                      <div className="text-center mb-4">
                        <h3 className="text-lg font-semibold text-gray-900">Accès anonyme</h3>
                        <p className="text-sm text-gray-600">Créez votre identité temporaire</p>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="firstName">Prénom *</Label>
                          <Input
                            id="firstName"
                            value={anonymousForm.firstName}
                            onChange={(e) => updateAnonymousForm('firstName', e.target.value)}
                            placeholder="John"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="lastName">Nom *</Label>
                          <Input
                            id="lastName"
                            value={anonymousForm.lastName}
                            onChange={(e) => updateAnonymousForm('lastName', e.target.value)}
                            placeholder="Doe"
                            required
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="nickname">Nom d&apos;utilisateur</Label>
                        <Input
                          id="nickname"
                          value={anonymousForm.nickname}
                          onChange={(e) => updateAnonymousForm('nickname', e.target.value)}
                          placeholder="Généré automatiquement"
                        />
                        <p className="text-xs text-gray-500">
                          Laissez vide pour génération automatique : prénom_initiales
                        </p>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="email">
                          Email {conversationLink.requireEmail && <span className="text-red-500">*</span>}
                          {!conversationLink.requireEmail && <span className="text-gray-500">(optionnel)</span>}
                        </Label>
                        <Input
                          id="email"
                          type="email"
                          value={anonymousForm.email}
                          onChange={(e) => updateAnonymousForm('email', e.target.value)}
                          placeholder="john.doe@example.com"
                          required={conversationLink.requireEmail}
                        />
                        {conversationLink.requireEmail && (
                          <p className="text-xs text-red-500">
                            L'email est obligatoire pour rejoindre cette conversation
                          </p>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="language">Langue parlée</Label>
                        <Select 
                          value={anonymousForm.language} 
                          onValueChange={(value) => updateAnonymousForm('language', value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ANONYMOUS_LANGUAGES.map((lang) => (
                              <SelectItem key={lang.code} value={lang.code}>
                                <span className="flex items-center">
                                  <span className="mr-2">{lang.flag}</span>
                                  {lang.name}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="flex space-x-3 pt-4">
                        <Button 
                          onClick={handleJoinAnonymously}
                          disabled={
                            isJoining || 
                            !anonymousForm.firstName.trim() || 
                            !anonymousForm.lastName.trim() ||
                            (conversationLink.requireEmail && !anonymousForm.email.trim())
                          }
                          size="lg"
                          className="flex-1"
                        >
                          {isJoining ? 'Connexion...' : 'Rejoindre'}
                          <ExternalLink className="h-4 w-4 ml-2" />
                        </Button>
                        <Button 
                          onClick={() => setShowAnonymousForm(false)}
                          variant="outline"
                          size="lg"
                        >
                          Retour
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
