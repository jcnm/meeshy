import { APP_CONFIG } from '@/lib/config';

interface ApiConfig {
  baseUrl: string;
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
      baseUrl: APP_CONFIG.getBackendUrl(),
      timeout: 10000,
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
    const url = `${this.config.baseUrl}${endpoint}`;
    
    // Get token from localStorage
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    
    const headers = {
      ...this.config.headers,
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

      const data = await response.json();

      if (!response.ok) {
        throw new ApiServiceError(
          data.message || 'Une erreur est survenue',
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
        throw new ApiServiceError('Timeout de la requête', 408, 'TIMEOUT');
      }

      throw new ApiServiceError(
        'Erreur de connexion au serveur',
        0,
        'NETWORK_ERROR'
      );
    }
  }

  async get<T>(endpoint: string, params?: Record<string, unknown>): Promise<ApiResponse<T>> {
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

    return this.request<T>(url, { method: 'GET' });
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

    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    
    return this.request<T>(endpoint, {
      method: 'POST',
      body: formData,
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
        // Ne pas spécifier Content-Type pour FormData
      },
    });
  }

  // Méthode pour gérer l'authentification
  setAuthToken(token: string | null) {
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('token', token);
      } else {
        localStorage.removeItem('auth_token');
      }
    }
  }

  getAuthToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('auth_token');
    }
    return null;
  }
}

// Instance singleton
export const apiService = new ApiService();
export { ApiService, ApiServiceError };
export type { ApiResponse, ApiError, ApiConfig };
