'use client';

import React from 'react';
import { useUser } from '@/stores';
import { AppHeader } from '@/components/layout/AppHeader';
import { LoginForm } from '@/components/auth/login-form';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  MessageSquare, 
  Globe, 
  Users, 
  Zap, 
  Shield, 
  LogIn, 
  UserPlus,
  Sparkles
} from 'lucide-react';

interface AuthenticatedLayoutProps {
  children: React.ReactNode;
  currentPage?: 'home' | 'conversations' | 'groups' | 'settings';
  requireAuth?: boolean;
  showHeader?: boolean;
  showSearch?: boolean;
  showNotifications?: boolean;
  className?: string;
}

export function AuthenticatedLayout({
  children,
  currentPage = 'home',
  requireAuth = true,
  showHeader = true,
  showSearch = true,
  showNotifications = true,
  className = ''
}: AuthenticatedLayoutProps) {
  const user = useUser(); const isAuthChecking = useIsAuthChecking();

  // Affichage du chargement pendant la vérification d'authentification
  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
        {showHeader && <AppHeader currentPage={currentPage} />}
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-gray-600">Vérification de l'authentification...</p>
          </div>
        </div>
      </div>
    );
  }

  // Si l'authentification est requise mais l'utilisateur n'est pas connecté
  if (requireAuth && !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
        {showHeader && <AppHeader currentPage={currentPage} />}
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] p-4">
          <div className="w-full max-w-2xl space-y-6">
            {/* Hero Section */}
            <div className="text-center space-y-4 mb-8">
              <div className="flex justify-center mb-4">
                <MessageSquare className="h-16 w-16 text-primary" />
              </div>
              <h1 className="text-4xl font-bold text-gray-900">
                Bienvenue sur Meeshy
              </h1>
              <p className="text-xl text-gray-600 max-w-lg mx-auto">
                Messagerie en temps réel avec traduction multilingue
              </p>
            </div>

            {/* Features */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <Card className="text-center p-4">
                <Globe className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                <h3 className="font-semibold text-sm">Traduction automatique</h3>
                <p className="text-xs text-gray-600">Communiquez dans toutes les langues</p>
              </Card>
              <Card className="text-center p-4">
                <Zap className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
                <h3 className="font-semibold text-sm">Temps réel</h3>
                <p className="text-xs text-gray-600">Messages instantanés</p>
              </Card>
              <Card className="text-center p-4">
                <Shield className="h-8 w-8 text-green-500 mx-auto mb-2" />
                <h3 className="font-semibold text-sm">Sécurisé</h3>
                <p className="text-xs text-gray-600">Chiffrement de bout en bout</p>
              </Card>
            </div>

            {/* Login Form */}
            <Card className="max-w-md mx-auto">
              <CardHeader className="text-center">
                <CardTitle className="flex items-center justify-center gap-2">
                  <LogIn className="h-5 w-5" />
                  Connexion requise
                </CardTitle>
                <CardDescription>
                  Connectez-vous pour accéder à cette page
                </CardDescription>
              </CardHeader>
              <div className="p-6 pt-0">
                <LoginForm />
              </div>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Utilisateur connecté ou authentification non requise
  return (
    <div className={`min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 ${className}`}>
      {showHeader && (
        <AppHeader 
          currentPage={currentPage}
          showSearch={showSearch}
          showNotifications={showNotifications}
        />
      )}
      <main className={showHeader ? 'pt-0' : ''}>
        {children}
      </main>
    </div>
  );
}
