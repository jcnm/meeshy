'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquare, LogIn, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { authService, TestUser } from '@/services/auth.service';

function QuickLoginPageContent() {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [testAccounts, setTestAccounts] = useState<TestUser[]>([]);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, isAuthenticated, isChecking } = useAuth();

  // Récupérer l'URL de retour depuis les paramètres de recherche
  const returnUrl = searchParams.get('returnUrl');

  // Rediriger automatiquement si l'utilisateur est déjà connecté
  useEffect(() => {
    if (!isChecking && isAuthenticated) {
      console.log('[LOGIN_PAGE] Utilisateur déjà connecté, redirection vers:', returnUrl || '/');
      const redirectUrl = returnUrl || '/';
      // Utiliser replace pour éviter l'ajout à l'historique
      router.replace(redirectUrl);
    }
  }, [isAuthenticated, isChecking, returnUrl, router]);

  // Charger les comptes de test
  useEffect(() => {
    const loadTestAccounts = async () => {
      try {
        const response = await authService.getTestUsers();
        if (response.success && response.data?.users) {
          setTestAccounts(response.data.users);
        }
      } catch (error) {
        console.error('Erreur lors du chargement des comptes de test:', error);
      }
    };

    loadTestAccounts();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.username.trim() || !formData.password.trim()) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }

    setIsLoading(true);
    try {
      console.log('[LOGIN_PAGE] Tentative de connexion:', { username: formData.username });
      
      const response = await authService.login(formData.username.trim(), formData.password.trim());
      console.log('[LOGIN_PAGE] Réponse authService:', response);

      if (response.success && response.data?.user && response.data?.token) {
        console.log('[LOGIN_PAGE] Connexion réussie, mise à jour des états');
        
        // Utiliser le hook useAuth pour la connexion
        login(response.data.user, response.data.token);
        
        toast.success(`Connexion réussie ! Bienvenue ${response.data.user.firstName}`);
        
        // Redirection vers l'URL de retour ou la page d'accueil
        setTimeout(() => {
          const redirectUrl = returnUrl || '/';
          console.log('[LOGIN_PAGE] Redirection vers:', redirectUrl);
          router.replace(redirectUrl);
        }, 100);
      } else {
        console.error('[LOGIN_PAGE] Échec de connexion:', response.error);
        toast.error(response.error || 'Erreur de connexion');
      }
    } catch (error) {
      console.error('[LOGIN_PAGE] Erreur de connexion:', error);
      toast.error('Erreur de connexion au serveur');
    } finally {
      setIsLoading(false);
    }
  };

  const quickLogin = async (username: string) => {
    console.log('[LOGIN_PAGE] Connexion rapide pour:', username);
    setFormData({ username, password: 'password123' });
    setIsLoading(true);
    
    try {
      const response = await authService.login(username, 'password123');
      console.log('[LOGIN_PAGE] Réponse connexion rapide:', response);

      if (response.success && response.data?.user && response.data?.token) {
        console.log('[LOGIN_PAGE] Connexion rapide réussie, mise à jour des états');
        
        // Utiliser le hook useAuth pour la connexion
        login(response.data.user, response.data.token);
        
        toast.success(`Connecté en tant que ${response.data.user.firstName} !`);
        
        // Redirection vers l'URL de retour ou la page d'accueil
        setTimeout(() => {
          const redirectUrl = returnUrl || '/';
          console.log('[LOGIN_PAGE] Redirection vers:', redirectUrl, '(connexion rapide)');
          router.replace(redirectUrl);
        }, 100);
      } else {
        console.error('[LOGIN_PAGE] Échec connexion rapide:', response.error);
        toast.error(response.error || 'Erreur de connexion');
      }
    } catch (error) {
      console.error('[LOGIN_PAGE] Erreur login rapide:', error);
      toast.error('Erreur de connexion');
    } finally {
      setIsLoading(false);
    }
  };

  // Afficher un état de chargement pendant la vérification d'authentification
  if (isChecking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                <MessageSquare className="h-6 w-6 text-white" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Meeshy</h1>
            <p className="text-gray-600 mt-2">Vérification de l'authentification...</p>
            <div className="flex justify-center mt-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Si l'utilisateur est déjà connecté et que la redirection est en cours, afficher un loading
  if (!isChecking && isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                <MessageSquare className="h-6 w-6 text-white" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Meeshy</h1>
            <p className="text-gray-600 mt-2">Redirection en cours...</p>
            <div className="flex justify-center mt-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
              <MessageSquare className="h-6 w-6 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Meeshy</h1>
          <p className="text-gray-600 mt-2">Connectez-vous à votre compte</p>
        </div>

        {/* Formulaire de connexion */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <LogIn className="h-5 w-5" />
              <span>Connexion</span>
            </CardTitle>
            <CardDescription>
              Entrez vos identifiants ou utilisez un compte de test
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                  Nom d&apos;utilisateur ou email
                </label>
                <Input
                  id="username"
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="alice_fr, bob_en, carlos_es..."
                  disabled={isLoading}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Utilisez le username (ex: alice_fr) ou cliquez sur "Connexion rapide" ci-dessous
                </p>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  Mot de passe
                </label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="password123"
                    disabled={isLoading}
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Mot de passe de test : <code className="bg-gray-100 px-1 rounded">password123</code>
                </p>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Connexion...</span>
                  </div>
                ) : (
                  'Se connecter'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Connexion rapide */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Connexion rapide</CardTitle>
            <CardDescription>
              Cliquez sur un utilisateur pour vous connecter automatiquement. Mot de passe pour tous : <code className="bg-gray-100 px-1 rounded text-xs">password123</code>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-2">
              {testAccounts.map((user) => (
                <Button
                  key={user.username}
                  variant="outline"
                  onClick={() => quickLogin(user.username)}
                  disabled={isLoading}
                  className="justify-start h-auto p-3"
                >
                  <div className="text-left w-full">
                    <p className="font-medium">{user.firstName} {user.lastName} ({user.role})</p>
                    <p className="text-sm text-gray-500">Email: {user.email}</p>
                    <p className="text-xs text-blue-600">Username: {user.username}</p>
                    <p className="text-xs text-green-600">Langue: {user.systemLanguage}</p>
                  </div>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Info debug */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Info de debug</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-gray-600 space-y-1">
              <p><strong>Backend URL:</strong> {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}</p>
              <p><strong>Login endpoint:</strong> /auth/login</p>
              <p><strong>Comptes chargés:</strong> {testAccounts.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function QuickLoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                <MessageSquare className="h-6 w-6 text-white" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Meeshy</h1>
            <p className="text-gray-600 mt-2">Chargement...</p>
            <div className="flex justify-center mt-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          </div>
        </div>
      </div>
    }>
      <QuickLoginPageContent />
    </Suspense>
  );
}
