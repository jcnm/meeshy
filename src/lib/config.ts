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
    LIST: '/conversations',
    CREATE: '/conversations',
    JOIN: '/conversations/join',
    LINK: '/conversations/link',
    CREATE_LINK: '/conversations/create-link',
    MESSAGES: '/conversations/:id/messages',
    GET_GROUP_CONVERSATIONS: (groupId: string) => `/conversations/group/${groupId}`
  },
  MESSAGE: {
    LIST: '/messages/conversation',
    SEND: '/messages'
  },
  USER: {
    SEARCH: '/users/search'
  },
  GROUP: {
    LIST: '/groups',
    CREATE: '/groups',
    JOIN: '/groups/:id/join',
    LEAVE: '/groups/:id/leave',
    SEARCH: '/groups/search',
    DETAILS: (id: string) => `/groups/${id}`,
    MEMBERS: (id: string) => `/groups/${id}/members`,
    UPDATE: (id: string) => `/groups/${id}`,
    ADD_MEMBER: (groupId: string, userId: string) => `/groups/${groupId}/members/${userId}`,
    REMOVE_MEMBER: (groupId: string, userId: string) => `/groups/${groupId}/members/${userId}`,
    UPDATE_ROLE: (groupId: string, userId: string) => `/groups/${groupId}/members/${userId}/role`
  }
};

// Helper pour construire une URL complète vers l'API
export const buildApiUrl = (endpoint: string): string => {
  return `${APP_CONFIG.getBackendUrl()}${endpoint}`;
};
