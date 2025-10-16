/**
 * Service de gestion des attachements de messages
 * Gère l'upload, le stockage, les miniatures et la suppression de fichiers
 */

import { PrismaClient } from '../../shared/prisma/client';
import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
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

export interface UploadResult {
  attachmentId: string;
  fileUrl: string;
  thumbnailUrl?: string;
  metadata: AttachmentMetadata;
}

export class AttachmentService {
  private prisma: PrismaClient;
  private uploadBasePath: string;
  private publicUrl: string;
  private thumbnailSize = 300; // Taille des miniatures en pixels

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.uploadBasePath = process.env.UPLOAD_PATH || path.join(process.cwd(), 'uploads', 'attachments');
    this.publicUrl = process.env.PUBLIC_URL || 'http://localhost:3001';
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
    messageId?: string
  ): Promise<UploadResult> {
    // Valider le fichier
    const validation = this.validateFile(file);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Générer le chemin
    const filePath = this.generateFilePath(userId, file.filename);
    
    // Sauvegarder le fichier
    await this.saveFile(file.buffer, filePath);

    // Déterminer le type
    const attachmentType = getAttachmentType(file.mimeType);

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

    // Générer les URLs
    const fileUrl = this.getAttachmentUrl(filePath);
    const thumbnailUrl = thumbnailPath ? this.getAttachmentUrl(thumbnailPath) : undefined;

    // Créer l'enregistrement en base de données
    const attachment = await this.prisma.messageAttachment.create({
      data: {
        messageId: messageId || 'temp', // Sera mis à jour lors de la création du message
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
        uploadedBy: userId,
        isAnonymous: isAnonymous,
      },
    });

    return {
      attachmentId: attachment.id,
      fileUrl,
      thumbnailUrl,
      metadata,
    };
  }

  /**
   * Upload multiple fichiers
   */
  async uploadMultiple(
    files: FileToUpload[],
    userId: string,
    isAnonymous: boolean = false,
    messageId?: string
  ): Promise<UploadResult[]> {
    const results: UploadResult[] = [];

    for (const file of files) {
      try {
        const result = await this.uploadFile(file, userId, isAnonymous, messageId);
        results.push(result);
      } catch (error) {
        console.error('[AttachmentService] Erreur upload fichier:', error);
        // Continuer avec les autres fichiers
      }
    }

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

