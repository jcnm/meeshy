/**
 * Composant de débogage des traductions pour le développement
 * Affiche les traductions manquantes et les erreurs de traduction
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { useTranslationChecker } from '@/hooks/use-translation-checker';

interface TranslationDebuggerProps {
  namespace?: string;
  requiredKeys?: string[];
  className?: string;
}

export function TranslationDebugger({ 
  namespace, 
  requiredKeys = [], 
  className = '' 
}: TranslationDebuggerProps) {
  const [isVisible, setIsVisible] = useState(false);
  const { isLoaded, missingKeys, hasErrors, t } = useTranslationChecker({
    namespace,
    requiredKeys,
    onMissingKey: (key) => {
      console.warn(`[TRANSLATION DEBUG] Clé manquante: ${key}`);
    },
    onError: (error) => {
      console.error(`[TRANSLATION DEBUG] Erreur:`, error);
    }
  });

  // Afficher uniquement en mode développement
  useEffect(() => {
    const isDev = process.env.NODE_ENV === 'development';
    setIsVisible(isDev);
  }, []);

  if (!isVisible) {
    return null;
  }

  const getStatusIcon = () => {
    if (!isLoaded) return <RefreshCw className="h-4 w-4 animate-spin" />;
    if (hasErrors) return <XCircle className="h-4 w-4 text-red-500" />;
    if (missingKeys.length > 0) return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    return <CheckCircle className="h-4 w-4 text-green-500" />;
  };

  const getStatusText = () => {
    if (!isLoaded) return 'Vérification...';
    if (hasErrors) return 'Erreurs détectées';
    if (missingKeys.length > 0) return `${missingKeys.length} clé(s) manquante(s)`;
    return 'Toutes les traductions sont présentes';
  };

  const getStatusColor = () => {
    if (!isLoaded) return 'bg-gray-100';
    if (hasErrors) return 'bg-red-100 text-red-800';
    if (missingKeys.length > 0) return 'bg-yellow-100 text-yellow-800';
    return 'bg-green-100 text-green-800';
  };

  return (
    <Card className={`border-dashed border-2 ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {getStatusIcon()}
            <CardTitle className="text-sm">
              Debug Traductions
              {namespace && (
                <Badge variant="outline" className="ml-2 text-xs">
                  {namespace}
                </Badge>
              )}
            </CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsVisible(!isVisible)}
          >
            {isVisible ? 'Masquer' : 'Afficher'}
          </Button>
        </div>
        <CardDescription className="text-xs">
          {getStatusText()}
        </CardDescription>
      </CardHeader>
      
      {isVisible && (
        <CardContent className="pt-0">
          <div className="space-y-3">
            {/* Statut global */}
            <div className={`p-2 rounded-md ${getStatusColor()}`}>
              <div className="flex items-center space-x-2">
                {getStatusIcon()}
                <span className="text-sm font-medium">{getStatusText()}</span>
              </div>
            </div>

            {/* Clés manquantes */}
            {missingKeys.length > 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-medium">Clés de traduction manquantes:</p>
                    <div className="flex flex-wrap gap-1">
                      {missingKeys.map((key) => (
                        <Badge key={key} variant="destructive" className="text-xs">
                          {key}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Test de traduction */}
            {requiredKeys.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Test des traductions:</p>
                <div className="grid grid-cols-1 gap-1 text-xs">
                  {requiredKeys.slice(0, 5).map((key) => {
                    try {
                      const translation = t(key);
                      return (
                        <div key={key} className="flex justify-between items-center p-1 bg-gray-50 rounded">
                          <span className="font-mono">{key}</span>
                          <span className="text-gray-600 truncate max-w-[200px]">
                            {translation}
                          </span>
                        </div>
                      );
                    } catch (error) {
                      return (
                        <div key={key} className="flex justify-between items-center p-1 bg-red-50 rounded">
                          <span className="font-mono text-red-600">{key}</span>
                          <span className="text-red-600">ERREUR</span>
                        </div>
                      );
                    }
                  })}
                  {requiredKeys.length > 5 && (
                    <div className="text-xs text-gray-500 text-center">
                      ... et {requiredKeys.length - 5} autres
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.reload()}
                className="text-xs"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Recharger
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  console.log('=== TRANSLATION DEBUG INFO ===');
                  console.log('Namespace:', namespace);
                  console.log('Required Keys:', requiredKeys);
                  console.log('Missing Keys:', missingKeys);
                  console.log('Has Errors:', hasErrors);
                  console.log('=============================');
                }}
                className="text-xs"
              >
                Log Debug
              </Button>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

/**
 * Composant de débogage spécialisé pour les pages de connexion
 */
export function LoginTranslationDebugger() {
  const requiredKeys = [
    'title',
    'subtitle',
    'formTitle',
    'formDescription',
    'usernameLabel',
    'usernamePlaceholder',
    'usernameHelp',
    'passwordLabel',
    'passwordPlaceholder',
    'passwordHelp',
    'loginButton',
    'loggingIn'
  ];

  return (
    <TranslationDebugger
      namespace="login"
      requiredKeys={requiredKeys}
      className="mb-4"
    />
  );
}

/**
 * Composant de débogage pour les toasts
 */
export function ToastTranslationDebugger() {
  const requiredKeys = [
    'connection.established',
    'connection.disconnected',
    'connection.lost',
    'messages.sent',
    'messages.sendError',
    'auth.fillAllFields',
    'auth.connectionError',
    'auth.serverConnectionError'
  ];

  return (
    <TranslationDebugger
      namespace="toasts"
      requiredKeys={requiredKeys}
      className="mb-4"
    />
  );
}
