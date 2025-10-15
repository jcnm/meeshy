/**
 * Générateur de noms de liens de partage automatiques
 * Génère des noms descriptifs basés sur le type de canal/destinataires
 * Format: "Canal [type] - [durée]" ou "Lien [limite] - [durée]"
 * Limite automatiquement à 32 caractères maximum
 */

export interface LinkNameOptions {
  conversationTitle: string;
  language?: string;
  durationDays?: number;
  maxParticipants?: number;
  maxUses?: number;
  isPublic?: boolean;
}

const MAX_LINK_NAME_LENGTH = 32;

/**
 * Génère un nom de lien basé sur le canal de diffusion et les destinataires
 * Format attendu: "Canal public - 7j" ou "Lien 10 pers. - 30j"
 * Ne contient PAS le titre de la conversation pour rester concis
 */
export function generateLinkName(options: LinkNameOptions): string {
  const {
    language = 'fr',
    durationDays,
    maxParticipants,
    maxUses,
    isPublic = true
  } = options;

  // Déterminer le type de canal/destinataires
  const channelType = getChannelType(maxParticipants, maxUses, isPublic, language);
  
  // Déterminer la durée courte
  const shortDuration = getShortDuration(durationDays, language);

  // Construire le nom selon la langue
  let linkName: string;
  
  switch (language) {
    case 'fr':
      linkName = `${channelType} - ${shortDuration}`;
      break;
    
    case 'en':
      linkName = `${channelType} - ${shortDuration}`;
      break;
    
    case 'es':
      linkName = `${channelType} - ${shortDuration}`;
      break;
    
    case 'de':
      linkName = `${channelType} - ${shortDuration}`;
      break;
    
    case 'it':
      linkName = `${channelType} - ${shortDuration}`;
      break;
    
    case 'pt':
      linkName = `${channelType} - ${shortDuration}`;
      break;
    
    case 'zh':
      linkName = `${channelType} - ${shortDuration}`;
      break;
    
    case 'ja':
      linkName = `${channelType} - ${shortDuration}`;
      break;
    
    case 'ar':
      linkName = `${channelType} - ${shortDuration}`;
      break;
    
    default:
      linkName = `${channelType} - ${shortDuration}`;
      break;
  }

  // S'assurer que le résultat ne dépasse pas 32 caractères
  if (linkName.length > MAX_LINK_NAME_LENGTH) {
    return linkName.substring(0, MAX_LINK_NAME_LENGTH - 3) + '...';
  }

  return linkName;
}

/**
 * Retourne le type de canal/destinataires selon les limites
 */
function getChannelType(
  maxParticipants: number | undefined,
  maxUses: number | undefined,
  isPublic: boolean,
  language: string
): string {
  const hasLimit = maxParticipants || maxUses;
  
  switch (language) {
    case 'fr':
      if (!hasLimit || isPublic) {
        return 'Canal public';
      }
      if (maxParticipants) {
        return `Lien ${maxParticipants} pers.`;
      }
      if (maxUses) {
        return `Lien ${maxUses} util.`;
      }
      return 'Canal public';
    
    case 'en':
      if (!hasLimit || isPublic) {
        return 'Public channel';
      }
      if (maxParticipants) {
        return `Link ${maxParticipants} people`;
      }
      if (maxUses) {
        return `Link ${maxUses} uses`;
      }
      return 'Public channel';
    
    case 'es':
      if (!hasLimit || isPublic) {
        return 'Canal público';
      }
      if (maxParticipants) {
        return `Enlace ${maxParticipants} pers.`;
      }
      if (maxUses) {
        return `Enlace ${maxUses} usos`;
      }
      return 'Canal público';
    
    case 'de':
      if (!hasLimit || isPublic) {
        return 'Öffentlicher Kanal';
      }
      if (maxParticipants) {
        return `Link ${maxParticipants} Pers.`;
      }
      if (maxUses) {
        return `Link ${maxUses} Verw.`;
      }
      return 'Öffentlicher Kanal';
    
    case 'it':
      if (!hasLimit || isPublic) {
        return 'Canale pubblico';
      }
      if (maxParticipants) {
        return `Link ${maxParticipants} pers.`;
      }
      if (maxUses) {
        return `Link ${maxUses} usi`;
      }
      return 'Canale pubblico';
    
    case 'pt':
      if (!hasLimit || isPublic) {
        return 'Canal público';
      }
      if (maxParticipants) {
        return `Link ${maxParticipants} pess.`;
      }
      if (maxUses) {
        return `Link ${maxUses} usos`;
      }
      return 'Canal público';
    
    case 'zh':
      if (!hasLimit || isPublic) {
        return '公开频道';
      }
      if (maxParticipants) {
        return `链接 ${maxParticipants}人`;
      }
      if (maxUses) {
        return `链接 ${maxUses}次`;
      }
      return '公开频道';
    
    case 'ja':
      if (!hasLimit || isPublic) {
        return '公開チャンネル';
      }
      if (maxParticipants) {
        return `リンク ${maxParticipants}名`;
      }
      if (maxUses) {
        return `リンク ${maxUses}回`;
      }
      return '公開チャンネル';
    
    case 'ar':
      if (!hasLimit || isPublic) {
        return 'قناة عامة';
      }
      if (maxParticipants) {
        return `رابط ${maxParticipants} شخص`;
      }
      if (maxUses) {
        return `رابط ${maxUses} استخدام`;
      }
      return 'قناة عامة';
    
    default:
      if (!hasLimit || isPublic) {
        return 'Public channel';
      }
      if (maxParticipants) {
        return `Link ${maxParticipants} people`;
      }
      if (maxUses) {
        return `Link ${maxUses} uses`;
      }
      return 'Public channel';
  }
}

/**
 * Retourne la durée en format court selon la langue
 */
function getShortDuration(durationDays: number | undefined, language: string): string {
  if (!durationDays) {
    switch (language) {
      case 'fr':
        return '∞';
      case 'en':
        return '∞';
      case 'es':
        return '∞';
      case 'de':
        return '∞';
      case 'it':
        return '∞';
      case 'pt':
        return '∞';
      case 'zh':
        return '∞';
      case 'ja':
        return '∞';
      case 'ar':
        return '∞';
      default:
        return '∞';
    }
  }

  switch (language) {
    case 'fr':
      return `${durationDays}j`;
    
    case 'en':
      return `${durationDays}d`;
    
    case 'es':
      return `${durationDays}d`;
    
    case 'de':
      return `${durationDays}T`;
    
    case 'it':
      return `${durationDays}g`;
    
    case 'pt':
      return `${durationDays}d`;
    
    case 'zh':
      return `${durationDays}天`;
    
    case 'ja':
      return `${durationDays}日`;
    
    case 'ar':
      return `${durationDays}ي`;
    
    default:
      return `${durationDays}d`;
  }
}

/**
 * Génère un nom de lien simple (pour retrocompatibilité)
 * @deprecated Utilisez generateLinkName à la place
 */
export function generateSimpleLinkName(conversationTitle: string, language: string = 'fr'): string {
  return generateLinkName({
    conversationTitle,
    language,
    durationDays: 7,
    isPublic: true
  });
}
