'use client';

import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { User } from '@/types';
import { Globe, Brain } from 'lucide-react';
import { LanguageSelector } from '@/components/translation/language-selector';
import { ModelsSettings } from './models-settings';

interface UserSettingsContentProps {
  user: User | null;
  localSettings: Partial<User>;
  onSettingUpdate: (key: keyof User, value: string | boolean) => void;
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

export function UserSettingsContent({ user, localSettings, onSettingUpdate, children }: UserSettingsContentProps) {
  const getLanguageDisplay = (code: string) => {
    const lang = LANGUAGES.find(l => l.code === code);
    return lang ? `${lang.flag} ${lang.name}` : code;
  };

  if (!user) return null;

  return (
    <div className="w-full">
      <Tabs defaultValue="translation" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="translation" className="gap-2">
            <Globe className="h-4 w-4" />
            Traduction
          </TabsTrigger>
          <TabsTrigger value="models" className="gap-2">
            <Brain className="h-4 w-4" />
            Modèles
          </TabsTrigger>
        </TabsList>

        <TabsContent value="translation" className="space-y-4">
          {/* Configuration des langues */}
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
                  <LanguageSelector
                    value={localSettings.systemLanguage || ''}
                    onValueChange={(value) => onSettingUpdate('systemLanguage', value)}
                    placeholder="Sélectionnez votre langue système"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="regionalLanguage">Langue régionale</Label>
                  <LanguageSelector
                    value={localSettings.regionalLanguage || ''}
                    onValueChange={(value) => onSettingUpdate('regionalLanguage', value)}
                    placeholder="Sélectionnez votre langue régionale"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="customDestinationLanguage">Langue de destination personnalisée</Label>
                <LanguageSelector
                  value={localSettings.customDestinationLanguage || ''}
                  onValueChange={(value) => onSettingUpdate('customDestinationLanguage', value)}
                  placeholder="Sélectionnez une langue personnalisée (optionnel)"
                />
              </div>
            </CardContent>
          </Card>

          {/* Paramètres de traduction */}
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
                  onCheckedChange={(checked) => onSettingUpdate('autoTranslateEnabled', checked)}
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
                      onCheckedChange={(checked) => onSettingUpdate('translateToSystemLanguage', checked)}
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
                      onCheckedChange={(checked) => onSettingUpdate('translateToRegionalLanguage', checked)}
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
                      onCheckedChange={(checked) => onSettingUpdate('useCustomDestination', checked)}
                      disabled={!localSettings.customDestinationLanguage}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="models" className="space-y-4">
          <ModelsSettings />
        </TabsContent>
      </Tabs>

      {children}
    </div>
  );
}
