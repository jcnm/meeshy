'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User as UserType } from '@/types';
import { getUserInitials } from '@/utils/user';
import { toast } from 'sonner';
import { Upload, Camera } from 'lucide-react';

interface UserSettingsProps {
  user: UserType | null;
  onUserUpdate: (user: UserType) => void;
}

export function UserSettings({ user, onUserUpdate }: UserSettingsProps) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    displayName: '',
    email: '',
    phoneNumber: '',
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        displayName: user.displayName || '',
        email: user.email || '',
        phoneNumber: user.phoneNumber || '',
      });
    }
  }, [user]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      // Appel API pour sauvegarder les modifications
      const response = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}` // Assurez-vous que le token est disponible
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la mise à jour du profil');
      }

      const updatedUserData = await response.json();
      
      // Mettre à jour l'utilisateur avec les données retournées par l'API
      const updatedUser: UserType = {
        ...user,
        ...updatedUserData
      };
      
      onUserUpdate(updatedUser);
      toast.success('Profil mis à jour avec succès');
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error);
      toast.error('Erreur lors de la mise à jour du profil');
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground">Aucun utilisateur connecté</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Photo de profil</CardTitle>
          <CardDescription>
            Personnalisez votre photo de profil visible par les autres utilisateurs
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-4 sm:space-y-0 sm:space-x-6">
            <Avatar className="h-24 w-24 sm:h-20 sm:w-20">
              <AvatarImage src={user.avatar} alt={user.username} />
              <AvatarFallback className="text-lg">
                {getUserInitials(user)}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <Button variant="outline" size="sm" className="w-full sm:w-auto">
                <Upload className="h-4 w-4 mr-2" />
                Télécharger une image
              </Button>
              <Button variant="outline" size="sm" className="w-full sm:w-auto">
                <Camera className="h-4 w-4 mr-2" />
                Prendre une photo
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Informations personnelles</CardTitle>
          <CardDescription>
            Modifiez vos informations de profil
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="firstName">Prénom</Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(e) => handleInputChange('firstName', e.target.value)}
                placeholder="Votre prénom"
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Nom</Label>
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={(e) => handleInputChange('lastName', e.target.value)}
                placeholder="Votre nom"
                className="w-full"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="displayName">Nom d&apos;affichage</Label>
            <Input
              id="displayName"
              value={formData.displayName}
              onChange={(e) => handleInputChange('displayName', e.target.value)}
              placeholder="Comment vous voulez apparaître dans les conversations"
              className="w-full"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                placeholder="votre.email@exemple.com"
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phoneNumber">Numéro de téléphone</Label>
              <Input
                id="phoneNumber"
                type="tel"
                value={formData.phoneNumber}
                onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                placeholder="+33 1 23 45 67 89"
                className="w-full"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="username">Nom d&apos;utilisateur</Label>
            <Input
              id="username"
              value={user.username}
              disabled
              className="bg-muted w-full"
            />
            <p className="text-sm text-muted-foreground">
              Le nom d&apos;utilisateur ne peut pas être modifié
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end space-x-4">
        <Button variant="outline" onClick={() => setFormData({
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          displayName: user.displayName || '',
          email: user.email || '',
          phoneNumber: user.phoneNumber || '',
        })}>
          Annuler
        </Button>
        <Button onClick={handleSave} disabled={isLoading}>
          {isLoading ? 'Sauvegarde...' : 'Sauvegarder'}
        </Button>
      </div>
    </div>
  );
}
