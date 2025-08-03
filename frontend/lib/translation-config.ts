/**
 * Configuration d'environnement pour désactiver les modèles ML côté client en production Docker
 */

export const isClientTranslationDisabled = () => {
  // Désactiver complètement en mode Docker/production
  if (process.env.NEXT_PUBLIC_DISABLE_CLIENT_TRANSLATION === 'true') {
    return true;
  }
  
  // Désactiver si on préfère utiliser uniquement l'API
  if (process.env.NEXT_PUBLIC_USE_API_TRANSLATION_ONLY === 'true') {
    return true;
  }
  
  // Désactiver côté serveur (SSR)
  if (typeof window === 'undefined') {
    return true;
  }
  
  return false;
};

export const shouldUseAPITranslationOnly = () => {
  return isClientTranslationDisabled() || process.env.NODE_ENV === 'production';
};

export const getTranslationAPIUrl = () => {
  return process.env.NEXT_PUBLIC_TRANSLATION_URL || 'http://localhost:8000';
};

export const getBackendAPIUrl = () => {
  return process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';
};
