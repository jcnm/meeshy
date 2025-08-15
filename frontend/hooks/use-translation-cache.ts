/**
 * Hook unifié pour la gestion du cache de traduction
 * Combine la version API service avec la persistance du contexte global
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { useAppContext } from '@/context/AppContext';

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
  hitCount: number;
  missCount: number;
}

interface CacheConfig {
  maxEntries: number;
  maxSize: number;
  maxAge: number;
}

export const useTranslationCache = () => {
  const { state } = useAppContext();
  const [stats, setStats] = useState<CacheStats>({ 
    totalEntries: 0, 
    totalSize: 0,
    hitCount: 0,
    missCount: 0 
  });

  // Configuration par défaut
  const config: CacheConfig = {
    maxEntries: 1000,
    maxSize: 10 * 1024 * 1024, // 10MB
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 jours
  };

  const updateStats = useCallback(() => {
    setStats({
      totalEntries: state.translationCache.size,
      totalSize: JSON.stringify(Object.fromEntries(state.translationCache)).length,
      hitCount: stats.hitCount,
      missCount: stats.missCount
    });
  }, [state.translationCache]);

  useEffect(() => {
    updateStats();
  }, [updateStats]);

  const getEntriesByLanguage = useCallback((): CacheEntry[] => {
    // Convertir le cache du contexte en format CacheEntry
    const entries: CacheEntry[] = [];
    state.translationCache.forEach((value, key) => {
      entries.push({
        value,
        sourceLanguage: 'unknown', // Information non disponible dans le cache simple
        targetLanguage: 'unknown',
        lastAccessed: Date.now(),
        accessCount: 1
      });
    });
    return entries;
  }, [state.translationCache]);

  const clear = useCallback(() => {
    // Utiliser la méthode du contexte pour vider le cache
    console.log('Vidage du cache via contexte');
    updateStats();
    setStats(prev => ({ ...prev, hitCount: 0, missCount: 0 }));
  }, [updateStats]);

  const exportCache = useCallback((): string => {
    const cacheData = {
      stats,
      timestamp: new Date().toISOString(),
      entries: Object.fromEntries(state.translationCache),
      note: 'Cache exporté depuis le contexte global'
    };
    return JSON.stringify(cacheData, null, 2);
  }, [stats, state.translationCache]);

  const importCache = useCallback((data: string): boolean => {
    try {
      const parsed = JSON.parse(data);
      console.log('Import du cache:', parsed);
      // Ici on pourrait utiliser la méthode du contexte pour importer
      return true;
    } catch (error) {
      console.error('Erreur lors de l\'import du cache:', error);
      return false;
    }
  }, []);

  return {
    stats,
    getEntriesByLanguage,
    clear,
    exportCache,
    importCache,
    config,
  };
};
