/**
 * Utilitaire simplifié pour les images Open Graph
 * Utilise 3 images SVG statiques de base
 */

export type OgImageType = 'default' | 'signin' | 'affiliate';

/**
 * Obtient l'URL de l'image Open Graph statique
 * @param type Type d'image (default, signin, affiliate)
 * @param frontendUrl URL du frontend (optionnel)
 * @returns URL complète de l'image
 */
export function getOgImageUrl(
  type: OgImageType = 'default',
  frontendUrl?: string
): string {
  const baseUrl = frontendUrl || process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://meeshy.me';
  
  const imageMap: Record<OgImageType, string> = {
    default: '/images/meeshy-og-default.svg',
    signin: '/images/meeshy-og-signin.svg',
    affiliate: '/images/meeshy-og-affiliate.svg',
  };

  const imagePath = imageMap[type] || imageMap.default;
  return `${baseUrl}${imagePath}`;
}

/**
 * Détermine le type d'image OG basé sur le contexte
 * @param path Chemin de la page actuelle
 * @returns Type d'image approprié
 */
export function getOgImageTypeFromPath(path: string): OgImageType {
  if (path.includes('/signin') || path.includes('/join')) {
    return 'signin';
  }
  if (path.includes('/affiliate')) {
    return 'affiliate';
  }
  return 'default';
}
