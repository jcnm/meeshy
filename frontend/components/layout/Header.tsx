'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { 
  MessageSquare, 
  LogIn, 
  UserPlus,
  Share,
  User,
  LogOut,
  AlertTriangle
} from 'lucide-react';
import { LoginForm } from '@/components/auth/login-form';
import { RegisterForm } from '@/components/auth/register-form';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LanguageSwitcher } from '@/components/common/language-switcher';
import { useTranslations } from 'next-intl';

interface HeaderProps {
  // Mode d'affichage
  mode?: 'landing' | 'chat';
  
  // Pour le mode chat
  conversationTitle?: string;
  shareLink?: string;
  
  // Pour le mode landing
  authMode?: 'welcome' | 'login' | 'register' | 'join';
  onAuthModeChange?: (mode: 'welcome' | 'login' | 'register' | 'join') => void;
  anonymousChatLink?: string | null;
  
  // Informations utilisateur pour le menu
  user?: {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
    displayName?: string;
    isAnonymous?: boolean;
  } | null;
  
  // Fonctions de gestion
  onLogout?: () => void;
  onClearAnonymousSession?: () => void;
}

export function Header({ 
  mode = 'landing',
  conversationTitle,
  shareLink,
  authMode = 'welcome',
  onAuthModeChange,
  anonymousChatLink,
  user,
  onLogout,
  onClearAnonymousSession
}: HeaderProps) {
  const router = useRouter();
  const [showClearSessionDialog, setShowClearSessionDialog] = useState(false);
  const t = useTranslations('header');

  const handleShare = () => {
    if (shareLink) {
      navigator.clipboard.writeText(shareLink);
      toast.success(t('shareLinkCopied'));
    }
  };

  return (
    <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <button 
            onClick={() => router.push('/')}
            className="flex items-center space-x-2 hover:opacity-80 transition-opacity cursor-pointer"
          >
            <div className="h-8 w-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
              <MessageSquare className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">Meeshy</span>
          </button>
          
          {/* Titre de la conversation pour le mode chat */}
          {mode === 'chat' && conversationTitle && (
            <>
              <div className="h-4 w-px bg-gray-300 mx-2"></div>
              <span className="text-sm text-gray-600 font-medium">
                {conversationTitle}
              </span>
            </>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          
          {/* Language Switcher */}
          <LanguageSwitcher />
          
          {/* Mode chat - Boutons de partage et menu utilisateur */}
          {mode === 'chat' && (
            <>
              {shareLink && (
                <Button 
                  onClick={handleShare}
                  variant="outline"
                  className="flex items-center space-x-2 bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                >
                  <Share className="h-4 w-4" />
                  <span>Partager</span>
                </Button>
              )}
              
              {/* Menu utilisateur */}
              {user && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="flex items-center space-x-2">
                      <User className="h-4 w-4" />
                      <span>{user.displayName || user.firstName || user.username}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <div className="px-3 py-2">
                      <p className="text-sm font-medium">{user.displayName || `${user.firstName} ${user.lastName}`}</p>
                      <p className="text-xs text-gray-500">@{user.username}</p>
                      {user.isAnonymous && (
                        <p className="text-xs text-orange-600 mt-1">Session anonyme</p>
                      )}
                    </div>
                    <DropdownMenuSeparator />
                    
                    {user.isAnonymous ? (
                      <>
                        <DropdownMenuItem onClick={() => onAuthModeChange?.('login')}>
                          <LogIn className="h-4 w-4 mr-2" />
                          Se connecter
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onAuthModeChange?.('register')}>
                          <UserPlus className="h-4 w-4 mr-2" />
                          S'inscrire
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => setShowClearSessionDialog(true)}
                          className="text-red-600 focus:text-red-600"
                        >
                          <LogOut className="h-4 w-4 mr-2" />
                          {t('clearSession')}
                        </DropdownMenuItem>
                      </>
                    ) : (
                      <>
                        <DropdownMenuItem onClick={() => router.push('/profile')}>
                          <User className="h-4 w-4 mr-2" />
                          Profil
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => router.push('/settings')}>
                          <AlertTriangle className="h-4 w-4 mr-2" />
                          Paramètres
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={onLogout}
                          className="text-red-600 focus:text-red-600"
                        >
                          <LogOut className="h-4 w-4 mr-2" />
                          Déconnexion
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </>
          )}
          
          {/* Mode landing - Boutons de connexion/inscription */}
          {mode === 'landing' && !user && (
            <div className="flex items-center space-x-2">
              <Dialog open={authMode === 'login'} onOpenChange={(open) => onAuthModeChange?.(open ? 'login' : 'welcome')}>
                <DialogTrigger asChild>
                  <Button variant="ghost" className="flex items-center space-x-2">
                    <LogIn className="h-4 w-4" />
                    <span>Connexion</span>
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Connexion</DialogTitle>
                    <DialogDescription>
                      Connectez-vous à votre compte Meeshy
                    </DialogDescription>
                  </DialogHeader>
                  <LoginForm />
                </DialogContent>
              </Dialog>
              
              <Dialog open={authMode === 'register'} onOpenChange={(open) => onAuthModeChange?.(open ? 'register' : 'welcome')}>
                <DialogTrigger asChild>
                  <Button className="flex items-center space-x-2">
                    <UserPlus className="h-4 w-4" />
                    <span>Inscription</span>
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Créer un compte</DialogTitle>
                    <DialogDescription>
                      Rejoignez Meeshy et communiquez sans barrières
                    </DialogDescription>
                  </DialogHeader>
                  <RegisterForm />
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>
      </div>

      {/* Dialog de confirmation pour effacer la session */}
      <Dialog open={showClearSessionDialog} onOpenChange={setShowClearSessionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <span>{t('clearSessionConfirm')}</span>
            </DialogTitle>
            <DialogDescription>
              {t('clearSessionDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setShowClearSessionDialog(false)}>
              Annuler
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => {
                onClearAnonymousSession?.();
                setShowClearSessionDialog(false);
              }}
            >
              Effacer la session
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </header>
  );
}
