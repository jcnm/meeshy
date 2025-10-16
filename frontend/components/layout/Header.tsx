'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  LogIn, 
  UserPlus, 
  MessageSquare,
  Menu,
  X,
  Share2,
  Sun,
  Moon,
  Monitor,
  ChevronDown
} from 'lucide-react';
import { AuthMode } from '@/types';
import { useAuth } from '@/hooks/use-auth';
import { useAppStore } from '@/stores/app-store';
import { useI18n } from '@/hooks/useI18n';

interface HeaderProps {
  mode?: 'landing' | 'chat' | 'default';
  authMode?: AuthMode;
  onAuthModeChange?: (mode: AuthMode) => void;
  anonymousChatLink?: string | null;
  conversationTitle?: string;
  shareLink?: string;
}

export function Header({ 
  mode = 'default', 
  authMode = 'welcome',
  onAuthModeChange,
  anonymousChatLink,
  conversationTitle,
  shareLink
}: HeaderProps) {
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user, isAnonymous } = useAuth();
  const { theme, setTheme } = useAppStore();
  const { t } = useI18n('header');

  const handleAuthClick = (newMode: AuthMode) => {
    if (onAuthModeChange) {
      onAuthModeChange(newMode);
    }
  };

  const handleShare = () => {
    if (shareLink && navigator.share) {
      navigator.share({
        title: conversationTitle || 'Meeshy Conversation',
        url: shareLink,
      }).catch(console.error);
    } else if (shareLink) {
      navigator.clipboard.writeText(shareLink);
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-md dark:bg-gray-900/80">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <MessageSquare className="h-8 w-8 text-blue-600" />
            <span className="text-xl font-bold text-gray-900 dark:text-white">
              {conversationTitle || 'Meeshy'}
            </span>
          </Link>

          {/* Actions Desktop */}
          <div className="hidden md:flex items-center space-x-4">
            {/* Mode Chat */}
            {mode === 'chat' && (
              <>
                {/* Bouton Share en premier */}
                {shareLink && (
                  <Button 
                    variant="outline"
                    onClick={handleShare}
                  >
                    <Share2 className="h-4 w-4 mr-2" />
                    {t('shareLink')}
                  </Button>
                )}
                
                {/* Menu Utilisateur avec Dropdown */}
                {user && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="flex items-center space-x-2 px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm">
                          {user.displayName?.[0] || user.firstName?.[0] || user.username[0].toUpperCase()}
                        </div>
                        <div className="flex flex-col items-start">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {user.displayName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username}
                          </span>
                          {isAnonymous && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">Guest</span>
                          )}
                        </div>
                        <ChevronDown className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel>
                        {user.displayName || user.username}
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      
                      {/* Options de connexion pour utilisateurs anonymes */}
                      {isAnonymous && (
                        <>
                          <DropdownMenuItem onClick={() => router.push('/login')}>
                            <LogIn className="h-4 w-4 mr-2" />
                            {t('login')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => router.push('/signin')}>
                            <UserPlus className="h-4 w-4 mr-2" />
                            {t('signUp')}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                        </>
                      )}
                      
                      {/* Options de thème */}
                      <DropdownMenuLabel className="text-xs text-gray-500 dark:text-gray-400">
                        {t('theme')}
                      </DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => setTheme('light')}>
                        <Sun className="h-4 w-4 mr-2" />
                        {t('light')}
                        {theme === 'light' && <span className="ml-auto">✓</span>}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setTheme('dark')}>
                        <Moon className="h-4 w-4 mr-2" />
                        {t('dark')}
                        {theme === 'dark' && <span className="ml-auto">✓</span>}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setTheme('auto')}>
                        <Monitor className="h-4 w-4 mr-2" />
                        {t('system')}
                        {theme === 'auto' && <span className="ml-auto">✓</span>}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </>
            )}
            
            {mode === 'landing' && (
              <>
                {anonymousChatLink && (
                  <Button
                    variant="outline"
                    onClick={() => router.push(anonymousChatLink)}
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    {t('continueChat')}
                  </Button>
                )}
                {mode === 'landing' ? (
                  <>
                    <Button 
                      variant="ghost" 
                      onClick={() => handleAuthClick('login')}
                    >
                      <LogIn className="h-4 w-4 mr-2" />
                      {t('login')}
                    </Button>
                    <Button 
                      onClick={() => handleAuthClick('register')}
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      {t('signUp')}
                    </Button>
                  </>
                ) : (
                  <>
                    <Link href="/login">
                      <Button variant="ghost">
                        <LogIn className="h-4 w-4 mr-2" />
                        {t('login')}
                      </Button>
                    </Link>
                    <Link href="/signin">
                      <Button>
                        <UserPlus className="h-4 w-4 mr-2" />
                        {t('signUp')}
                      </Button>
                    </Link>
                  </>
                )}
              </>
            )}
            
            {/* Mode Default - affiche les boutons login/signin */}
            {mode === 'default' && !user && (
              <>
                <Link href="/login">
                  <Button variant="ghost">
                    <LogIn className="h-4 w-4 mr-2" />
                    {t('login')}
                  </Button>
                </Link>
                <Link href="/signin">
                  <Button>
                    <UserPlus className="h-4 w-4 mr-2" />
                    {t('signUp')}
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </Button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden py-4 border-t">
            <nav className="flex flex-col space-y-4">
              {/* Mode Chat */}
              {mode === 'chat' && (
                <>
                  {/* Informations utilisateur en mobile */}
                  {user && (
                    <>
                      <div className="flex items-center space-x-3 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold">
                          {user.displayName?.[0] || user.firstName?.[0] || user.username[0].toUpperCase()}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {user.displayName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username}
                          </span>
                          {isAnonymous && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">{t('guest')}</span>
                          )}
                        </div>
                      </div>
                      
                      {/* Options pour utilisateurs anonymes */}
                      {isAnonymous && (
                        <>
                          <Button 
                            variant="ghost" 
                            className="w-full justify-start"
                            onClick={() => {
                              router.push('/login');
                              setIsMobileMenuOpen(false);
                            }}
                          >
                            <LogIn className="h-4 w-4 mr-2" />
                            {t('login')}
                          </Button>
                          <Button 
                            className="w-full justify-start"
                            onClick={() => {
                              router.push('/signin');
                              setIsMobileMenuOpen(false);
                            }}
                          >
                            <UserPlus className="h-4 w-4 mr-2" />
                            {t('signUp')}
                          </Button>
                        </>
                      )}
                      
                      {/* Options de thème */}
                      <div className="space-y-2">
                        <div className="px-2 py-1.5">
                          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{t('theme')}</span>
                        </div>
                        <Button 
                          variant="ghost" 
                          className="w-full justify-start"
                          onClick={() => {
                            setTheme('light');
                            setIsMobileMenuOpen(false);
                          }}
                        >
                          <Sun className="h-4 w-4 mr-2" />
                          {t('light')}
                          {theme === 'light' && <span className="ml-auto">✓</span>}
                        </Button>
                        <Button 
                          variant="ghost" 
                          className="w-full justify-start"
                          onClick={() => {
                            setTheme('dark');
                            setIsMobileMenuOpen(false);
                          }}
                        >
                          <Moon className="h-4 w-4 mr-2" />
                          {t('dark')}
                          {theme === 'dark' && <span className="ml-auto">✓</span>}
                        </Button>
                        <Button 
                          variant="ghost" 
                          className="w-full justify-start"
                          onClick={() => {
                            setTheme('auto');
                            setIsMobileMenuOpen(false);
                          }}
                        >
                          <Monitor className="h-4 w-4 mr-2" />
                          {t('system')}
                          {theme === 'auto' && <span className="ml-auto">✓</span>}
                        </Button>
                      </div>
                    </>
                  )}
                  
                  {shareLink && (
                    <Button 
                      variant="outline"
                      className="w-full justify-start"
                      onClick={handleShare}
                    >
                      <Share2 className="h-4 w-4 mr-2" />
                      {t('shareLink')}
                    </Button>
                  )}
                </>
              )}
              
              {mode === 'landing' && (
                <>
                  {anonymousChatLink && (
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => {
                        router.push(anonymousChatLink);
                        setIsMobileMenuOpen(false);
                      }}
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      {t('continueChat')}
                    </Button>
                  )}
                  {mode === 'landing' ? (
                    <>
                      <Button 
                        variant="ghost" 
                        className="w-full justify-start"
                        onClick={() => {
                          handleAuthClick('login');
                          setIsMobileMenuOpen(false);
                        }}
                      >
                        <LogIn className="h-4 w-4 mr-2" />
                        {t('login')}
                      </Button>
                      <Button 
                        className="w-full justify-start"
                        onClick={() => {
                          handleAuthClick('register');
                          setIsMobileMenuOpen(false);
                        }}
                      >
                        <UserPlus className="h-4 w-4 mr-2" />
                        {t('signUp')}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Link href="/login" onClick={() => setIsMobileMenuOpen(false)}>
                        <Button variant="ghost" className="w-full justify-start">
                          <LogIn className="h-4 w-4 mr-2" />
                          {t('login')}
                        </Button>
                      </Link>
                      <Link href="/signin" onClick={() => setIsMobileMenuOpen(false)}>
                        <Button className="w-full justify-start">
                          <UserPlus className="h-4 w-4 mr-2" />
                          {t('signUp')}
                        </Button>
                      </Link>
                    </>
                  )}
                </>
              )}
              
              {/* Mode Default - affiche les boutons login/signin en mobile */}
              {mode === 'default' && !user && (
                <>
                  <Link href="/login" onClick={() => setIsMobileMenuOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start">
                      <LogIn className="h-4 w-4 mr-2" />
                      {t('login')}
                    </Button>
                  </Link>
                  <Link href="/signin" onClick={() => setIsMobileMenuOpen(false)}>
                    <Button className="w-full justify-start">
                      <UserPlus className="h-4 w-4 mr-2" />
                      {t('signUp')}
                    </Button>
                  </Link>
                </>
              )}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}

