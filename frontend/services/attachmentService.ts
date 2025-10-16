/**
 * Service de gestion des attachments côté frontend
 */

import { 
  Attachment, 
  UploadedAttachmentResponse,
  UploadMultipleResponse,
  formatFileSize,
  getSizeLimit,
  getAttachmentType
} from '../shared/types/attachment';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Helper pour construire l'URL correcte sans duplication du préfixe /api
const buildApiUrl = (path: string): string => {
  const baseUrl = API_URL.replace(/\/$/, ''); // Enlever le slash final
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  
  // Si baseUrl contient déjà /api, ne pas le rajouter
  if (baseUrl.endsWith('/api')) {
    const finalUrl = `${baseUrl}${cleanPath}`;
    console.log('[AttachmentService] URL construite:', finalUrl, { baseUrl, cleanPath });
    return finalUrl;
  }
  
  const finalUrl = `${baseUrl}/api${cleanPath}`;
  console.log('[AttachmentService] URL construite:', finalUrl, { baseUrl, cleanPath });
  return finalUrl;
};

export class AttachmentService {
  /**
   * Upload un ou plusieurs fichiers
   */
  static async uploadFiles(files: File[], token?: string): Promise<UploadMultipleResponse> {
    console.log('[AttachmentService] uploadFiles - Début', {
      filesCount: files.length,
      hasToken: !!token,
      fileNames: files.map(f => f.name)
    });
    
    const formData = new FormData();
    
    files.forEach((file) => {
      formData.append('files', file);
    });

    const headers: HeadersInit = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      console.log('[AttachmentService] Token ajouté aux headers');
    } else {
      console.warn('[AttachmentService] ⚠️ Pas de token fourni');
    }

    const response = await fetch(buildApiUrl('/attachments/upload'), {
      method: 'POST',
      headers,
      body: formData,
      credentials: 'include',
    });

    console.log('[AttachmentService] Réponse HTTP:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload failed' }));
      console.error('[AttachmentService] ❌ Erreur upload:', {
        status: response.status,
        error
      });
      throw new Error(error.error || 'Failed to upload files');
    }

    const result = await response.json();
    console.log('[AttachmentService] ✅ Upload réussi:', result);
    return result;
  }

  /**
   * Crée un attachment texte
   */
  static async uploadText(content: string, token?: string): Promise<{ success: boolean; attachment: UploadedAttachmentResponse }> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(buildApiUrl('/attachments/upload-text'), {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({ content }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(error.error || 'Failed to create text attachment');
    }

    return response.json();
  }

  /**
   * Récupère les attachments d'une conversation
   */
  static async getConversationAttachments(
    conversationId: string,
    options: {
      type?: 'image' | 'document' | 'audio' | 'video' | 'text';
      limit?: number;
      offset?: number;
    } = {},
    token?: string
  ): Promise<{ success: boolean; attachments: Attachment[] }> {
    const params = new URLSearchParams();
    if (options.type) params.append('type', options.type);
    if (options.limit) params.append('limit', options.limit.toString());
    if (options.offset) params.append('offset', options.offset.toString());

    const headers: HeadersInit = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(
      buildApiUrl(`/conversations/${conversationId}/attachments?${params}`),
      {
        headers,
        credentials: 'include',
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch attachments');
    }

    return response.json();
  }

  /**
   * Supprime un attachment
   */
  static async deleteAttachment(attachmentId: string, token?: string): Promise<void> {
    const headers: HeadersInit = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(buildApiUrl(`/attachments/${attachmentId}`), {
      method: 'DELETE',
      headers,
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to delete attachment');
    }
  }

  /**
   * Génère l'URL d'un attachment
   */
  static getAttachmentUrl(attachmentId: string): string {
    return buildApiUrl(`/attachments/${attachmentId}`);
  }

  /**
   * Génère l'URL d'une miniature
   */
  static getThumbnailUrl(attachmentId: string): string {
    return buildApiUrl(`/attachments/${attachmentId}/thumbnail`);
  }

  /**
   * Valide un fichier avant upload
   */
  static validateFile(file: File): { valid: boolean; error?: string } {
    const type = getAttachmentType(file.type);
    const sizeLimit = getSizeLimit(type);

    if (file.size > sizeLimit) {
      return {
        valid: false,
        error: `File too large. Max size: ${formatFileSize(sizeLimit)}`,
      };
    }

    return { valid: true };
  }

  /**
   * Valide plusieurs fichiers
   */
  static validateFiles(files: File[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    files.forEach((file, index) => {
      const validation = this.validateFile(file);
      if (!validation.valid) {
        errors.push(`${file.name}: ${validation.error}`);
      }
    });

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

