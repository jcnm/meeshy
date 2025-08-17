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

  const handleShare = () => {
    if (shareLink) {
      navigator.clipboard.writeText(shareLink);
      toast.success('Lien de partage copié dans le presse-papiers');
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
                          Effacer la session anonyme
                        </DropdownMenuItem>
                      </>
                    ) : (
                      <DropdownMenuItem onClick={onLogout}>
                        <LogOut className="h-4 w-4 mr-2" />
                        Se déconnecter
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </>
          )}
          
          {/* Mode landing - Boutons d'authentification et lien anonyme */}
          {mode === 'landing' && (
            <>
              {/* Lien vers la conversation anonyme en cours */}
              {anonymousChatLink && (
                <Button 
                  onClick={() => router.push(anonymousChatLink)}
                  variant="outline"
                  className="flex items-center space-x-2 bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                >
                  <MessageSquare className="h-4 w-4" />
                  <span>Reprendre la discussion</span>
                </Button>
              )}
              
              <Dialog open={authMode === 'login'} onOpenChange={(open) => onAuthModeChange?.(open ? 'login' : 'welcome')}>
                <DialogTrigger asChild>
                  <Button variant="ghost" className="flex items-center space-x-2">
                    <LogIn className="h-4 w-4" />
                    <span>Se connecter</span>
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Se connecter</DialogTitle>
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
                    <span>S'inscrire</span>
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
            </>
          )}
        </div>
      </div>
      
      {/* Dialog de confirmation pour l'effacement de session anonyme */}
      <Dialog open={showClearSessionDialog} onOpenChange={setShowClearSessionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              <span>Effacer la session anonyme</span>
            </DialogTitle>
            <DialogDescription className="space-y-3">
              <div>
                Êtes-vous sûr de vouloir effacer votre session anonyme ?
              </div>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <div className="text-sm text-orange-800 font-medium mb-2">⚠️ Attention :</div>
                <ul className="text-sm text-orange-700 space-y-1">
                  <li>• Les autres participants ne vous reconnaîtront plus</li>
                  <li>• Votre pseudo sera perdu pour cette conversation</li>
                  <li>• Vous devrez rejoindre à nouveau avec un nouveau pseudo</li>
                </ul>
              </div>
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
