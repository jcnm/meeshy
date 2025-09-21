'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

// Composants inline légers pour éviter les imports lourds
const SimpleCard = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-white rounded-lg shadow-md border ${className}`}>
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
    className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${className}`}
  />
);

// Messages statiques pour éviter le système de traduction lourd
const MESSAGES = {
  title: 'Connexion',
  subtitle: 'Connectez-vous à votre compte Meeshy',
  usernameLabel: 'Nom d\'utilisateur',
  usernamePlaceholder: 'Votre nom d\'utilisateur',
  passwordLabel: 'Mot de passe',
  passwordPlaceholder: 'Votre mot de passe',
  loginButton: 'Se connecter',
  loggingIn: 'Connexion...',
  noAccount: 'Pas de compte ?',
  registerLink: 'S\'inscrire',
  loginSuccess: 'Connexion réussie !',
  loginFailed: 'Erreur de connexion',
  required: 'Tous les champs sont requis'
};

function QuickLoginPageContent() {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get('returnUrl');

  // Vérification d'authentification simplifiée
  useEffect(() => {
    const checkAuth = () => {
      const token = localStorage.getItem('auth_token');
      const user = localStorage.getItem('user');
      
      if (token && user) {
        setIsAuthenticated(true);
        const redirectUrl = returnUrl || '/';
        router.replace(redirectUrl);
      } else {
        setAuthChecking(false);
      }
    };

    checkAuth();
  }, [returnUrl, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.username.trim() || !formData.password.trim()) {
      alert(MESSAGES.required);
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
        // Stockage direct
        localStorage.setItem('auth_token', data.data.token);
        localStorage.setItem('user', JSON.stringify(data.data.user));
        
        // Notification de succès simple
        console.log(MESSAGES.loginSuccess);
        
        // Redirection immédiate
        const redirectUrl = returnUrl || '/';
        router.replace(redirectUrl);
      } else {
        alert(data.error || MESSAGES.loginFailed);
      }
    } catch (error) {
      console.error('Erreur de connexion:', error);
      alert(MESSAGES.loginFailed);
    } finally {
      setIsLoading(false);
    }
  };

  // État de chargement minimaliste
  if (authChecking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-xl">M</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Meeshy</h1>
          <p className="text-gray-600 mt-2">Vérification...</p>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mt-4"></div>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-xl">M</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Meeshy</h1>
          <p className="text-gray-600 mt-2">Redirection...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header minimaliste */}
        <div className="text-center">
          <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-xl font-bold">M</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Meeshy</h1>
          <p className="text-gray-600 mt-2">{MESSAGES.subtitle}</p>
        </div>

        {/* Formulaire simplifié */}
        <SimpleCard className="p-6">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">{MESSAGES.title}</h2>
            <p className="text-gray-600 text-sm">Entrez vos identifiants pour vous connecter</p>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {MESSAGES.usernameLabel}
              </label>
              <SimpleInput
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder={MESSAGES.usernamePlaceholder}
                disabled={isLoading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {MESSAGES.passwordLabel}
              </label>
              <div className="relative">
                <SimpleInput
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder={MESSAGES.passwordPlaceholder}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="absolute right-3 top-2 text-gray-400 hover:text-gray-600"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <SimpleButton type="submit" disabled={isLoading}>
              {isLoading ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>{MESSAGES.loggingIn}</span>
                </div>
              ) : (
                MESSAGES.loginButton
              )}
            </SimpleButton>

            <div className="text-center pt-4">
              <p className="text-gray-600 text-sm">
                {MESSAGES.noAccount}{' '}
                <button
                  type="button"
                  onClick={() => router.push('/signin' + (returnUrl ? `?returnUrl=${encodeURIComponent(returnUrl)}` : ''))}
                  className="text-blue-600 hover:text-blue-700 font-medium underline"
                >
                  {MESSAGES.registerLink}
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    }>
      <QuickLoginPageContent />
    </Suspense>
  );
}