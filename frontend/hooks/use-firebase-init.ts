/**
 * Hook React pour vérifier Firebase au démarrage de l'application
 * À utiliser dans le Layout principal (UNE SEULE FOIS)
 *
 * USAGE:
 * ```tsx
 * const { status, loading } = useFirebaseInit();
 * ```
 *
 * @module use-firebase-init
 */

'use client';

import { useEffect, useState } from 'react';
import { firebaseChecker, FirebaseStatus } from '@/utils/firebase-availability-checker';

/**
 * Hook pour vérifier Firebase au démarrage de l'app
 * À utiliser dans le Layout principal (une seule fois)
 */
export function useFirebaseInit() {
  const [status, setStatus] = useState<FirebaseStatus>({
    available: false,
    pushEnabled: false,
    badgeEnabled: false,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function checkFirebase() {
      try {
        console.info('[Firebase Init] Checking Firebase availability...');
        const result = await firebaseChecker.check();

        if (mounted) {
          setStatus(result);
          setLoading(false);

          // Log du résultat en dev
          if (process.env.NODE_ENV === 'development') {
            if (result.available) {
              console.info(
                '%c[Meeshy] Firebase available',
                'color: green; font-weight: bold;',
                '\n- Push notifications:', result.pushEnabled ? 'Enabled' : 'Disabled',
                '\n- PWA badges:', result.badgeEnabled ? 'Enabled' : 'Disabled'
              );
            } else {
              console.warn(
                '%c[Meeshy] Firebase not configured - Using WebSocket notifications only',
                'color: orange; font-weight: bold;',
                '\nReason:', result.reason
              );
            }
          }
        }
      } catch (err) {
        console.error('[Firebase Init] Check failed:', err);
        if (mounted) {
          setStatus({
            available: false,
            pushEnabled: false,
            badgeEnabled: false,
            reason: 'Check failed',
          });
          setError(err instanceof Error ? err.message : 'Unknown error');
          setLoading(false);
        }
      }
    }

    checkFirebase();

    return () => {
      mounted = false;
    };
  }, []); // Ne s'exécute qu'une seule fois au montage

  return {
    /**
     * Statut Firebase
     */
    status,

    /**
     * Chargement en cours
     */
    loading,

    /**
     * Erreur éventuelle
     */
    error,

    /**
     * Firebase est disponible
     */
    isAvailable: status.available,

    /**
     * Push notifications activées
     */
    isPushEnabled: status.pushEnabled,

    /**
     * Badges PWA activés
     */
    isBadgeEnabled: status.badgeEnabled,

    /**
     * Obtient un rapport de debug
     */
    getDebugReport: () => firebaseChecker.getDebugReport(),
  };
}

/**
 * Hook simplifié qui retourne seulement si Firebase est disponible
 */
export function useIsFirebaseAvailable(): boolean {
  const { isAvailable } = useFirebaseInit();
  return isAvailable;
}
