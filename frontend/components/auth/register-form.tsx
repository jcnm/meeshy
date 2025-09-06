'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';
import { User, SUPPORTED_LANGUAGES } from '@/types';
import { buildApiUrl, API_ENDPOINTS } from '@/lib/config';
import { useTranslations } from '@/hooks/useTranslations';

interface RegisterFormProps {
  onSuccess?: (user: User, token: string) => void; // Optional callback for custom behavior
  disabled?: boolean; // Pour désactiver les inputs quand le modal est fermé
}

export function RegisterForm({ onSuccess, disabled = false }: RegisterFormProps) {
  const { login } = useAuth();
  const t = useTranslations('register');
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    systemLanguage: 'fr',
    regionalLanguage: 'en',
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.username.trim() || !formData.password.trim() || 
        !formData.firstName.trim() || !formData.lastName.trim() || 
        !formData.email.trim()) {
      toast.error(t('fillRequiredFields'));
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(buildApiUrl(API_ENDPOINTS.AUTH.REGISTER), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (response.ok && result.success && result.data?.user && result.data?.token) {
        toast.success(`${t('success.welcome')} ${formData.firstName}!`);
        
        // Use useAuth hook for authentication
        login(result.data.user, result.data.token);
        
        // Call optional success callback if provided
        if (onSuccess) {
          onSuccess(result.data.user, result.data.token);
        }
      } else {
        toast.error(result.message || t('accountCreationError'));
      }
    } catch (error) {
      console.error('Erreur register:', error);
      toast.error(t('errors.loginFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="firstName">{t('firstNameLabel')}</Label>
          <Input
            id="firstName"
            type="text"
            placeholder={t('firstNamePlaceholder')}
            value={formData.firstName}
            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
            disabled={isLoading || disabled}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">{t('lastNameLabel')}</Label>
          <Input
            id="lastName"
            type="text"
            placeholder={t('lastNamePlaceholder')}
            value={formData.lastName}
            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
            disabled={isLoading || disabled}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="username">{t('usernameLabel')}</Label>
        <Input
          id="username"
          type="text"
          placeholder={t('usernamePlaceholder')}
          value={formData.username}
          onChange={(e) => setFormData({ ...formData, username: e.target.value })}
          disabled={isLoading || disabled}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">{t('emailLabel')}</Label>
        <Input
          id="email"
          type="email"
          placeholder={t('emailPlaceholder')}
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          disabled={isLoading || disabled}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phoneNumber">{t('phoneLabel')}</Label>
        <Input
          id="phoneNumber"
          type="tel"
          placeholder={t('phonePlaceholder')}
          value={formData.phoneNumber}
          onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
          disabled={isLoading || disabled}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">{t('passwordLabel')}</Label>
        <Input
          id="password"
          type="password"
          placeholder={t('passwordPlaceholder')}
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          disabled={isLoading || disabled}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="systemLanguage">{t('systemLanguageLabel')}</Label>
          <Select 
            value={formData.systemLanguage} 
            onValueChange={(value) => setFormData({ ...formData, systemLanguage: value })}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('systemLanguageLabel')} />
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_LANGUAGES.map((lang) => (
                <SelectItem key={lang.code} value={lang.code}>
                  {lang.flag} {lang.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="regionalLanguage">{t('regionalLanguageLabel')}</Label>
          <Select 
            value={formData.regionalLanguage} 
            onValueChange={(value) => setFormData({ ...formData, regionalLanguage: value })}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('regionalLanguageLabel')} />
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_LANGUAGES.map((lang) => (
                <SelectItem key={lang.code} value={lang.code}>
                  {lang.flag} {lang.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button 
        type="submit" 
        className="w-full" 
        disabled={isLoading || disabled}
      >
        {isLoading ? t('creating') : t('registerButton')}
      </Button>
    </form>
  );
}
