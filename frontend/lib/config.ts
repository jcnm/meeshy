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

// Configuration principale
export const config: MeeshyConfig = {
  frontend: {
    url: process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3100',
    port: parseInt(process.env.NEXT_PUBLIC_FRONTEND_URL?.split(':')[2] || '3100'),
  },
  
  backend: {
    url: process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000',
    port: parseInt(process.env.PORT || '3000'),
  },
  
  translation: {
    url: process.env.NEXT_PUBLIC_TRANSLATION_URL || 'http://localhost:8000',
    port: parseInt(process.env.FASTAPI_PORT || '8000'),
    grpcPort: parseInt(process.env.GRPC_PORT || '50051'),
    zmqPort: parseInt(process.env.ZMQ_PORT || '5555'),
  },
  
  database: {
    url: process.env.DATABASE_URL || 'file:./dev.db',
    poolSize: parseInt(process.env.PRISMA_POOL_SIZE || '10'),
  },
  
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
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
    origin: parseArray(process.env.CORS_ORIGIN, ['http://localhost:3100']),
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
    return config.backend.url;
  },
  
  getFrontendUrl: () => {
    if (typeof window !== 'undefined') {
      return config.frontend.url;
    }
    return config.frontend.url;
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

// Helper pour construire une URL WebSocket
export const getWebSocketUrl = (): string => {
  const backendUrl = APP_CONFIG.getBackendUrl();
  // Convertir HTTP/HTTPS en WS/WSS
  return backendUrl.replace(/^https?:\/\//, (match) => 
    match === 'https://' ? 'wss://' : 'ws://'
  );
};

// Helper pour construire une URL WebSocket complète avec path
export const buildWebSocketUrl = (path = '/ws'): string => {
  return `${getWebSocketUrl()}${path}`;
};
