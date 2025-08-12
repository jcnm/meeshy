'use client';

import { ReactNode, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  MessageSquare, 
  Bell, 
  Search,
  LogOut,
  Settings,
  User as UserIcon,
  Home,
  Users,
  UserPlus,
  Link as LinkIcon,
  ChevronDown,
  Shield,
  Brain
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { User } from '@/types';
import { buildApiUrl, API_ENDPOINTS } from '@/lib/config';
import { useUser } from '@/context/AppContext';

interface DashboardLayoutProps {
  children: ReactNode;
  title?: string;
  hideSearch?: boolean;
}

export function DashboardLayout({ 
  children, 
  title,
  hideSearch = false
}: DashboardLayoutProps) {
  const router = useRouter();
  const { user, logout } = useUser();
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Gérer l'état de chargement basé sur l'utilisateur du hook
  useEffect(() => {
    // Si l'utilisateur est défini ou si la vérification d'auth est terminée
    if (user || !user) {
      setIsLoading(false);
    }
  }, [user]);

  const handleLogout = async () => {
    try {
      // Appeler l'API de déconnexion si possible
      const token = localStorage.getItem('auth_token');
      if (token) {
        try {
          await fetch(buildApiUrl(API_ENDPOINTS.AUTH.LOGOUT), {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` }
          });
        } catch (error) {
          console.error('Erreur API déconnexion:', error);
        }
      }
      
      // Utiliser la fonction logout centralisée
      logout();
      toast.success('Déconnexion réussie');
    } catch (error) {
      console.error('Erreur déconnexion:', error);
      toast.error('Erreur lors de la déconnexion');
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header fixe */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo et titre */}
            <div className="flex items-center space-x-4">
              <div 
                className="flex items-center space-x-2 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => router.push('/')}
              >
                <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                  <MessageSquare className="h-5 w-5 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900">Meeshy</h1>
              </div>
              {title && (
                <div className="hidden md:block">
                  <span className="text-gray-400 mx-2">/</span>
                  <span className="text-lg font-medium text-gray-700">{title}</span>
                </div>
              )}
            </div>

            {/* Barre de recherche */}
            {!hideSearch && (
              <div className="flex-1 max-w-lg mx-8">
                <form onSubmit={handleSearch} className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Rechercher conversations, groupes, contacts..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 w-full"
                  />
                </form>
              </div>
            )}

            {/* Menu utilisateur */}
            <div className="flex items-center space-x-4">
              {/* Notifications */}
              <Button 
                variant="ghost" 
                size="sm" 
                className="relative"
                onClick={() => router.push('/notifications')}
              >
                <Bell className="h-5 w-5" />
                <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 text-xs bg-red-500">
                  3
                </Badge>
              </Button>

              {/* Menu déroulant utilisateur */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center space-x-3 hover:bg-gray-100">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user.avatar} alt={user.firstName} />
                      <AvatarFallback>
                        {user.firstName?.charAt(0)}{user.lastName?.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="hidden md:block text-left">
                      <p className="text-sm font-medium text-gray-900">
                        {user.firstName} {user.lastName}
                      </p>
                      <p className="text-xs text-gray-500">@{user.username}</p>
                    </div>
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  </Button>
                </DropdownMenuTrigger>
                
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onClick={() => router.push('/dashboard')}>
                    <Home className="mr-2 h-4 w-4" />
                    <span>Tableau de bord</span>
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem onClick={() => router.push('/conversations')}>
                    <MessageSquare className="mr-2 h-4 w-4" />
                    <span>Conversations</span>
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem onClick={() => router.push('/groups')}>
                    <Users className="mr-2 h-4 w-4" />
                    <span>Groupes</span>
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem onClick={() => router.push('/contacts')}>
                    <UserPlus className="mr-2 h-4 w-4" />
                    <span>Contacts</span>
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem onClick={() => router.push('/links')}>
                    <LinkIcon className="mr-2 h-4 w-4" />
                    <span>Liens</span>
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem onClick={() => router.push('/models')}>
                    <Brain className="mr-2 h-4 w-4" />
                    <span>Modèles</span>
                  </DropdownMenuItem>
                  
                  <DropdownMenuSeparator />
                  
                  <DropdownMenuItem onClick={() => router.push('/profile')}>
                    <UserIcon className="mr-2 h-4 w-4" />
                    <span>Profil</span>
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem onClick={() => router.push('/settings')}>
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Paramètres</span>
                  </DropdownMenuItem>
                  
                  {/* Lien Admin - Affiché seulement si l'utilisateur a les permissions */}
                  {user.permissions?.canAccessAdmin && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => router.push('/admin')}>
                        <Shield className="mr-2 h-4 w-4" />
                        <span>Administration</span>
                      </DropdownMenuItem>
                    </>
                  )}
                  
                  <DropdownMenuSeparator />
                  
                  <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Déconnexion</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      {/* Contenu principal avec padding-top pour compenser le header fixe */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-8">
        {children}
      </main>
    </div>
  );
}
