'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveTabs } from '@/components/ui/responsive-tabs';
import { User } from '@/types';
import { 
  Globe, 
  User as UserIcon, 
  Palette
} from 'lucide-react';
import { UserSettings } from './user-settings';
import { LanguageSettings } from '@/components/translation/language-settings';
import { ThemeSettings } from './theme-settings';
import { useI18n } from '@/hooks/useI18n';

interface CompleteUserSettingsProps {
  user: User | null;
  onUserUpdate: (updatedUser: Partial<User>) => void;
  children?: React.ReactNode;
}

export function CompleteUserSettings({ user, onUserUpdate, children }: CompleteUserSettingsProps) {
  const { t } = useI18n('settings');
  const [activeTab, setActiveTab] = useState('user');

  // Gérer l'ancrage URL pour les tabs
  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash && ['user', 'translation', 'theme'].includes(hash)) {
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
      label: t('tabs.profile'),
      icon: <UserIcon className="h-3 w-3 lg:h-4 lg:w-4" />,
      content: <UserSettings user={user} onUserUpdate={onUserUpdate} />
    },
    {
      value: "translation",
      label: t('tabs.translation'),
      icon: <Globe className="h-3 w-3 lg:h-4 lg:w-4" />,
      content: (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('translation.title')}</CardTitle>
            <CardDescription>
              {t('translation.description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LanguageSettings user={user} onUserUpdate={onUserUpdate} />
          </CardContent>
        </Card>
      )
    },
    {
      value: "theme",
      label: t('tabs.theme'),
      icon: <Palette className="h-3 w-3 lg:h-4 lg:w-4" />,
      content: <ThemeSettings />
    }
  ];

  return (
    <div className="w-full space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <ResponsiveTabs
          items={tabItems}
          value={activeTab}
          onValueChange={setActiveTab}
          className="w-full"
          mobileBreakpoint="lg"
        />
      </div>

      {children}
    </div>
  );
}
