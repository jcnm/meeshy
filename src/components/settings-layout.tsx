'use client';

import { useState, useEffect, useCallback } from 'react';
import { ResponsiveLayout } from '@/components/responsive-layout';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Languages,
  Bell,
  Shield,
  User,
  Palette,
  Save,
  RotateCcw
} from 'lucide-react';
import { User as UserType, SUPPORTED_LANGUAGES, LanguageCode } from '@/types';
import { toast } from 'sonner';
import { buildApiUrl, API_ENDPOINTS } from '@/lib/config';

interface SettingsLayoutProps {
  currentUser: UserType;
  initialTab?: string;
}

interface SettingsSection {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

export function SettingsLayout({ currentUser, initialTab = 'profile' }: SettingsLayoutProps) {
  // États principaux
  const [selectedSection, setSelectedSection] = useState<string>(initialTab);
  const [localSettings, setLocalSettings] = useState<Partial<UserType>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Sections des paramètres
  const settingsSections: SettingsSection[] = [
    {
      id: 'profile',
      title: 'Profil',
      description: 'Informations personnelles',
      icon: User
    },
    {
      id: 'language',
      title: 'Langues',
      description: 'Préférences de traduction',
      icon: Languages
    },
    {
      id: 'notifications',
      title: 'Notifications',
      description: 'Alertes et notifications',
      icon: Bell
    },
    {
      id: 'privacy',
      title: 'Confidentialité',
      description: 'Paramètres de confidentialité',
      icon: Shield
    },
    {
      id: 'appearance',
      title: 'Apparence',
      description: 'Thème et interface',
      icon: Palette
    }
  ];

  // Initialiser les paramètres locaux
  useEffect(() => {
    setLocalSettings({
      systemLanguage: currentUser.systemLanguage,
      regionalLanguage: currentUser.regionalLanguage,
      customDestinationLanguage: currentUser.customDestinationLanguage,
      autoTranslateEnabled: currentUser.autoTranslateEnabled,
      translateToSystemLanguage: currentUser.translateToSystemLanguage,
      translateToRegionalLanguage: currentUser.translateToRegionalLanguage,
      useCustomDestination: currentUser.useCustomDestination,
    });
  }, [currentUser]);

  // Sauvegarder les paramètres
  const saveSettings = useCallback(async () => {
    setIsSaving(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(buildApiUrl(API_ENDPOINTS.AUTH.ME), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(localSettings)
      });

      if (response.ok) {
        setHasChanges(false);
        toast.success('Paramètres sauvegardés avec succès');
      } else {
        toast.error('Erreur lors de la sauvegarde');
      }
    } catch (error) {
      console.error('Erreur sauvegarde:', error);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setIsSaving(false);
    }
  }, [localSettings]);

  // Réinitialiser les paramètres
  const resetSettings = useCallback(() => {
    setLocalSettings({
      systemLanguage: currentUser.systemLanguage,
      regionalLanguage: currentUser.regionalLanguage,
      customDestinationLanguage: currentUser.customDestinationLanguage,
      autoTranslateEnabled: currentUser.autoTranslateEnabled,
      translateToSystemLanguage: currentUser.translateToSystemLanguage,
      translateToRegionalLanguage: currentUser.translateToRegionalLanguage,
      useCustomDestination: currentUser.useCustomDestination,
    });
    setHasChanges(false);
    toast.info('Paramètres réinitialisés');
  }, [currentUser]);

  // Mettre à jour un paramètre
  const updateSetting = useCallback((key: string, value: unknown) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  }, []);

  // Contenu de la sidebar
  const sidebarContent = (
    <div className="space-y-2">
      {settingsSections.map((section) => {
        const IconComponent = section.icon;
        return (
          <Card 
            key={section.id}
            className={`cursor-pointer transition-colors hover:bg-gray-50 ${
              selectedSection === section.id ? 'ring-2 ring-blue-500 bg-blue-50' : ''
            }`}
            onClick={() => setSelectedSection(section.id)}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <IconComponent className="w-4 h-4 mr-2" />
                {section.title}
              </CardTitle>
              <CardDescription className="text-xs">
                {section.description}
              </CardDescription>
            </CardHeader>
          </Card>
        );
      })}

      {/* Actions de sauvegarde */}
      {hasChanges && (
        <>
          <Separator className="my-4" />
          <div className="space-y-2">
            <Button 
              onClick={saveSettings} 
              disabled={isSaving}
              className="w-full"
              size="sm"
            >
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? 'Sauvegarde...' : 'Sauvegarder'}
            </Button>
            <Button 
              onClick={resetSettings} 
              variant="outline"
              className="w-full"
              size="sm"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Réinitialiser
            </Button>
          </div>
        </>
      )}
    </div>
  );

  // Rendu du contenu selon la section sélectionnée
  const renderSectionContent = () => {
    switch (selectedSection) {
      case 'profile':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-4">Informations du profil</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Nom d'utilisateur</Label>
                  <div className="mt-1 p-2 bg-gray-50 rounded-md">
                    {currentUser.username}
                  </div>
                </div>
                <div>
                  <Label>Email</Label>
                  <div className="mt-1 p-2 bg-gray-50 rounded-md">
                    {currentUser.email}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'language':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-4">Paramètres de langue</h3>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="systemLanguage">Langue du système</Label>
                  <Select 
                    value={localSettings.systemLanguage} 
                    onValueChange={(value) => updateSetting('systemLanguage', value)}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SUPPORTED_LANGUAGES.map((lang: LanguageCode) => (
                        <SelectItem key={lang.code} value={lang.code}>
                          {lang.flag} {lang.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="regionalLanguage">Langue régionale</Label>
                  <Select 
                    value={localSettings.regionalLanguage} 
                    onValueChange={(value) => updateSetting('regionalLanguage', value)}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SUPPORTED_LANGUAGES.map((lang: LanguageCode) => (
                        <SelectItem key={lang.code} value={lang.code}>
                          {lang.flag} {lang.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Traduction automatique</Label>
                      <p className="text-sm text-gray-500">Activer la traduction automatique des messages</p>
                    </div>
                    <Switch
                      checked={localSettings.autoTranslateEnabled}
                      onCheckedChange={(checked) => updateSetting('autoTranslateEnabled', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Traduire vers la langue système</Label>
                      <p className="text-sm text-gray-500">Traduire les messages vers votre langue système</p>
                    </div>
                    <Switch
                      checked={localSettings.translateToSystemLanguage}
                      onCheckedChange={(checked) => updateSetting('translateToSystemLanguage', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Traduire vers la langue régionale</Label>
                      <p className="text-sm text-gray-500">Traduire les messages vers votre langue régionale</p>
                    </div>
                    <Switch
                      checked={localSettings.translateToRegionalLanguage}
                      onCheckedChange={(checked) => updateSetting('translateToRegionalLanguage', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Utiliser une destination personnalisée</Label>
                      <p className="text-sm text-gray-500">Utiliser une langue de destination personnalisée</p>
                    </div>
                    <Switch
                      checked={localSettings.useCustomDestination}
                      onCheckedChange={(checked) => updateSetting('useCustomDestination', checked)}
                    />
                  </div>

                  {localSettings.useCustomDestination && (
                    <div>
                      <Label htmlFor="customDestinationLanguage">Langue de destination personnalisée</Label>
                      <Select 
                        value={localSettings.customDestinationLanguage || ''} 
                        onValueChange={(value) => updateSetting('customDestinationLanguage', value)}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Choisir une langue" />
                        </SelectTrigger>
                        <SelectContent>
                          {SUPPORTED_LANGUAGES.map((lang: LanguageCode) => (
                            <SelectItem key={lang.code} value={lang.code}>
                              {lang.flag} {lang.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );

      case 'notifications':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-4">Paramètres de notification</h3>
              <div className="text-center text-gray-500 py-8">
                Paramètres de notification à implémenter
              </div>
            </div>
          </div>
        );

      case 'privacy':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-4">Paramètres de confidentialité</h3>
              <div className="text-center text-gray-500 py-8">
                Paramètres de confidentialité à implémenter
              </div>
            </div>
          </div>
        );

      case 'appearance':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-4">Paramètres d'apparence</h3>
              <div className="text-center text-gray-500 py-8">
                Paramètres d'apparence à implémenter
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // Contenu principal
  const mainContent = (
    <div className="h-full">
      <ScrollArea className="h-full">
        <div className="p-6">
          {renderSectionContent()}
        </div>
      </ScrollArea>
    </div>
  );

  const selectedSectionData = settingsSections.find(s => s.id === selectedSection);

  return (
    <ResponsiveLayout
      currentUser={currentUser}
      sidebarTitle="Paramètres"
      sidebarContent={sidebarContent}
      showMainContent={true}
      mainContentTitle={selectedSectionData?.title}
      mainContentSubtitle={selectedSectionData?.description}
      mainContent={mainContent}
      onBackToList={() => setSelectedSection('profile')}
    >
      <div />
    </ResponsiveLayout>
  );
}
