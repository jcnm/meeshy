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
      <DialogContent className="max-w-6xl h-[80vh] p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="text-xl font-semibold">Paramètres et Configuration</DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar avec tabs - Desktop */}
          <div className="hidden lg:flex lg:w-64 lg:flex-col lg:border-r lg:bg-muted/30">
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-2">
                {tabs.map((tab) => (
                  <Button
                    key={tab.id}
                    variant={activeTab === tab.id ? 'secondary' : 'ghost'}
                    className="w-full justify-start gap-3 h-12"
                    onClick={() => setActiveTab(tab.id)}
                  >
                    {tab.icon}
                    <span className="text-left">{tab.label}</span>
                  </Button>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Contenu principal */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Menu déroulant pour mobile */}
            <div className="lg:hidden p-4 border-b">
              <select 
                value={activeTab} 
                onChange={(e) => setActiveTab(e.target.value)}
                className="w-full p-2 border rounded-md bg-background"
              >
                {tabs.map((tab) => (
                  <option key={tab.id} value={tab.id}>
                    {tab.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Contenu de l'onglet actif */}
            <ScrollArea className="flex-1 p-6">
              {tabs.find(tab => tab.id === activeTab)?.component}
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
