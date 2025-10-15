'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SUPPORTED_LANGUAGES } from '@shared/types';
import { JoinConversationResponse } from '@/types/frontend';
import { toast } from 'sonner';
import { buildApiUrl, API_ENDPOINTS } from '@/lib/config';
import { useI18n } from '@/hooks/useI18n';

interface CreateAccountFormProps {
  linkId: string;
  onSuccess: (userData: JoinConversationResponse) => void;
}

export function CreateAccountForm({ linkId, onSuccess }: CreateAccountFormProps) {
  const { t } = useI18n('auth');
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    password: '',
    spokenLanguage: '',
    receiveLanguage: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Utiliser l'endpoint d'inscription standard avec les bonnes clés de langue
      const response = await fetch(buildApiUrl(API_ENDPOINTS.AUTH.REGISTER), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: formData.email.split('@')[0], // Générer un username à partir de l'email
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          password: formData.password,
          phoneNumber: formData.phoneNumber,
          systemLanguage: formData.spokenLanguage,
          regionalLanguage: formData.receiveLanguage,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Compte créé avec succès !');
        onSuccess(result.data);
      } else {
        toast.error(result.message || 'Erreur lors de la création du compte');
      }
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur de connexion au serveur');
    } finally {
      setLoading(false);
    }
  };

  const updateFormData = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>{t('createAccount.title')}</CardTitle>
        <CardDescription>
          {t('createAccount.description')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="create-account-firstName">Prénom *</Label>
              <Input
                id="create-account-firstName"
                value={formData.firstName}
                onChange={(e) => updateFormData('firstName', e.target.value)}
                required
                placeholder="Jean"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-account-lastName">Nom *</Label>
              <Input
                id="create-account-lastName"
                value={formData.lastName}
                onChange={(e) => updateFormData('lastName', e.target.value)}
                required
                placeholder="Dupont"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-account-email">Email *</Label>
            <Input
              id="create-account-email"
              type="email"
              value={formData.email}
              onChange={(e) => updateFormData('email', e.target.value)}
              required
              placeholder="jean.dupont@email.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-account-phoneNumber">Numéro de téléphone (optionnel)</Label>
            <Input
              id="create-account-phoneNumber"
              type="tel"
              value={formData.phoneNumber}
              onChange={(e) => updateFormData('phoneNumber', e.target.value)}
              placeholder="+33123456789"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-account-password">Mot de passe *</Label>
            <Input
              id="create-account-password"
              type="password"
              value={formData.password}
              onChange={(e) => updateFormData('password', e.target.value)}
              required
              placeholder="Choisissez un mot de passe sécurisé"
            />
            <p className="text-xs text-gray-500">
              Le mot de passe doit contenir au moins 6 caractères
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="spokenLanguage">Langue parlée *</Label>
            <Select value={formData.spokenLanguage} onValueChange={(value) => updateFormData('spokenLanguage', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionnez votre langue" />
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
            <Label htmlFor="receiveLanguage">Langue de réception des messages *</Label>
            <Select value={formData.receiveLanguage} onValueChange={(value) => updateFormData('receiveLanguage', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Dans quelle langue voulez-vous recevoir les messages ?" />
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

          <Button 
            type="submit" 
            className="w-full" 
            disabled={loading || !formData.firstName || !formData.lastName || !formData.email || !formData.password || !formData.spokenLanguage || !formData.receiveLanguage}
          >
            {loading ? 'Création en cours...' : 'Créer le compte et rejoindre'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
