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
            {mode === 'chat' && shareLink && (
              <Button 
                variant="outline"
                onClick={handleShare}
              >
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
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
              {mode === 'chat' && shareLink && (
                <Button 
                  variant="outline"
                  className="w-full justify-start"
                  onClick={handleShare}
                >
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </Button>
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
              )}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}

