/**
 * Service de gestion des attachements de messages
 * Gère l'upload, le stockage, les miniatures et la suppression de fichiers
 */

import { PrismaClient } from '../../shared/prisma/client';
import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { parseFile } from 'music-metadata';
import { 
  Attachment, 
  AttachmentType, 
  AttachmentMetadata,
  getAttachmentType,
  getSizeLimit,
  UPLOAD_LIMITS,
  ACCEPTED_MIME_TYPES 
} from '../../shared/types/attachment';

export interface FileToUpload {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  size: number;
}

export interface AudioMetadata {
  duration: number;
  bitrate: number;
  sampleRate: number;
  codec: string;
  channels: number;
}

export interface UploadResult {
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
  bitrate?: number;
  sampleRate?: number;
  codec?: string;
  channels?: number;
  uploadedBy: string;
  isAnonymous: boolean;
  createdAt: Date;
}

export class AttachmentService {
  private prisma: PrismaClient;
  private uploadBasePath: string;
  private publicUrl: string;
  private thumbnailSize = 300; // Taille des miniatures en pixels

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.uploadBasePath = process.env.UPLOAD_PATH || path.join(process.cwd(), 'uploads', 'attachments');
    
    // Détection intelligente de l'URL publique selon l'environnement
    const isProduction = process.env.NODE_ENV === 'production';
    const isDevelopment = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'local';
    
    // Déterminer l'URL publique avec une logique plus robuste
    if (process.env.PUBLIC_URL) {
      // 1. Priorité absolue à PUBLIC_URL si définie explicitement
      this.publicUrl = process.env.PUBLIC_URL;
    } else if (isProduction) {
      // 2. En production, construire l'URL à partir du domaine
      const domain = process.env.DOMAIN || 'meeshy.me';
      this.publicUrl = `https://gate.${domain}`;
      console.warn('[AttachmentService] ⚠️  PUBLIC_URL non définie, utilisation du domaine par défaut:', this.publicUrl);
    } else if (isDevelopment) {
      // 3. En développement, utiliser localhost
      this.publicUrl = 'http://localhost:3000';
    } else {
      // 4. Fallback ultime (ne devrait jamais arriver)
      this.publicUrl = 'http://localhost:3000';
      console.error('[AttachmentService] ❌ Impossible de déterminer PUBLIC_URL, utilisation du fallback localhost');
    }
    
    console.log('[AttachmentService] Configuration:', {
      environment: process.env.NODE_ENV || 'development',
      publicUrl: this.publicUrl,
      uploadBasePath: this.uploadBasePath,
      domain: process.env.DOMAIN,
      publicUrlSource: process.env.PUBLIC_URL ? 'PUBLIC_URL env var' : 'auto-detected'
    });
    
    // Validation en production
    if (isProduction && this.publicUrl.includes('localhost')) {
      console.error('[AttachmentService] ❌ ERREUR CRITIQUE: PUBLIC_URL pointe vers localhost en production!');
      console.error('[AttachmentService] Veuillez définir PUBLIC_URL=https://gate.meeshy.me dans le fichier .env');
    }
  }

  /**
   * Valide un fichier selon son type et sa taille
   */
  validateFile(file: FileToUpload): { valid: boolean; error?: string } {
    // Vérifier le MIME type
    const attachmentType = getAttachmentType(file.mimeType);
    const allAcceptedTypes = [
      ...ACCEPTED_MIME_TYPES.IMAGE,
      ...ACCEPTED_MIME_TYPES.DOCUMENT,
      ...ACCEPTED_MIME_TYPES.AUDIO,
      ...ACCEPTED_MIME_TYPES.VIDEO,
      ...ACCEPTED_MIME_TYPES.TEXT,
      ...ACCEPTED_MIME_TYPES.CODE,
    ];

    if (!allAcceptedTypes.includes(file.mimeType as any)) {
      return { valid: false, error: `Type de fichier non accepté: ${file.mimeType}` };
    }

    // Vérifier la taille
    const sizeLimit = getSizeLimit(attachmentType);
    if (file.size > sizeLimit) {
      const limitMB = Math.floor(sizeLimit / (1024 * 1024));
      return { 
        valid: false, 
        error: `Fichier trop volumineux. Taille max: ${limitMB}MB` 
      };
    }

    return { valid: true };
  }

  /**
   * Génère un chemin de fichier structuré: YYYY/mm/userId/filename
   */
  generateFilePath(userId: string, originalFilename: string): string {
    const now = new Date();
    const year = now.getFullYear().toString();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    
    // Nettoyer le nom de fichier original
    const ext = path.extname(originalFilename);
    const nameWithoutExt = path.basename(originalFilename, ext);
    const cleanName = nameWithoutExt.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
    
    // Générer un nom unique avec UUID
    const uniqueName = `${cleanName}_${uuidv4()}${ext}`;
    
    return path.join(year, month, userId, uniqueName);
  }

  /**
   * Sauvegarde physiquement un fichier
   */
  async saveFile(buffer: Buffer, relativePath: string): Promise<void> {
    const fullPath = path.join(this.uploadBasePath, relativePath);
    const directory = path.dirname(fullPath);
    
    // Créer les répertoires si nécessaire
    await fs.mkdir(directory, { recursive: true });
    
    // Écrire le fichier
    await fs.writeFile(fullPath, buffer);
  }

  /**
   * Génère une miniature pour une image
   */
  async generateThumbnail(imagePath: string): Promise<string | null> {
    try {
      const fullPath = path.join(this.uploadBasePath, imagePath);
      const ext = path.extname(imagePath);
      const thumbnailPath = imagePath.replace(ext, `_thumb${ext}`);
      const fullThumbnailPath = path.join(this.uploadBasePath, thumbnailPath);

      // Générer la miniature avec Sharp
      await sharp(fullPath)
        .resize(this.thumbnailSize, this.thumbnailSize, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: 80 })
        .toFile(fullThumbnailPath);

      return thumbnailPath;
    } catch (error) {
      console.error('[AttachmentService] Erreur génération miniature:', error);
      return null;
    }
  }

  /**
   * Extrait les métadonnées d'une image
   */
  async extractImageMetadata(imagePath: string): Promise<{ width: number; height: number }> {
    try {
      const fullPath = path.join(this.uploadBasePath, imagePath);
      const metadata = await sharp(fullPath).metadata();
      return {
        width: metadata.width || 0,
        height: metadata.height || 0,
      };
    } catch (error) {
      console.error('[AttachmentService] Erreur extraction métadonnées image:', error);
      return { width: 0, height: 0 };
    }
  }

  /**
   * Extrait les métadonnées d'un fichier audio
   * Supporte WebM, MP4, OGG, MP3, WAV, etc.
   */
  async extractAudioMetadata(audioPath: string): Promise<AudioMetadata> {
    try {
      const fullPath = path.join(this.uploadBasePath, audioPath);
      const metadata = await parseFile(fullPath);

      const format = metadata.format;

      // Extraction des métadonnées audio
      const audioMetadata: AudioMetadata = {
        duration: Math.round(format.duration || 0), // Durée en secondes (arrondie)
        bitrate: format.bitrate || 0, // Débit en bps
        sampleRate: format.sampleRate || 0, // Fréquence d'échantillonnage
        codec: format.codec || format.codecProfile || 'unknown', // Codec détecté
        channels: format.numberOfChannels || 1, // Nombre de canaux (mono=1, stereo=2)
      };

      console.log('[AttachmentService] Métadonnées audio extraites:', {
        filePath: audioPath,
        ...audioMetadata,
      });

      return audioMetadata;
    } catch (error) {
      console.error('[AttachmentService] Erreur extraction métadonnées audio:', {
        filePath: audioPath,
        error: error instanceof Error ? error.message : error,
      });

      // Retourner des valeurs par défaut en cas d'erreur
      return {
        duration: 0,
        bitrate: 0,
        sampleRate: 0,
        codec: 'unknown',
        channels: 1,
      };
    }
  }

  /**
   * Génère une URL publique pour un fichier
   */
  getAttachmentUrl(filePath: string): string {
    return `${this.publicUrl}/api/attachments/file/${encodeURIComponent(filePath)}`;
  }

  /**
   * Upload un seul fichier
   */
  async uploadFile(
    file: FileToUpload,
    userId: string,
    isAnonymous: boolean = false,
    messageId?: string,
    providedMetadata?: any
  ): Promise<UploadResult> {
    console.log('[AttachmentService] uploadFile - Début', {
      filename: file.filename,
      mimeType: file.mimeType,
      size: file.size,
      userId,
      isAnonymous,
      messageId,
      hasProvidedMetadata: !!providedMetadata,
    });

    // Valider le fichier
    const validation = this.validateFile(file);
    if (!validation.valid) {
      console.error('[AttachmentService] ❌ Validation échouée:', validation.error);
      throw new Error(validation.error);
    }
    console.log('[AttachmentService] ✅ Validation OK');

    // Générer le chemin
    const filePath = this.generateFilePath(userId, file.filename);
    console.log('[AttachmentService] Chemin généré:', filePath);
    
    // Sauvegarder le fichier
    await this.saveFile(file.buffer, filePath);
    console.log('[AttachmentService] ✅ Fichier sauvegardé');

    // Déterminer le type
    const attachmentType = getAttachmentType(file.mimeType);
    console.log('[AttachmentService] Type détecté:', attachmentType);

    // Préparer les métadonnées
    const metadata: AttachmentMetadata = {};
    let thumbnailPath: string | null = null;

    // Si c'est une image, générer miniature et extraire métadonnées
    if (attachmentType === 'image') {
      const imageMeta = await this.extractImageMetadata(filePath);
      metadata.width = imageMeta.width;
      metadata.height = imageMeta.height;

      thumbnailPath = await this.generateThumbnail(filePath);
      metadata.thumbnailGenerated = !!thumbnailPath;
    }

    // Si c'est un fichier audio, extraire les métadonnées audio complètes
    if (attachmentType === 'audio') {
      // Utiliser les métadonnées fournies par le frontend si disponibles (Web Audio API)
      // Sinon, extraire avec music-metadata (peut échouer sur WebM mal encodé)
      if (providedMetadata && providedMetadata.duration !== undefined) {
        console.log('[AttachmentService] ✅ Utilisation des métadonnées fournies par le frontend:', providedMetadata);
        metadata.duration = Math.round(providedMetadata.duration);
        metadata.bitrate = providedMetadata.bitrate || 0;
        metadata.sampleRate = providedMetadata.sampleRate || 0;
        metadata.codec = providedMetadata.codec || 'unknown';
        metadata.channels = providedMetadata.channels || 1;
      } else {
        console.log('[AttachmentService] 📋 Extraction des métadonnées audio avec music-metadata...');
        const audioMeta = await this.extractAudioMetadata(filePath);
        metadata.duration = audioMeta.duration;
        metadata.bitrate = audioMeta.bitrate;
        metadata.sampleRate = audioMeta.sampleRate;
        metadata.codec = audioMeta.codec;
        metadata.channels = audioMeta.channels;
      }
      console.log('[AttachmentService] Métadonnées audio finales:', metadata);
    }

    // Générer les URLs
    const fileUrl = this.getAttachmentUrl(filePath);
    const thumbnailUrl = thumbnailPath ? this.getAttachmentUrl(thumbnailPath) : undefined;

    // Pour messageId, générer un ObjectId temporaire si non fourni
    // Cela évite l'erreur Prisma car messageId doit être un ObjectId valide
    const tempMessageId = messageId || '000000000000000000000000'; // ObjectId temporaire valide (24 hex chars)

    // Créer l'enregistrement en base de données
    const attachment = await this.prisma.messageAttachment.create({
      data: {
        messageId: tempMessageId,
        fileName: path.basename(filePath),
        originalName: file.filename,
        mimeType: file.mimeType,
        fileSize: file.size,
        filePath: filePath,
        fileUrl: fileUrl,
        thumbnailPath: thumbnailPath || undefined,
        thumbnailUrl: thumbnailUrl,
        width: metadata.width,
        height: metadata.height,
        duration: metadata.duration,
        bitrate: metadata.bitrate,
        sampleRate: metadata.sampleRate,
        codec: metadata.codec,
        channels: metadata.channels,
        uploadedBy: userId,
        isAnonymous: isAnonymous,
      },
    });

    console.log('[AttachmentService] ✅ Record Prisma créé:', {
      id: attachment.id,
      fileName: attachment.fileName,
      fileSize: attachment.fileSize,
    });

    const result = {
      id: attachment.id,
      messageId: attachment.messageId,
      fileName: attachment.fileName,
      originalName: attachment.originalName,
      mimeType: attachment.mimeType,
      fileSize: attachment.fileSize,
      fileUrl: attachment.fileUrl,
      thumbnailUrl: attachment.thumbnailUrl || undefined,
      width: attachment.width || undefined,
      height: attachment.height || undefined,
      duration: attachment.duration || undefined,
      bitrate: attachment.bitrate || undefined,
      sampleRate: attachment.sampleRate || undefined,
      codec: attachment.codec || undefined,
      channels: attachment.channels || undefined,
      uploadedBy: attachment.uploadedBy,
      isAnonymous: attachment.isAnonymous,
      createdAt: attachment.createdAt,
    };

    console.log('[AttachmentService] uploadFile - Fin, returning:', {
      id: result.id,
      fileName: result.fileName,
      fileSize: result.fileSize,
      hasAllFields: !!(result.id && result.fileName && result.mimeType),
    });

    return result;
  }

  /**
   * Upload multiple fichiers
   */
  async uploadMultiple(
    files: FileToUpload[],
    userId: string,
    isAnonymous: boolean = false,
    messageId?: string,
    metadataMap?: Map<number, any>
  ): Promise<UploadResult[]> {
    console.log('[AttachmentService] uploadMultiple - Début', {
      filesCount: files.length,
      userId,
      isAnonymous,
      messageId,
      hasMetadata: !!metadataMap,
    });

    const results: UploadResult[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        console.log('[AttachmentService] Uploading file:', file.filename);
        const fileMetadata = metadataMap?.get(i);
        const result = await this.uploadFile(file, userId, isAnonymous, messageId, fileMetadata);
        console.log('[AttachmentService] Upload result:', {
          id: result.id,
          fileName: result.fileName,
          fileSize: result.fileSize,
          hadMetadata: !!fileMetadata,
        });
        results.push(result);
      } catch (error) {
        console.error('[AttachmentService] ❌ Erreur upload fichier:', {
          filename: file.filename,
          error: error instanceof Error ? error.message : error,
          stack: error instanceof Error ? error.stack : undefined,
        });
        // Continuer avec les autres fichiers
      }
    }

    console.log('[AttachmentService] uploadMultiple - Fin', {
      resultsCount: results.length,
      results: results.map(r => ({ id: r.id, fileName: r.fileName })),
    });

    return results;
  }

  /**
   * Associe des attachments à un message
   */
  async associateAttachmentsToMessage(
    attachmentIds: string[],
    messageId: string
  ): Promise<void> {
    await this.prisma.messageAttachment.updateMany({
      where: {
        id: { in: attachmentIds },
      },
      data: {
        messageId: messageId,
      },
    });
  }

  /**
   * Récupère un attachment par son ID
   */
  async getAttachment(attachmentId: string): Promise<Attachment | null> {
    const attachment = await this.prisma.messageAttachment.findUnique({
      where: { id: attachmentId },
    });

    if (!attachment) {
      return null;
    }

    return {
      id: attachment.id,
      messageId: attachment.messageId,
      fileName: attachment.fileName,
      originalName: attachment.originalName,
      mimeType: attachment.mimeType,
      fileSize: attachment.fileSize,
      fileUrl: attachment.fileUrl,
      thumbnailUrl: attachment.thumbnailUrl || undefined,
      width: attachment.width || undefined,
      height: attachment.height || undefined,
      duration: attachment.duration || undefined,
      bitrate: attachment.bitrate || undefined,
      sampleRate: attachment.sampleRate || undefined,
      codec: attachment.codec || undefined,
      channels: attachment.channels || undefined,
      uploadedBy: attachment.uploadedBy,
      isAnonymous: attachment.isAnonymous,
      createdAt: attachment.createdAt.toISOString(),
    };
  }

  /**
   * Récupère le chemin physique d'un fichier
   */
  async getFilePath(attachmentId: string): Promise<string | null> {
    const attachment = await this.prisma.messageAttachment.findUnique({
      where: { id: attachmentId },
      select: { filePath: true },
    });

    if (!attachment) {
      return null;
    }

    return path.join(this.uploadBasePath, attachment.filePath);
  }

  /**
   * Récupère le chemin physique d'une miniature
   */
  async getThumbnailPath(attachmentId: string): Promise<string | null> {
    const attachment = await this.prisma.messageAttachment.findUnique({
      where: { id: attachmentId },
      select: { thumbnailPath: true },
    });

    if (!attachment || !attachment.thumbnailPath) {
      return null;
    }

    return path.join(this.uploadBasePath, attachment.thumbnailPath);
  }

  /**
   * Supprime un attachment
   */
  async deleteAttachment(attachmentId: string): Promise<void> {
    const attachment = await this.prisma.messageAttachment.findUnique({
      where: { id: attachmentId },
    });

    if (!attachment) {
      throw new Error('Attachment not found');
    }

    // Supprimer les fichiers physiques
    try {
      const fullPath = path.join(this.uploadBasePath, attachment.filePath);
      await fs.unlink(fullPath);

      // Supprimer la miniature si elle existe
      if (attachment.thumbnailPath) {
        const thumbnailFullPath = path.join(this.uploadBasePath, attachment.thumbnailPath);
        await fs.unlink(thumbnailFullPath).catch(() => {});
      }
    } catch (error) {
      console.error('[AttachmentService] Erreur suppression fichiers:', error);
    }

    // Supprimer de la base de données
    await this.prisma.messageAttachment.delete({
      where: { id: attachmentId },
    });
  }

  /**
   * Récupère tous les attachments d'une conversation
   */
  async getConversationAttachments(
    conversationId: string,
    options: {
      type?: AttachmentType;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<Attachment[]> {
    const where: any = {
      message: {
        conversationId: conversationId,
      },
    };

    // Filtrer par type si spécifié
    if (options.type) {
      const mimeTypes = ACCEPTED_MIME_TYPES[options.type.toUpperCase() as keyof typeof ACCEPTED_MIME_TYPES] || [];
      where.mimeType = { in: mimeTypes };
    }

    const attachments = await this.prisma.messageAttachment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options.limit || 50,
      skip: options.offset || 0,
    });

    return attachments.map((att) => ({
      id: att.id,
      messageId: att.messageId,
      fileName: att.fileName,
      originalName: att.originalName,
      mimeType: att.mimeType,
      fileSize: att.fileSize,
      fileUrl: att.fileUrl,
      thumbnailUrl: att.thumbnailUrl || undefined,
      width: att.width || undefined,
      height: att.height || undefined,
      duration: att.duration || undefined,
      bitrate: att.bitrate || undefined,
      sampleRate: att.sampleRate || undefined,
      codec: att.codec || undefined,
      channels: att.channels || undefined,
      uploadedBy: att.uploadedBy,
      isAnonymous: att.isAnonymous,
      createdAt: att.createdAt.toISOString(),
    }));
  }

  /**
   * Crée un attachment depuis du texte
   */
  async createTextAttachment(
    content: string,
    userId: string,
    isAnonymous: boolean = false,
    messageId?: string
  ): Promise<UploadResult> {
    const filename = `text_${Date.now()}.txt`;
    const buffer = Buffer.from(content, 'utf-8');

    return this.uploadFile(
      {
        buffer,
        filename,
        mimeType: 'text/plain',
        size: buffer.length,
      },
      userId,
      isAnonymous,
      messageId
    );
  }
}

