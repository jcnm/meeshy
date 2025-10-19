'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';
import { User, SUPPORTED_LANGUAGES } from '@/types';
import { JoinConversationResponse } from '@/types/frontend';
import { buildApiUrl, API_ENDPOINTS } from '@/lib/config';
import { useI18n } from '@/hooks/useI18n';

interface RegisterFormProps {
  onSuccess?: (user: User, token: string) => void; // Optional callback for custom behavior
  disabled?: boolean; // Pour désactiver les inputs quand le modal est fermé
  linkId?: string; // Pour rejoindre une conversation via lien
  onJoinSuccess?: (userData: JoinConversationResponse) => void; // Pour les liens d'invitation
  formPrefix?: string; // Préfixe unique pour les IDs de formulaire
}

export function RegisterForm({ 
  onSuccess, 
  disabled = false, 
  linkId,
  onJoinSuccess,
  formPrefix = 'register'
}: RegisterFormProps) {
  const { login } = useAuth();
  const { t } = useI18n('auth');
  const [formData, setFormData] = useState({
    username: linkId ? '' : '', // Pas de username pour les liens, sera généré
    password: '',
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    systemLanguage: 'fr',
    regionalLanguage: 'en',
  });
  const [isLoading, setIsLoading] = useState(false);

  const validateUsername = (username: string) => {
    // Validation: uniquement lettres, chiffres, tirets et underscores
    const usernameRegex = /^[a-zA-Z0-9_-]+$/;
    return usernameRegex.test(username);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation différente selon le mode
    if (linkId) {
      // Mode lien d'invitation - pas de username requis
      if (!formData.firstName.trim() || !formData.lastName.trim() || 
          !formData.email.trim() || !formData.password.trim()) {
        toast.error('Veuillez remplir tous les champs obligatoires');
        return;
      }
    } else {
      // Mode inscription normale - username requis
      if (!formData.username.trim() || !formData.password.trim() || 
          !formData.firstName.trim() || !formData.lastName.trim() || 
          !formData.email.trim()) {
        toast.error(t('register.fillRequiredFields'));
        return;
      }
      
      // Validation du nom d'utilisateur
      if (!validateUsername(formData.username)) {
        toast.error(t('register.validation.usernameInvalid'));
        return;
      }
    }

    setIsLoading(true);
    try {
      // Générer un username sécurisé à partir de l'email en mode lien (uniquement lettres, chiffres, tirets et underscores)
      const emailUsername = formData.email.split('@')[0];
      const cleanUsername = emailUsername.replace(/[^a-zA-Z0-9_-]/g, '_');
      
      const requestBody = linkId ? {
        // Mode lien d'invitation
        username: cleanUsername,
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        password: formData.password,
        phoneNumber: formData.phoneNumber,
        systemLanguage: formData.systemLanguage,
        regionalLanguage: formData.regionalLanguage,
      } : {
        // Mode inscription normale
        ...formData
      };

      const response = await fetch(buildApiUrl(API_ENDPOINTS.AUTH.REGISTER), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Registration failed');
      }

      const data = await response.json();
      
      if (linkId && onJoinSuccess) {
        // Mode lien d'invitation
        toast.success('Compte créé avec succès !');
        onJoinSuccess(data);
      } else {
        // Mode inscription normale
        if (data.success && data.data?.user && data.data?.token) {
          toast.success(`${t('register.success.welcome', { name: formData.firstName })} ${formData.firstName}!`);
          login(data.data.user, data.data.token);
          
          if (onSuccess) {
            onSuccess(data.data.user, data.data.token);
          }
        } else {
          throw new Error('Invalid response data');
        }
      }
    } catch (error) {
      console.error('Registration error:', error);
      const errorMessage = linkId 
        ? 'Erreur lors de la création du compte' 
        : t('register.errors.registrationError');
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor={`${formPrefix}-firstName`}>{t('register.firstNameLabel')}</Label>
          <Input
            id={`${formPrefix}-firstName`}
            type="text"
            placeholder={t('register.firstNamePlaceholder')}
            value={formData.firstName}
            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
            disabled={isLoading || disabled}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${formPrefix}-lastName`}>{t('register.lastNameLabel')}</Label>
          <Input
            id={`${formPrefix}-lastName`}
            type="text"
            placeholder={t('register.lastNamePlaceholder')}
            value={formData.lastName}
            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
            disabled={isLoading || disabled}
            required
          />
        </div>
      </div>

      {/* Champ username - seulement en mode inscription normale */}
      {!linkId && (
        <div className="space-y-2">
          <Label htmlFor={`${formPrefix}-username`}>{t('register.usernameLabel')}</Label>
          <Input
            id={`${formPrefix}-username`}
            type="text"
            placeholder={t('register.usernamePlaceholder')}
            value={formData.username}
            onChange={(e) => {
              // Filtrer les caractères non autorisés en temps réel
              const value = e.target.value.replace(/[^a-zA-Z0-9_-]/g, '');
              setFormData({ ...formData, username: value });
            }}
            disabled={isLoading || disabled}
            required
          />
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t('register.usernameHelp')}
          </p>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor={`${formPrefix}-email`}>{t('register.emailLabel')}</Label>
        <Input
          id={`${formPrefix}-email`}
          type="email"
          placeholder={t('register.emailPlaceholder')}
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          disabled={isLoading || disabled}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${formPrefix}-phoneNumber`}>{t('register.phoneLabel')}</Label>
        <Input
          id={`${formPrefix}-phoneNumber`}
          type="tel"
          placeholder={t('register.phonePlaceholder')}
          value={formData.phoneNumber}
          onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
          disabled={isLoading || disabled}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${formPrefix}-password`}>{t('register.passwordLabel')}</Label>
        <Input
          id={`${formPrefix}-password`}
          type="password"
          placeholder={t('register.passwordPlaceholder')}
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          disabled={isLoading || disabled}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="systemLanguage">{t('register.systemLanguageLabel')}</Label>
          <Select 
            value={formData.systemLanguage} 
            onValueChange={(value) => setFormData({ ...formData, systemLanguage: value })}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('register.systemLanguageLabel')} />
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_LANGUAGES.filter(lang => lang.code !== 'auto').map((lang) => (
                <SelectItem key={lang.code} value={lang.code}>
                  {lang.flag} {lang.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {t('register.systemLanguageHelp')}
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="regionalLanguage">{t('register.regionalLanguageLabel')}</Label>
          <Select 
            value={formData.regionalLanguage} 
            onValueChange={(value) => setFormData({ ...formData, regionalLanguage: value })}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('register.regionalLanguageLabel')} />
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_LANGUAGES.filter(lang => lang.code !== 'auto').map((lang) => (
                <SelectItem key={lang.code} value={lang.code}>
                  {lang.flag} {lang.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {t('register.regionalLanguageHelp')}
          </p>
        </div>
      </div>

      <Button 
        type="submit" 
        className="w-full" 
        disabled={isLoading || disabled}
      >
        {isLoading ? t('register.creating') : t('register.registerButton')}
      </Button>
    </form>
  );
}
