'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  AlertTriangle, 
  RefreshCw, 
  Home, 
  LogIn, 
  MessageSquare,
  Clock
} from 'lucide-react';
import { toast } from 'sonner';

interface AnonymousChatErrorHandlerProps {
  error: string;
  identifier: string;
  isAnonymous: boolean;
  onRetry?: () => void;
  onRedirect?: (path: string) => void;
}

export function AnonymousChatErrorHandler({
  error,
  identifier,
  isAnonymous,
  onRetry,
  onRedirect
}: AnonymousChatErrorHandlerProps) {
  const router = useRouter();
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;

  // Analyser le type d'erreur
  const getErrorInfo = () => {
    if (error.includes('403') || error.includes('Forbidden') || error.includes('Accès non autorisé')) {
      return {
        type: 'forbidden',
        title: 'Accès non autorisé',
        description: 'Vous n\'avez pas l\'autorisation d\'accéder à cette conversation.',
        icon: AlertTriangle,
        actions: [
          {
            label: 'Retourner à l\'accueil',
            action: () => router.push('/'),
            variant: 'default' as const
          }
        ]
      };
    }

    if (error.includes('401') || error.includes('Unauthorized') || error.includes('Session expirée')) {
      return {
        type: 'unauthorized',
        title: 'Session expirée',
        description: 'Votre session a expiré. Veuillez vous reconnecter pour continuer.',
        icon: Clock,
        actions: [
          {
            label: isAnonymous ? 'Rejoindre à nouveau' : 'Se connecter',
            action: () => {
              if (isAnonymous) {
                const storedLinkId = localStorage.getItem('anonymous_current_link_id');
                if (storedLinkId) {
                  router.push(`/join/${storedLinkId}`);
                } else {
                  router.push('/');
                }
              } else {
                router.push('/login');
              }
            },
            variant: 'default' as const
          },
          {
            label: 'Retourner à l\'accueil',
            action: () => router.push('/'),
            variant: 'outline' as const
          }
        ]
      };
    }

    if (error.includes('404') || error.includes('Not Found') || error.includes('introuvable')) {
      return {
        type: 'not-found',
        title: 'Conversation introuvable',
        description: 'Cette conversation n\'existe pas ou a été supprimée.',
        icon: MessageSquare,
        actions: [
          {
            label: 'Retourner à l\'accueil',
            action: () => router.push('/'),
            variant: 'default' as const
          }
        ]
      };
    }

    if (error.includes('Identifiant invalide')) {
      return {
        type: 'invalid-identifier',
        title: 'Lien invalide',
        description: 'Le lien que vous essayez d\'utiliser n\'est pas valide.',
        icon: AlertTriangle,
        actions: [
          {
            label: 'Retourner à l\'accueil',
            action: () => router.push('/'),
            variant: 'default' as const
          }
        ]
      };
    }

    // Erreur générique
    return {
      type: 'generic',
      title: 'Erreur de connexion',
      description: 'Une erreur est survenue lors du chargement de la conversation.',
      icon: AlertTriangle,
      actions: [
        {
          label: 'Réessayer',
          action: handleRetry,
          variant: 'default' as const,
          disabled: retryCount >= maxRetries
        },
        {
          label: 'Retourner à l\'accueil',
          action: () => router.push('/'),
          variant: 'outline' as const
        }
      ]
    };
  };

  const handleRetry = async () => {
    if (retryCount >= maxRetries) {
      toast.error('Nombre maximum de tentatives atteint');
      return;
    }

    setIsRetrying(true);
    setRetryCount(prev => prev + 1);

    try {
      // Attendre un peu avant de réessayer
      await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
      
      if (onRetry) {
        await onRetry();
      } else {
        // Recharger la page
        window.location.reload();
      }
    } catch (error) {
      console.error('Erreur lors de la nouvelle tentative:', error);
      toast.error('Échec de la nouvelle tentative');
    } finally {
      setIsRetrying(false);
    }
  };

  const errorInfo = getErrorInfo();
  const IconComponent = errorInfo.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="h-16 w-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <IconComponent className="h-8 w-8 text-red-600" />
          </div>
          <CardTitle className="text-xl text-red-700">{errorInfo.title}</CardTitle>
          <CardDescription className="text-red-600">
            {errorInfo.description}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Informations de debug pour les développeurs */}
          {process.env.NODE_ENV === 'development' && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                <strong>Debug:</strong> {error}
                <br />
                <strong>Identifiant:</strong> {identifier}
                <br />
                <strong>Type:</strong> {isAnonymous ? 'Anonyme' : 'Authentifié'}
                <br />
                <strong>Tentatives:</strong> {retryCount}/{maxRetries}
              </AlertDescription>
            </Alert>
          )}

          {/* Actions */}
          <div className="space-y-2">
            {errorInfo.actions.map((action, index) => (
              <Button
                key={index}
                onClick={action.action}
                variant={action.variant}
                className="w-full"
                disabled={action.disabled || isRetrying}
              >
                {action.label === 'Réessayer' && isRetrying && (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                )}
                {action.label === 'Retourner à l\'accueil' && (
                  <Home className="h-4 w-4 mr-2" />
                )}
                {action.label === 'Se connecter' && (
                  <LogIn className="h-4 w-4 mr-2" />
                )}
                {action.label === 'Rejoindre à nouveau' && (
                  <MessageSquare className="h-4 w-4 mr-2" />
                )}
                {action.label}
              </Button>
            ))}
          </div>

          {/* Indicateur de tentatives */}
          {retryCount > 0 && (
            <div className="text-center text-sm text-gray-500">
              Tentatives: {retryCount}/{maxRetries}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
