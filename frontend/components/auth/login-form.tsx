'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';
import { User } from '@/types';
import { buildApiUrl, API_ENDPOINTS } from '@/lib/config';
import { useTranslations } from '@/hooks/useTranslations';

interface LoginFormProps {
  onSuccess?: (user: User, token: string) => void; // Optional callback for custom behavior
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const { login } = useAuth();
  const t = useTranslations('login');
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.username.trim() || !formData.password.trim()) {
      toast.error(t('validation.required'));
      return;
    }

    setIsLoading(true);
    try {
      console.log('[LOGIN_FORM] Tentative de connexion pour:', formData.username);
      
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
        throw new Error('Format de réponse invalide');
      }

      if (userData && token) {
        console.log('[LOGIN_FORM] Connexion réussie pour:', userData.username);
        toast.success(t('success.loginSuccess'));
        
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
      toast.error(error instanceof Error ? error.message : t('errors.loginFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="username">{t('usernameLabel')}</Label>
        <Input
          id="username"
          type="text"
          placeholder={t('usernamePlaceholder')}
          value={formData.username}
          onChange={(e) => setFormData({ ...formData, username: e.target.value })}
          disabled={isLoading}
          required
        />
        <p className="text-xs text-gray-500">
          {t('usernameHelp')}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">{t('passwordLabel')}</Label>
        <Input
          id="password"
          type="password"
          placeholder={t('passwordPlaceholder')}
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          disabled={isLoading}
          required
        />
        <p className="text-xs text-gray-500">
          {t('passwordHelp')}
        </p>
      </div>

      <Button 
        type="submit" 
        className="w-full" 
        disabled={isLoading}
      >
        {isLoading ? t('loggingIn') : t('loginButton')}
      </Button>
    </form>
  );
}
