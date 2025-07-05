'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { User, SUPPORTED_LANGUAGES } from '@/types';

interface RegisterFormProps {
  onSuccess: (user: User, token: string) => void;
}

export function RegisterForm({ onSuccess }: RegisterFormProps) {
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
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:3002/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (response.ok && result.user && result.token) {
        toast.success(`Bienvenue ${formData.firstName} !`);
        onSuccess(result.user, result.token);
      } else {
        toast.error(result.message || 'Erreur lors de la création du compte');
      }
    } catch (error) {
      console.error('Erreur register:', error);
      toast.error('Erreur de connexion');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="firstName">Prénom *</Label>
          <Input
            id="firstName"
            type="text"
            placeholder="Votre prénom"
            value={formData.firstName}
            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
            disabled={isLoading}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Nom *</Label>
          <Input
            id="lastName"
            type="text"
            placeholder="Votre nom"
            value={formData.lastName}
            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
            disabled={isLoading}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="username">Nom d&apos;utilisateur *</Label>
        <Input
          id="username"
          type="text"
          placeholder="Choisissez un nom d'utilisateur"
          value={formData.username}
          onChange={(e) => setFormData({ ...formData, username: e.target.value })}
          disabled={isLoading}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email *</Label>
        <Input
          id="email"
          type="email"
          placeholder="votre@email.com"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          disabled={isLoading}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phoneNumber">Téléphone</Label>
        <Input
          id="phoneNumber"
          type="tel"
          placeholder="+33123456789"
          value={formData.phoneNumber}
          onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
          disabled={isLoading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Mot de passe *</Label>
        <Input
          id="password"
          type="password"
          placeholder="Choisissez un mot de passe"
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          disabled={isLoading}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="systemLanguage">Langue système</Label>
          <Select 
            value={formData.systemLanguage} 
            onValueChange={(value) => setFormData({ ...formData, systemLanguage: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Langue système" />
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
          <Label htmlFor="regionalLanguage">Langue régionale</Label>
          <Select 
            value={formData.regionalLanguage} 
            onValueChange={(value) => setFormData({ ...formData, regionalLanguage: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Langue régionale" />
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
        disabled={isLoading}
      >
        {isLoading ? 'Création...' : 'Créer mon compte'}
      </Button>
    </form>
  );
}
