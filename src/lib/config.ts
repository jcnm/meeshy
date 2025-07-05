// Configuration centralisée pour les URLs et ports de l'application
export const APP_CONFIG = {
  // URLs des services
  FRONTEND_URL: process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3100',
  BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000',
  
  // Ports
  FRONTEND_PORT: 3100,
  BACKEND_PORT: 3000,
  
  // URLs spécifiques pour différents environnements
  getBackendUrl: () => {
    if (typeof window !== 'undefined') {
      // Côté client
      return process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';
    }
    // Côté serveur
    return process.env.BACKEND_URL || 'http://localhost:3000';
  },
  
  getFrontendUrl: () => {
    if (typeof window !== 'undefined') {
      // Côté client
      return process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3100';
    }
    // Côté serveur
    return process.env.FRONTEND_URL || 'http://localhost:3100';
  }
};

// URLs d'API fréquemment utilisées
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    ME: '/auth/me',
    LOGOUT: '/auth/logout'
  },
  CONVERSATION: {
    LIST: '/conversation',
    CREATE: '/conversation',
    JOIN: '/conversation/join',
    LINK: '/conversation/link',
    CREATE_LINK: '/conversation/create-link',
    MESSAGES: '/conversation/:id/messages',
    GET_GROUP_CONVERSATIONS: (groupId: string) => `/conversation/group/${groupId}`
  },
  MESSAGE: {
    LIST: '/message/conversation',
    SEND: '/message'
  },
  USER: {
    SEARCH: '/users/search'
  }
};

// Helper pour construire une URL complète vers l'API
export const buildApiUrl = (endpoint: string): string => {
  return `${APP_CONFIG.getBackendUrl()}${endpoint}`;
};
