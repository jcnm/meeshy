'use client';

import { useEffect } from 'react';
import { meeshyDebug } from '@/utils/debug-models';
import { translationModels } from '@/lib/translation-models';

/**
 * Composant pour charger les outils de debug dans l'application
 * En mode développement uniquement
 */
export function DebugModelsScript() {
  useEffect(() => {
    // Seulement en mode développement
    if (process.env.NODE_ENV === 'development') {
      // Exposer translationModels sur window pour le debugging
      if (typeof window !== 'undefined') {
        window.translationModels = translationModels;
        window.meeshyDebug = meeshyDebug;
        
        console.log('🛠️ Meeshy Debug Tools activés en mode développement');
        console.log('💡 Tapez "meeshyDebug.help()" dans la console pour voir les commandes');
        console.log('🔍 Tapez "meeshyDebug.diagnoseModels()" pour un diagnostic complet');
      }
    }
  }, []);

  // Ce composant ne rend rien
  return null;
}
