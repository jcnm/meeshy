'use client';

import { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { MeeshyLogo } from '@/components/meeshy-logo';

interface PageLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  showBackButton?: boolean;
  headerActions?: ReactNode;
  className?: string;
}

export function PageLayout({ 
  children, 
  title, 
  subtitle, 
  showBackButton = true, 
  headerActions,
  className = 'min-h-screen bg-gray-50'
}: PageLayoutProps) {
  const router = useRouter();

  return (
    <div className={className}>
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {showBackButton && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => router.back()}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Retour
              </Button>
            )}
            <div className="flex items-center space-x-3">
              <MeeshyLogo size="md" />
              {(title || subtitle) && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-2">
                  {title && (
                    <span className="text-sm text-gray-500">{title}</span>
                  )}
                  {subtitle && (
                    <span className="text-sm text-gray-400">{subtitle}</span>
                  )}
                </div>
              )}
            </div>
          </div>
          {headerActions && (
            <div className="flex items-center space-x-2">
              {headerActions}
            </div>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
