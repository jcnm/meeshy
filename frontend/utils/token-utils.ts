/**
 * Utilitaires pour la gestion des tokens d'authentification
 */

export interface TokenInfo {
  value: string;
  type: 'auth' | 'anonymous';
  header: {
    name: string;
    value: string;
  };
}

/**
 * Récupère le token d'authentification actuel (auth ou anonymous)
 */
export function getAuthToken(): TokenInfo | null {
  if (typeof window === 'undefined') {
    return null;
  }

  // Priorité 1: Token d'authentification normale
  const authToken = localStorage.getItem('auth_token');
  if (authToken) {
    return {
      value: authToken,
      type: 'auth',
      header: {
        name: 'Authorization',
        value: `Bearer ${authToken}`
      }
    };
  }

  // Priorité 2: Token de session anonyme
  const sessionToken = localStorage.getItem('anonymous_session_token');
  if (sessionToken) {
    return {
      value: sessionToken,
      type: 'anonymous',
      header: {
        name: 'X-Session-Token',
        value: sessionToken
      }
    };
  }

  return null;
}

/**
 * Détermine le type d'un token donné
 */
export function getTokenType(token: string): 'auth' | 'anonymous' | null {
  if (!token) return null;

  // Vérifier si c'est un token anonyme en cherchant dans le localStorage
  const sessionToken = typeof window !== 'undefined' 
    ? localStorage.getItem('anonymous_session_token') 
    : null;
  
  if (sessionToken === token) {
    return 'anonymous';
  }

  // Vérifier si c'est un token d'authentification
  const authToken = typeof window !== 'undefined' 
    ? localStorage.getItem('auth_token') 
    : null;
  
  if (authToken === token) {
    return 'auth';
  }

  // Par défaut, on assume que c'est un token d'authentification normale (JWT)
  // car les tokens anonymes sont toujours stockés dans localStorage
  return 'auth';
}

/**
 * Crée les headers d'authentification appropriés pour un token
 */
export function createAuthHeaders(token?: string): HeadersInit {
  if (!token) {
    const tokenInfo = getAuthToken();
    if (!tokenInfo) return {};
    
    return {
      [tokenInfo.header.name]: tokenInfo.header.value
    };
  }

  const tokenType = getTokenType(token);
  
  if (tokenType === 'anonymous') {
    return {
      'X-Session-Token': token
    };
  }

  return {
    'Authorization': `Bearer ${token}`
  };
}

/**
 * Vérifie si l'utilisateur actuel est authentifié (auth ou anonymous)
 */
export function isAuthenticated(): boolean {
  return getAuthToken() !== null;
}

/**
 * Vérifie si l'utilisateur actuel est anonyme
 */
export function isAnonymousUser(): boolean {
  const tokenInfo = getAuthToken();
  return tokenInfo?.type === 'anonymous';
}

