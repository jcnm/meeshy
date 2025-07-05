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
      // TODO: Appel API pour sauvegarder les modifications
      const updatedUser: UserType = {
        ...user,
        ...settings
      };
      
      onUserUpdate(updatedUser);
      toast.success('Paramètres de langue mis à jour');
    } catch (error) {
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
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Langues principales
          </CardTitle>
          <CardDescription>
            Configurez vos langues préférées pour la communication
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="systemLanguage">Langue système</Label>
            <Select
              value={settings.systemLanguage}
              onValueChange={(value) => handleSettingChange('systemLanguage', value)}
            >
              <SelectTrigger>
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
            <p className="text-sm text-muted-foreground">
              Langue principale de votre interface et de vos messages
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="regionalLanguage">Langue régionale</Label>
            <Select
              value={settings.regionalLanguage}
              onValueChange={(value) => handleSettingChange('regionalLanguage', value)}
            >
              <SelectTrigger>
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
            <p className="text-sm text-muted-foreground">
              Langue de votre région ou langue secondaire préférée
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="customDestinationLanguage">Langue de destination personnalisée</Label>
            <Select
              value={settings.customDestinationLanguage}
              onValueChange={(value) => handleSettingChange('customDestinationLanguage', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une langue" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Aucune</SelectItem>
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
            <p className="text-sm text-muted-foreground">
              Langue spécifique pour la traduction automatique (optionnel)
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Languages className="h-5 w-5" />
            Options de traduction automatique
          </CardTitle>
          <CardDescription>
            Configurez comment les messages sont traduits automatiquement
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="autoTranslateEnabled">Traduction automatique</Label>
              <p className="text-sm text-muted-foreground">
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
            <>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="translateToSystemLanguage">
                    Traduire vers la langue système
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Traduit les messages vers {getLanguageFlag(settings.systemLanguage)} {getLanguageName(settings.systemLanguage)}
                  </p>
                </div>
                <Switch
                  id="translateToSystemLanguage"
                  checked={settings.translateToSystemLanguage}
                  onCheckedChange={(checked) => handleSettingChange('translateToSystemLanguage', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="translateToRegionalLanguage">
                    Traduire vers la langue régionale
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Traduit les messages vers {getLanguageFlag(settings.regionalLanguage)} {getLanguageName(settings.regionalLanguage)}
                  </p>
                </div>
                <Switch
                  id="translateToRegionalLanguage"
                  checked={settings.translateToRegionalLanguage}
                  onCheckedChange={(checked) => handleSettingChange('translateToRegionalLanguage', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="useCustomDestination">
                    Utiliser la langue personnalisée
                  </Label>
                  <p className="text-sm text-muted-foreground">
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
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Aperçu de la configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Langue système</Badge>
              <span className="flex items-center gap-1">
                {getLanguageFlag(settings.systemLanguage)} {getLanguageName(settings.systemLanguage)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Langue régionale</Badge>
              <span className="flex items-center gap-1">
                {getLanguageFlag(settings.regionalLanguage)} {getLanguageName(settings.regionalLanguage)}
              </span>
            </div>
            {settings.customDestinationLanguage && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary">Langue personnalisée</Badge>
                <span className="flex items-center gap-1">
                  {getLanguageFlag(settings.customDestinationLanguage)} {getLanguageName(settings.customDestinationLanguage)}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Badge variant={settings.autoTranslateEnabled ? "default" : "outline"}>
                Traduction automatique
              </Badge>
              <span>{settings.autoTranslateEnabled ? 'Activée' : 'Désactivée'}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end space-x-4">
        <Button variant="outline" onClick={() => {
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
        }}>
          Annuler
        </Button>
        <Button onClick={handleSave} disabled={isLoading}>
          {isLoading ? 'Sauvegarde...' : 'Sauvegarder'}
        </Button>
      </div>
    </div>
  );
}
