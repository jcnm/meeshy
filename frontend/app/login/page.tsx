'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useI18n } from '@/hooks/useI18n';
import { useAuth } from '@/hooks/use-auth';
import { LargeLogo } from '@/components/branding';

// Composants inline légers pour éviter les imports lourds
const SimpleCard = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 ${className}`}>
    {children}
  </div>
);

const SimpleButton = ({ 
  children, 
  onClick, 
  disabled = false, 
  type = 'button',
  className = ''
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
  className?: string;
}) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled}
    className={`w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-md transition-colors ${className}`}
  >
    {children}
  </button>
);

const SimpleInput = ({ 
  type = 'text', 
  value, 
  onChange, 
  placeholder, 
  disabled = false,
  className = ''
}: {
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) => (
  <input
    type={type}
    value={value}
    onChange={onChange}
    placeholder={placeholder}
    disabled={disabled}
    className={`w-full px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent placeholder:text-gray-400 dark:placeholder:text-gray-500 ${className}`}
  />
);

function QuickLoginPageContent() {
  const { t } = useI18n('auth');
  const { login: authLogin, isAuthenticated, isChecking } = useAuth();
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get('returnUrl');

  // Rediriger si déjà authentifié
  useEffect(() => {
    if (!isChecking && isAuthenticated) {
      const redirectUrl = returnUrl || '/';
      router.replace(redirectUrl);
    }
  }, [isAuthenticated, isChecking, returnUrl, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.username.trim() || !formData.password.trim()) {
      alert(t('login.validation.required'));
      return;
    }

    setIsLoading(true);
    
    try {
      // Construire l'URL de l'API
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://gate.meeshy.me';
      const apiUrl = `${backendUrl}/api/auth/login`;
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: formData.username.trim(),
          password: formData.password.trim()
        }),
      });

      const data = await response.json();

      if (data.success && data.data?.token) {
        // Utiliser le hook d'authentification pour mettre à jour le store
        authLogin(data.data.user, data.data.token);

        // Notification de succès simple
        console.log(t('login.success.loginSuccess'));

        // CORRECTION CRITIQUE: Forcer un hard redirect pour rafraîchir complètement l'état
        // router.replace() ne force pas le rechargement de tous les composants
        const redirectUrl = returnUrl || '/';

        // Utiliser window.location.href pour un vrai reload qui force tous les composants à se réinitialiser
        window.location.href = redirectUrl;
      } else {
        alert(data.error || t('login.errors.loginFailed'));
      }
    } catch (error) {
      console.error('Erreur de connexion:', error);
      alert(t('login.errors.loginFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  // État de chargement minimaliste
  if (isChecking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <LargeLogo href="/" />
          <p className="text-gray-600 dark:text-gray-400">{t('login.verifyingAuth')}</p>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <LargeLogo href="/" />
          <p className="text-gray-600 dark:text-gray-400">{t('login.redirecting')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header minimaliste */}
        <div className="text-center space-y-3">
          <LargeLogo href="/" />
          <p className="text-gray-600 dark:text-gray-400">{t('login.subtitle')}</p>
        </div>

        {/* Formulaire simplifié */}
        <SimpleCard className="p-6">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{t('login.title')}</h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm">{t('login.formDescription')}</p>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('login.usernameLabel')}
              </label>
              <SimpleInput
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder={t('login.usernamePlaceholder')}
                disabled={isLoading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('login.passwordLabel')}
              </label>
              <SimpleInput
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder={t('login.passwordPlaceholder')}
                disabled={isLoading}
              />
            </div>

            <SimpleButton type="submit" disabled={isLoading}>
              {isLoading ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>{t('login.loggingIn')}</span>
                </div>
              ) : (
                t('login.loginButton')
              )}
            </SimpleButton>

            <div className="text-center pt-4">
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                {t('login.noAccount')}{' '}
                <button
                  type="button"
                  onClick={() => router.push('/signin' + (returnUrl ? `?returnUrl=${encodeURIComponent(returnUrl)}` : ''))}
                  className="text-blue-600 hover:text-blue-700 font-medium underline"
                >
                  {t('login.registerLink')}
                </button>
              </p>
            </div>
          </form>
        </SimpleCard>
      </div>
    </div>
  );
}

export default function QuickLoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    }>
      <QuickLoginPageContent />
    </Suspense>
  );
}
