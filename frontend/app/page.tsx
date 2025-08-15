'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { buildApiUrl, API_ENDPOINTS } from '@/lib/config';
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
  Globe, 
  Users, 
  Zap, 
  Shield, 
  LogIn, 
  UserPlus,
  Link2,
  ArrowRight,
  Languages,
  Sparkles,
  Building2,
  GraduationCap
} from 'lucide-react';
import { LoginForm } from '@/components/auth/login-form';
import { RegisterForm } from '@/components/auth/register-form';
import { JoinConversationForm } from '@/components/auth/join-conversation-form';
import { BubbleStreamPage } from '@/components/common';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useUser } from '@/context/AppContext';
import { User, AuthMode } from '@/types';
import { toast } from 'sonner';

export default function LandingPage() {
  const { user, isAuthChecking, setUser } = useUser();
  const [authMode, setAuthMode] = useState<AuthMode>('welcome');
  const router = useRouter();

  // Nettoyer les données d'authentification invalides au chargement
  useEffect(() => {
    const cleanupInvalidAuth = async () => {
      const token = localStorage.getItem('auth_token');
      if (token) {
        try {
          const response = await fetch(buildApiUrl('/auth/me'), {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          if (!response.ok) {
            // Token invalide, nettoyer les données
            console.log('[LANDING] Token invalide détecté, nettoyage');
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user');
            localStorage.removeItem('token');
            setUser(null);
          }
        } catch (error) {
          console.error('Erreur vérification token:', error);
          // En cas d'erreur, nettoyer aussi
          localStorage.removeItem('auth_token');
          localStorage.removeItem('user');
          localStorage.removeItem('token');
          setUser(null);
        }
      }
    };

    cleanupInvalidAuth();
  }, [setUser]);

  const handleAuthSuccess = (user: User, token: string) => {
    // Sauvegarder le token et l'utilisateur
    localStorage.setItem('auth_token', token);
    localStorage.setItem('user', JSON.stringify(user));
    
    // Mettre à jour le contexte immédiatement
    setUser(user);
  };

  const quickLogin = async (email: string) => {
    try {
      const response = await fetch(buildApiUrl(API_ENDPOINTS.AUTH.LOGIN), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username:email,
          email,
          password: 'password123',
        }),
      });

      const result = await response.json();

      if (response.ok && result.user && result.access_token) {
        toast.success(`Connecté en tant que ${result.user.firstName} !`);
        handleAuthSuccess(result.user, result.access_token);
      } else {
        toast.error(result.message || 'Erreur de connexion');
      }
    } catch (error) {
      console.error('Erreur login rapide:', error);
      toast.error('Erreur de connexion');
    }
  };

  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (user) {
    return (
      <DashboardLayout title="Accueil">
        <BubbleStreamPage user={user} />
      </DashboardLayout>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="h-8 w-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
              <MessageSquare className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">Meeshy</span>
          </div>
          
          <div className="flex items-center space-x-2">
            
            <Dialog open={authMode === 'login'} onOpenChange={(open) => setAuthMode(open ? 'login' : 'welcome')}>
              <DialogTrigger asChild>
                <Button variant="ghost" className="flex items-center space-x-2">
                  <LogIn className="h-4 w-4" />
                  <span>Se connecter</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Se connecter</DialogTitle>
                  <DialogDescription>
                    Connectez-vous à votre compte Meeshy
                  </DialogDescription>
                </DialogHeader>
                <LoginForm onSuccess={handleAuthSuccess} />
              </DialogContent>
            </Dialog>
            
            <Dialog open={authMode === 'register'} onOpenChange={(open) => setAuthMode(open ? 'register' : 'welcome')}>
              <DialogTrigger asChild>
                <Button className="flex items-center space-x-2">
                  <UserPlus className="h-4 w-4" />
                  <span>S'inscrire</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Créer un compte</DialogTitle>
                  <DialogDescription>
                    Rejoignez Meeshy et communiquez sans barrières
                  </DialogDescription>
                </DialogHeader>
                <RegisterForm onSuccess={handleAuthSuccess} />
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 lg:py-24">
        <div className="text-center max-w-4xl mx-auto">
          <Badge variant="secondary" className="mb-4">
            <Sparkles className="h-3 w-3 mr-1" />
            Traduction en temps réel
          </Badge>
          
          <h1 className="text-4xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
            Communiquez sans{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
              barrières linguistiques
            </span>
          </h1>
          
          <p className="text-xl text-gray-600 mb-8 leading-relaxed">
            Meeshy traduit automatiquement vos messages en temps réel grâce à l'IA, 
            directement dans votre navigateur. Aucune donnée ne quitte votre appareil.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Dialog open={authMode === 'register'} onOpenChange={(open) => setAuthMode(open ? 'register' : 'welcome')}>
              <DialogTrigger asChild>
                <Button size="lg" className="flex items-center space-x-2">
                  <UserPlus className="h-5 w-5" />
                  <span>Commencer gratuitement</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Créer un compte</DialogTitle>
                  <DialogDescription>
                    Rejoignez Meeshy et communiquez sans barrières
                  </DialogDescription>
                </DialogHeader>
                <RegisterForm onSuccess={handleAuthSuccess} />
              </DialogContent>
            </Dialog>
            
            <Dialog open={authMode === 'join'} onOpenChange={(open) => setAuthMode(open ? 'join' : 'welcome')}>
              <DialogTrigger asChild>
                <Button size="lg" variant="outline" className="flex items-center space-x-2">
                  <Link2 className="h-5 w-5" />
                  <span>Rejoindre une conversation</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Rejoindre une conversation</DialogTitle>
                  <DialogDescription>
                    Entrez le lien de conversation que vous avez reçu
                  </DialogDescription>
                </DialogHeader>
                <JoinConversationForm onSuccess={(linkId: string) => {
                  router.push(`/join/${linkId}`);
                }} />
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-white py-16 lg:py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              Pourquoi choisir Meeshy ?
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Une messagerie moderne qui brise les barrières linguistiques
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <Globe className="h-12 w-12 text-blue-600 mb-4" />
                <CardTitle>Traduction Universelle</CardTitle>
                <CardDescription>
                  Support de plus de 15 langues avec des modèles IA avancés (MT5 et NLLB)
                </CardDescription>
              </CardHeader>
            </Card>
            
              <Card className="border-0 shadow-lg">
              <CardHeader>
                <Languages className="h-12 w-12 text-violet-600 mb-4" />
                <CardTitle>Détection Automatique</CardTitle>
                <CardDescription>
                  Détecte automatiquement la langue des messages pour une traduction plus précise.
                </CardDescription>
              </CardHeader>
            </Card>
            
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <Shield className="h-12 w-12 text-green-600 mb-4" />
                <CardTitle>100% Privé</CardTitle>
                <CardDescription>
                  Traduction côté client uniquement. Vos données restent sur votre appareil.
                </CardDescription>
              </CardHeader>
            </Card>
            
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <Zap className="h-12 w-12 text-yellow-600 mb-4" />
                <CardTitle>Temps Réel</CardTitle>
                <CardDescription>
                  Messages traduits instantanément avec indicateurs de frappe et présence.
                </CardDescription>
              </CardHeader>
            </Card>
            
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <Users className="h-12 w-12 text-purple-600 mb-4" />
                <CardTitle>Conversations de Groupe</CardTitle>
                <CardDescription>
                  Créez des groupes multilingues et gérez les permissions facilement.
                </CardDescription>
              </CardHeader>
            </Card>
            
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <Languages className="h-12 w-12 text-indigo-600 mb-4" />
                <CardTitle>Multi-Langues Personnalisées</CardTitle>
                <CardDescription>
                  Configurez vos langues système et régionale pour une expérience sur mesure.
                </CardDescription>
              </CardHeader>
            </Card>
            
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <MessageSquare className="h-12 w-12 text-red-600 mb-4" />
                <CardTitle>Interface Moderne</CardTitle>
                <CardDescription>
                  Design responsive et intuitive pour une expérience utilisateur optimale.
                </CardDescription>
              </CardHeader>
            </Card>
            
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <Building2 className="h-12 w-12 text-orange-600 mb-4" />
                <CardTitle>Collègues Internationaux</CardTitle>
                <CardDescription>
                  Communiquez avec vos collègues étrangers sans vous soucier de la barrière linguistique.
                </CardDescription>
              </CardHeader>
            </Card>
            
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <GraduationCap className="h-12 w-12 text-teal-600 mb-4" />
                <CardTitle>Salles de Classe Multilingues</CardTitle>
                <CardDescription>
                  Échangez avec vos camarades de classe dans leur langue maternelle, peu importe d'où ils viennent.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-r from-blue-600 to-indigo-600 py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-6">
            Prêt à communiquer sans limites ?
          </h2>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            Rejoignez des milliers d'utilisateurs qui utilisent déjà Meeshy pour briser les barrières linguistiques.
          </p>
          
          <Dialog open={authMode === 'register'} onOpenChange={(open) => setAuthMode(open ? 'register' : 'welcome')}>
            <DialogTrigger asChild>
              <Button size="lg" variant="secondary" className="flex items-center space-x-2">
                <UserPlus className="h-5 w-5" />
                <span>Créer mon compte</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Créer un compte</DialogTitle>
                <DialogDescription>
                  Rejoignez Meeshy et communiquez sans barrières
                </DialogDescription>
              </DialogHeader>
              <RegisterForm onSuccess={handleAuthSuccess} />
            </DialogContent>
          </Dialog>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <div className="h-6 w-6 bg-gradient-to-br from-blue-600 to-indigo-600 rounded flex items-center justify-center">
              <MessageSquare className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-bold">Meeshy</span>
          </div>
          <p className="text-gray-400">
            © 2024 Meeshy. Communication sans barrières linguistiques.
          </p>
        </div>
      </footer>
    </div>
  );
}