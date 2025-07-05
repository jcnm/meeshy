'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SUPPORTED_LANGUAGES, JoinConversationResponse } from '@/types/frontend';
import { toast } from 'sonner';

interface CreateAccountFormProps {
  linkId: string;
  onSuccess: (userData: JoinConversationResponse) => void;
}

export function CreateAccountForm({ linkId, onSuccess }: CreateAccountFormProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    spokenLanguage: '',
    receiveLanguage: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/conversation/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          linkId,
          userData: {
            ...formData,
            conversationLinkId: linkId,
          },
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success(
          result.data.existingUserFound 
            ? 'Compte existant trouvé ! Connexion en cours...'
            : result.data.isNewUser 
            ? 'Compte créé avec succès !'
            : 'Connexion réussie !'
        );
        onSuccess(result.data);
      } else {
        toast.error(result.error || 'Erreur lors de la création du compte');
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
        <CardTitle>Rejoindre la conversation</CardTitle>
        <CardDescription>
          Créez votre compte ou connectez-vous si vous en avez déjà un
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">Prénom *</Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(e) => updateFormData('firstName', e.target.value)}
                required
                placeholder="Jean"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Nom *</Label>
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={(e) => updateFormData('lastName', e.target.value)}
                required
                placeholder="Dupont"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => updateFormData('email', e.target.value)}
              required
              placeholder="jean.dupont@email.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phoneNumber">Numéro de téléphone *</Label>
            <Input
              id="phoneNumber"
              type="tel"
              value={formData.phoneNumber}
              onChange={(e) => updateFormData('phoneNumber', e.target.value)}
              required
              placeholder="+33123456789"
            />
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
            disabled={loading || !formData.firstName || !formData.lastName || !formData.email || !formData.phoneNumber || !formData.spokenLanguage || !formData.receiveLanguage}
          >
            {loading ? 'Création en cours...' : 'Créer le compte et rejoindre'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
