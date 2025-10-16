/**
 * Types pour le système d'attachements de messages
 * Partagés entre frontend et backend
 */

export interface Attachment {
  id: string;
  messageId: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  fileUrl: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  duration?: number;
  uploadedBy: string;
  isAnonymous: boolean;
  createdAt: string;
}

export type AttachmentType = 'image' | 'document' | 'audio' | 'video' | 'text';

export interface UploadProgress {
  attachmentId: string;
  progress: number; // 0-100
  status: 'pending' | 'uploading' | 'complete' | 'error';
  error?: string;
}

export interface AttachmentMetadata {
  width?: number;
  height?: number;
  duration?: number;
  thumbnailGenerated?: boolean;
}

export interface UploadedAttachmentResponse {
  attachmentId: string;
  fileUrl: string;
  thumbnailUrl?: string;
  metadata: AttachmentMetadata;
}

export interface UploadMultipleResponse {
  success: boolean;
  attachments: UploadedAttachmentResponse[];
  errors?: Array<{
    filename: string;
    error: string;
  }>;
}

// Constantes pour les limites de taille
export const UPLOAD_LIMITS = {
  IMAGE: 52428800, // 50MB
  DOCUMENT: 104857600, // 100MB
  AUDIO: 104857600, // 100MB
  VIDEO: 104857600, // 100MB
  TEXT: 10485760, // 10MB
} as const;

// Types MIME acceptés
export const ACCEPTED_MIME_TYPES = {
  IMAGE: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
  DOCUMENT: [
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ],
  AUDIO: ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm'],
  VIDEO: ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'],
  TEXT: ['text/plain'],
} as const;

/**
 * Détermine le type d'attachement basé sur le MIME type
 */
export function getAttachmentType(mimeType: string): AttachmentType {
  if (ACCEPTED_MIME_TYPES.IMAGE.includes(mimeType as any)) {
    return 'image';
  }
  if (ACCEPTED_MIME_TYPES.AUDIO.includes(mimeType as any)) {
    return 'audio';
  }
  if (ACCEPTED_MIME_TYPES.VIDEO.includes(mimeType as any)) {
    return 'video';
  }
  if (ACCEPTED_MIME_TYPES.TEXT.includes(mimeType as any)) {
    return 'text';
  }
  return 'document';
}

/**
 * Obtient la limite de taille pour un type d'attachement
 */
export function getSizeLimit(type: AttachmentType): number {
  switch (type) {
    case 'image':
      return UPLOAD_LIMITS.IMAGE;
    case 'text':
      return UPLOAD_LIMITS.TEXT;
    default:
      return UPLOAD_LIMITS.DOCUMENT;
  }
}

/**
 * Formate une taille de fichier pour l'affichage
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

