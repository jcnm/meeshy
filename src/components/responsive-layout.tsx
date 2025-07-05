'use client';

import { ReactNode, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import {
  MessageSquare,
  Users,
  Settings,
  ArrowLeft,
  Search,
  MoreVertical,
  Bell,
  LogOut,
  Menu,
  X
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MeeshyLogo } from '@/components/meeshy-logo';
import { User } from '@/types';

interface ResponsiveLayoutProps {
  currentUser: User;
  children: ReactNode;
  
  // Sidebar list props
  sidebarTitle: string;
  sidebarContent: ReactNode;
  
  // Main content props
  showMainContent: boolean;
  mainContentTitle?: string;
  mainContentSubtitle?: string;
  mainContentActions?: ReactNode;
  mainContent?: ReactNode;
  
  // Mobile navigation
  onBackToList?: () => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  badge?: number;
}

export function ResponsiveLayout({
  currentUser,
  children,
  sidebarTitle,
  sidebarContent,
  showMainContent,
  mainContentTitle,
  mainContentSubtitle,
  mainContentActions,
  mainContent,
  onBackToList
}: ResponsiveLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Détection mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Navigation items
  const navItems: NavItem[] = [
    {
      id: 'dashboard',
      label: 'Conversations',
      icon: MessageSquare,
      href: '/dashboard',
      badge: 0 // TODO: compter messages non lus
    },
    {
      id: 'groups',
      label: 'Groupes',
      icon: Users,
      href: '/groups',
      badge: 0 // TODO: compter notifications groupes
    },
    {
      id: 'settings',
      label: 'Paramètres',
      icon: Settings,
      href: '/settings'
    }
  ];

  const currentNavItem = navItems.find(item => pathname.startsWith(item.href));

  const handleNavigation = (href: string) => {
    router.push(href);
    setIsMobileMenuOpen(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    router.push('/');
  };

  // Mobile: affichage en plein écran de la liste ou du contenu principal
  if (isMobile) {
    return (
      <div className="h-screen bg-white flex flex-col">
        {/* Header mobile */}
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          {showMainContent ? (
            // Mode conversation/détail
            <div className="flex items-center space-x-3 flex-1">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={onBackToList}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex-1 min-w-0">
                <h1 className="font-semibold text-lg truncate">{mainContentTitle}</h1>
                {mainContentSubtitle && (
                  <p className="text-sm text-gray-500 truncate">{mainContentSubtitle}</p>
                )}
              </div>
            </div>
          ) : (
            // Mode liste
            <div className="flex items-center space-x-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMobileMenuOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </Button>
              <MeeshyLogo size="sm" />
              <h1 className="font-semibold text-lg">{sidebarTitle}</h1>
            </div>
          )}
          
          {/* Actions */}
          <div className="flex items-center space-x-2">
            {showMainContent && mainContentActions}
            {!showMainContent && (
              <>
                <Button variant="ghost" size="sm">
                  <Search className="h-5 w-5" />
                </Button>
                <Button variant="ghost" size="sm">
                  <Bell className="h-5 w-5" />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={currentUser.avatar} />
                        <AvatarFallback>
                          {currentUser.firstName?.[0]}{currentUser.lastName?.[0]}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Mon compte</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleNavigation('/settings')}>
                      <Settings className="mr-2 h-4 w-4" />
                      Paramètres
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleLogout}>
                      <LogOut className="mr-2 h-4 w-4" />
                      Déconnexion
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        </header>

        {/* Contenu mobile */}
        <div className="flex-1 overflow-hidden">
          {showMainContent ? (
            // Affichage contenu principal (conversation, groupe, paramètres)
            <div className="h-full flex flex-col">
              {mainContent}
            </div>
          ) : (
            // Affichage liste (conversations, groupes, etc.)
            <ScrollArea className="h-full">
              {sidebarContent}
            </ScrollArea>
          )}
        </div>

        {/* Menu mobile overlay */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex">
            <div className="bg-white w-80 h-full flex flex-col">
              {/* Header menu */}
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <MeeshyLogo size="sm" />
                  <span className="font-semibold">Meeshy</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {/* Navigation */}
              <div className="flex-1 p-4">
                <nav className="space-y-2">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname.startsWith(item.href);
                    
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleNavigation(item.href)}
                        className={cn(
                          "w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors text-left",
                          isActive 
                            ? "bg-blue-50 text-blue-700 border border-blue-200" 
                            : "hover:bg-gray-50 text-gray-700"
                        )}
                      >
                        <Icon className="h-5 w-5" />
                        <span className="flex-1">{item.label}</span>
                        {item.badge && item.badge > 0 && (
                          <Badge variant="destructive" className="h-5 w-5 p-0 text-xs">
                            {item.badge}
                          </Badge>
                        )}
                      </button>
                    );
                  })}
                </nav>
              </div>

              {/* User info */}
              <div className="p-4 border-t border-gray-200">
                <div className="flex items-center space-x-3 mb-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={currentUser.avatar} />
                    <AvatarFallback>
                      {currentUser.firstName?.[0]}{currentUser.lastName?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {currentUser.displayName || `${currentUser.firstName} ${currentUser.lastName}`}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {currentUser.email}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  className="w-full"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Déconnexion
                </Button>
              </div>
            </div>
            
            {/* Overlay pour fermer */}
            <div 
              className="flex-1" 
              onClick={() => setIsMobileMenuOpen(false)}
            />
          </div>
        )}
      </div>
    );
  }

  // Desktop: layout two-panel
  return (
    <div className="h-screen bg-gray-50 flex">
      {/* Sidebar navigation desktop */}
      <div className="w-20 bg-white border-r border-gray-200 flex flex-col items-center py-4 space-y-4">
        <MeeshyLogo size="sm" />
        
        <nav className="flex-1 flex flex-col space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);
            
            return (
              <button
                key={item.id}
                onClick={() => handleNavigation(item.href)}
                className={cn(
                  "relative p-3 rounded-lg transition-colors",
                  isActive 
                    ? "bg-blue-50 text-blue-700" 
                    : "hover:bg-gray-50 text-gray-700"
                )}
                title={item.label}
              >
                <Icon className="h-6 w-6" />
                {item.badge && item.badge > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-1 -right-1 h-5 w-5 p-0 text-xs"
                  >
                    {item.badge}
                  </Badge>
                )}
              </button>
            );
          })}
        </nav>

        {/* User menu desktop */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="p-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src={currentUser.avatar} />
                <AvatarFallback>
                  {currentUser.firstName?.[0]}{currentUser.lastName?.[0]}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="right">
            <DropdownMenuLabel>
              {currentUser.displayName || `${currentUser.firstName} ${currentUser.lastName}`}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleNavigation('/settings')}>
              <Settings className="mr-2 h-4 w-4" />
              Paramètres
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Déconnexion
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Sidebar content */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        {/* Header sidebar */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h1 className="font-semibold text-lg">{sidebarTitle}</h1>
            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="sm">
                <Search className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Sidebar content scrollable */}
        <ScrollArea className="flex-1">
          {sidebarContent}
        </ScrollArea>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col">
        {showMainContent ? (
          <>
            {/* Header main content */}
            {(mainContentTitle || mainContentActions) && (
              <div className="bg-white border-b border-gray-200 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    {mainContentTitle && (
                      <h1 className="font-semibold text-xl truncate">{mainContentTitle}</h1>
                    )}
                    {mainContentSubtitle && (
                      <p className="text-sm text-gray-500 truncate mt-1">{mainContentSubtitle}</p>
                    )}
                  </div>
                  {mainContentActions && (
                    <div className="flex items-center space-x-2 ml-4">
                      {mainContentActions}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Main content */}
            <div className="flex-1 overflow-hidden">
              {mainContent}
            </div>
          </>
        ) : (
          // Placeholder when no content selected
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center text-gray-500">
              <div className="mb-4">
                {currentNavItem && <currentNavItem.icon className="h-16 w-16 mx-auto opacity-20" />}
              </div>
              <h3 className="text-lg font-medium mb-2">
                Sélectionnez {currentNavItem?.label?.toLowerCase()}
              </h3>
              <p className="text-sm">
                Choisissez un élément dans la liste pour commencer
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Children pour contenu additionnel */}
      {children}
    </div>
  );
}
