'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquare, LogIn, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { authService } from '@/services/auth.service';
import { useTranslations } from '@/hooks/useTranslations';
function QuickLoginPageContent() {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, isAuthenticated, isChecking } = useAuth();
  const t = useTranslations('login');

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
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.username.trim() || !formData.password.trim()) {
      toast.error(t('validation.required'));
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
        
        toast.success(t('success.loginSuccess'));
        
        // Redirection vers l'URL de retour ou la page d'accueil
        setTimeout(() => {
          const redirectUrl = returnUrl || '/';
          console.log('[LOGIN_PAGE] Redirection vers:', redirectUrl);
          router.replace(redirectUrl);
        }, 100);
      } else {
        console.error('[LOGIN_PAGE] Échec de connexion:', response.error);
        toast.error(response.error || t('errors.loginFailed'));
      }
    } catch (error) {
      console.error('[LOGIN_PAGE] Erreur de connexion:', error);
      toast.error(t('errors.loginFailed'));
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
          <p className="text-gray-600 mt-2">{t('subtitle')}</p>
        </div>

        {/* Formulaire de connexion */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <LogIn className="h-5 w-5" />
              <span>{t('title')}</span>
            </CardTitle>
            <CardDescription>
              {t('formDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                  {t('usernameLabel')}
                </label>
                <Input
                  id="username"
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder={t('usernamePlaceholder')}
                  disabled={isLoading}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  {t('usernameHelp')}
                </p>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  {t('passwordLabel')}
                </label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder={t('passwordPlaceholder')}
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
                  {t('passwordHelp')}
                </p>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>{t('loggingIn')}</span>
                  </div>
                ) : (
                  t('loginButton')
                )}
              </Button>
            </form>
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
            <p className="text-gray-600 mt-2">Loading...</p>
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
