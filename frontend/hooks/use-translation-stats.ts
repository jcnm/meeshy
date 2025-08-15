import { useState, useEffect, useCallback } from 'react';

interface TranslationStats {
  totalTranslations: number;
  lastUsed: Date | null;
  translationsToday: number;
  languagesUsed: string[];
}

const STORAGE_KEY = 'translation_stats';

export function useTranslationStats() {
  const [stats, setStats] = useState<TranslationStats>({
    totalTranslations: 0,
    lastUsed: null,
    translationsToday: 0,
    languagesUsed: []
  });

  // Charger les statistiques depuis le localStorage
  const loadStats = useCallback(() => {
    try {
      const statsData = localStorage.getItem(STORAGE_KEY);
      if (statsData) {
        const parsedStats = JSON.parse(statsData);
        setStats({
          totalTranslations: parsedStats.totalTranslations || 0,
          lastUsed: parsedStats.lastUsed ? new Date(parsedStats.lastUsed) : null,
          translationsToday: parsedStats.translationsToday || 0,
          languagesUsed: parsedStats.languagesUsed || []
        });
      }
    } catch (error) {
      console.error('Erreur lors du chargement des statistiques:', error);
    }
  }, []);

  // Sauvegarder les statistiques dans le localStorage
  const saveStats = useCallback((newStats: TranslationStats) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newStats));
    } catch (error) {
      console.error('Erreur lors de la sauvegarde des statistiques:', error);
    }
  }, []);

  // Incrémenter le compteur de traductions
  const incrementTranslationCount = useCallback((targetLanguage: string) => {
    setStats(prevStats => {
      const today = new Date().toDateString();
      const lastUsedDate = prevStats.lastUsed ? prevStats.lastUsed.toDateString() : null;
      
      const newStats: TranslationStats = {
        ...prevStats,
        totalTranslations: prevStats.totalTranslations + 1,
        lastUsed: new Date(),
        translationsToday: today === lastUsedDate ? prevStats.translationsToday + 1 : 1,
        languagesUsed: prevStats.languagesUsed.includes(targetLanguage) 
          ? prevStats.languagesUsed 
          : [...prevStats.languagesUsed, targetLanguage]
      };
      
      saveStats(newStats);
      return newStats;
    });
  }, [saveStats]);

  // Réinitialiser les statistiques
  const resetStats = useCallback(() => {
    const defaultStats: TranslationStats = {
      totalTranslations: 0,
      lastUsed: null,
      translationsToday: 0,
      languagesUsed: []
    };
    setStats(defaultStats);
    saveStats(defaultStats);
  }, [saveStats]);

  // Charger les statistiques au montage
  useEffect(() => {
    loadStats();
  }, [loadStats]);

  return {
    stats,
    incrementTranslationCount,
    resetStats,
    loadStats
  };
}
