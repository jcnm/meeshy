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

export class AttachmentService {
  /**
   * Upload un ou plusieurs fichiers
   */
  static async uploadFiles(files: File[], token?: string): Promise<UploadMultipleResponse> {
    const formData = new FormData();
    
    files.forEach((file) => {
      formData.append('files', file);
    });

    const headers: HeadersInit = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}/api/attachments/upload`, {
      method: 'POST',
      headers,
      body: formData,
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(error.error || 'Failed to upload files');
    }

    return response.json();
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

    const response = await fetch(`${API_URL}/api/attachments/upload-text`, {
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
      `${API_URL}/api/conversations/${conversationId}/attachments?${params}`,
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

    const response = await fetch(`${API_URL}/api/attachments/${attachmentId}`, {
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
    return `${API_URL}/api/attachments/${attachmentId}`;
  }

  /**
   * Génère l'URL d'une miniature
   */
  static getThumbnailUrl(attachmentId: string): string {
    return `${API_URL}/api/attachments/${attachmentId}/thumbnail`;
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

