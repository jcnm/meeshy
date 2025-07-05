'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { User } from '@/types';
import { Settings, Languages, Globe, User as UserIcon, Zap } from 'lucide-react';
import { useSimpleTranslation } from '@/hooks/use-simple-translation';
import { ModelsStatus } from './models-status';

interface UserSettingsModalProps {
  user: User | null;
  onUserUpdate: (updatedUser: Partial<User>) => void;
  onClose?: () => void;
  children?: React.ReactNode;
}

const LANGUAGES = [
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'pt', name: 'Português', flag: '🇵🇹' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
  { code: 'hi', name: 'हिन्दी', flag: '🇮🇳' },
];

export function UserSettingsModal({ user, onUserUpdate, onClose, children }: UserSettingsModalProps) {
  const [open, setOpen] = useState(false);
  const [localSettings, setLocalSettings] = useState<Partial<User>>({});
  const { modelsStatus, preloadModels } = useSimpleTranslation();

  useEffect(() => {
    if (user && open) {
      setLocalSettings({
        systemLanguage: user.systemLanguage,
        regionalLanguage: user.regionalLanguage,
        customDestinationLanguage: user.customDestinationLanguage,
        autoTranslateEnabled: user.autoTranslateEnabled,
        translateToSystemLanguage: user.translateToSystemLanguage,
        translateToRegionalLanguage: user.translateToRegionalLanguage,
        useCustomDestination: user.useCustomDestination,
      });
    }
  }, [user, open]);

  const handleSave = () => {
    onUserUpdate(localSettings);
    setOpen(false);
    onClose?.();
  };

  const updateSetting = (key: keyof User, value: string | boolean) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  const getLanguageDisplay = (code: string) => {
    const lang = LANGUAGES.find(l => l.code === code);
    return lang ? `${lang.flag} ${lang.name}` : code;
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" size="sm" className="gap-2">
            <Settings className="h-4 w-4" />
            Paramètres
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserIcon className="h-5 w-5" />
            Paramètres de {user.username}
          </DialogTitle>
          <DialogDescription>
            Configurez vos préférences de langue et de traduction automatique
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="languages" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="languages" className="gap-2">
              <Languages className="h-4 w-4" />
              Langues
            </TabsTrigger>
            <TabsTrigger value="translation" className="gap-2">
              <Globe className="h-4 w-4" />
              Traduction
            </TabsTrigger>
            <TabsTrigger value="models" className="gap-2">
              <Zap className="h-4 w-4" />
              Modèles
            </TabsTrigger>
          </TabsList>

          <TabsContent value="languages" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Configuration des langues</CardTitle>
                <CardDescription>
                  Définissez vos langues système et régionale
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="systemLanguage">Langue système</Label>
                    <Select
                      value={localSettings.systemLanguage}
                      onValueChange={(value) => updateSetting('systemLanguage', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionnez votre langue système" />
                      </SelectTrigger>
                      <SelectContent>
                        {LANGUAGES.map((lang) => (
                          <SelectItem key={lang.code} value={lang.code}>
                            {getLanguageDisplay(lang.code)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="regionalLanguage">Langue régionale</Label>
                    <Select
                      value={localSettings.regionalLanguage}
                      onValueChange={(value) => updateSetting('regionalLanguage', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionnez votre langue régionale" />
                      </SelectTrigger>
                      <SelectContent>
                        {LANGUAGES.map((lang) => (
                          <SelectItem key={lang.code} value={lang.code}>
                            {getLanguageDisplay(lang.code)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customDestinationLanguage">Langue de destination personnalisée</Label>
                  <Select
                    value={localSettings.customDestinationLanguage || ''}
                    onValueChange={(value) => updateSetting('customDestinationLanguage', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionnez une langue personnalisée (optionnel)" />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.map((lang) => (
                        <SelectItem key={lang.code} value={lang.code}>
                          {getLanguageDisplay(lang.code)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="translation" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Paramètres de traduction</CardTitle>
                <CardDescription>
                  Configurez le comportement de la traduction automatique
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="autoTranslate" className="text-base font-medium">
                      Traduction automatique
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Activer la traduction automatique des messages reçus
                    </p>
                  </div>
                  <Switch
                    id="autoTranslate"
                    checked={localSettings.autoTranslateEnabled || false}
                    onCheckedChange={(checked) => updateSetting('autoTranslateEnabled', checked)}
                  />
                </div>

                {localSettings.autoTranslateEnabled && (
                  <div className="space-y-4 pl-4 border-l-2 border-primary/20">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label htmlFor="translateToSystem" className="text-sm font-medium">
                          Traduire vers la langue système
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Traduire les messages vers {getLanguageDisplay(localSettings.systemLanguage || 'fr')}
                        </p>
                      </div>
                      <Switch
                        id="translateToSystem"
                        checked={localSettings.translateToSystemLanguage || false}
                        onCheckedChange={(checked) => updateSetting('translateToSystemLanguage', checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label htmlFor="translateToRegional" className="text-sm font-medium">
                          Traduire vers la langue régionale
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Traduire les messages vers {getLanguageDisplay(localSettings.regionalLanguage || 'fr')}
                        </p>
                      </div>
                      <Switch
                        id="translateToRegional"
                        checked={localSettings.translateToRegionalLanguage || false}
                        onCheckedChange={(checked) => updateSetting('translateToRegionalLanguage', checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label htmlFor="useCustomDestination" className="text-sm font-medium">
                          Utiliser la destination personnalisée
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Traduire vers {localSettings.customDestinationLanguage ? 
                            getLanguageDisplay(localSettings.customDestinationLanguage) : 
                            'aucune langue sélectionnée'
                          }
                        </p>
                      </div>
                      <Switch
                        id="useCustomDestination"
                        checked={localSettings.useCustomDestination || false}
                        onCheckedChange={(checked) => updateSetting('useCustomDestination', checked)}
                        disabled={!localSettings.customDestinationLanguage}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="models" className="space-y-4">
            <ModelsStatus />
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">État des modèles</CardTitle>
                <CardDescription>
                  Informations sur les modèles de traduction TensorFlow.js
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(modelsStatus).map(([modelName, status]) => (
                    <div key={modelName} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <h4 className="font-medium">{modelName.toUpperCase()}</h4>
                        <p className="text-sm text-muted-foreground">
                          {status?.loaded ? 'Modèle chargé et prêt' : 'Modèle non chargé'}
                        </p>
                      </div>
                      <Badge variant={status?.loaded ? 'default' : 'secondary'}>
                        {status?.loading ? 'Chargement...' : status?.loaded ? 'Prêt' : 'Arrêté'}
                      </Badge>
                    </div>
                  ))}
                </div>

                <Button
                  onClick={preloadModels}
                  className="w-full"
                  variant="outline"
                >
                  Précharger tous les modèles
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Annuler
          </Button>
          <Button onClick={handleSave}>
            Sauvegarder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
