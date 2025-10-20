/**
 * Types pour le système d'attachements de messages
 * Partagés entre frontend et backend
 */

/**
 * Types d'attachements supportés
 */
export type AttachmentType = 'image' | 'document' | 'audio' | 'video' | 'text' | 'code';

/**
 * Statuts de progression d'upload
 */
export type UploadStatus = 'pending' | 'uploading' | 'complete' | 'error';

/**
 * Types MIME pour les images
 */
export type ImageMimeType = 'image/jpeg' | 'image/jpg' | 'image/png' | 'image/gif' | 'image/webp';

/**
 * Types MIME pour les documents
 */
export type DocumentMimeType = 
  | 'application/pdf'
  | 'text/plain'
  | 'application/msword'
  | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  | 'application/vnd.ms-powerpoint'
  | 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  | 'application/zip'
  | 'application/x-zip-compressed';

/**
 * Types MIME pour les fichiers audio
 */
export type AudioMimeType = 'audio/mpeg' | 'audio/mp3' | 'audio/wav' | 'audio/ogg' | 'audio/webm';

/**
 * Types MIME pour les vidéos
 */
export type VideoMimeType = 'video/mp4' | 'video/webm' | 'video/ogg' | 'video/quicktime';

/**
 * Types MIME pour les fichiers texte
 */
export type TextMimeType = 'text/plain';

/**
 * Types MIME pour les fichiers de code
 */
export type CodeMimeType = 
  | 'text/markdown'
  | 'text/x-markdown'
  | 'application/x-sh'
  | 'text/javascript'
  | 'application/javascript'
  | 'text/typescript'
  | 'application/typescript'
  | 'text/x-python'
  | 'text/x-python-script'
  | 'application/x-python-code';

/**
 * Union de tous les types MIME acceptés
 */
export type AcceptedMimeType = ImageMimeType | DocumentMimeType | AudioMimeType | VideoMimeType | TextMimeType | CodeMimeType;

/**
 * Attachement de message
 */
export interface Attachment {
  readonly id: string;
  readonly messageId: string;
  readonly fileName: string;
  readonly originalName: string;
  readonly mimeType: string;
  readonly fileSize: number;
  readonly fileUrl: string;
  readonly thumbnailUrl?: string;
  readonly width?: number;
  readonly height?: number;
  readonly duration?: number;
  readonly uploadedBy: string;
  readonly isAnonymous: boolean;
  readonly createdAt: string;
}

/**
 * Progression d'upload
 */
export interface UploadProgress {
  readonly attachmentId: string;
  readonly progress: number; // 0-100
  readonly status: UploadStatus;
  readonly error?: string;
}

/**
 * Métadonnées d'un attachement (mutable pour construction)
 */
export interface AttachmentMetadata {
  width?: number;
  height?: number;
  duration?: number;
  thumbnailGenerated?: boolean;
}

/**
 * Réponse d'upload d'un attachement
 */
export interface UploadedAttachmentResponse {
  readonly id: string;
  readonly messageId: string;
  readonly fileName: string;
  readonly originalName: string;
  readonly mimeType: string;
  readonly fileSize: number;
  readonly fileUrl: string;
  readonly thumbnailUrl?: string;
  readonly width?: number;
  readonly height?: number;
  readonly duration?: number;
  readonly uploadedBy: string;
  readonly isAnonymous: boolean;
  readonly createdAt: string;
}

/**
 * Erreur d'upload pour un fichier spécifique
 */
export interface UploadError {
  readonly filename: string;
  readonly error: string;
}

/**
 * Réponse d'upload de plusieurs attachements
 */
export interface UploadMultipleResponse {
  readonly success: boolean;
  readonly attachments: readonly UploadedAttachmentResponse[];
  readonly errors?: readonly UploadError[];
}

/**
 * Limites de taille d'upload par type de fichier (en octets)
 */
export const UPLOAD_LIMITS = {
  IMAGE: 52428800, // 50MB
  DOCUMENT: 104857600, // 100MB
  AUDIO: 104857600, // 100MB
  VIDEO: 104857600, // 100MB
  TEXT: 10485760, // 10MB
  CODE: 10485760, // 10MB
} as const;

/**
 * Type des limites d'upload
 */
export type UploadLimits = typeof UPLOAD_LIMITS;

/**
 * Types MIME acceptés par catégorie
 */
export const ACCEPTED_MIME_TYPES = {
  IMAGE: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'] as const,
  DOCUMENT: [
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/zip',
    'application/x-zip-compressed',
  ] as const,
  AUDIO: ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm'] as const,
  VIDEO: ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'] as const,
  TEXT: ['text/plain'] as const,
  CODE: [
    'text/markdown',
    'text/x-markdown',
    'application/x-sh',
    'text/javascript',
    'application/javascript',
    'text/typescript',
    'application/typescript',
    'text/x-python',
    'text/x-python-script',
    'application/x-python-code',
  ] as const,
} as const;

/**
 * Type des types MIME acceptés
 */
export type AcceptedMimeTypes = typeof ACCEPTED_MIME_TYPES;

/**
 * Type guard pour vérifier si un MIME type est une image
 */
export function isImageMimeType(mimeType: string): mimeType is ImageMimeType {
  return (ACCEPTED_MIME_TYPES.IMAGE as unknown as string[]).includes(mimeType);
}

/**
 * Type guard pour vérifier si un MIME type est audio
 */
export function isAudioMimeType(mimeType: string): mimeType is AudioMimeType {
  return (ACCEPTED_MIME_TYPES.AUDIO as unknown as string[]).includes(mimeType);
}

/**
 * Type guard pour vérifier si un MIME type est vidéo
 */
export function isVideoMimeType(mimeType: string): mimeType is VideoMimeType {
  return (ACCEPTED_MIME_TYPES.VIDEO as unknown as string[]).includes(mimeType);
}

/**
 * Type guard pour vérifier si un MIME type est texte
 */
export function isTextMimeType(mimeType: string): mimeType is TextMimeType {
  return (ACCEPTED_MIME_TYPES.TEXT as unknown as string[]).includes(mimeType);
}

/**
 * Type guard pour vérifier si un MIME type est document
 */
export function isDocumentMimeType(mimeType: string): mimeType is DocumentMimeType {
  return (ACCEPTED_MIME_TYPES.DOCUMENT as unknown as string[]).includes(mimeType);
}

/**
 * Type guard pour vérifier si un MIME type est code
 */
export function isCodeMimeType(mimeType: string): mimeType is CodeMimeType {
  return (ACCEPTED_MIME_TYPES.CODE as unknown as string[]).includes(mimeType);
}

/**
 * Type guard pour vérifier si un MIME type est accepté
 */
export function isAcceptedMimeType(mimeType: string): mimeType is AcceptedMimeType {
  return isImageMimeType(mimeType) || 
         isAudioMimeType(mimeType) || 
         isVideoMimeType(mimeType) || 
         isTextMimeType(mimeType) || 
         isDocumentMimeType(mimeType) ||
         isCodeMimeType(mimeType);
}

/**
 * Détermine le type d'attachement basé sur le MIME type
 */
export function getAttachmentType(mimeType: string): AttachmentType {
  if (isImageMimeType(mimeType)) {
    return 'image';
  }
  if (isAudioMimeType(mimeType)) {
    return 'audio';
  }
  if (isVideoMimeType(mimeType)) {
    return 'video';
  }
  if (isTextMimeType(mimeType)) {
    return 'text';
  }
  if (isCodeMimeType(mimeType)) {
    return 'code';
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
    case 'audio':
      return UPLOAD_LIMITS.AUDIO;
    case 'video':
      return UPLOAD_LIMITS.VIDEO;
    case 'text':
      return UPLOAD_LIMITS.TEXT;
    case 'code':
      return UPLOAD_LIMITS.CODE;
    case 'document':
      return UPLOAD_LIMITS.DOCUMENT;
    default: {
      // Exhaustive check - assure que tous les cas sont couverts
      const _exhaustiveCheck: never = type;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      void _exhaustiveCheck;
      return UPLOAD_LIMITS.DOCUMENT;
    }
  }
}

/**
 * Unités de taille de fichier
 */
const FILE_SIZE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

/**
 * Type pour les unités de taille
 */
export type FileSizeUnit = typeof FILE_SIZE_UNITS[number];

/**
 * Formate une taille de fichier pour l'affichage
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const sizeIndex = Math.min(i, FILE_SIZE_UNITS.length - 1);
  return `${parseFloat((bytes / Math.pow(k, sizeIndex)).toFixed(2))} ${FILE_SIZE_UNITS[sizeIndex]}`;
}

