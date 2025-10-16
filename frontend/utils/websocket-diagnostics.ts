/**
 * Outil de diagnostic pour déboguer les problèmes de connexion WebSocket
 */

export interface WebSocketDiagnostics {
  timestamp: string;
  userState: {
    hasUser: boolean;
    userId: string | null;
    username: string | null;
  };
  tokens: {
    hasAuthToken: boolean;
    hasSessionToken: boolean;
    authTokenValid: boolean;
    authTokenPreview: string;
    sessionTokenPreview: string;
  };
  socketState: {
    isConnecting: boolean;
    isConnected: boolean;
    hasSocket: boolean;
    socketId: string | null;
    transport: string | null;
  };
  configuration: {
    serverUrl: string;
    currentPath: string;
    isPublicPath: boolean;
  };
  recommendations: string[];
}

/**
 * Vérifie si un JWT est expiré (sans le décoder côté serveur)
 */
function isJWTExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp ? Date.now() >= payload.exp * 1000 : false;
  } catch {
    return true; // Si on ne peut pas parser, considérer comme expiré
  }
}

/**
 * Récupère des diagnostics complets sur l'état de la connexion WebSocket
 */
export function getWebSocketDiagnostics(): WebSocketDiagnostics {
  const diagnostics: WebSocketDiagnostics = {
    timestamp: new Date().toISOString(),
    userState: {
      hasUser: false,
      userId: null,
      username: null
    },
    tokens: {
      hasAuthToken: false,
      hasSessionToken: false,
      authTokenValid: false,
      authTokenPreview: '',
      sessionTokenPreview: ''
    },
    socketState: {
      isConnecting: false,
      isConnected: false,
      hasSocket: false,
      socketId: null,
      transport: null
    },
    configuration: {
      serverUrl: '',
      currentPath: '',
      isPublicPath: false
    },
    recommendations: []
  };

  // Vérifier si on est côté client
  if (typeof window === 'undefined') {
    diagnostics.recommendations.push('⚠️ Exécution côté serveur (SSR) - WebSocket non disponible');
    return diagnostics;
  }

  // 1. État utilisateur
  try {
    const userStore = require('@/stores').useAuthStore.getState();
    const user = userStore?.user;
    if (user) {
      diagnostics.userState.hasUser = true;
      diagnostics.userState.userId = user.id;
      diagnostics.userState.username = user.username;
    } else {
      diagnostics.recommendations.push('❌ Aucun utilisateur dans le store - Connexion impossible');
    }
  } catch (error) {
    diagnostics.recommendations.push('⚠️ Erreur lors de la récupération de l\'utilisateur');
  }

  // 2. Tokens d'authentification
  const authToken = localStorage.getItem('auth_token');
  const sessionToken = localStorage.getItem('anonymous_session_token');

  if (authToken) {
    diagnostics.tokens.hasAuthToken = true;
    diagnostics.tokens.authTokenValid = !isJWTExpired(authToken);
    diagnostics.tokens.authTokenPreview = authToken.substring(0, 20) + '...';
    
    if (!diagnostics.tokens.authTokenValid) {
      diagnostics.recommendations.push('❌ Token JWT expiré - Reconnexion requise');
    }
  }

  if (sessionToken) {
    diagnostics.tokens.hasSessionToken = true;
    diagnostics.tokens.sessionTokenPreview = sessionToken.substring(0, 20) + '...';
  }

  if (!authToken && !sessionToken) {
    diagnostics.recommendations.push('❌ Aucun token trouvé - Authentification impossible');
  }

  // 3. État de la socket
  try {
    const socketService = require('@/services/meeshy-socketio.service').meeshySocketIOService;
    const status = socketService.getConnectionStatus();
    const socket = socketService.getSocket();
    
    diagnostics.socketState.isConnected = status.isConnected;
    diagnostics.socketState.hasSocket = status.hasSocket;
    diagnostics.socketState.socketId = socket?.id || null;
    diagnostics.socketState.transport = socket?.io?.engine?.transport?.name || null;

    if (!status.hasSocket) {
      diagnostics.recommendations.push('⚠️ Socket non créée - Appeler meeshySocketIOService.setCurrentUser()');
    } else if (!status.isConnected) {
      diagnostics.recommendations.push('⚠️ Socket créée mais non authentifiée - Vérifier les logs backend');
    }
  } catch (error) {
    diagnostics.recommendations.push('⚠️ Erreur lors de la récupération de l\'état de la socket');
  }

  // 4. Configuration
  try {
    const { getWebSocketUrl } = require('@/lib/config');
    diagnostics.configuration.serverUrl = getWebSocketUrl();
    diagnostics.configuration.currentPath = window.location.pathname;
    
    const publicPaths = ['/about', '/contact', '/privacy', '/terms', '/partners'];
    diagnostics.configuration.isPublicPath = publicPaths.includes(window.location.pathname);
    
    if (diagnostics.configuration.isPublicPath) {
      diagnostics.recommendations.push('ℹ️ Page publique détectée - WebSocket non nécessaire');
    }
  } catch (error) {
    diagnostics.recommendations.push('⚠️ Erreur lors de la récupération de la configuration');
  }

  // 5. Recommandations finales
  if (diagnostics.recommendations.length === 0) {
    diagnostics.recommendations.push('✅ Tous les paramètres semblent corrects');
  }

  return diagnostics;
}

/**
 * Affiche les diagnostics dans la console de manière formatée
 */
export function printWebSocketDiagnostics(): void {
  const diagnostics = getWebSocketDiagnostics();
  
  console.group('🔍 DIAGNOSTICS WEBSOCKET');
  console.log('📅 Timestamp:', diagnostics.timestamp);
  
  console.group('👤 État Utilisateur');
  console.log('Utilisateur présent:', diagnostics.userState.hasUser ? '✅' : '❌');
  if (diagnostics.userState.hasUser) {
    console.log('User ID:', diagnostics.userState.userId);
    console.log('Username:', diagnostics.userState.username);
  }
  console.groupEnd();
  
  console.group('🔐 Tokens');
  console.log('Auth Token:', diagnostics.tokens.hasAuthToken ? '✅' : '❌');
  if (diagnostics.tokens.hasAuthToken) {
    console.log('  Valide:', diagnostics.tokens.authTokenValid ? '✅' : '❌');
    console.log('  Preview:', diagnostics.tokens.authTokenPreview);
  }
  console.log('Session Token:', diagnostics.tokens.hasSessionToken ? '✅' : '❌');
  if (diagnostics.tokens.hasSessionToken) {
    console.log('  Preview:', diagnostics.tokens.sessionTokenPreview);
  }
  console.groupEnd();
  
  console.group('🔌 État Socket');
  console.log('Socket créée:', diagnostics.socketState.hasSocket ? '✅' : '❌');
  console.log('Socket authentifiée:', diagnostics.socketState.isConnected ? '✅' : '❌');
  if (diagnostics.socketState.socketId) {
    console.log('Socket ID:', diagnostics.socketState.socketId);
    console.log('Transport:', diagnostics.socketState.transport);
  }
  console.groupEnd();
  
  console.group('⚙️ Configuration');
  console.log('Server URL:', diagnostics.configuration.serverUrl);
  console.log('Current Path:', diagnostics.configuration.currentPath);
  console.log('Is Public Path:', diagnostics.configuration.isPublicPath);
  console.groupEnd();
  
  console.group('💡 Recommandations');
  diagnostics.recommendations.forEach(rec => console.log(rec));
  console.groupEnd();
  
  console.groupEnd();
}

/**
 * Hook React pour exposer les diagnostics dans les composants
 */
export function useWebSocketDiagnostics() {
  if (typeof window === 'undefined') {
    return null;
  }
  
  return {
    getDiagnostics: getWebSocketDiagnostics,
    printDiagnostics: printWebSocketDiagnostics
  };
}

