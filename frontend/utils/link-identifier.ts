/**
 * Utilitaires pour la gestion des identifiants de liens de partage
 */

export interface LinkIdentifierInfo {
  type: 'linkId' | 'conversationShareLinkId' | 'unknown';
  value: string;
  isValid: boolean;
}

/**
 * Analyse un identifiant pour déterminer son type et sa validité
 */
export function analyzeLinkIdentifier(identifier: string): LinkIdentifierInfo {
  if (!identifier || typeof identifier !== 'string') {
    return {
      type: 'unknown',
      value: identifier,
      isValid: false
    };
  }

  // Vérifier si c'est un linkId (commence par "mshy_")
  if (identifier.startsWith('mshy_')) {
    return {
      type: 'linkId',
      value: identifier,
      isValid: identifier.length > 10 && /^mshy_[a-zA-Z0-9_-]+$/.test(identifier)
    };
  }

  // Vérifier si c'est un ObjectId MongoDB (24 caractères hexadécimaux)
  if (/^[0-9a-fA-F]{24}$/.test(identifier)) {
    return {
      type: 'conversationShareLinkId',
      value: identifier,
      isValid: true
    };
  }

  // Vérifier si c'est un identifiant personnalisé (alphanumérique avec tirets/underscores)
  if (/^[a-zA-Z0-9_-]+$/.test(identifier)) {
    return {
      type: 'conversationShareLinkId',
      value: identifier,
      isValid: identifier.length >= 3
    };
  }

  return {
    type: 'unknown',
    value: identifier,
    isValid: false
  };
}

/**
 * Génère des identifiants de fallback pour essayer différents formats
 */
export function generateFallbackIdentifiers(identifier: string): string[] {
  const fallbacks: string[] = [];
  const info = analyzeLinkIdentifier(identifier);

  if (info.type === 'linkId') {
    // Si c'est un linkId, essayer sans le préfixe
    const withoutPrefix = identifier.replace('mshy_', '');
    if (withoutPrefix !== identifier) {
      fallbacks.push(withoutPrefix);
    }
  } else if (info.type === 'conversationShareLinkId') {
    // Si c'est un conversationShareLinkId, essayer avec le préfixe
    fallbacks.push(`mshy_${identifier}`);
  }

  return fallbacks;
}

/**
 * Valide qu'un identifiant est utilisable pour les requêtes API
 */
export function isValidForApiRequest(identifier: string): boolean {
  const info = analyzeLinkIdentifier(identifier);
  return info.isValid && (info.type === 'linkId' || info.type === 'conversationShareLinkId');
}

/**
 * Normalise un identifiant pour l'affichage
 */
export function normalizeForDisplay(identifier: string): string {
  const info = analyzeLinkIdentifier(identifier);
  
  if (info.type === 'linkId') {
    // Pour les linkIds, afficher de manière plus lisible
    return identifier.replace('mshy_', '');
  }
  
  return identifier;
}

/**
 * Génère un identifiant de lien temporaire pour le stockage local
 */
export function generateTemporaryLinkId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `temp_${timestamp}_${random}`;
}

/**
 * Vérifie si un identifiant est temporaire
 */
export function isTemporaryLinkId(identifier: string): boolean {
  return identifier.startsWith('temp_');
}

/**
 * Extrait l'ID de conversation depuis un identifiant de lien
 */
export function extractConversationId(identifier: string): string | null {
  const info = analyzeLinkIdentifier(identifier);
  
  if (info.type === 'linkId') {
    // Pour les linkIds, on ne peut pas extraire directement l'ID de conversation
    // Il faut faire une requête API
    return null;
  }
  
  if (info.type === 'conversationShareLinkId') {
    // Pour les conversationShareLinkIds, c'est directement l'ID
    return identifier;
  }
  
  return null;
}
