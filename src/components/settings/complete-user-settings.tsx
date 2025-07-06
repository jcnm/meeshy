'use client';

import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { User } from '@/types';
import { 
  Languages, 
  Globe, 
  Database, 
  Zap, 
  User as UserIcon, 
  Palette, 
  Bell, 
  BarChart3,
  HardDrive
} from 'lucide-react';
import { CacheManager } from '@/components/models/cache-manager';
import { UserSettings } from './user-settings';
import { LanguageSettings } from '@/components/translation/language-settings';
import { UnifiedModelSettings } from './unified-model-settings';
import { EnhancedSystemTestComponent } from './enhanced-system-test';
import { ThemeSettings } from './theme-settings';
import { NotificationSettings } from './notification-settings';
import { TranslationStats } from '@/components/translation/translation-stats';

interface CompleteUserSettingsProps {
  user: User | null;
  localSettings: Partial<User>;
  onSettingUpdate: (key: keyof User, value: string | boolean) => void;
  onUserUpdate: (updatedUser: Partial<User>) => void;
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

export function CompleteUserSettings({ user, localSettings, onSettingUpdate, onUserUpdate, children }: CompleteUserSettingsProps) {
  const [activeTab, setActiveTab] = useState('user');

  // Gérer l'ancrage URL pour les tabs
  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash && ['user', 'languages', 'translation', 'models', 'system-test', 'cache', 'theme', 'notifications', 'stats'].includes(hash)) {
      setActiveTab(hash);
    }
  }, []);

  // Mettre à jour l'URL quand l'onglet change
  useEffect(() => {
    window.history.replaceState(null, '', `#${activeTab}`);
  }, [activeTab]);

  const getLanguageDisplay = (code: string) => {
    const lang = LANGUAGES.find(l => l.code === code);
    return lang ? `${lang.flag} ${lang.name}` : code;
  };

  if (!user) return null;

  return (
    <div className="w-full">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8 gap-1">
          <TabsTrigger value="user" className="gap-1 lg:gap-2 text-xs lg:text-sm">
            <UserIcon className="h-3 w-3 lg:h-4 lg:w-4" />
            <span className="hidden sm:inline">Profil</span>
          </TabsTrigger>
          <TabsTrigger value="languages" className="gap-1 lg:gap-2 text-xs lg:text-sm">
            <Languages className="h-3 w-3 lg:h-4 lg:w-4" />
            <span className="hidden sm:inline">Langues</span>
          </TabsTrigger>
          <TabsTrigger value="translation" className="gap-1 lg:gap-2 text-xs lg:text-sm">
            <Globe className="h-3 w-3 lg:h-4 lg:w-4" />
            <span className="hidden sm:inline">Traduction</span>
          </TabsTrigger>
          <TabsTrigger value="models" className="gap-1 lg:gap-2 text-xs lg:text-sm">
            <Zap className="h-3 w-3 lg:h-4 lg:w-4" />
            <span className="hidden sm:inline">Modèles</span>
          </TabsTrigger>
          <TabsTrigger value="system-test" className="gap-1 lg:gap-2 text-xs lg:text-sm">
            <Database className="h-3 w-3 lg:h-4 lg:w-4" />
            <span className="hidden sm:inline">Tests</span>
          </TabsTrigger>
          <TabsTrigger value="cache" className="gap-1 lg:gap-2 text-xs lg:text-sm">
            <HardDrive className="h-3 w-3 lg:h-4 lg:w-4" />
            <span className="hidden sm:inline">Cache</span>
          </TabsTrigger>
          <TabsTrigger value="theme" className="gap-1 lg:gap-2 text-xs lg:text-sm">
            <Palette className="h-3 w-3 lg:h-4 lg:w-4" />
            <span className="hidden sm:inline">Thème</span>
          </TabsTrigger>
          <TabsTrigger value="stats" className="gap-1 lg:gap-2 text-xs lg:text-sm">
            <BarChart3 className="h-3 w-3 lg:h-4 lg:w-4" />
            <span className="hidden sm:inline">Stats</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="user" className="space-y-4">
          <UserSettings user={user} onUserUpdate={onUserUpdate} />
        </TabsContent>

        <TabsContent value="languages" className="space-y-4">
          <LanguageSettings user={user} onUserUpdate={onUserUpdate} />
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
          <UnifiedModelSettings />
        </TabsContent>

        <TabsContent value="system-test" className="space-y-4">
          <EnhancedSystemTestComponent />
        </TabsContent>

        <TabsContent value="cache" className="space-y-4">
          <CacheManager />
        </TabsContent>

        <TabsContent value="theme" className="space-y-4">
          <ThemeSettings />
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <NotificationSettings />
        </TabsContent>

        <TabsContent value="stats" className="space-y-4">
          <TranslationStats />
        </TabsContent>
      </Tabs>

      {children}
    </div>
  );
}
