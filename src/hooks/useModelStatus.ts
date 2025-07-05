'use client';

import { useState, useEffect } from 'react';

export interface ModelStatus {
  hasAnyModel: boolean;
  loadedModels: Record<string, boolean>;
  isLoading: boolean;
}

export function useModelStatus(): ModelStatus {
  const [loadedModels, setLoadedModels] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkModels = () => {
      try {
        const savedModels = localStorage.getItem('meeshy-loaded-models');
        const models = savedModels ? JSON.parse(savedModels) : {};
        setLoadedModels(models);
        setIsLoading(false);
      } catch (error) {
        console.error('Erreur lors de la vérification des modèles:', error);
        setLoadedModels({});
        setIsLoading(false);
      }
    };

    checkModels();

    // Écouter les changements dans localStorage
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'meeshy-loaded-models') {
        checkModels();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const hasAnyModel = Object.values(loadedModels).some(Boolean);

  return {
    hasAnyModel,
    loadedModels,
    isLoading
  };
}
