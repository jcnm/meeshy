'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User as UserType } from '@/types';
import { getUserInitials } from '@/utils/user';
import { toast } from 'sonner';
import { Upload, Camera, X } from 'lucide-react';
import { useTranslations } from '@/hooks/useTranslations';
import { buildApiUrl } from '@/lib/config';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { validateAvatarFile } from '@/utils/avatar-upload';

interface UserSettingsProps {
  user: UserType | null;
  onUserUpdate: (user: UserType) => void;
}

export function UserSettings({ user, onUserUpdate }: UserSettingsProps) {
  const { t } = useTranslations('settings');
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    displayName: '',
    email: '',
    phoneNumber: '',
    bio: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [showAvatarDialog, setShowAvatarDialog] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      setFormData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        displayName: user.displayName || '',
        email: user.email || '',
        phoneNumber: user.phoneNumber || '',
        bio: user.bio || '',
      });
    }
  }, [user]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAvatarSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validation du fichier
      const validation = validateAvatarFile(file);
      if (!validation.valid) {
        toast.error(validation.error || 'Fichier invalide');
        return;
      }

      setSelectedFile(file);
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
        setShowAvatarDialog(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAvatarUpload = async () => {
    if (!selectedFile || !user) return;

    setIsUploadingAvatar(true);
    try {
      // Étape 1: Upload du fichier vers l'API Next.js
      const formData = new FormData();
      formData.append('avatar', selectedFile);

      const uploadResponse = await fetch('/api/upload/avatar', {
        method: 'POST',
        body: formData
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json();
        throw new Error(errorData.error || 'Erreur lors de l\'upload du fichier');
      }

      const uploadData = await uploadResponse.json();
      const imageUrl = uploadData.data.url;

      // Étape 2: Mettre à jour l'avatar dans la base de données via l'API backend
      const updateResponse = await fetch(buildApiUrl('/users/me/avatar'), {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({ avatar: imageUrl })
      });

      if (!updateResponse.ok) {
        const errorData = await updateResponse.json();
        throw new Error(errorData.error || 'Erreur lors de la mise à jour de l\'avatar');
      }

      const responseData = await updateResponse.json();
      const updatedUser: UserType = {
        ...user,
        avatar: responseData.data.avatar
      };
      
      onUserUpdate(updatedUser);
      toast.success('Photo de profil mise à jour avec succès');
      setShowAvatarDialog(false);
      setAvatarPreview(null);
      setSelectedFile(null);
    } catch (error) {
      console.error('Erreur lors de l\'upload:', error);
      toast.error(error instanceof Error ? error.message : 'Erreur lors de l\'upload de l\'avatar');
    } finally {
      setIsUploadingAvatar(false);
    }
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
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarSelect}
                className="hidden"
              />
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full sm:w-auto"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                {t('profile.photo.uploadImage')}
              </Button>
              <Button variant="outline" size="sm" className="w-full sm:w-auto" disabled>
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
              <Label htmlFor="settings-firstName">{t('profile.personalInfo.firstName')}</Label>
              <Input
                id="settings-firstName"
                value={formData.firstName}
                onChange={(e) => handleInputChange('firstName', e.target.value)}
                placeholder={t('profile.personalInfo.firstName')}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="settings-lastName">{t('profile.personalInfo.lastName')}</Label>
              <Input
                id="settings-lastName"
                value={formData.lastName}
                onChange={(e) => handleInputChange('lastName', e.target.value)}
                placeholder={t('profile.personalInfo.lastName')}
                className="w-full"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="settings-displayName">{t('profile.personalInfo.displayName')}</Label>
            <Input
              id="settings-displayName"
              value={formData.displayName}
              onChange={(e) => handleInputChange('displayName', e.target.value)}
              placeholder={t('profile.personalInfo.displayNamePlaceholder')}
              className="w-full"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="settings-email">{t('profile.personalInfo.email')}</Label>
              <Input
                id="settings-email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                placeholder={t('profile.personalInfo.emailPlaceholder')}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="settings-phoneNumber">{t('profile.personalInfo.phoneNumber')}</Label>
              <Input
                id="settings-phoneNumber"
                type="tel"
                value={formData.phoneNumber}
                onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                placeholder={t('profile.personalInfo.phoneNumberPlaceholder')}
                className="w-full"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="settings-bio">{t('profile.personalInfo.bio')}</Label>
            <Textarea
              id="settings-bio"
              value={formData.bio}
              onChange={(e) => handleInputChange('bio', e.target.value)}
              placeholder={t('profile.personalInfo.bioPlaceholder')}
              className="w-full min-h-[100px]"
              maxLength={500}
            />
            <p className="text-sm text-muted-foreground text-right">
              {formData.bio.length}/500
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="settings-username">{t('profile.personalInfo.username')}</Label>
            <Input
              id="settings-username"
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
          bio: user.bio || '',
        })}>
          {t('profile.actions.cancel')}
        </Button>
        <Button onClick={handleSave} disabled={isLoading}>
          {isLoading ? t('profile.actions.saving') : t('profile.actions.save')}
        </Button>
      </div>

      {/* Modale de prévisualisation d'avatar */}
      <Dialog open={showAvatarDialog} onOpenChange={setShowAvatarDialog}>
        <DialogContent className="max-w-md w-[95vw] sm:max-w-md sm:w-[90vw]">
          <DialogHeader>
            <DialogTitle>{t('profile.photo.previewTitle')}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center space-y-4">
            {avatarPreview && (
              <Avatar className="h-32 w-32">
                <AvatarImage src={avatarPreview} alt="Preview" />
                <AvatarFallback>{getUserInitials(user)}</AvatarFallback>
              </Avatar>
            )}
            <div className="flex space-x-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowAvatarDialog(false);
                  setAvatarPreview(null);
                }}
              >
                {t('profile.actions.cancel')}
              </Button>
              <Button onClick={handleAvatarUpload} disabled={isUploadingAvatar}>
                {isUploadingAvatar ? t('profile.actions.uploading') : t('profile.actions.confirm')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
