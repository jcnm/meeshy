'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';
import { User } from '@/types';
import { buildApiUrl, API_ENDPOINTS } from '@/lib/config';
import { useI18n } from '@/hooks/useI18n';

interface LoginFormProps {
  onSuccess?: (user: User, token: string) => void; // Optional callback for custom behavior
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const { login } = useAuth();
  const { t } = useI18n('auth');
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.username.trim() || !formData.password.trim()) {
      toast.error(t('login.validation.required'));
      return;
    }

    setIsLoading(true);
    try {
      console.log('[LOGIN_FORM] Tentative de connexion pour:', formData.username);
      console.log('[LOGIN_FORM] URL de connexion:', buildApiUrl(API_ENDPOINTS.AUTH.LOGIN));
      
      const response = await fetch(buildApiUrl(API_ENDPOINTS.AUTH.LOGIN), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: formData.username.trim(),
          password: formData.password.trim(),
        }),
      });

      console.log('[LOGIN_FORM] Status de la réponse:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[LOGIN_FORM] Erreur HTTP:', response.status, errorData);
        throw new Error(errorData.error || `Erreur ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('[LOGIN_FORM] Réponse API:', result);

      // Gérer les différents formats de réponse
      let userData, token;
      
      if (result.success && result.data?.user && result.data?.token) {
        // Format standardisé: { success: true, data: { user: {...}, token: "..." } }
        userData = result.data.user;
        token = result.data.token;
      } else if (result.user && result.access_token) {
        // Format alternatif: { user: {...}, access_token: "..." }
        userData = result.user;
        token = result.access_token;
      } else if (result.user && result.token) {
        // Format alternatif: { user: {...}, token: "..." }
        userData = result.user;
        token = result.token;
      } else {
        console.error('[LOGIN_FORM] Format de réponse inattendu:', result);
        console.error('[LOGIN_FORM] URL appelée:', buildApiUrl(API_ENDPOINTS.AUTH.LOGIN));
        throw new Error('Format de réponse invalide - vérifiez la configuration du serveur');
      }

      if (userData && token) {
        console.log('[LOGIN_FORM] Connexion réussie pour:', userData.username);
        toast.success(t('login.success.loginSuccess'));
        
        // Use useAuth hook for authentication
        login(userData, token);
        
        // Call optional success callback if provided
        if (onSuccess) {
          onSuccess(userData, token);
        }
      } else {
        throw new Error('Données utilisateur ou token manquantes');
      }
    } catch (error) {
      console.error('[LOGIN_FORM] Erreur login:', error);
      toast.error(error instanceof Error ? error.message : t('login.errors.loginFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="login-form-username">{t('login.usernameLabel')}</Label>
        <Input
          id="login-form-username"
          type="text"
          placeholder={t('login.usernamePlaceholder')}
          value={formData.username}
          onChange={(e) => setFormData({ ...formData, username: e.target.value })}
          disabled={isLoading}
          required
        />
        <p className="text-xs text-gray-500">
          {t('login.usernameHelp')}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="login-form-password">{t('login.passwordLabel')}</Label>
        <Input
          id="login-form-password"
          type="password"
          placeholder={t('login.passwordPlaceholder')}
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          disabled={isLoading}
          required
        />
        <p className="text-xs text-gray-500">
          {t('login.passwordHelp')}
        </p>
      </div>

      <Button 
        type="submit" 
        className="w-full" 
        disabled={isLoading}
      >
        {isLoading ? t('login.loggingIn') : t('login.loginButton')}
      </Button>
      
      {/* Liens de navigation */}
      <div className="mt-4 text-center text-sm text-gray-600 dark:text-gray-400">
        <span>Vous n'avez pas de compte ? </span>
        <a 
          href="/signin" 
          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium underline"
        >
          S'inscrire
        </a>
      </div>
    </form>
  );
}
