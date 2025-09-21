'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/context/UnifiedProvider';
import { useAuth } from '@/hooks/use-auth';
import { AuthGuard } from '@/components/auth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { 
  Shield, 
  Users, 
  BarChart3, 
  Settings, 
  FileText, 
  Crown,
  LogOut,
  Home,
  Menu,
  X
} from 'lucide-react';
import { PermissionsService } from '@/services/permissions.service';
import { toast } from 'sonner';

interface AdminLayoutProps {
  children: React.ReactNode;
  currentPage?: string;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children, currentPage }) => {
  const { user } = useUser();
  const { logout } = useAuth();
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Vérifier l'accès admin avec useEffect pour éviter setState pendant render
  useEffect(() => {
    if (!user || !PermissionsService.canAccessAdmin(user)) {
      router.push('/dashboard');
    }
  }, [user, router]);

  // Ne pas rendre le contenu si l'utilisateur n'a pas les permissions
  if (!user || !PermissionsService.canAccessAdmin(user)) {
    return null;
  }

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Déconnexion réussie');
      // La redirection se fait automatiquement dans la fonction logout
    } catch (error) {
      console.error('Erreur déconnexion:', error);
      toast.error('Erreur lors de la déconnexion');
    }
  };

  const navigationItems = [
    {
      icon: BarChart3,
      label: 'Tableau de bord',
      href: '/admin',
      permission: 'canAccessAdmin',
    },
    {
      icon: Users,
      label: 'Gestion utilisateurs',
      href: '/admin/users',
      permission: 'canManageUsers',
    },
    {
      icon: Shield,
      label: 'Modération',
      href: '/admin/moderation',
      permission: 'canModerateContent',
    },
    {
      icon: FileText,
      label: 'Logs d\'audit',
      href: '/admin/audit',
      permission: 'canViewAuditLogs',
    },
    {
      icon: BarChart3,
      label: 'Analyses',
      href: '/admin/analytics',
      permission: 'canViewAnalytics',
    },
    {
      icon: Settings,
      label: 'Paramètres système',
      href: '/admin/settings',
      permission: 'canManageTranslations',
    },
  ];

  const filteredNavigation = navigationItems.filter(item => 
    PermissionsService.hasPermission(user, item.permission as keyof typeof user.permissions)
  );

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'BIGBOSS': return '👑';
      case 'ADMIN': return '⚡';
      case 'MODO': return '🛡️';
      case 'AUDIT': return '📊';
      case 'ANALYST': return '📈';
      default: return '👤';
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'BIGBOSS': return 'bg-purple-600 text-white';
      case 'ADMIN': return 'bg-red-600 text-white';
      case 'MODO': return 'bg-orange-600 text-white';
      case 'AUDIT': return 'bg-blue-600 text-white';
      case 'ANALYST': return 'bg-green-600 text-white';
      default: return 'bg-gray-600 text-white';
    }
  };

  return (
    <AuthGuard>
      <div className="flex h-screen bg-gray-50">
        {/* Sidebar */}
        <div className={`bg-white shadow-lg transition-all duration-300 ${
          isSidebarOpen ? 'w-64' : 'w-16'
        } flex flex-col`}>
          {/* Header */}
          <div className="p-4 border-b">
            <div className="flex items-center justify-between">
              <div className={`flex items-center space-x-3 ${!isSidebarOpen && 'justify-center'}`}>
                <Crown className="w-8 h-8 text-purple-600" />
                {isSidebarOpen && (
                  <div>
                    <h1 className="text-xl font-bold text-gray-900">Administration</h1>
                    <p className="text-sm text-gray-500">Panel de contrôle</p>
                  </div>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="p-2"
              >
                {isSidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          {/* User Info */}
          <div className="p-4 border-b">
            <div className={`flex items-center space-x-3 ${!isSidebarOpen && 'justify-center'}`}>
              <Avatar className="w-10 h-10">
                <AvatarImage src={user.avatar} alt={user.displayName || user.username} />
                <AvatarFallback>
                  {(user.displayName || user.username).slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {isSidebarOpen && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {user.displayName || user.username}
                  </p>
                  <Badge className={`text-xs ${getRoleColor(user.role)}`}>
                    {getRoleIcon(user.role)} {user.role}
                  </Badge>
                </div>
              )}
            </div>
          </div>

          {/* Navigation */}
          <ScrollArea className="flex-1 px-2 py-4">
            <nav className="space-y-1">
              {/* Retour au dashboard */}
              <Button
                variant="ghost"
                className={`w-full ${isSidebarOpen ? 'justify-start' : 'justify-center'} h-10`}
                onClick={() => router.push('/dashboard')}
              >
                <Home className="w-5 h-5" />
                {isSidebarOpen && <span className="ml-3">Retour dashboard</span>}
              </Button>

              {/* Navigation admin */}
              {filteredNavigation.map((item) => {
                const Icon = item.icon;
                const isActive = currentPage === item.href;
                
                return (
                  <Button
                    key={item.href}
                    variant={isActive ? "default" : "ghost"}
                    className={`w-full ${isSidebarOpen ? 'justify-start' : 'justify-center'} h-10`}
                    onClick={() => router.push(item.href)}
                  >
                    <Icon className="w-5 h-5" />
                    {isSidebarOpen && <span className="ml-3">{item.label}</span>}
                  </Button>
                );
              })}
            </nav>
          </ScrollArea>

          {/* Footer */}
          <div className="p-4 border-t">
            <Button
              variant="ghost"
              className={`w-full ${isSidebarOpen ? 'justify-start' : 'justify-center'} h-10 text-red-600 hover:text-red-700 hover:bg-red-50`}
              onClick={handleLogout}
            >
              <LogOut className="w-5 h-5" />
              {isSidebarOpen && <span className="ml-3">Déconnexion</span>}
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top Bar */}
          <header className="bg-white shadow-sm border-b px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {currentPage === '/admin' && 'Tableau de bord'}
                  {currentPage === '/admin/users' && 'Gestion des utilisateurs'}
                  {currentPage === '/admin/moderation' && 'Modération'}
                  {currentPage === '/admin/audit' && 'Logs d\'audit'}
                  {currentPage === '/admin/analytics' && 'Analyses'}
                  {currentPage === '/admin/settings' && 'Paramètres système'}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Administration Meeshy - Niveau d&apos;accès: {PermissionsService.getRoleDisplayName(user.role)}
                </p>
              </div>
              
              <div className="flex items-center space-x-4">
                <Badge variant="outline" className="text-green-600 border-green-200">
                  En ligne
                </Badge>
                <span className="text-sm text-gray-500">
                  {new Date().toLocaleDateString('fr-FR', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </span>
              </div>
            </div>
          </header>

          {/* Content Area */}
          <main className="flex-1 overflow-auto p-6">
            {children}
          </main>
        </div>
      </div>
    </AuthGuard>
  );
};

export default AdminLayout;
