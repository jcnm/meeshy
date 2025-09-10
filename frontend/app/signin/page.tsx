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
import { MessageSquare, UserPlus, Eye, EyeOff, Mail, Phone, Globe, User, Lock, X } from 'lucide-react';
// Pas d'import useAuth - la page signin ne doit pas être protégée
import { useTranslations } from '@/hooks/useTranslations';
import { SUPPORTED_LANGUAGES } from '@/types';
import { buildApiUrl, API_ENDPOINTS } from '@/lib/config';

function SigninPageContent() {
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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [affiliateData, setAffiliateData] = useState<{
    isValid: boolean;
    token: any;
    affiliateUser: any;
  } | null>(null);
  const [isValidatingAffiliate, setIsValidatingAffiliate] = useState(false);
  // Pas d'utilisation de useAuth - gestion manuelle de l'authentification
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslations('register');

  // Récupérer l'URL de retour et le token d'affiliation depuis les paramètres de recherche
  const returnUrl = searchParams.get('returnUrl');
  const affiliateToken = searchParams.get('affiliate');

  // Pas de vérification d'authentification - la page signin est accessible à tous

  // Valider le token d'affiliation au chargement de la page
  useEffect(() => {
    if (affiliateToken) {
      validateAffiliateToken(affiliateToken);
    }
  }, [affiliateToken]);

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

  const handleNextStep = () => {
    // Validation de l'étape 1
    if (currentStep === 1) {
      if (!formData.username.trim() || !formData.email.trim() || !formData.password.trim() || !confirmPassword.trim()) {
        toast.error(t('fillRequiredFields'));
        return;
      }
      
      if (formData.password !== confirmPassword) {
        toast.error(t('passwordsDoNotMatch'));
        return;
      }
      
      if (formData.password.length < 6) {
        toast.error(t('passwordTooShort'));
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
      toast.error(t('fillRequiredFields'));
      return;
    }

    // Validation de l'acceptation des conditions
    if (!acceptTerms) {
      toast.error(t('mustAcceptTerms'));
      return;
    }

    setIsLoading(true);
    try {
      console.log('[SIGNIN_PAGE] Tentative d\'inscription:', { username: formData.username, email: formData.email });
      
      const response = await fetch(buildApiUrl(API_ENDPOINTS.AUTH.REGISTER), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || t('registrationError'));
      }

      const data = await response.json();
      console.log('[SIGNIN_PAGE] Réponse inscription:', data);

      if (data.success && data.data?.user && data.data?.token) {
        // Stocker les données d'authentification manuellement
        localStorage.setItem('auth_token', data.data.token);
        localStorage.setItem('user_data', JSON.stringify(data.data.user));
        
        // Gérer l'affiliation si un token valide est présent
        if (affiliateToken && affiliateData?.isValid) {
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
          } catch (affiliateError) {
            console.error('Erreur enregistrement affiliation:', affiliateError);
            // Ne pas bloquer l'inscription si l'affiliation échoue
          }
        }
        
        toast.success(`${t('success.welcome')} ${formData.firstName}!`);
        
        // Redirection vers l'URL de retour ou la page d'accueil
        const redirectUrl = returnUrl || '/';
        router.replace(redirectUrl);
      } else {
        throw new Error('Invalid response data');
      }
    } catch (error) {
      console.error('[SIGNIN_PAGE] Erreur d\'inscription:', error);
      toast.error(error instanceof Error ? error.message : t('registrationError'));
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
              <MessageSquare className="h-8 w-8 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Meeshy</h1>
          <p className="text-gray-600 text-lg">{t('description')}</p>
          
          {/* Affichage des informations d'affiliation */}
          {affiliateToken && (
            <div className="mt-4">
              {isValidatingAffiliate ? (
                <div className="flex items-center justify-center space-x-2 text-blue-600">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  <span className="text-sm">Validation du lien d'invitation...</span>
                </div>
              ) : affiliateData?.isValid ? (
                <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-4">
                  <div className="flex items-center justify-center space-x-2 text-purple-700 mb-2">
                    <UserPlus className="h-5 w-5" />
                    <span className="font-semibold">Invitation de {affiliateData.affiliateUser?.firstName} {affiliateData.affiliateUser?.lastName}</span>
                  </div>
                  <p className="text-sm text-purple-600">
                    Rejoignez Meeshy et discutez avec {affiliateData.affiliateUser?.firstName} et d'autres personnes du monde entier !
                  </p>
                </div>
              ) : (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center justify-center space-x-2 text-red-700 mb-2">
                    <X className="h-5 w-5" />
                    <span className="font-semibold">Lien d'invitation invalide</span>
                  </div>
                  <p className="text-sm text-red-600">
                    Ce lien d'invitation n'est plus valide ou a expiré. Vous pouvez toujours vous inscrire normalement.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Formulaire d'inscription en 2 étapes */}
        <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="text-center pb-6">
            <CardTitle className="flex items-center justify-center space-x-2 text-2xl">
              <UserPlus className="h-6 w-6 text-blue-600" />
              <span>{t('title')}</span>
            </CardTitle>
            <CardDescription className="text-base">
              {t('formDescription')}
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
                  {/* Nom d'utilisateur */}
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <User className="h-4 w-4 text-blue-600" />
                      <Label htmlFor="username" className="text-sm font-medium text-gray-700">
                        {t('usernameLabel')}
                      </Label>
                    </div>
                    <Input
                      id="username"
                      type="text"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      placeholder={t('usernamePlaceholder')}
                      disabled={isLoading}
                      required
                      className="h-10"
                    />
                  </div>

                  {/* Email */}
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Mail className="h-4 w-4 text-blue-600" />
                      <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                        {t('emailLabel')}
                      </Label>
                    </div>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder={t('emailPlaceholder')}
                      disabled={isLoading}
                      required
                      className="h-10"
                    />
                  </div>

                  {/* Mot de passe et confirmation */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Lock className="h-4 w-4 text-blue-600" />
                        <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                          {t('passwordLabel')}
                        </Label>
                      </div>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPassword ? 'text' : 'password'}
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          placeholder={t('passwordPlaceholder')}
                          disabled={isLoading}
                          required
                          className="h-10 pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Lock className="h-4 w-4 text-blue-600" />
                        <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700">
                          {t('confirmPasswordLabel')}
                        </Label>
                      </div>
                      <div className="relative">
                        <Input
                          id="confirmPassword"
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder={t('confirmPasswordPlaceholder')}
                          disabled={isLoading}
                          required
                          className="h-10 pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        >
                          {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Bouton suivant */}
                  <Button 
                    type="button"
                    onClick={handleNextStep}
                    className="w-full h-11 font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
                  >
                    Continuer
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
                        <Label htmlFor="firstName" className="text-sm font-medium text-gray-700">
                          {t('firstNameLabel')}
                        </Label>
                      </div>
                      <Input
                        id="firstName"
                        type="text"
                        value={formData.firstName}
                        onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                        placeholder={t('firstNamePlaceholder')}
                        disabled={isLoading}
                        required
                        className="h-10"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <User className="h-4 w-4 text-blue-600" />
                        <Label htmlFor="lastName" className="text-sm font-medium text-gray-700">
                          {t('lastNameLabel')}
                        </Label>
                      </div>
                      <Input
                        id="lastName"
                        type="text"
                        value={formData.lastName}
                        onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                        placeholder={t('lastNamePlaceholder')}
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
                      <Label htmlFor="phoneNumber" className="text-sm font-medium text-gray-700">
                        {t('phoneLabel')}
                      </Label>
                    </div>
                    <Input
                      id="phoneNumber"
                      type="tel"
                      value={formData.phoneNumber}
                      onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                      placeholder={t('phonePlaceholder')}
                      disabled={isLoading}
                      className="h-10"
                    />
                  </div>

                  {/* Préférences de langue */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Globe className="h-4 w-4 text-blue-600" />
                        <Label htmlFor="systemLanguage" className="text-sm font-medium text-gray-700">
                          {t('systemLanguageLabel')}
                        </Label>
                      </div>
                      <Select 
                        value={formData.systemLanguage} 
                        onValueChange={(value) => setFormData({ ...formData, systemLanguage: value })}
                        disabled={isLoading}
                      >
                        <SelectTrigger className="h-10">
                          <SelectValue placeholder={t('systemLanguageLabel')} />
                        </SelectTrigger>
                        <SelectContent>
                          {SUPPORTED_LANGUAGES.filter(lang => lang.code !== 'auto').map((lang) => (
                            <SelectItem key={lang.code} value={lang.code}>
                              {lang.flag} {lang.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Globe className="h-4 w-4 text-blue-600" />
                        <Label htmlFor="regionalLanguage" className="text-sm font-medium text-gray-700">
                          {t('regionalLanguageLabel')}
                        </Label>
                      </div>
                      <Select 
                        value={formData.regionalLanguage} 
                        onValueChange={(value) => setFormData({ ...formData, regionalLanguage: value })}
                        disabled={isLoading}
                      >
                        <SelectTrigger className="h-10">
                          <SelectValue placeholder={t('regionalLanguageLabel')} />
                        </SelectTrigger>
                        <SelectContent>
                          {SUPPORTED_LANGUAGES.filter(lang => lang.code !== 'auto').map((lang) => (
                            <SelectItem key={lang.code} value={lang.code}>
                              {lang.flag} {lang.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Case d'acceptation des politiques - EN DERNIER */}
                  <div className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg border">
                    <Checkbox
                      id="acceptTerms"
                      checked={acceptTerms}
                      onCheckedChange={(checked) => setAcceptTerms(checked as boolean)}
                      disabled={isLoading}
                      className="mt-1"
                    />
                    <div className="text-sm text-gray-700 leading-relaxed">
                      <label htmlFor="acceptTerms" className="cursor-pointer">
                        {t('acceptTerms')}{' '}
                        <a
                          href="/terms"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-700 underline font-medium"
                        >
                          {t('termsOfService')}
                        </a>{' '}
                        {t('and')}{' '}
                        <a
                          href="/policy"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-700 underline font-medium"
                        >
                          {t('privacyPolicy')}
                        </a>
                        .{' '}
                        <a
                          href="/contact"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-700 underline font-medium"
                        >
                          {t('contactUs')}
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
                      className="flex-1 h-11"
                    >
                      Précédent
                    </Button>
                    <Button 
                      type="submit" 
                      className="flex-1 h-11 font-semibold shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed" 
                      disabled={isLoading || !acceptTerms}
                    >
                      {isLoading ? (
                        <div className="flex items-center space-x-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          <span>{t('creating')}</span>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <UserPlus className="h-4 w-4" />
                          <span>{t('registerButton')}</span>
                        </div>
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* Lien vers la connexion */}
              <div className="text-center pt-4">
                <p className="text-gray-600">
                  {t('hasAccount')}{' '}
                  <button
                    type="button"
                    onClick={() => router.push('/login' + (returnUrl ? `?returnUrl=${encodeURIComponent(returnUrl)}` : ''))}
                    className="text-blue-600 hover:text-blue-700 font-medium underline transition-colors"
                  >
                    {t('loginLink')}
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

export default function SigninPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-blue-50 to-indigo-100 flex items-center justify-center p-4">
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
      <SigninPageContent />
    </Suspense>
  );
}