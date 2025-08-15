'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { 
  Menu, 
  X, 
  MessageSquare, 
  Users, 
  Settings, 
  Home,
  UserPlus,
  Link as LinkIcon,
  Bell,
  Search,
  LogOut
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUser } from '@/context/AppContext';
import { Z_CLASSES } from '@/lib/z-index';
import { 
  Avatar, 
  AvatarFallback, 
  Button, 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  Badge
} from '@/components/common';

interface NavigationItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

const navigationItems: NavigationItem[] = [
  { href: '/dashboard', label: 'Tableau de bord', icon: Home },
  { href: '/conversations', label: 'Conversations', icon: MessageSquare },
  { href: '/groups', label: 'Groupes', icon: Users },
  { href: '/contacts', label: 'Contacts', icon: UserPlus },
  { href: '/links', label: 'Liens', icon: LinkIcon },
  { href: '/settings', label: 'Paramètres', icon: Settings },
];

interface NavigationProps {
  className?: string;
}

export function Navigation({ className }: NavigationProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useUser();

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth >= 768) {
        setIsOpen(false);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleLogout = () => {
    logout();
    // La redirection se fait automatiquement dans la fonction logout
  };

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname.startsWith(href);
  };

  const getUserInitials = (user: { firstName?: string; lastName?: string; username?: string } | null) => {
    if (!user) return 'U';
    const firstName = user.firstName || user.username || '';
    const lastName = user.lastName || '';
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || 'U';
  };

  return (
    <>
      {/* Mobile Menu Button */}
      {isMobile && (
        <Button
          variant="ghost"
          size="sm"
          className={`fixed top-4 left-4 ${Z_CLASSES.HEADER} md:hidden`}
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      )}

      {/* Sidebar */}
      <nav
        className={cn(
          'flex flex-col h-full bg-card border-r border-border transition-all duration-300',
          isMobile
            ? cn(
                `fixed inset-y-0 left-0 ${Z_CLASSES.NAVIGATION_SIDEBAR} w-64 transform`,
                isOpen ? 'translate-x-0' : '-translate-x-full'
              )
            : 'w-64',
          className
        )}
      >
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-primary-foreground" />
              </div>
            </div>
            <div>
              <h1 className="text-lg font-semibold">Meeshy</h1>
              <p className="text-xs text-muted-foreground">Messagerie intelligente</p>
            </div>
          </div>
        </div>

        {/* User Info */}
        {user && (
          <div className="p-4 border-b border-border">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="w-full justify-start p-2 h-auto">
                  <div className="flex items-center space-x-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">
                        {getUserInitials(user)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="text-left">
                      <p className="text-sm font-medium">
                        {user.firstName} {user.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {user.email}
                      </p>
                    </div>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuItem onClick={() => router.push('/settings')}>
                  <Settings className="mr-2 h-4 w-4" />
                  Paramètres
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Se déconnecter
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {/* Search */}
        <div className="p-4 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Rechercher..."
              className="w-full pl-10 pr-4 py-2 text-sm border border-input rounded-md bg-background"
            />
          </div>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-2 space-y-1">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    'flex items-center space-x-3 px-3 py-2 text-sm font-medium rounded-md transition-colors',
                    active
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  )}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {item.badge && item.badge > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {item.badge}
                    </Badge>
                  )}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Notifications */}
        <div className="p-4 border-t border-border">
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={() => router.push('/notifications')}
          >
            <Bell className="mr-3 h-5 w-5" />
            Notifications
            <Badge variant="destructive" className="ml-auto text-xs">
              3
            </Badge>
          </Button>
        </div>
      </nav>

      {/* Mobile Overlay */}
      {isMobile && isOpen && (
        <div
          className={`fixed inset-0 bg-background/80 backdrop-blur-sm ${Z_CLASSES.MOBILE_OVERLAY} mobile-overlay`}
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
