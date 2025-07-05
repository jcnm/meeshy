'use client';

import { useState, useEffect, useCallback } from 'react';

interface CacheEntry {
  key: string;
  value: string;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
  sourceLanguage: string;
  targetLanguage: string;
}

interface CacheStats {
  totalEntries: number;
  totalSize: number;
  hitRate: number;
  oldestEntry: number;
  newestEntry: number;
  mostAccessed: string | null;
}

interface TranslationCacheOptions {
  maxEntries?: number;
  maxAge?: number; // en millisecondes
  maxSize?: number; // en caractères
  autoCleanup?: boolean;
  cleanupInterval?: number; // en millisecondes
}

const DEFAULT_OPTIONS: Required<TranslationCacheOptions> = {
  maxEntries: 1000,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 jours
  maxSize: 1024 * 1024, // 1MB en caractères
  autoCleanup: true,
  cleanupInterval: 5 * 60 * 1000, // 5 minutes
};

export function useTranslationCache(options: TranslationCacheOptions = {}) {
  const config = { ...DEFAULT_OPTIONS, ...options };
  const [cache, setCache] = useState<Map<string, CacheEntry>>(new Map());
  const [stats, setStats] = useState<CacheStats>({
    totalEntries: 0,
    totalSize: 0,
    hitRate: 0,
    oldestEntry: 0,
    newestEntry: 0,
    mostAccessed: null,
  });
  const [hitCount, setHitCount] = useState(0);
  const [missCount, setMissCount] = useState(0);

  // Générer une clé de cache
  const generateCacheKey = useCallback((
    text: string, 
    sourceLanguage: string, 
    targetLanguage: string
  ): string => {
    // Utiliser un hash simple mais efficace
    const normalizedText = text.trim().toLowerCase();
    const keyString = `${normalizedText}|${sourceLanguage}|${targetLanguage}`;
    
    // Hash simple (DJB2)
    let hash = 5381;
    for (let i = 0; i < keyString.length; i++) {
      hash = ((hash << 5) + hash) + keyString.charCodeAt(i);
    }
    
    return Math.abs(hash).toString(36);
  }, []);

  // Charger le cache depuis localStorage
  useEffect(() => {
    try {
      const savedCache = localStorage.getItem('meeshy-translation-cache');
      if (savedCache) {
        const parsedCache = JSON.parse(savedCache);
        const cacheMap = new Map<string, CacheEntry>();
        
        Object.entries(parsedCache).forEach(([key, entry]) => {
          const cacheEntry = entry as CacheEntry;
          // Vérifier que l'entrée n'est pas expirée
          if (Date.now() - cacheEntry.timestamp < config.maxAge) {
            cacheMap.set(key, cacheEntry);
          }
        });
        
        setCache(cacheMap);
      }
    } catch (error) {
      console.warn('Erreur lors du chargement du cache de traduction:', error);
    }
  }, [config.maxAge]);

  // Sauvegarder le cache dans localStorage
  const saveCache = useCallback((cacheMap: Map<string, CacheEntry>) => {
    try {
      const cacheObject = Object.fromEntries(cacheMap);
      localStorage.setItem('meeshy-translation-cache', JSON.stringify(cacheObject));
    } catch (error) {
      console.warn('Erreur lors de la sauvegarde du cache:', error);
    }
  }, []);

  // Mettre à jour les statistiques
  const updateStats = useCallback((cacheMap: Map<string, CacheEntry>) => {
    const entries = Array.from(cacheMap.values());
    const totalSize = entries.reduce((size, entry) => size + entry.value.length, 0);
    const timestamps = entries.map(entry => entry.timestamp);
    const accessCounts = entries.map(entry => entry.accessCount);
    
    const oldestEntry = timestamps.length > 0 ? Math.min(...timestamps) : 0;
    const newestEntry = timestamps.length > 0 ? Math.max(...timestamps) : 0;
    const mostAccessedIndex = accessCounts.indexOf(Math.max(...accessCounts));
    const mostAccessed = mostAccessedIndex >= 0 ? entries[mostAccessedIndex].key : null;
    
    const totalRequests = hitCount + missCount;
    const hitRate = totalRequests > 0 ? (hitCount / totalRequests) * 100 : 0;

    setStats({
      totalEntries: cacheMap.size,
      totalSize,
      hitRate,
      oldestEntry,
      newestEntry,
      mostAccessed,
    });
  }, [hitCount, missCount]);

  // Nettoyer le cache
  const cleanCache = useCallback((cacheMap: Map<string, CacheEntry>): Map<string, CacheEntry> => {
    const now = Date.now();
    const cleanedCache = new Map<string, CacheEntry>();
    
    // Supprimer les entrées expirées
    for (const [key, entry] of cacheMap) {
      if (now - entry.timestamp < config.maxAge) {
        cleanedCache.set(key, entry);
      }
    }
    
    // Si on dépasse toujours les limites, supprimer les entrées les moins utilisées
    if (cleanedCache.size > config.maxEntries) {
      const entries = Array.from(cleanedCache.entries())
        .sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed)
        .slice(0, config.maxEntries);
      
      return new Map(entries);
    }
    
    // Vérifier la taille totale
    let totalSize = 0;
    const sizeOrderedEntries = Array.from(cleanedCache.entries())
      .sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed);
    
    const finalCache = new Map<string, CacheEntry>();
    for (const [key, entry] of sizeOrderedEntries) {
      if (totalSize + entry.value.length <= config.maxSize) {
        finalCache.set(key, entry);
        totalSize += entry.value.length;
      } else {
        break;
      }
    }
    
    return finalCache;
  }, [config.maxAge, config.maxEntries, config.maxSize]);

  // Nettoyage automatique
  useEffect(() => {
    if (!config.autoCleanup) return;

    const interval = setInterval(() => {
      setCache(currentCache => {
        const cleanedCache = cleanCache(currentCache);
        if (cleanedCache.size !== currentCache.size) {
          saveCache(cleanedCache);
        }
        return cleanedCache;
      });
    }, config.cleanupInterval);

    return () => clearInterval(interval);
  }, [config.autoCleanup, config.cleanupInterval, cleanCache, saveCache]);

  // Mettre à jour les stats quand le cache change
  useEffect(() => {
    updateStats(cache);
  }, [cache, updateStats]);

  // Obtenir une traduction du cache
  const get = useCallback((
    text: string, 
    sourceLanguage: string, 
    targetLanguage: string
  ): string | null => {
    const key = generateCacheKey(text, sourceLanguage, targetLanguage);
    const entry = cache.get(key);
    
    if (entry) {
      // Mettre à jour les statistiques d'accès
      const updatedEntry = {
        ...entry,
        accessCount: entry.accessCount + 1,
        lastAccessed: Date.now(),
      };
      
      setCache(prev => new Map(prev).set(key, updatedEntry));
      setHitCount(prev => prev + 1);
      
      return entry.value;
    }
    
    setMissCount(prev => prev + 1);
    return null;
  }, [cache, generateCacheKey]);

  // Sauvegarder une traduction dans le cache
  const set = useCallback((
    text: string, 
    sourceLanguage: string, 
    targetLanguage: string, 
    translation: string
  ): void => {
    if (!translation.trim()) return;

    const key = generateCacheKey(text, sourceLanguage, targetLanguage);
    const now = Date.now();
    
    const entry: CacheEntry = {
      key,
      value: translation,
      timestamp: now,
      accessCount: 1,
      lastAccessed: now,
      sourceLanguage,
      targetLanguage,
    };

    setCache(prev => {
      const newCache = new Map(prev);
      newCache.set(key, entry);
      
      // Nettoyer si nécessaire
      const cleanedCache = cleanCache(newCache);
      saveCache(cleanedCache);
      
      return cleanedCache;
    });
  }, [generateCacheKey, cleanCache, saveCache]);

  // Supprimer une entrée du cache
  const remove = useCallback((
    text: string, 
    sourceLanguage: string, 
    targetLanguage: string
  ): boolean => {
    const key = generateCacheKey(text, sourceLanguage, targetLanguage);
    
    if (cache.has(key)) {
      setCache(prev => {
        const newCache = new Map(prev);
        newCache.delete(key);
        saveCache(newCache);
        return newCache;
      });
      return true;
    }
    
    return false;
  }, [cache, generateCacheKey, saveCache]);

  // Vider tout le cache
  const clear = useCallback(() => {
    setCache(new Map());
    try {
      localStorage.removeItem('meeshy-translation-cache');
    } catch (error) {
      console.warn('Erreur lors de la suppression du cache:', error);
    }
    
    setHitCount(0);
    setMissCount(0);
  }, []);

  // Obtenir les entrées par langue
  const getEntriesByLanguage = useCallback((
    sourceLanguage?: string, 
    targetLanguage?: string
  ): CacheEntry[] => {
    return Array.from(cache.values()).filter(entry => {
      const matchesSource = !sourceLanguage || entry.sourceLanguage === sourceLanguage;
      const matchesTarget = !targetLanguage || entry.targetLanguage === targetLanguage;
      return matchesSource && matchesTarget;
    });
  }, [cache]);

  // Exporter le cache
  const exportCache = useCallback((): string => {
    return JSON.stringify(Object.fromEntries(cache), null, 2);
  }, [cache]);

  // Importer le cache
  const importCache = useCallback((cacheData: string): boolean => {
    try {
      const parsedData = JSON.parse(cacheData);
      const newCache = new Map<string, CacheEntry>();
      
      Object.entries(parsedData).forEach(([key, entry]) => {
        const cacheEntry = entry as CacheEntry;
        if (cacheEntry.key && cacheEntry.value && cacheEntry.timestamp) {
          newCache.set(key, cacheEntry);
        }
      });
      
      setCache(newCache);
      saveCache(newCache);
      return true;
    } catch (error) {
      console.error('Erreur lors de l\'importation du cache:', error);
      return false;
    }
  }, [saveCache]);

  return {
    // Opérations principales
    get,
    set,
    remove,
    clear,
    
    // Statistiques et informations
    stats,
    hitCount,
    missCount,
    
    // Utilitaires
    getEntriesByLanguage,
    exportCache,
    importCache,
    
    // Configuration
    config,
  };
}
