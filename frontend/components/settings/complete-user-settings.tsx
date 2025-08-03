'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveTabs } from '@/components/ui/responsive-tabs';
import { User } from '@/types';
import { 
  Globe, 
  User as UserIcon, 
  Palette, 
  BarChart3,
  Brain
} from 'lucide-react';
import { UserSettings } from './user-settings';
import { LanguageSettings } from '@/components/translation/language-settings';
import { ModelsSettings } from './models-settings';
import { ThemeSettings } from './theme-settings';
import { TranslationStats } from '@/components/translation/translation-stats';

interface CompleteUserSettingsProps {
  user: User | null;
  onUserUpdate: (updatedUser: Partial<User>) => void;
  children?: React.ReactNode;
}

export function CompleteUserSettings({ user, onUserUpdate, children }: CompleteUserSettingsProps) {
  const [activeTab, setActiveTab] = useState('user');

  // Gérer l'ancrage URL pour les tabs
  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash && ['user', 'translation', 'models', 'theme', 'notifications', 'stats'].includes(hash)) {
      setActiveTab(hash);
    }
  }, []);

  // Mettre à jour l'URL quand l'onglet change
  useEffect(() => {
    window.history.replaceState(null, '', `#${activeTab}`);
  }, [activeTab]);

  if (!user) return null;

  // Définition des onglets avec leurs icônes et contenus
  const tabItems = [
    {
      value: "user",
      label: "Profil",
      icon: <UserIcon className="h-3 w-3 lg:h-4 lg:w-4" />,
      content: <UserSettings user={user} onUserUpdate={onUserUpdate} />
    },
    {
      value: "translation",
      label: "Traduction",
      icon: <Globe className="h-3 w-3 lg:h-4 lg:w-4" />,
      content: (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Configuration des langues et traduction</CardTitle>
            <CardDescription>
              Définissez vos langues et paramètres de traduction
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LanguageSettings user={user} onUserUpdate={onUserUpdate} />
          </CardContent>
        </Card>
      )
    },
    {
      value: "models",
      label: "Modèles",
      icon: <Brain className="h-3 w-3 lg:h-4 lg:w-4" />,
      content: <ModelsSettings />
    },
    {
      value: "theme",
      label: "Thème",
      icon: <Palette className="h-3 w-3 lg:h-4 lg:w-4" />,
      content: <ThemeSettings />
    },
    {
      value: "stats",
      label: "Stats",
      icon: <BarChart3 className="h-3 w-3 lg:h-4 lg:w-4" />,
      content: <TranslationStats />
    }
  ];

  return (
    <div className="w-full">
      <ResponsiveTabs
        items={tabItems}
        value={activeTab}
        onValueChange={setActiveTab}
        className="w-full"
        mobileBreakpoint="lg"
      />

      {children}
    </div>
  );
}
