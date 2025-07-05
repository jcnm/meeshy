'use client';

import { ReactNode } from 'react';
import { Navigation } from './Navigation';
import { ErrorBoundary } from '@/components/common';

interface ResponsiveLayoutProps {
  children: ReactNode;
  showNavigation?: boolean;
}

export function ResponsiveLayout({ 
  children, 
  showNavigation = true 
}: ResponsiveLayoutProps) {
  return (
    <ErrorBoundary>
      <div className="h-screen flex bg-background">
        {showNavigation && <Navigation />}
        
        <main className={`flex-1 flex flex-col overflow-hidden ${!showNavigation ? 'ml-0' : ''}`}>
          <div className="flex-1 overflow-y-auto">
            {children}
          </div>
        </main>
      </div>
    </ErrorBoundary>
  );
}

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  breadcrumb?: ReactNode;
}

export function PageHeader({ title, description, actions, breadcrumb }: PageHeaderProps) {
  return (
    <div className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
      <div className="container flex h-14 items-center px-4">
        <div className="flex flex-1 items-center space-x-4">
          {breadcrumb}
          <div className="flex-1">
            <h1 className="text-lg font-semibold">{title}</h1>
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
          {actions && (
            <div className="flex items-center space-x-2">
              {actions}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface PageContentProps {
  children: ReactNode;
  className?: string;
}

export function PageContent({ children, className }: PageContentProps) {
  return (
    <div className={`container p-4 space-y-6 ${className || ''}`}>
      {children}
    </div>
  );
}
