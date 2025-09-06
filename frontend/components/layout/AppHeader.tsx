'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  MessageSquare,
  Bell,
  Search,
  LogOut,
  Settings,
  User as UserIcon,
  Home,
  Users,
  UserPlus
} from 'lucide-react';
import { useUser } from '@/context/AppContext';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import { useTranslations } from '@/hooks/useTranslations';
import type { User } from '@shared/types';

interface AppHeaderProps {
  showSearch?: boolean;
  showNotifications?: boolean;
  currentPage?: 'home' | 'conversations' | 'groups' | 'settings';
  className?: string;
}

export function AppHeader({ 
  showSearch = true, 
  showNotifications = true, 
  currentPage = 'home',
  className = ''
}: AppHeaderProps) {
  const router = useRouter();
  const { user, isAuthChecking } = useUser();
  const { logout } = useAuth();
  const { t } = useTranslations('toasts');

  const handleLogout = () => {
    logout();
    toast.success(t('auth.logoutSuccess'));
  };

  const handleNavigation = (path: string) => {
    router.push(path);
  };

  if (isAuthChecking) {
    return (
      <header className={`bg-white/95 backdrop-blur-sm border-b border-gray-200/50 px-4 py-3 ${className}`}>
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <div className="h-8 w-8 bg-gray-200 rounded animate-pulse"></div>
            <div className="h-6 w-24 bg-gray-200 rounded animate-pulse"></div>
          </div>
          <div className="flex items-center space-x-2">
            <div className="h-8 w-8 bg-gray-200 rounded animate-pulse"></div>
            <div className="h-8 w-8 bg-gray-200 rounded animate-pulse"></div>
            <div className="h-10 w-10 bg-gray-200 rounded-full animate-pulse"></div>
          </div>
        </div>
      </header>
    );
  }

  if (!user) {
    return (
      <header className={`bg-white/95 backdrop-blur-sm border-b border-gray-200/50 px-4 py-3 ${className}`}>
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <MessageSquare className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold text-gray-900">Meeshy</span>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="sm" onClick={() => handleNavigation('/login')}>
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Se connecter</span>
            </Button>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className={`bg-white/95 backdrop-blur-sm border-b border-gray-200/50 px-4 py-3 ${className}`}>
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        {/* Logo et Navigation */}
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            <MessageSquare className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold text-gray-900">Meeshy</span>
          </div>
          
          {/* Navigation principale */}
          <nav className="hidden md:flex items-center space-x-1">
            <Button 
              variant={currentPage === 'home' ? 'default' : 'ghost'} 
              size="sm"
              onClick={() => handleNavigation('/')}
            >
              <Home className="h-4 w-4 mr-2" />
              Accueil
            </Button>
            <Button 
              variant={currentPage === 'conversations' ? 'default' : 'ghost'} 
              size="sm"
              onClick={() => handleNavigation('/conversations')}
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Conversations
            </Button>
            <Button 
              variant={currentPage === 'groups' ? 'default' : 'ghost'} 
              size="sm"
              onClick={() => handleNavigation('/groups')}
            >
              <Users className="h-4 w-4 mr-2" />
              Groupes
            </Button>
          </nav>
        </div>

        {/* Actions utilisateur */}
        <div className="flex items-center space-x-3">
          {/* Recherche */}
          {showSearch && (
            <Button variant="ghost" size="sm" onClick={() => handleNavigation('/search')}>
              <Search className="h-4 w-4" />
            </Button>
          )}

          {/* Notifications */}
          {showNotifications && (
            <Button variant="ghost" size="sm" onClick={() => handleNavigation('/notifications')}>
              <Bell className="h-4 w-4" />
            </Button>
          )}

          {/* Profil utilisateur */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0">
                <Avatar className="h-10 w-10">
                  <AvatarImage 
                    src={user.avatar || undefined} 
                    alt={user.firstName || user.username} 
                  />
                  <AvatarFallback>
                    {user.firstName ? user.firstName[0].toUpperCase() : user.username[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-80" align="end">
              {/* Info utilisateur */}
              <div className="p-4 border-b">
                <div className="flex items-center space-x-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage 
                      src={user.avatar || undefined} 
                      alt={user.firstName || user.username} 
                    />
                    <AvatarFallback>
                      {user.firstName ? user.firstName[0].toUpperCase() : user.username[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {user.firstName && user.lastName 
                        ? `${user.firstName} ${user.lastName}` 
                        : user.username
                      }
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      @{user.username}
                    </p>
                    {user.email && (
                      <p className="text-xs text-gray-500 truncate">
                        {user.email}
                      </p>
                    )}
                    <div className="flex items-center space-x-2 mt-1">
                      <Badge variant="secondary" className="text-xs">
                        {user.systemLanguage || 'fr'}
                      </Badge>
                      {user.autoTranslateEnabled && (
                        <Badge variant="outline" className="text-xs">
                          Auto-traduction
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="p-1">
                <DropdownMenuItem onClick={() => handleNavigation('/settings')}>
                  <Settings className="h-4 w-4 mr-2" />
                  Paramètres
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleNavigation('/contacts')}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Contacts
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                  <LogOut className="h-4 w-4 mr-2" />
                  Se déconnecter
                </DropdownMenuItem>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
