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
import { useTranslations } from 'next-intl';
import { buildApiUrl } from '@/lib/config';

interface UserSettingsProps {
  user: UserType | null;
  onUserUpdate: (user: UserType) => void;
}

export function UserSettings({ user, onUserUpdate }: UserSettingsProps) {
  const t = useTranslations('settings');
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
      const response = await fetch(buildApiUrl('/users/me'), {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || t('profile.actions.updateError'));
      }

      const responseData = await response.json();
      
      // Mettre à jour l'utilisateur avec les données retournées par l'API
      const updatedUser: UserType = {
        ...user,
        ...responseData.data
      };
      
      onUserUpdate(updatedUser);
      toast.success(responseData.message || t('profile.actions.profileUpdated'));
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error);
      toast.error(error instanceof Error ? error.message : t('profile.actions.updateError'));
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground">{t('noUserConnected')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('profile.photo.title')}</CardTitle>
          <CardDescription>
            {t('profile.photo.description')}
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
                {t('profile.photo.uploadImage')}
              </Button>
              <Button variant="outline" size="sm" className="w-full sm:w-auto">
                <Camera className="h-4 w-4 mr-2" />
                {t('profile.photo.takePhoto')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('profile.personalInfo.title')}</CardTitle>
          <CardDescription>
            {t('profile.personalInfo.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="firstName">{t('profile.personalInfo.firstName')}</Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(e) => handleInputChange('firstName', e.target.value)}
                placeholder={t('profile.personalInfo.firstName')}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">{t('profile.personalInfo.lastName')}</Label>
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={(e) => handleInputChange('lastName', e.target.value)}
                placeholder={t('profile.personalInfo.lastName')}
                className="w-full"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="displayName">{t('profile.personalInfo.displayName')}</Label>
            <Input
              id="displayName"
              value={formData.displayName}
              onChange={(e) => handleInputChange('displayName', e.target.value)}
              placeholder={t('profile.personalInfo.displayNamePlaceholder')}
              className="w-full"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="email">{t('profile.personalInfo.email')}</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                placeholder={t('profile.personalInfo.emailPlaceholder')}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phoneNumber">{t('profile.personalInfo.phoneNumber')}</Label>
              <Input
                id="phoneNumber"
                type="tel"
                value={formData.phoneNumber}
                onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                placeholder={t('profile.personalInfo.phoneNumberPlaceholder')}
                className="w-full"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="username">{t('profile.personalInfo.username')}</Label>
            <Input
              id="username"
              value={user.username}
              disabled
              className="bg-muted w-full"
            />
            <p className="text-sm text-muted-foreground">
              {t('profile.personalInfo.usernameCannotChange')}
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
          {t('profile.actions.cancel')}
        </Button>
        <Button onClick={handleSave} disabled={isLoading}>
          {isLoading ? t('profile.actions.saving') : t('profile.actions.save')}
        </Button>
      </div>
    </div>
  );
}
