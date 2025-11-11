import { buildApiUrl } from '@/lib/config';
import { authManager } from './auth-manager.service';

interface ApiConfig {
  timeout: number;
  headers: Record<string, string>;
}

interface ApiResponse<T> {
  data: T;
  status: number;
  message?: string;
}

interface ApiError {
  message: string;
  status: number;
  code?: string;
}

class ApiServiceError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiServiceError';
    this.status = status;
    this.code = code;
  }
}

class ApiService {
  private config: ApiConfig;
  constructor(config: Partial<ApiConfig> = {}) {
    this.config = {
      timeout: 15000, // 15 seconds - augmenté pour les requêtes complexes (conversations, traductions)
      headers: {
        'Content-Type': 'application/json',
      },
      ...config,
    };
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    // Utiliser une URL relative côté client pour que Next.js rewrites fonctionnent
    // et préservent les cookies d'authentification
    const isBrowser = typeof window !== 'undefined';
    const url = isBrowser
      ? (endpoint.startsWith('/api/') ? endpoint : `/api${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`)
      : buildApiUrl(endpoint);

    // Get token from AuthManager (source unique de vérité)
    const token = authManager.getAuthToken();

    // Pour les requêtes DELETE/POST/PUT sans body, ne pas inclure Content-Type
    const shouldExcludeContentType = (options.method === 'DELETE' || options.method === 'POST' || options.method === 'PUT') && !options.body;
    let defaultHeaders = { ...this.config.headers };

    // Supprimer complètement le Content-Type pour les requêtes sans body
    if (shouldExcludeContentType) {
      delete defaultHeaders['Content-Type'];
    }

    const headers = {
      ...defaultHeaders,
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        // Si la réponse n'est pas du JSON valide, utiliser le texte brut
        const text = await response.text();
        throw new ApiServiceError(
          `Erreur serveur (${response.status}): ${text || 'Réponse invalide'}`,
          response.status,
          'PARSE_ERROR'
        );
      }

      if (!response.ok) {
        throw new ApiServiceError(
          data.message || data.error || `Erreur serveur (${response.status})`,
          response.status,
          data.code
        );
      }

      return {
        data,
        status: response.status,
        message: data.message,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof ApiServiceError) {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        console.error('❌ [API-SERVICE] Timeout de la requête:', { endpoint: url, timeout: this.config.timeout });
        throw new ApiServiceError(`Timeout de la requête (${this.config.timeout}ms) - ${endpoint}`, 408, 'TIMEOUT');
      }

      throw new ApiServiceError(
        'Erreur de connexion au serveur',
        0,
        'NETWORK_ERROR'
      );
    }
  }

  /**
   * Perform a GET request with optional query parameters
   *
   * @param endpoint - API endpoint path (e.g., '/admin/users')
   * @param params - Query string parameters as a flat key-value object (NOT wrapped in {params: ...})
   * @param options - Additional options (abort signal, custom headers)
   *
   * @example
   * // Correct usage:
   * apiService.get('/users', { page: 1, limit: 20, search: 'john' })
   * // → GET /users?page=1&limit=20&search=john
   *
   * @example
   * // WRONG - Do NOT wrap in {params: ...}:
   * apiService.get('/users', { params: { page: 1 } }) // ✗ This will NOT work
   *
   * @returns Promise resolving to ApiResponse<T>
   */
  async get<T>(endpoint: string, params?: Record<string, unknown>, options?: { signal?: AbortSignal; headers?: Record<string, string> }): Promise<ApiResponse<T>> {
    let url = endpoint;
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });
      url += `?${searchParams.toString()}`;
    }

    return this.request<T>(url, {
      method: 'GET',
      signal: options?.signal,
      headers: options?.headers
    });
  }

  async post<T>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  // Méthode pour uploader des fichiers
  async uploadFile<T>(endpoint: string, file: File, additionalData?: Record<string, unknown>): Promise<ApiResponse<T>> {
    const formData = new FormData();
    formData.append('file', file);
    
    if (additionalData) {
      Object.entries(additionalData).forEach(([key, value]) => {
        formData.append(key, String(value));
      });
    }

    const token = authManager.getAuthToken();

    return this.request<T>(endpoint, {
      method: 'POST',
      body: formData,
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
        // Ne pas spécifier Content-Type pour FormData
      },
    });
  }

  /**
   * @deprecated Utiliser authManager.setCredentials() à la place
   * Conservé pour compatibilité legacy
   */
  setAuthToken(token: string | null) {
    console.warn('[API_SERVICE] setAuthToken is deprecated. Use authManager.setCredentials() instead');
    // Legacy: Ne rien faire, authManager gère maintenant
  }

  /**
   * @deprecated Utiliser authManager.getAuthToken() à la place
   * Conservé pour compatibilité legacy
   */
  getAuthToken(): string | null {
    return authManager.getAuthToken();
  }
}

// Instance singleton
export const apiService = new ApiService();
export { ApiService, ApiServiceError };
export type { ApiResponse, ApiError, ApiConfig };
