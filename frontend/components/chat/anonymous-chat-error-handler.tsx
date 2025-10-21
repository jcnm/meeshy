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
import { useI18n } from '@/hooks/useI18n';

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
  const { t } = useI18n('anonymousChatErrorHandler');
  const router = useRouter();
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;

  // Analyser le type d'erreur
  const getErrorInfo = () => {
    if (error.includes('403') || error.includes('Forbidden') || error.includes('Accès non autorisé')) {
      return {
        type: 'forbidden',
        title: t('forbidden.title'),
        description: t('forbidden.description'),
        icon: AlertTriangle,
        actions: [
          {
            label: t('forbidden.actions.backHome'),
            action: () => router.push('/'),
            variant: 'default' as const
          }
        ]
      };
    }

    if (error.includes('401') || error.includes('Unauthorized') || error.includes('Session expirée')) {
      return {
        type: 'unauthorized',
        title: t('unauthorized.title'),
        description: t('unauthorized.description'),
        icon: Clock,
        actions: [
          {
            label: isAnonymous ? t('unauthorized.actions.rejoin') : t('unauthorized.actions.login'),
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
            label: t('unauthorized.actions.backHome'),
            action: () => router.push('/'),
            variant: 'outline' as const
          }
        ]
      };
    }

    if (error.includes('404') || error.includes('Not Found') || error.includes('introuvable')) {
      return {
        type: 'not-found',
        title: t('notFound.title'),
        description: t('notFound.description'),
        icon: MessageSquare,
        actions: [
          {
            label: t('notFound.actions.backHome'),
            action: () => router.push('/'),
            variant: 'default' as const
          }
        ]
      };
    }

    if (error.includes('Identifiant invalide')) {
      return {
        type: 'invalid-identifier',
        title: t('invalidIdentifier.title'),
        description: t('invalidIdentifier.description'),
        icon: AlertTriangle,
        actions: [
          {
            label: t('invalidIdentifier.actions.backHome'),
            action: () => router.push('/'),
            variant: 'default' as const
          }
        ]
      };
    }

    // Erreur générique
    return {
      type: 'generic',
      title: t('generic.title'),
      description: t('generic.description'),
      icon: AlertTriangle,
      actions: [
        {
          label: t('generic.actions.retry'),
          action: handleRetry,
          variant: 'default' as const,
          disabled: retryCount >= maxRetries
        },
        {
          label: t('generic.actions.backHome'),
          action: () => router.push('/'),
          variant: 'outline' as const
        }
      ]
    };
  };

  const handleRetry = async () => {
    if (retryCount >= maxRetries) {
      toast.error(t('maxRetriesReached'));
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
      toast.error(t('retryFailed'));
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
                <strong>{t('debug.title')}</strong> {error}
                <br />
                <strong>{t('debug.identifier')}</strong> {identifier}
                <br />
                <strong>{t('debug.type')}</strong> {isAnonymous ? t('debug.anonymous') : t('debug.authenticated')}
                <br />
                <strong>{t('debug.attempts')}</strong> {retryCount}/{maxRetries}
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
                disabled={'disabled' in action ? action.disabled || isRetrying : isRetrying}
              >
                {action.label === t('generic.actions.retry') && isRetrying && (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                )}
                {action.label === t('forbidden.actions.backHome') && (
                  <Home className="h-4 w-4 mr-2" />
                )}
                {action.label === t('unauthorized.actions.login') && (
                  <LogIn className="h-4 w-4 mr-2" />
                )}
                {action.label === t('unauthorized.actions.rejoin') && (
                  <MessageSquare className="h-4 w-4 mr-2" />
                )}
                {action.label}
              </Button>
            ))}
          </div>

          {/* Indicateur de tentatives */}
          {retryCount > 0 && (
            <div className="text-center text-sm text-gray-500">
              {t('attempts', { current: retryCount, max: maxRetries })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
