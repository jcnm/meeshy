// Configuration centralisée Meeshy - Variables d'environnement
// Ce fichier centralise toutes les configurations depuis .env

interface MeeshyConfig {
  // Ports et URLs
  frontend: {
    url: string;
    port: number;
  };
  backend: {
    url: string;
    port: number;
  };
  translation: {
    url: string;
    port: number;
    grpcPort: number;
    zmqPort: number;
  };
  
  // Base de données
  database: {
    url: string;
    poolSize: number;
  };
  
  // Cache Redis (optionnel)
  redis: {
    url: string;
    ttl: number;
    maxEntries: number;
  };
  
  // JWT
  jwt: {
    secret: string;
    expiresIn: string;
  };
  
  // Langues
  languages: {
    default: string;
    supported: string[];
    autoDetect: boolean;
  };
  
  // Environnement
  env: {
    nodeEnv: string;
    debug: boolean;
    logLevel: string;
  };
  
  // CORS
  cors: {
    origin: string[];
  };
}

// Fonction helper pour parser les booléens
const parseBoolean = (value: string | undefined, defaultValue: boolean = false): boolean => {
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true';
};

// Fonction helper pour parser les arrays
const parseArray = (value: string | undefined, defaultValue: string[] = []): string[] => {
  if (!value) return defaultValue;
  return value.split(',').map(item => item.trim()).filter(Boolean);
};

// Fonction helper pour vérifier si on est côté client
const isBrowser = (): boolean => typeof window !== 'undefined';

// Fonction helper pour nettoyer les URLs
const trimSlashes = (value: string): string => value.replace(/\/$/, '');
const ensureLeadingSlash = (path: string): string => (path.startsWith('/') ? path : `/${path}`);

// Configuration principale
export const config: MeeshyConfig = {
  frontend: {
    url: process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://meeshy.me',
    port: parseInt(process.env.NEXT_PUBLIC_FRONTEND_URL?.split(':')[2] || '3100'),
  },
  
  backend: {
    url: process.env.NEXT_PUBLIC_BACKEND_URL || 'https://gate.meeshy.me',
    port: parseInt(process.env.PORT || '3000'),
  },
  
  translation: {
    url: process.env.NEXT_PUBLIC_TRANSLATION_URL || 'https://ml.meeshy.me/',
    port: parseInt(process.env.FASTAPI_PORT || '8000'),
    grpcPort: parseInt(process.env.GRPC_PORT || '50051'),
    zmqPort: parseInt(process.env.ZMQ_PORT || '5555'),
  },
  
  database: {
    url: process.env.DATABASE_URL || 'file:./dev.db',
    poolSize: parseInt(process.env.PRISMA_POOL_SIZE || '10'),
  },
  
  redis: {
    url: process.env.REDIS_URL || 'redis://redis:6379',
    ttl: parseInt(process.env.TRANSLATION_CACHE_TTL || '3600'),
    maxEntries: parseInt(process.env.CACHE_MAX_ENTRIES || '10000'),
  },
  
  jwt: {
    secret: process.env.JWT_SECRET || 'meeshy-dev-secret-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  
  languages: {
    default: process.env.DEFAULT_LANGUAGE || 'fr',
    supported: parseArray(process.env.SUPPORTED_LANGUAGES, ['fr', 'en', 'es', 'de', 'pt', 'zh', 'ja', 'ar']),
    autoDetect: parseBoolean(process.env.AUTO_DETECT_LANGUAGE, true),
  },
  
  env: {
    nodeEnv: process.env.NODE_ENV || 'development',
    debug: parseBoolean(process.env.DEBUG, true),
    logLevel: process.env.LOG_LEVEL || 'info',
  },
  
  cors: {
    origin: parseArray(process.env.CORS_ORIGINS, ['https://meeshy.me']),
  },
};

// Export des configurations spécifiques pour faciliter l'usage
export const isDevelopment = config.env.nodeEnv === 'development';
export const isProduction = config.env.nodeEnv === 'production';
export const isDebug = config.env.debug;

// Fonction pour afficher la configuration (utile pour le debugging)
export const logConfig = () => {
  if (isDebug) {
    console.log('🔧 Configuration Meeshy:');
    console.log(`  • Frontend: ${config.frontend.url}`);
    console.log(`  • Backend: ${config.backend.url}`);
    console.log(`  • Translation: ${config.translation.url}`);
    console.log(`  • Environment: ${config.env.nodeEnv}`);
    console.log(`  • Debug: ${config.env.debug}`);
    console.log(`  • Languages: ${config.languages.supported.join(', ')}`);
  }
};

// Compatibilité avec l'ancien APP_CONFIG
export const APP_CONFIG = {
  FRONTEND_URL: config.frontend.url,
  BACKEND_URL: config.backend.url,
  FRONTEND_PORT: config.frontend.port,
  BACKEND_PORT: config.backend.port,
  
  getBackendUrl: () => {
    return getBackendUrl();
  },

  getFrontendUrl: () => {
    return getFrontendUrl();
  },

  getWebSocketUrl: () => {
    return getWebSocketUrl();
  }

};

export default config;

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
    CREATE_LINK: '/api/links',
    GET_CONVERSATION_LINKS: (conversationId: string) => `/conversations/${conversationId}/links`,
    GET_LINK_CONVERSATION: (linkId: string) => `/api/links/${linkId}/conversations`,
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
    LIST: '/communities',
    CREATE: '/communities',
    JOIN: '/communities/:id/join',
    LEAVE: '/communities/:id/leave',
    SEARCH: '/communities/search',
    DETAILS: (id: string) => `/communities/${id}`,
    MEMBERS: (id: string) => `/communities/${id}/members`,
    UPDATE: (id: string) => `/communities/${id}`,
    ADD_MEMBER: (groupId: string) => `/communities/${groupId}/members`,
    REMOVE_MEMBER: (groupId: string, memberId: string) => `/communities/${groupId}/members/${memberId}`,
    UPDATE_MEMBER_ROLE: (groupId: string, memberId: string) => `/communities/${groupId}/members/${memberId}/role`,
    CHECK_IDENTIFIER: (identifier: string) => `/communities/check-identifier/${identifier}`
  },
  TRACKING_LINK: {
    CREATE: '/api/tracking-links',
    CLICK: (token: string) => `/api/tracking-links/${token}/click`,
    GET: (token: string) => `/api/tracking-links/${token}`,
    STATS: (token: string) => `/api/tracking-links/${token}/stats`,
    USER_LINKS: '/api/tracking-links/user/me',
    CONVERSATION_LINKS: (conversationId: string) => `/api/tracking-links/conversation/${conversationId}`,
    DEACTIVATE: (token: string) => `/api/tracking-links/${token}/deactivate`,
    DELETE: (token: string) => `/api/tracking-links/${token}`,
    REDIRECT: (token: string) => `/l/${token}`
  }
};

// === FONCTIONS UNIFIÉES POUR LES URLs ===

// HTTP base URL for the Gateway - Gère automatiquement client/serveur
export const getBackendUrl = (): string => {
  if (isBrowser()) {
    // Vérifier d'abord les variables d'environnement
    const fromEnv = process.env.NEXT_PUBLIC_BACKEND_URL;
    if (fromEnv) return trimSlashes(fromEnv);
    
    // CORRECTION: Détection automatique localhost en développement
    const currentHost = window.location.hostname;
    const isDev = currentHost === 'localhost' || currentHost === '127.0.0.1';
    
    if (isDev) {
      // En développement local, utiliser http://localhost:3000 (gateway)
      console.log('🔧 [CONFIG] Développement local détecté, utilisation de http://localhost:3000');
      return 'http://localhost:3000';
    }
    
    // En production, utiliser l'URL de production
    return 'https://gate.meeshy.me';
  }
  // Côté serveur (SSR) - utiliser INTERNAL_BACKEND_URL
  return trimSlashes(process.env.INTERNAL_BACKEND_URL || 'https://gate.meeshy.me');
};

// HTTP base URL for the Frontend - Gère automatiquement client/serveur
export const getFrontendUrl = (): string => {
  if (isBrowser()) {
    // Côté client (navigateur) - utiliser l'URL actuelle ou NEXT_PUBLIC_FRONTEND_URL
    return trimSlashes(window.location.origin || process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://meeshy.me');
  }
  // Côté serveur (SSR) - utiliser NEXT_PUBLIC_FRONTEND_URL
  return trimSlashes(process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://meeshy.me');
};

// WebSocket base URL for the Gateway - Gère automatiquement client/serveur
export const getWebSocketUrl = (): string => {
  if (isBrowser()) {
    // Côté client (navigateur) - utiliser NEXT_PUBLIC_WS_URL
    const fromEnv = process.env.NEXT_PUBLIC_WS_URL;
    if (fromEnv) return trimSlashes(fromEnv);
    
    // CORRECTION: Détection automatique localhost en développement
    const currentHost = window.location.hostname;
    const isDev = currentHost === 'localhost' || currentHost === '127.0.0.1';
    
    if (isDev) {
      // En développement local, utiliser ws://localhost:4000
      console.log('🔧 [CONFIG] Développement local détecté, utilisation de ws://localhost:3000');
      return 'ws://localhost:3000';
    }
    
    // Derive from backend if WS not provided
    const backendUrl = getBackendUrl();
    const wsUrl = backendUrl.replace(/^http(s?):\/\//, (_m, s) => (s ? 'wss://' : 'ws://'));
    console.log('🔧 [CONFIG] URL WebSocket dérivée:', wsUrl);
    return trimSlashes(wsUrl);
  }
  // Côté serveur (SSR) - utiliser INTERNAL_WS_URL
  return trimSlashes(process.env.INTERNAL_WS_URL || 'ws://gateway:3000');
};

// Helper pour construire une URL complète vers l'API - Version unifiée
export const buildApiUrl = (endpoint: string): string => {
  // Add /api prefix for all API endpoints that don't already have it
  const apiEndpoint = endpoint.startsWith('/api/') ? endpoint : `/api${ensureLeadingSlash(endpoint)}`;
  
  // Route directly to gateway with /api prefix since all gateway routes are prefixed with /api
  return `${getBackendUrl()}${apiEndpoint}`;
};

// Helper pour construire une URL directe vers le Gateway (bypass Next.js API)
export const buildGatewayUrl = (endpoint: string): string => {
  // No /api prefix for direct gateway calls
  const cleanEndpoint = ensureLeadingSlash(endpoint);
  return `${getBackendUrl()}${cleanEndpoint}`;
};

// Helper pour construire une URL WebSocket complète avec path - Version unifiée
export const buildWsUrl = (path = '/socket.io/'): string => {
  return `${getWebSocketUrl()}${ensureLeadingSlash(path)}`;
};

// === FONCTIONS DE COMPATIBILITÉ (pour éviter les breaking changes) ===

// Helper pour construire une URL WebSocket (ancienne version)
export const buildWebSocketUrl = (path = '/socket.io/'): string => {
  return buildWsUrl(path);
};
