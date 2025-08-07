/**
 * Composant pour initialiser la police de l'utilisateur
 * Se charge automatiquement au démarrage de l'application
 */

'use client';

import { useEffect } from 'react';
import { useFontPreference } from '@/hooks/use-font-preference';

export function FontInitializer() {
  const { isLoading, error } = useFontPreference();

  useEffect(() => {
    // Ne s'exécute que côté client
    if (typeof window === 'undefined') {
      return;
    }

    if (!isLoading && !error) {
      // La police a été chargée et appliquée avec succès
      console.log('✅ Font preference loaded successfully');
    } else if (error) {
      console.warn('⚠️ Font preference loading error:', error);
    }
  }, [isLoading, error]);

  // Ce composant ne rend rien visuellement
  return null;
}

/**
 * Version avec feedback visuel optionnel
 */
export function FontInitializerWithFeedback() {
  const { currentFont, isLoading, error, fontConfig } = useFontPreference();

  if (isLoading) {
    return (
      <div className="fixed top-4 right-4 z-50 bg-background/80 backdrop-blur border rounded-lg p-2 text-xs text-muted-foreground">
        ⏳ Chargement des préférences...
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed top-4 right-4 z-50 bg-destructive/10 border border-destructive/20 rounded-lg p-2 text-xs text-destructive">
        ⚠️ Erreur de police
      </div>
    );
  }

  // Optionnel: afficher brièvement la police chargée
  return (
    <div className="fixed top-4 right-4 z-50 bg-background/80 backdrop-blur border rounded-lg p-2 text-xs text-muted-foreground opacity-70 transition-opacity duration-1000">
      ✅ Police: {fontConfig?.name}
    </div>
  );
}
