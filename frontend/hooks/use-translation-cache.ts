/**
 * Hook pour la gestion du cache de traduction
 * Version simplifiée pour le service API
 */

'use client';

import { useState, useCallback, useEffect } from 'react';

interface CacheEntry {
  value: string;
  sourceLanguage: string;
  targetLanguage: string;
  lastAccessed: number;
  accessCount: number;
}

interface CacheStats {
  totalEntries: number;
  totalSize: number;
}

interface CacheConfig {
  maxEntries: number;
  maxSize: number;
  maxAge: number;
}

export const useTranslationCache = () => {
  const [stats, setStats] = useState<CacheStats>({ totalEntries: 0, totalSize: 0 });
  const [hitCount, setHitCount] = useState(0);
  const [missCount, setMissCount] = useState(0);

  // Configuration par défaut
  const config: CacheConfig = {
    maxEntries: 1000,
    maxSize: 10 * 1024 * 1024, // 10MB
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 jours
  };

  const updateStats = useCallback(() => {
    // Service API - statistiques de cache non disponibles
    setStats({
      totalEntries: 0,
      totalSize: 0
    });
  }, []);

  useEffect(() => {
    updateStats();
  }, [updateStats]);

  const getEntriesByLanguage = useCallback((): CacheEntry[] => {
    // Service API - pas d'entrées locales
    return [];
  }, []);

  const clear = useCallback(() => {
    // Service API - pas de cache local à vider
    console.log('Cache géré côté serveur');
    updateStats();
    setHitCount(0);
    setMissCount(0);
  }, [updateStats]);

  const exportCache = useCallback((): string => {
    // Service API - export non disponible
    const cacheData = {
      stats,
      timestamp: new Date().toISOString(),
      entries: [],
      note: 'Cache géré côté serveur'
    };
    return JSON.stringify(cacheData, null, 2);
  }, [stats]);

  const importCache = useCallback((data: string): boolean => {
    try {
      const parsed = JSON.parse(data);
      console.log('Import non disponible avec service API:', parsed);
      return false;
    } catch (error) {
      console.error('Erreur lors de l\'import du cache:', error);
      return false;
    }
  }, []);

  return {
    stats,
    hitCount,
    missCount,
    getEntriesByLanguage,
    clear,
    exportCache,
    importCache,
    config,
  };
};
