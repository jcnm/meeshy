import { apiService, ApiServiceError } from '@/services/apiService';

// Mock fetch globalement
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('ApiService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('GET requests', () => {
    it('should make successful GET request', async () => {
      const mockData = { id: 1, name: 'Test' };
      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue(mockData),
      };

      mockFetch.mockResolvedValue(mockResponse as unknown as Response);

      const result = await apiService.get('/test');

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3001/test',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
      expect(result.data).toEqual(mockData);
      expect(result.status).toBe(200);
    });

    it('should include query parameters', async () => {
      const mockData = { results: [] };
      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue(mockData),
      };

      mockFetch.mockResolvedValue(mockResponse as unknown as Response);

      await apiService.get('/search', { q: 'test', limit: 10 });

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3001/search?q=test&limit=10',
        expect.any(Object)
      );
    });

    it('should include authorization header when token is present', async () => {
      localStorageMock.getItem.mockReturnValue('test-token');
      
      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({}),
      };

      mockFetch.mockResolvedValue(mockResponse as unknown as Response);

      await apiService.get('/protected');

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3001/protected',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token',
          }),
        })
      );
    });
  });

  describe('POST requests', () => {
    it('should make successful POST request with body', async () => {
      const postData = { name: 'New Item' };
      const mockResponse = {
        ok: true,
        status: 201,
        json: jest.fn().mockResolvedValue({ id: 1, ...postData }),
      };

      mockFetch.mockResolvedValue(mockResponse as unknown as Response);

      const result = await apiService.post('/items', postData);

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3001/items',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(postData),
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
      expect(result.status).toBe(201);
    });
  });

  describe('PATCH requests', () => {
    it('should make successful PATCH request', async () => {
      const updateData = { name: 'Updated Item' };
      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ id: 1, ...updateData }),
      };

      mockFetch.mockResolvedValue(mockResponse as unknown as Response);

      const result = await apiService.patch('/items/1', updateData);

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3001/items/1',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify(updateData),
        })
      );
      expect(result.status).toBe(200);
    });
  });

  describe('DELETE requests', () => {
    it('should make successful DELETE request', async () => {
      const mockResponse = {
        ok: true,
        status: 204,
        json: jest.fn().mockResolvedValue(undefined),
      };

      mockFetch.mockResolvedValue(mockResponse as unknown as Response);

      const result = await apiService.delete('/items/1');

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3001/items/1',
        expect.objectContaining({
          method: 'DELETE',
        })
      );
      expect(result.status).toBe(204);
    });
  });

  describe('Error handling', () => {
    it('should throw ApiServiceError for HTTP errors', async () => {
      const errorResponse = {
        ok: false,
        status: 404,
        json: jest.fn().mockResolvedValue({
          message: 'Resource not found',
          code: 'NOT_FOUND',
        }),
      };

      mockFetch.mockResolvedValue(errorResponse as unknown as Response);

      await expect(apiService.get('/nonexistent')).rejects.toThrow(ApiServiceError);
      
      try {
        await apiService.get('/nonexistent');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiServiceError);
        expect((error as ApiServiceError).status).toBe(404);
        expect((error as ApiServiceError).message).toBe('Resource not found');
        expect((error as ApiServiceError).code).toBe('NOT_FOUND');
      }
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(apiService.get('/test')).rejects.toThrow(ApiServiceError);
      
      try {
        await apiService.get('/test');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiServiceError);
        expect((error as ApiServiceError).message).toBe('Erreur de connexion au serveur');
        expect((error as ApiServiceError).status).toBe(0);
      }
    });

    it('should handle timeout errors', async () => {
      // Simuler un timeout en rejetant avec AbortError
      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValue(abortError);

      await expect(apiService.get('/slow-endpoint')).rejects.toThrow(ApiServiceError);
      
      try {
        await apiService.get('/slow-endpoint');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiServiceError);
        expect((error as ApiServiceError).message).toBe('Timeout de la requête');
        expect((error as ApiServiceError).status).toBe(408);
        expect((error as ApiServiceError).code).toBe('TIMEOUT');
      }
    });

    it('should handle JSON parse errors', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON')),
      };

      mockFetch.mockResolvedValue(mockResponse as unknown as Response);

      await expect(apiService.get('/invalid-json')).rejects.toThrow(ApiServiceError);
    });
  });

  describe('Request configuration', () => {
    it('should use custom headers', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({}),
      };

      mockFetch.mockResolvedValue(mockResponse as unknown as Response);

      await apiService.get('/test', undefined, {
        headers: { 'Custom-Header': 'custom-value' }
      });

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3001/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Custom-Header': 'custom-value',
          }),
        })
      );
    });

    it('should handle empty response bodies', async () => {
      const mockResponse = {
        ok: true,
        status: 204,
        json: jest.fn().mockResolvedValue(null),
      };

      mockFetch.mockResolvedValue(mockResponse as unknown as Response);

      const result = await apiService.delete('/items/1');

      expect(result.data).toBeNull();
      expect(result.status).toBe(204);
    });
  });

  describe('URL construction', () => {
    it('should handle query parameters with special characters', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({}),
      };

      mockFetch.mockResolvedValue(mockResponse as unknown as Response);

      await apiService.get('/search', { 
        q: 'test with spaces & symbols',
        filter: 'category=tech&active=true'
      });

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('test%20with%20spaces%20%26%20symbols'),
        expect.any(Object)
      );
    });

    it('should handle null and undefined query parameters', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({}),
      };

      mockFetch.mockResolvedValue(mockResponse as unknown as Response);

      await apiService.get('/search', { 
        q: 'test',
        nullParam: null,
        undefinedParam: undefined,
        emptyString: '',
        validParam: 'value'
      });

      const callUrl = (fetch as jest.Mock).mock.calls[0][0];
      expect(callUrl).toContain('q=test');
      expect(callUrl).toContain('emptyString=');
      expect(callUrl).toContain('validParam=value');
      expect(callUrl).not.toContain('nullParam');
      expect(callUrl).not.toContain('undefinedParam');
    });
  });
});
