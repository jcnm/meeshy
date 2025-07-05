'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { 
  User, 
  Globe, 
  Brain, 
  Database, 
  Palette, 
  Shield,
  Bell
} from 'lucide-react';
import { User as UserType } from '@/types';
import { UserSettings } from '@/components/user-settings';
import { LanguageSettings } from '@/components/language-settings';
import { ModelSettings } from '@/components/model-settings';
import { CacheManager } from '@/components/cache-manager';
import { ThemeSettings } from '@/components/theme-settings';
import { PrivacySettings } from '@/components/privacy-settings';
import { NotificationSettings } from '@/components/notification-settings';

interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserType | null;
  onUserUpdate: (user: UserType) => void;
}

interface TabConfig {
  id: string;
  label: string;
  icon: React.ReactNode;
  component: React.ReactNode;
}

export function ConfigModal({ isOpen, onClose, currentUser, onUserUpdate }: ConfigModalProps) {
  const [activeTab, setActiveTab] = useState('user');

  const tabs: TabConfig[] = [
    {
      id: 'user',
      label: 'Profil utilisateur',
      icon: <User className="h-4 w-4" />,
      component: <UserSettings user={currentUser} onUserUpdate={onUserUpdate} />
    },
    {
      id: 'language',
      label: 'Langues & Traduction',
      icon: <Globe className="h-4 w-4" />,
      component: <LanguageSettings user={currentUser} onUserUpdate={onUserUpdate} />
    },
    {
      id: 'models',
      label: 'Modèles IA',
      icon: <Brain className="h-4 w-4" />,
      component: <ModelSettings />
    },
    {
      id: 'cache',
      label: 'Cache & Performance',
      icon: <Database className="h-4 w-4" />,
      component: <CacheManager />
    },
    {
      id: 'theme',
      label: 'Apparence',
      icon: <Palette className="h-4 w-4" />,
      component: <ThemeSettings />
    },
    {
      id: 'notifications',
      label: 'Notifications',
      icon: <Bell className="h-4 w-4" />,
      component: <NotificationSettings />
    },
    {
      id: 'privacy',
      label: 'Confidentialité',
      icon: <Shield className="h-4 w-4" />,
      component: <PrivacySettings />
    }
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[98vw] w-full h-[95vh] p-0 sm:max-w-[95vw] sm:h-[90vh]">
        <DialogHeader className="px-4 py-3 border-b sm:px-6 sm:py-4">
          <DialogTitle className="text-lg sm:text-xl font-semibold">Paramètres et Configuration</DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar avec tabs - Desktop */}
          <div className="hidden lg:flex lg:w-72 xl:w-80 lg:flex-col lg:border-r lg:bg-muted/30">
            <ScrollArea className="flex-1 p-4 xl:p-6">
              <div className="space-y-2 xl:space-y-3">
                {tabs.map((tab) => (
                  <Button
                    key={tab.id}
                    variant={activeTab === tab.id ? 'secondary' : 'ghost'}
                    className="w-full justify-start gap-2 xl:gap-3 h-12 xl:h-14 text-left text-sm xl:text-base"
                    onClick={() => setActiveTab(tab.id)}
                  >
                    <div className="flex items-center gap-2 xl:gap-3">
                      {tab.icon}
                      <span className="font-medium">{tab.label}</span>
                    </div>
                  </Button>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Contenu principal */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Menu déroulant pour mobile et tablette */}
            <div className="lg:hidden p-3 sm:p-4 border-b bg-background">
              <select 
                value={activeTab} 
                onChange={(e) => setActiveTab(e.target.value)}
                className="w-full p-2 sm:p-3 border rounded-lg bg-background text-sm sm:text-base"
              >
                {tabs.map((tab) => (
                  <option key={tab.id} value={tab.id}>
                    {tab.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Contenu de l'onglet actif */}
            <ScrollArea className="flex-1 p-3 sm:p-4 lg:p-6 xl:p-8">
              <div className="max-w-none lg:max-w-5xl xl:max-w-6xl mx-auto">
                {tabs.find(tab => tab.id === activeTab)?.component}
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
