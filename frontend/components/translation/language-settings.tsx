'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { User as UserType, SUPPORTED_LANGUAGES } from '@/types';
import { toast } from 'sonner';
import { Globe, Languages, Target } from 'lucide-react';

interface LanguageSettingsProps {
  user: UserType | null;
  onUserUpdate: (user: UserType) => void;
}

export function LanguageSettings({ user, onUserUpdate }: LanguageSettingsProps) {
  const [settings, setSettings] = useState({
    systemLanguage: 'fr',
    regionalLanguage: 'fr',
    customDestinationLanguage: '',
    autoTranslateEnabled: true,
    translateToSystemLanguage: true,
    translateToRegionalLanguage: false,
    useCustomDestination: false,
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setSettings({
        systemLanguage: user.systemLanguage,
        regionalLanguage: user.regionalLanguage,
        customDestinationLanguage: user.customDestinationLanguage || '',
        autoTranslateEnabled: user.autoTranslateEnabled,
        translateToSystemLanguage: user.translateToSystemLanguage,
        translateToRegionalLanguage: user.translateToRegionalLanguage,
        useCustomDestination: user.useCustomDestination,
      });
    }
  }, [user]);

  const handleSettingChange = (key: string, value: boolean | string) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSave = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      // Appel API pour sauvegarder les modifications des paramètres de langue
      const response = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}` // Assurez-vous que le token est disponible
        },
        body: JSON.stringify(settings)
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la mise à jour des paramètres de langue');
      }

      const updatedUserData = await response.json();
      
      // Mettre à jour l'utilisateur avec les données retournées par l'API
      const updatedUser: UserType = {
        ...user,
        ...updatedUserData
      };
      
      onUserUpdate(updatedUser);
      toast.success('Paramètres de langue mis à jour');
    } catch (err) {
      console.error('Erreur lors de la mise à jour:', err);
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setIsLoading(false);
    }
  };

  const getLanguageFlag = (code: string) => {
    const lang = SUPPORTED_LANGUAGES.find(l => l.code === code);
    return lang?.flag || '🌐';
  };

  const getLanguageName = (code: string) => {
    const lang = SUPPORTED_LANGUAGES.find(l => l.code === code);
    return lang?.name || code;
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
    <div className="space-y-4 sm:space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Globe className="h-4 w-4 sm:h-5 sm:w-5" />
            Langues principales
          </CardTitle>
          <CardDescription className="text-sm sm:text-base">
            Configurez vos langues préférées pour la communication
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 sm:space-y-6">
          <div className="grid gap-4 sm:gap-6 lg:grid-cols-2 xl:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="systemLanguage" className="text-sm sm:text-base">Langue système</Label>
              <Select
                value={settings.systemLanguage}
                onValueChange={(value) => handleSettingChange('systemLanguage', value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <SelectItem key={lang.code} value={lang.code}>
                      <span className="flex items-center gap-2">
                        <span>{lang.flag}</span>
                        <span>{lang.name}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Langue principale de votre interface et de vos messages
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="regionalLanguage" className="text-sm sm:text-base">Langue régionale</Label>
              <Select
                value={settings.regionalLanguage}
                onValueChange={(value) => handleSettingChange('regionalLanguage', value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <SelectItem key={lang.code} value={lang.code}>
                      <span className="flex items-center gap-2">
                        <span>{lang.flag}</span>
                        <span>{lang.name}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Langue de votre région ou langue secondaire préférée
              </p>
            </div>

            <div className="space-y-2 lg:col-span-2 xl:col-span-1">
              <Label htmlFor="customDestinationLanguage" className="text-sm sm:text-base">Langue de destination personnalisée</Label>
              <Select
                value={settings.customDestinationLanguage || "none"}
                onValueChange={(value) => handleSettingChange('customDestinationLanguage', value === "none" ? "" : value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sélectionner une langue" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucune</SelectItem>
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <SelectItem key={lang.code} value={lang.code}>
                      <span className="flex items-center gap-2">
                        <span>{lang.flag}</span>
                        <span>{lang.name}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Langue spécifique pour la traduction automatique (optionnel)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Languages className="h-4 w-4 sm:h-5 sm:w-5" />
            Options de traduction automatique
          </CardTitle>
          <CardDescription className="text-sm sm:text-base">
            Configurez comment les messages sont traduits automatiquement
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 sm:space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1 flex-1">
              <Label htmlFor="autoTranslateEnabled" className="text-sm sm:text-base">Traduction automatique</Label>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Active la traduction automatique des messages entrants
              </p>
            </div>
            <Switch
              id="autoTranslateEnabled"
              checked={settings.autoTranslateEnabled}
              onCheckedChange={(checked) => handleSettingChange('autoTranslateEnabled', checked)}
            />
          </div>

          {settings.autoTranslateEnabled && (
            <div className="space-y-4 sm:space-y-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1 flex-1">
                  <Label htmlFor="translateToSystemLanguage" className="text-sm sm:text-base">
                    Traduire vers la langue système
                  </Label>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Traduit les messages vers {getLanguageFlag(settings.systemLanguage)} {getLanguageName(settings.systemLanguage)}
                  </p>
                </div>
                <Switch
                  id="translateToSystemLanguage"
                  checked={settings.translateToSystemLanguage}
                  onCheckedChange={(checked) => handleSettingChange('translateToSystemLanguage', checked)}
                />
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1 flex-1">
                  <Label htmlFor="translateToRegionalLanguage" className="text-sm sm:text-base">
                    Traduire vers la langue régionale
                  </Label>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Traduit les messages vers {getLanguageFlag(settings.regionalLanguage)} {getLanguageName(settings.regionalLanguage)}
                  </p>
                </div>
                <Switch
                  id="translateToRegionalLanguage"
                  checked={settings.translateToRegionalLanguage}
                  onCheckedChange={(checked) => handleSettingChange('translateToRegionalLanguage', checked)}
                />
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1 flex-1">
                  <Label htmlFor="useCustomDestination" className="text-sm sm:text-base">
                    Utiliser la langue personnalisée
                  </Label>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    {settings.customDestinationLanguage ? (
                      <>Traduit les messages vers {getLanguageFlag(settings.customDestinationLanguage)} {getLanguageName(settings.customDestinationLanguage)}</>
                    ) : (
                      'Aucune langue personnalisée définie'
                    )}
                  </p>
                </div>
                <Switch
                  id="useCustomDestination"
                  checked={settings.useCustomDestination && !!settings.customDestinationLanguage}
                  onCheckedChange={(checked) => handleSettingChange('useCustomDestination', checked)}
                  disabled={!settings.customDestinationLanguage}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Target className="h-4 w-4 sm:h-5 sm:w-5" />
            Aperçu de la configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
              <Badge variant="secondary" className="text-xs sm:text-sm w-fit">Langue système</Badge>
              <span className="flex items-center gap-1 text-sm sm:text-base">
                {getLanguageFlag(settings.systemLanguage)} {getLanguageName(settings.systemLanguage)}
              </span>
            </div>
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
              <Badge variant="secondary" className="text-xs sm:text-sm w-fit">Langue régionale</Badge>
              <span className="flex items-center gap-1 text-sm sm:text-base">
                {getLanguageFlag(settings.regionalLanguage)} {getLanguageName(settings.regionalLanguage)}
              </span>
            </div>
            {settings.customDestinationLanguage && (
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
                <Badge variant="secondary" className="text-xs sm:text-sm w-fit">Langue personnalisée</Badge>
                <span className="flex items-center gap-1 text-sm sm:text-base">
                  {getLanguageFlag(settings.customDestinationLanguage)} {getLanguageName(settings.customDestinationLanguage)}
                </span>
              </div>
            )}
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
              <Badge variant={settings.autoTranslateEnabled ? "default" : "outline"} className="text-xs sm:text-sm w-fit">
                Traduction automatique
              </Badge>
              <span className="text-sm sm:text-base">{settings.autoTranslateEnabled ? 'Activée' : 'Désactivée'}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end sm:space-x-4">
        <Button 
          variant="outline" 
          className="w-full sm:w-auto" 
          onClick={() => {
            if (user) {
              setSettings({
                systemLanguage: user.systemLanguage,
                regionalLanguage: user.regionalLanguage,
                customDestinationLanguage: user.customDestinationLanguage || '',
                autoTranslateEnabled: user.autoTranslateEnabled,
                translateToSystemLanguage: user.translateToSystemLanguage,
                translateToRegionalLanguage: user.translateToRegionalLanguage,
                useCustomDestination: user.useCustomDestination,
              });
            }
          }}
        >
          Annuler
        </Button>
        <Button onClick={handleSave} disabled={isLoading} className="w-full sm:w-auto">
          {isLoading ? 'Sauvegarde...' : 'Sauvegarder'}
        </Button>
      </div>
    </div>
  );
}
