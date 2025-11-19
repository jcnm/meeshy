/**
 * Utilitaires pour construire les URLs d'attachements
 * Transforme les chemins relatifs en URLs complètes selon l'environnement
 */

/**
 * Construit l'URL complète d'un attachement à partir d'un chemin relatif ou absolu
 *
 * Exemples:
 * - Input: "/api/attachments/file/2024/11/userId/photo.jpg"
 *   Output: "https://smpdev02.local:3000/api/attachments/file/2024/11/userId/photo.jpg"
 *
 * - Input: "http://localhost:3000/api/attachments/file/..."
 *   Output: "http://localhost:3000/api/attachments/file/..." (passthrough pour compatibilité)
 *
 * @param relativePath - Chemin relatif ou URL absolue
 * @returns URL complète
 */
export function buildAttachmentUrl(relativePath: string | null | undefined): string | null {
  // Retourner null si le chemin est vide
  if (!relativePath) {
    return null;
  }

  // Si c'est déjà une URL complète (http:// ou https://), la retourner telle quelle
  // Cela assure la compatibilité avec les anciennes données
  if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) {
    return relativePath;
  }

  // Si c'est un chemin relatif, construire l'URL complète
  if (relativePath.startsWith('/')) {
    // Récupérer l'URL du backend depuis les variables d'environnement
    const backendUrl =
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      'http://localhost:3000'; // Fallback

    // Construire l'URL complète
    return `${backendUrl}${relativePath}`;
  }

  // Si ce n'est ni une URL complète ni un chemin relatif (cas improbable),
  // le retourner tel quel
  console.warn('[AttachmentURL] Format de chemin inattendu:', relativePath);
  return relativePath;
}

/**
 * Construit les URLs pour un attachement (fileUrl et thumbnailUrl)
 *
 * @param attachment - Objet attachement avec fileUrl et thumbnailUrl
 * @returns Objet avec fileUrl et thumbnailUrl construites
 */
export function buildAttachmentUrls<T extends { fileUrl?: string | null; thumbnailUrl?: string | null }>(
  attachment: T
): T & { fileUrl: string | null; thumbnailUrl: string | null } {
  return {
    ...attachment,
    fileUrl: buildAttachmentUrl(attachment.fileUrl),
    thumbnailUrl: buildAttachmentUrl(attachment.thumbnailUrl),
  };
}

/**
 * Construit les URLs pour un tableau d'attachements
 *
 * @param attachments - Tableau d'attachements
 * @returns Tableau avec URLs construites
 */
export function buildAttachmentsUrls<T extends { fileUrl?: string | null; thumbnailUrl?: string | null }>(
  attachments: T[]
): Array<T & { fileUrl: string | null; thumbnailUrl: string | null }> {
  return attachments.map(buildAttachmentUrls);
}

/**
 * Vérifie si une URL d'attachement est relative ou absolue
 *
 * @param url - URL à vérifier
 * @returns true si l'URL est relative, false si elle est absolue
 */
export function isRelativeUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.startsWith('/') && !url.startsWith('//');
}

/**
 * Extrait le chemin relatif d'une URL absolue
 * Utile pour la migration inverse si nécessaire
 *
 * @param absoluteUrl - URL absolue
 * @returns Chemin relatif
 */
export function extractRelativePath(absoluteUrl: string | null | undefined): string | null {
  if (!absoluteUrl) return null;

  try {
    const url = new URL(absoluteUrl);
    return url.pathname;
  } catch (e) {
    // Si ce n'est pas une URL valide, vérifier si c'est déjà un chemin relatif
    if (absoluteUrl.startsWith('/')) {
      return absoluteUrl;
    }
    console.warn('[AttachmentURL] Impossible d\'extraire le chemin relatif:', absoluteUrl);
    return absoluteUrl;
  }
}
