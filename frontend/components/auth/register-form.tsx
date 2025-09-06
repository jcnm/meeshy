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
import { useTranslations } from '@/hooks/useTranslations';

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
  const { t } = useTranslations('register');
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
        toast.error(t('fillRequiredFields'));
        return;
      }
    }

    setIsLoading(true);
    try {
      const requestBody = linkId ? {
        // Mode lien d'invitation
        username: formData.email.split('@')[0], // Générer username depuis email
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
          toast.success(`${t('success.welcome')} ${formData.firstName}!`);
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
        : t('registrationError');
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor={`${formPrefix}-firstName`}>{t('firstNameLabel')}</Label>
          <Input
            id={`${formPrefix}-firstName`}
            type="text"
            placeholder={t('firstNamePlaceholder')}
            value={formData.firstName}
            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
            disabled={isLoading || disabled}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${formPrefix}-lastName`}>{t('lastNameLabel')}</Label>
          <Input
            id={`${formPrefix}-lastName`}
            type="text"
            placeholder={t('lastNamePlaceholder')}
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
          <Label htmlFor={`${formPrefix}-username`}>{t('usernameLabel')}</Label>
          <Input
            id={`${formPrefix}-username`}
            type="text"
            placeholder={t('usernamePlaceholder')}
            value={formData.username}
            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
            disabled={isLoading || disabled}
            required
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor={`${formPrefix}-email`}>{t('emailLabel')}</Label>
        <Input
          id={`${formPrefix}-email`}
          type="email"
          placeholder={t('emailPlaceholder')}
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          disabled={isLoading || disabled}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${formPrefix}-phoneNumber`}>{t('phoneLabel')}</Label>
        <Input
          id={`${formPrefix}-phoneNumber`}
          type="tel"
          placeholder={t('phonePlaceholder')}
          value={formData.phoneNumber}
          onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
          disabled={isLoading || disabled}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${formPrefix}-password`}>{t('passwordLabel')}</Label>
        <Input
          id={`${formPrefix}-password`}
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
