'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LanguageSelector } from '@/components/translation/language-selector';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';
import { User } from '@/types';
import { JoinConversationResponse } from '@/types/frontend';
import { buildApiUrl, API_ENDPOINTS } from '@/lib/config';
import { useI18n } from '@/hooks/useI18n';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  const router = useRouter();
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

  // État pour la validation du username
  const [usernameCheckStatus, setUsernameCheckStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const usernameCheckTimeout = useRef<NodeJS.Timeout | null>(null);

  const validateUsername = (username: string) => {
    // Validation: longueur minimale de 4 caractères
    if (username.length < 4) {
      return false;
    }
    // Validation: uniquement lettres, chiffres, tirets et underscores
    const usernameRegex = /^[a-zA-Z0-9_-]+$/;
    return usernameRegex.test(username);
  };

  // Vérification de disponibilité du username avec debounce
  useEffect(() => {
    // Ne pas vérifier si on est en mode lien ou si le formulaire est désactivé
    if (linkId || disabled) {
      return;
    }

    // Clear le timeout précédent
    if (usernameCheckTimeout.current) {
      clearTimeout(usernameCheckTimeout.current);
    }

    // Si le username est vide ou invalide, reset le statut
    if (!formData.username.trim() || !validateUsername(formData.username)) {
      setUsernameCheckStatus('idle');
      return;
    }

    // Indiquer qu'on est en train de vérifier
    setUsernameCheckStatus('checking');

    // Debounce: attendre 500ms avant de lancer la vérification
    usernameCheckTimeout.current = setTimeout(async () => {
      try {
        const response = await fetch(
          buildApiUrl(`/users/check-username/${encodeURIComponent(formData.username.trim())}`)
        );

        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            setUsernameCheckStatus(result.available ? 'available' : 'taken');
          } else {
            setUsernameCheckStatus('idle');
          }
        } else {
          setUsernameCheckStatus('idle');
        }
      } catch (error) {
        console.error('Erreur vérification username:', error);
        setUsernameCheckStatus('idle');
      }
    }, 500);

    // Cleanup
    return () => {
      if (usernameCheckTimeout.current) {
        clearTimeout(usernameCheckTimeout.current);
      }
    };
  }, [formData.username, linkId, disabled]);

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
          } else {
            // Comportement par défaut : Recharger la page si on est sur "/" sinon rediriger
            const currentPath = window.location.pathname;
            
            // Petit délai pour permettre à l'état d'être mis à jour
            setTimeout(() => {
              if (currentPath === '/') {
                // Sur la page d'accueil, recharger la page pour afficher la conversation meeshy
                window.location.reload();
              } else {
                // Sur les autres pages, redirection normale vers le dashboard
                router.push('/dashboard');
              }
            }, 100);
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
    <form onSubmit={handleSubmit} className="flex flex-col" autoComplete="off">
      {/* Contenu des champs */}
      <div className="space-y-4 py-4">
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
          <div className="relative">
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
              className={cn(
                "pr-10",
                usernameCheckStatus === 'available' && "border-green-500 focus-visible:ring-green-500",
                usernameCheckStatus === 'taken' && "border-red-500 focus-visible:ring-red-500"
              )}
              disabled={isLoading || disabled}
              required
            />
            {/* Indicateur de statut */}
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {usernameCheckStatus === 'checking' && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
              )}
              {usernameCheckStatus === 'available' && (
                <div className="flex items-center justify-center h-5 w-5 rounded-full bg-green-500">
                  <Check className="h-3 w-3 text-white" />
                </div>
              )}
              {usernameCheckStatus === 'taken' && (
                <div className="flex items-center justify-center h-5 w-5 rounded-full bg-red-500">
                  <X className="h-3 w-3 text-white" />
                </div>
              )}
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t('register.usernameHelp')}
          </p>
          {usernameCheckStatus === 'available' && (
            <p className="text-xs text-green-600 flex items-center gap-1">
              <Check className="h-3 w-3" />
              Nom d'utilisateur disponible
            </p>
          )}
          {usernameCheckStatus === 'taken' && (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <X className="h-3 w-3" />
              Ce nom d'utilisateur est déjà pris
            </p>
          )}
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
          <LanguageSelector
            value={formData.systemLanguage}
            onValueChange={(value) => setFormData({ ...formData, systemLanguage: value })}
            disabled={disabled}
            placeholder={t('register.systemLanguageLabel')}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {t('register.systemLanguageHelp')}
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="regionalLanguage">{t('register.regionalLanguageLabel')}</Label>
          <LanguageSelector
            value={formData.regionalLanguage}
            onValueChange={(value) => setFormData({ ...formData, regionalLanguage: value })}
            disabled={disabled}
            placeholder={t('register.regionalLanguageLabel')}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {t('register.regionalLanguageHelp')}
          </p>
        </div>
      </div>

      {/* Bouton submit - avec padding bottom pour qu'il soit toujours visible */}
      <div className="sticky bottom-0 bg-white dark:bg-gray-950 pt-4 pb-6 mt-4 border-t">
        <Button 
          type="submit" 
          className="w-full" 
          disabled={isLoading || disabled}
        >
          {isLoading ? t('register.creating') : t('register.registerButton')}
        </Button>
        
        {/* Liens de navigation */}
        <div className="mt-4 text-center text-sm text-gray-600 dark:text-gray-400">
          <span>{t('register.hasAccount')} </span>
          <a 
            href="/login" 
            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium underline"
          >
            {t('register.loginLink')}
          </a> -  <a 
            href="/signin" 
            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium underline"
          >
            {t('login.registerLink')}
          </a>
        </div>
      </div>
      </div>
    </form>
  );
}
