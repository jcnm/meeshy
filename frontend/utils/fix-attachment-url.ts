/**
 * Transforme une URL d'attachment pour qu'elle passe par le proxy Next.js
 *
 * Problème: Le backend retourne des URLs absolues comme:
 * - http://localhost:3000/api/attachments/file/...
 * - https://gate.meeshy.me/api/attachments/file/...
 *
 * Solution: Convertir en URL relative qui passe par le proxy Next.js:
 * - /api/attachments/file/...
 *
 * Le proxy Next.js (configuré dans next.config.ts) redirigera automatiquement
 * vers le bon backend avec la bonne URL (HTTPS si nécessaire).
 */
export function fixAttachmentUrl(url: string | undefined): string {
  if (!url) return '';

  try {
    // Si l'URL est déjà relative, la retourner telle quelle
    if (url.startsWith('/')) {
      return url;
    }

    // Si c'est une URL absolue, extraire le chemin
    if (url.startsWith('http://') || url.startsWith('https://')) {
      const urlObj = new URL(url);

      // Si le chemin commence par /api/, utiliser le chemin relatif
      if (urlObj.pathname.startsWith('/api/')) {
        const fixedUrl = urlObj.pathname + urlObj.search;
        console.log('🔧 [fixAttachmentUrl]', {
          original: url,
          fixed: fixedUrl
        });
        return fixedUrl;
      }

      // Sinon retourner l'URL telle quelle (pour les URLs externes)
      return url;
    }

    // Pour toute autre forme d'URL, la retourner telle quelle
    return url;
  } catch (error) {
    // En cas d'erreur de parsing, retourner l'URL originale
    console.warn('Failed to parse attachment URL:', url, error);
    return url;
  }
}
