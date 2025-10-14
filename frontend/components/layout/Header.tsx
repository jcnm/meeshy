'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { 
  LogIn, 
  UserPlus, 
  MessageSquare,
  Menu,
  X,
  Share2
} from 'lucide-react';
import { AuthMode } from '@/types';
import { useAuth } from '@/hooks/use-auth';

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
                    Share
                  </Button>
                )}
                
                {/* Informations utilisateur */}
                {user && (
                  <div className="flex items-center space-x-3 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm">
                      {user.displayName?.[0] || user.firstName?.[0] || user.username[0].toUpperCase()}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {user.displayName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username}
                      </span>
                      {isAnonymous && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">Guest</span>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Boutons de connexion pour les utilisateurs anonymes */}
                {isAnonymous && (
                  <>
                    <Button 
                      variant="ghost" 
                      onClick={() => router.push('/login')}
                    >
                      <LogIn className="h-4 w-4 mr-2" />
                      Login
                    </Button>
                    <Button 
                      onClick={() => router.push('/signin')}
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      Sign Up
                    </Button>
                  </>
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
                    Continue Chat
                  </Button>
                )}
                {mode === 'landing' ? (
                  <>
                    <Button 
                      variant="ghost" 
                      onClick={() => handleAuthClick('login')}
                    >
                      <LogIn className="h-4 w-4 mr-2" />
                      Login
                    </Button>
                    <Button 
                      onClick={() => handleAuthClick('register')}
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      Sign Up
                    </Button>
                  </>
                ) : (
                  <>
                    <Link href="/login">
                      <Button variant="ghost">
                        <LogIn className="h-4 w-4 mr-2" />
                        Login
                      </Button>
                    </Link>
                    <Link href="/signin">
                      <Button>
                        <UserPlus className="h-4 w-4 mr-2" />
                        Sign Up
                      </Button>
                    </Link>
                  </>
                )}
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
                    <div className="flex items-center space-x-3 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold">
                        {user.displayName?.[0] || user.firstName?.[0] || user.username[0].toUpperCase()}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {user.displayName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username}
                        </span>
                        {isAnonymous && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">Guest</span>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {shareLink && (
                    <Button 
                      variant="outline"
                      className="w-full justify-start"
                      onClick={handleShare}
                    >
                      <Share2 className="h-4 w-4 mr-2" />
                      Share
                    </Button>
                  )}
                  
                  {/* Boutons de connexion pour les utilisateurs anonymes */}
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
                        Login
                      </Button>
                      <Button 
                        className="w-full justify-start"
                        onClick={() => {
                          router.push('/signin');
                          setIsMobileMenuOpen(false);
                        }}
                      >
                        <UserPlus className="h-4 w-4 mr-2" />
                        Sign Up
                      </Button>
                    </>
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
                      Continue Chat
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
                        Login
                      </Button>
                      <Button 
                        className="w-full justify-start"
                        onClick={() => {
                          handleAuthClick('register');
                          setIsMobileMenuOpen(false);
                        }}
                      >
                        <UserPlus className="h-4 w-4 mr-2" />
                        Sign Up
                      </Button>
                    </>
                  ) : (
                    <>
                      <Link href="/login" onClick={() => setIsMobileMenuOpen(false)}>
                        <Button variant="ghost" className="w-full justify-start">
                          <LogIn className="h-4 w-4 mr-2" />
                          Login
                        </Button>
                      </Link>
                      <Link href="/signin" onClick={() => setIsMobileMenuOpen(false)}>
                        <Button className="w-full justify-start">
                          <UserPlus className="h-4 w-4 mr-2" />
                          Sign Up
                        </Button>
                      </Link>
                    </>
                  )}
                </>
              )}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}

