/**
 * Utilitaire centralisé pour la transformation des attachments
 * Extrait audioEffectsTimeline du champ metadata JSON et l'expose au niveau racine
 */

export interface AttachmentWithMetadata {
  id: string;
  metadata?: {
    audioEffectsTimeline?: any;
    [key: string]: any;
  };
  [key: string]: any;
}

/**
 * Transforme un attachment en extrayant audioEffectsTimeline du champ metadata
 * @param attachment - L'attachment brut depuis Prisma
 * @returns L'attachment transformé avec audioEffectsTimeline au niveau racine
 */
export function transformAttachment(attachment: AttachmentWithMetadata): any {
  if (!attachment) return attachment;

  return {
    ...attachment,
    // Extraire audioEffectsTimeline du champ metadata JSON et l'exposer au niveau racine
    audioEffectsTimeline: attachment.metadata?.audioEffectsTimeline || undefined
  };
}

/**
 * Transforme un tableau d'attachments
 * @param attachments - Tableau d'attachments bruts
 * @returns Tableau d'attachments transformés
 */
export function transformAttachments(attachments: AttachmentWithMetadata[] | null | undefined): any[] {
  if (!attachments || !Array.isArray(attachments)) return [];
  return attachments.map(transformAttachment);
}
