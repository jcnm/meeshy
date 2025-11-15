'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { MessageSquare, UserPlus, Mail, Phone, Globe, User, Lock, X } from 'lucide-react';
// Pas d'import useAuth - la page signin ne doit pas être protégée
import { useI18n } from '@/hooks/useI18n';
import { SUPPORTED_LANGUAGES } from '@/types';
import { buildApiUrl, API_ENDPOINTS } from '@/lib/config';
import { LargeLogo } from '@/components/branding';
import { authManager } from '@/services/auth-manager.service';

function SigninPageContent({ affiliateToken: propAffiliateToken }: { affiliateToken?: string } = {}) {
  const [currentStep, setCurrentStep] = useState(1);
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
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [affiliateData, setAffiliateData] = useState<{
    isValid: boolean;
    token: any;
    affiliateUser: any;
  } | null>(null);
  const [isValidatingAffiliate, setIsValidatingAffiliate] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [emailAvailable, setEmailAvailable] = useState<boolean | null>(null);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  // Pas d'utilisation de useAuth - gestion manuelle de l'authentification
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n('auth');

  // Récupérer l'URL de retour depuis les paramètres de recherche
  const returnUrl = searchParams.get('returnUrl');
  const urlAffiliateToken = searchParams.get('affiliate');

  // Récupérer le token d'affiliation depuis localStorage (sauvegardé par le middleware)
  const [affiliateToken, setAffiliateToken] = useState<string | null>(null);

  // CORRECTION MAJEURE: Vérifier si une session active existe au montage
  useEffect(() => {
    const checkExistingSession = async () => {
      try {
        setIsCheckingSession(true);

        // Vérifier si un token d'authentification existe
        const authToken = authManager.getAuthToken();
        const anonymousSession = authManager.getAnonymousSession();

        if (authToken || (anonymousSession && anonymousSession.token)) {

          // Vérifier que la session est valide côté backend
          const response = await fetch(buildApiUrl('/auth/me'), {
            headers: {
              'Authorization': `Bearer ${authToken || anonymousSession?.token}`
            }
          });

          if (response.ok) {
            // CORRECTION MAJEURE: Redirection intelligente selon le type d'utilisateur
            // Pour les utilisateurs anonymes : rediriger vers leur conversation
            // Pour les membres : rediriger vers / ou returnUrl
            if (anonymousSession) {
              // Utilisateur anonyme - rediriger vers la conversation du lien utilisé
              const shareLinkId = localStorage.getItem('anonymous_current_share_link') ||
                                 localStorage.getItem('anonymous_current_link_id');

              if (shareLinkId) {
                window.location.href = `/chat/${shareLinkId}`;
                return;
              }
            }

            // Session valide (utilisateur membre), rediriger vers la page d'accueil
            window.location.href = returnUrl || '/dashboard';
            return;
          } else {
            // Session invalide, nettoyer toutes les données
            authManager.clearAllSessions();
          }
        }
      } catch (error) {
        console.error('[SIGNIN_PAGE] Erreur vérification session:', error);
        // En cas d'erreur, nettoyer par sécurité
        authManager.clearAllSessions();
      } finally {
        setIsCheckingSession(false);
      }
    };

    checkExistingSession();
  }, []); // Exécuter une seule fois au montage

  // Charger le token d'affiliation depuis localStorage ou URL au chargement
  useEffect(() => {
    // Priorité 1: paramètre URL (si présent, le sauvegarder)
    if (urlAffiliateToken) {
      localStorage.setItem('meeshy_affiliate_token', urlAffiliateToken);
      document.cookie = `meeshy_affiliate_token=${urlAffiliateToken}; max-age=${30 * 24 * 60 * 60}; path=/; samesite=lax`;
      setAffiliateToken(urlAffiliateToken);
      validateAffiliateToken(urlAffiliateToken);
      return;
    }
    
    // Priorité 2: localStorage
    const storedToken = localStorage.getItem('meeshy_affiliate_token');
    if (storedToken) {
      setAffiliateToken(storedToken);
      validateAffiliateToken(storedToken);
    }
  }, [urlAffiliateToken]);

  const validateAffiliateToken = async (token: string) => {
    try {
      setIsValidatingAffiliate(true);
      const response = await fetch(buildApiUrl(`/affiliate/validate/${token}`));
      
      if (response.ok) {
        const data = await response.json();
        setAffiliateData(data.data);
      } else {
        console.error('Erreur validation token affiliation');
        setAffiliateData({ isValid: false, token: null, affiliateUser: null });
      }
    } catch (error) {
      console.error('Erreur validation token:', error);
      setAffiliateData({ isValid: false, token: null, affiliateUser: null });
    } finally {
      setIsValidatingAffiliate(false);
    }
  };

  const validateUsername = (username: string) => {
    // Validation: longueur minimale de 4 caractères
    if (username.length < 4) {
      return false;
    }
    // Validation: uniquement lettres, chiffres, tirets et underscores
    const usernameRegex = /^[a-zA-Z0-9_-]+$/;
    return usernameRegex.test(username);
  };

  const checkUsernameAvailability = async (username: string) => {
    if (!username || username.length < 4) {
      setUsernameAvailable(null);
      return;
    }

    setIsCheckingUsername(true);
    try {
      const response = await fetch(buildApiUrl(`/auth/check-availability?username=${encodeURIComponent(username)}`));
      if (response.ok) {
        const data = await response.json();
        setUsernameAvailable(data.data.usernameAvailable);
      } else {
        setUsernameAvailable(null);
      }
    } catch (error) {
      console.error('Erreur vérification username:', error);
      setUsernameAvailable(null);
    } finally {
      setIsCheckingUsername(false);
    }
  };

  const checkEmailAvailability = async (email: string) => {
    if (!email || !email.includes('@')) {
      setEmailAvailable(null);
      return;
    }

    setIsCheckingEmail(true);
    try {
      const response = await fetch(buildApiUrl(`/auth/check-availability?email=${encodeURIComponent(email)}`));
      if (response.ok) {
        const data = await response.json();
        setEmailAvailable(data.data.emailAvailable);
      } else {
        setEmailAvailable(null);
      }
    } catch (error) {
      console.error('Erreur vérification email:', error);
      setEmailAvailable(null);
    } finally {
      setIsCheckingEmail(false);
    }
  };

  // Debounce pour vérifier le username en temps réel
  useEffect(() => {
    // Réinitialiser l'état si le champ est vide
    if (!formData.username || formData.username.length < 4) {
      setUsernameAvailable(null);
      return;
    }

    // Vérifier le format avant de faire la requête
    if (!validateUsername(formData.username)) {
      setUsernameAvailable(null);
      return;
    }

    // Debounce de 300ms pour éviter trop de requêtes
    const timer = setTimeout(() => {
      checkUsernameAvailability(formData.username);
    }, 300);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.username]);

  // Debounce pour vérifier l'email en temps réel
  useEffect(() => {
    // Réinitialiser l'état si le champ est vide
    if (!formData.email || !formData.email.includes('@')) {
      setEmailAvailable(null);
      return;
    }

    // Debounce de 300ms pour éviter trop de requêtes
    const timer = setTimeout(() => {
      checkEmailAvailability(formData.email);
    }, 300);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.email]);

  const handleNextStep = () => {
    // Validation de l'étape 1
    if (currentStep === 1) {
      if (!formData.username.trim() || !formData.email.trim() || !formData.password.trim() || !confirmPassword.trim()) {
        toast.error(t('register.fillRequiredFields'));
        return;
      }

      // Validation du nom d'utilisateur
      if (!validateUsername(formData.username)) {
        toast.error(t('register.validation.usernameInvalid'));
        return;
      }

      // Vérifier disponibilité du username
      if (usernameAvailable === false) {
        toast.error(t('register.errors.usernameExists'));
        return;
      }

      // Vérifier disponibilité de l'email
      if (emailAvailable === false) {
        toast.error(t('register.errors.emailExists'));
        return;
      }

      if (formData.password !== confirmPassword) {
        toast.error(t('register.validation.passwordMismatch'));
        return;
      }
    }

    setCurrentStep(2);
  };

  const handlePreviousStep = () => {
    setCurrentStep(1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation des champs obligatoires de l'étape 2
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      toast.error(t('register.fillRequiredFields'));
      return;
    }

    // Validation de l'acceptation des conditions
    if (!acceptTerms) {
      toast.error(t('register.errors.acceptTermsRequired'));
      return;
    }

    setIsLoading(true);
    console.log('[SIGNIN_PAGE] Tentative d\'inscription pour:', formData.username);

    try {
      const apiUrl = buildApiUrl(API_ENDPOINTS.AUTH.REGISTER);
      console.log('[SIGNIN_PAGE] URL API:', apiUrl);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      console.log('[SIGNIN_PAGE] Réponse HTTP:', response.status, response.statusText);

      // Gérer les erreurs HTTP avec messages spécifiques
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        let errorMessage = errorData.error || t('register.errors.registrationError');

        if (response.status === 400) {
          // Erreur de validation ou données existantes
          if (errorData.error) {
            if (errorData.error.includes('email') || errorData.error.includes('Email')) {
              errorMessage = t('register.errors.emailExists');
            } else if (errorData.error.includes('username') || errorData.error.includes('utilisateur')) {
              errorMessage = t('register.errors.usernameExists');
            } else if (errorData.error.includes('phone') || errorData.error.includes('téléphone')) {
              errorMessage = t('register.errors.phoneExists');
            } else {
              errorMessage = t('register.errors.invalidData');
            }
          }
          console.error('[SIGNIN_PAGE] Échec 400: Données invalides -', errorData.error);
        } else if (response.status === 500) {
          errorMessage = t('register.errors.serverError');
          console.error('[SIGNIN_PAGE] Échec 500: Erreur serveur');
        } else if (response.status >= 400) {
          errorMessage = t('register.errors.unknownError');
          console.error('[SIGNIN_PAGE] Échec', response.status, ':', response.statusText, errorData);
        }

        toast.error(errorMessage);
        setIsLoading(false);
        return;
      }

      const data = await response.json();
      console.log('[SIGNIN_PAGE] Données reçues:', { success: data.success, hasToken: !!data.data?.token, hasUser: !!data.data?.user });

      if (data.success && data.data?.user && data.data?.token) {
        console.log('[SIGNIN_PAGE] ✅ Inscription réussie pour:', data.data.user.username);

        // Stocker les données d'authentification via authManager (source unique)
        authManager.setCredentials(data.data.user, data.data.token);

        // Gérer l'affiliation si un token est présent
        if (affiliateToken) {
          try {
            await fetch(buildApiUrl('/affiliate/register'), {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                token: affiliateToken,
                referredUserId: data.data.user.id
              })
            });

            // Nettoyer le token d'affiliation après utilisation
            localStorage.removeItem('meeshy_affiliate_token');
            // Supprimer également le cookie
            document.cookie = 'meeshy_affiliate_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
          } catch (affiliateError) {
            console.error('[SIGNIN_PAGE] Erreur enregistrement affiliation:', affiliateError);
            // Ne pas bloquer l'inscription si l'affiliation échoue
          }
        }

        // Toast de succès
        toast.success(t('register.success.registrationSuccess'));

        // Redirection
        const redirectUrl = returnUrl || '/dashboard';
        console.log('[SIGNIN_PAGE] Redirection vers:', redirectUrl);
        window.location.href = redirectUrl;
      } else {
        const errorMsg = t('register.errors.registrationError');
        console.error('[SIGNIN_PAGE] ❌ Réponse invalide:', data);
        toast.error(errorMsg);
        setIsLoading(false);
      }
    } catch (error) {
      console.error('[SIGNIN_PAGE] ❌ Erreur réseau ou exception:', error);
      const errorMsg = error instanceof Error
        ? `${t('register.errors.networkError')}: ${error.message}`
        : t('register.errors.networkError');
      toast.error(errorMsg);
      setIsLoading(false);
    }
  };


  // Afficher un écran de chargement pendant la vérification de session
  if (isCheckingSession) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <LargeLogo href="/" />
          <p className="text-gray-600 dark:text-gray-400">{t('register.checkingSession') || 'Vérification de session...'}</p>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-6">
        {/* Header */}
        <div className="text-center">
          <LargeLogo href="/" />
          <p className="text-gray-600 dark:text-gray-400 text-lg">{t('register.description')}</p>
        </div>

        {/* Formulaire d'inscription en 2 étapes */}
        <Card className="shadow-xl border-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
          <CardHeader className="text-center pb-6">
            <CardTitle className="flex items-center justify-center space-x-2 text-2xl">
              <UserPlus className="h-6 w-6 text-blue-600" />
              <span>{t('register.title')}</span>
            </CardTitle>
            <CardDescription className="text-base">
              {t('register.formDescription')}
            </CardDescription>
            
            {/* Indicateur de progression */}
            <div className="flex justify-center mt-4">
              <div className="flex space-x-2">
                <div className={`w-3 h-3 rounded-full ${currentStep >= 1 ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
                <div className={`w-3 h-3 rounded-full ${currentStep >= 2 ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
              {currentStep === 1 ? (
                // ÉTAPE 1: Informations de compte (pseudo, email, mot de passe répété)
                <div className="space-y-4">
                  {/* Nom d'utilisateur (Pseudonyme) */}
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <User className="h-4 w-4 text-blue-600" />
                      <Label htmlFor="username" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {t('register.usernameLabel')}
                      </Label>
                    </div>
                    <Input
                      id="username whisper"
                      type="text"
                      value={formData.username}
                      onChange={(e) => {
                        // Filtrer les caractères non autorisés en temps réel
                        const value = e.target.value.replace(/[^a-zA-Z0-9_-]/g, '');
                        setFormData({ ...formData, username: value });
                      }}
                      placeholder={t('register.usernamePlaceholder')}
                      disabled={isLoading}
                      required
                      className="h-10"
                    />
                    {isCheckingUsername ? (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {t('register.validation.checking')}
                      </p>
                    ) : usernameAvailable === false ? (
                      <p className="text-xs text-red-600 mt-1">
                        ❌ {t('register.errors.usernameExists')}
                      </p>
                    ) : usernameAvailable === true ? (
                      <p className="text-xs text-green-600 mt-1">
                        ✓ {t('register.validation.usernameAvailable')}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {t('register.usernameHelp')}
                      </p>
                    )}
                  </div>

                  {/* Email */}
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Mail className="h-4 w-4 text-blue-600" />
                      <Label htmlFor="email" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {t('register.emailLabel')}
                      </Label>
                    </div>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder={t('register.emailPlaceholder')}
                      disabled={isLoading}
                      required
                      className="h-10"
                    />
                    {isCheckingEmail ? (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {t('register.validation.checking')}
                      </p>
                    ) : emailAvailable === false ? (
                      <p className="text-xs text-red-600 mt-1">
                        ❌ {t('register.errors.emailExists')}
                      </p>
                    ) : emailAvailable === true ? (
                      <p className="text-xs text-green-600 mt-1">
                        ✓ {t('register.validation.emailAvailable')}
                      </p>
                    ) : null}
                  </div>

                  {/* Mot de passe et confirmation */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Lock className="h-4 w-4 text-blue-600" />
                        <Label htmlFor="password" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {t('register.passwordLabel')}
                        </Label>
                      </div>
                      <Input
                        id="password"
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        placeholder={t('register.passwordPlaceholder')}
                        disabled={isLoading}
                        required
                        className="h-10"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {t('register.passwordHelp')}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Lock className="h-4 w-4 text-blue-600" />
                        <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {t('register.confirmPasswordLabel')}
                        </Label>
                      </div>
                      <Input
                        id="confirmPassword"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder={t('register.confirmPasswordPlaceholder')}
                        disabled={isLoading}
                        required
                        className="h-10"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {t('register.confirmPasswordHelp')}
                      </p>
                    </div>
                  </div>

                  {/* Bouton suivant */}
                  <Button 
                    type="button"
                    onClick={handleNextStep}
                    className="w-full h-11 font-semibold shadow-lg hover:shadow-xl transition-all duration-300 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white"
                  >
                    {t('register.continueButton')}
                  </Button>
                </div>
              ) : (
                // ÉTAPE 2: Nom, Prénom, Téléphone, validation des politiques, Préférences de langue
                <div className="space-y-4">
                  {/* Nom et Prénom */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <User className="h-4 w-4 text-blue-600" />
                        <Label htmlFor="firstName" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {t('register.firstNameLabel')}
                        </Label>
                      </div>
                      <Input
                        id="firstName"
                        type="text"
                        value={formData.firstName}
                        onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                        placeholder={t('register.firstNamePlaceholder')}
                        disabled={isLoading}
                        required
                        className="h-10"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <User className="h-4 w-4 text-blue-600" />
                        <Label htmlFor="lastName" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {t('register.lastNameLabel')}
                        </Label>
                      </div>
                      <Input
                        id="lastName"
                        type="text"
                        value={formData.lastName}
                        onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                        placeholder={t('register.lastNamePlaceholder')}
                        disabled={isLoading}
                        required
                        className="h-10"
                      />
                    </div>
                  </div>

                  {/* Téléphone */}
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Phone className="h-4 w-4 text-blue-600" />
                      <Label htmlFor="phoneNumber" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {t('register.phoneLabel')}
                      </Label>
                    </div>
                    <Input
                      id="phoneNumber"
                      type="tel"
                      value={formData.phoneNumber}
                      onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                      placeholder={t('register.phonePlaceholder')}
                      disabled={isLoading}
                      className="h-10"
                    />
                  </div>

                  {/* Préférences de langue */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Globe className="h-4 w-4 text-blue-600" />
                        <Label htmlFor="systemLanguage" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {t('register.systemLanguageLabel')}
                        </Label>
                      </div>
                      <Select 
                        value={formData.systemLanguage} 
                        onValueChange={(value) => setFormData({ ...formData, systemLanguage: value })}
                        disabled={isLoading}
                      >
                        <SelectTrigger className="h-10">
                          <SelectValue placeholder={t('register.systemLanguageLabel')} />
                        </SelectTrigger>
                        <SelectContent>
                          {SUPPORTED_LANGUAGES.map((lang) => (
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
                      <div className="flex items-center space-x-2">
                        <Globe className="h-4 w-4 text-blue-600" />
                        <Label htmlFor="regionalLanguage" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {t('register.regionalLanguageLabel')}
                        </Label>
                      </div>
                      <Select 
                        value={formData.regionalLanguage} 
                        onValueChange={(value) => setFormData({ ...formData, regionalLanguage: value })}
                        disabled={isLoading}
                      >
                        <SelectTrigger className="h-10">
                          <SelectValue placeholder={t('register.regionalLanguageLabel')} />
                        </SelectTrigger>
                        <SelectContent>
                          {SUPPORTED_LANGUAGES.map((lang) => (
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

                  {/* Case d'acceptation des politiques - EN DERNIER */}
                  <div className="flex items-start space-x-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border">
                    <Checkbox
                      id="acceptTerms"
                      checked={acceptTerms}
                      onCheckedChange={(checked) => setAcceptTerms(checked as boolean)}
                      disabled={isLoading}
                      className="mt-1"
                    />
                    <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                      <label htmlFor="acceptTerms" className="cursor-pointer">
                        {t('register.acceptTerms')}{' '}
                        <a
                          href="/terms"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-700 underline font-medium"
                        >
                          {t('register.termsOfService')}
                        </a>{' '}
                        {t('register.and')}{' '}
                        <a
                          href="/policy"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-700 underline font-medium"
                        >
                          {t('register.privacyPolicy')}
                        </a>
                        .{' '}
                        <a
                          href="/contact"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-700 underline font-medium"
                        >
                          {t('register.contactUs')}
                        </a>
                      </label>
                    </div>
                  </div>

                  {/* Boutons de navigation */}
                  <div className="flex space-x-3">
                    <Button 
                      type="button"
                      variant="outline"
                      onClick={handlePreviousStep}
                      className="flex-1 h-11 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                    >
                      {t('register.previousButton')}
                    </Button>
                    <Button 
                      type="submit" 
                      className="flex-1 h-11 font-semibold shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white" 
                      disabled={isLoading || !acceptTerms}
                    >
                      {isLoading ? (
                        <div className="flex items-center space-x-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          <span>{t('register.creating')}</span>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <UserPlus className="h-4 w-4" />
                          <span>{t('register.registerButton')}</span>
                        </div>
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* Lien vers la connexion */}
              <div className="text-center pt-4">
                <p className="text-gray-600 dark:text-gray-400">
                  {t('register.hasAccount')}{' '}
                  <button
                    type="button"
                    onClick={() => router.push('/login' + (returnUrl ? `?returnUrl=${encodeURIComponent(returnUrl)}` : ''))}
                    className="text-blue-600 hover:text-blue-700 font-medium underline transition-colors"
                  >
                    {t('register.loginLink')}
                  </button>
                </p>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Export nommé pour réutilisation dans les pages d'affiliation
export { SigninPageContent };

export default function SigninPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-4">
            <LargeLogo href="/" />
            <p className="text-gray-600 dark:text-gray-400">Loading...</p>
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          </div>
        </div>
      </div>
    }>
      <SigninPageContent />
    </Suspense>
  );
}