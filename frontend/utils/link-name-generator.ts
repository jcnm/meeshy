/**
 * Générateur de noms de liens de partage automatiques
 * Génère des noms de liens selon le nom de la conversation, la langue, la durée et les limites
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
 * Tronque intelligemment une chaîne pour respecter la limite de caractères
 */
function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }
  // Tronquer en gardant de l'espace pour "..."
  return str.substring(0, maxLength - 3) + '...';
}

/**
 * Génère un nom de lien automatique selon les paramètres et la langue
 * Limite automatiquement à 32 caractères maximum
 * Format attendu (français): "lien <limite> de la conversation <nom> valable <durée>"
 * Exemple: "lien ouvert à tous de la conversation 'Rencontre à Paris les Samedi' valable 7 jours"
 */
export function generateLinkName(options: LinkNameOptions): string {
  const {
    conversationTitle,
    language = 'fr',
    durationDays,
    maxParticipants,
    maxUses,
    isPublic = true
  } = options;

  // Déterminer la limite de participants
  const participantLimit = getParticipantLimitText(maxParticipants, maxUses, isPublic, language);

  // Déterminer la durée
  const durationText = getDurationText(durationDays, language);

  // Construire le nom selon la langue
  let fullName: string;
  
  switch (language) {
    case 'fr':
      fullName = `lien ${participantLimit} de la conversation '${conversationTitle}' valable ${durationText}`;
      break;
    
    case 'en':
      fullName = `${participantLimit} link for conversation '${conversationTitle}' valid for ${durationText}`;
      break;
    
    case 'es':
      fullName = `enlace ${participantLimit} de la conversación '${conversationTitle}' válido por ${durationText}`;
      break;
    
    case 'de':
      fullName = `${participantLimit} Link für Gespräch '${conversationTitle}' gültig für ${durationText}`;
      break;
    
    case 'it':
      fullName = `link ${participantLimit} per conversazione '${conversationTitle}' valido per ${durationText}`;
      break;
    
    case 'pt':
      fullName = `link ${participantLimit} para conversa '${conversationTitle}' válido por ${durationText}`;
      break;
    
    case 'zh':
      fullName = `${conversationTitle} 的${participantLimit}链接，有效期 ${durationText}`;
      break;
    
    case 'ja':
      fullName = `会話 '${conversationTitle}' の${participantLimit}リンク（有効期限: ${durationText}）`;
      break;
    
    case 'ar':
      fullName = `رابط ${participantLimit} للمحادثة '${conversationTitle}' صالح لمدة ${durationText}`;
      break;
    
    default:
      fullName = `${participantLimit} link for conversation '${conversationTitle}' valid for ${durationText}`;
      break;
  }

  // Si le nom dépasse 32 caractères, essayer de tronquer intelligemment
  if (fullName.length > MAX_LINK_NAME_LENGTH) {
    // Essayer de créer un nom plus court en priorisant le titre
    const truncatedTitle = truncateString(conversationTitle, 20);
    
    switch (language) {
      case 'fr':
        fullName = `Lien '${truncatedTitle}'`;
        break;
      case 'en':
        fullName = `Link '${truncatedTitle}'`;
        break;
      case 'es':
        fullName = `Enlace '${truncatedTitle}'`;
        break;
      case 'de':
        fullName = `Link '${truncatedTitle}'`;
        break;
      case 'it':
        fullName = `Link '${truncatedTitle}'`;
        break;
      case 'pt':
        fullName = `Link '${truncatedTitle}'`;
        break;
      case 'zh':
        fullName = `${truncatedTitle} 链接`;
        break;
      case 'ja':
        fullName = `${truncatedTitle} リンク`;
        break;
      case 'ar':
        fullName = `رابط '${truncatedTitle}'`;
        break;
      default:
        fullName = `Link '${truncatedTitle}'`;
        break;
    }
  }

  // S'assurer que le résultat final ne dépasse pas 32 caractères
  return truncateString(fullName, MAX_LINK_NAME_LENGTH);
}

/**
 * Retourne le texte de limitation des participants selon la langue
 */
function getParticipantLimitText(
  maxParticipants: number | undefined,
  maxUses: number | undefined,
  isPublic: boolean,
  language: string
): string {
  const hasLimit = maxParticipants || maxUses;
  
  switch (language) {
    case 'fr':
      if (!hasLimit || isPublic) {
        return 'ouvert à tous';
      }
      if (maxParticipants) {
        return `limité à ${maxParticipants} participant${maxParticipants > 1 ? 's' : ''}`;
      }
      if (maxUses) {
        return `limité à ${maxUses} utilisation${maxUses > 1 ? 's' : ''}`;
      }
      return 'ouvert à tous';
    
    case 'en':
      if (!hasLimit || isPublic) {
        return 'open to all';
      }
      if (maxParticipants) {
        return `limited to ${maxParticipants} participant${maxParticipants > 1 ? 's' : ''}`;
      }
      if (maxUses) {
        return `limited to ${maxUses} use${maxUses > 1 ? 's' : ''}`;
      }
      return 'open to all';
    
    case 'es':
      if (!hasLimit || isPublic) {
        return 'abierto a todos';
      }
      if (maxParticipants) {
        return `limitado a ${maxParticipants} participante${maxParticipants > 1 ? 's' : ''}`;
      }
      if (maxUses) {
        return `limitado a ${maxUses} uso${maxUses > 1 ? 's' : ''}`;
      }
      return 'abierto a todos';
    
    case 'de':
      if (!hasLimit || isPublic) {
        return 'für alle geöffnet';
      }
      if (maxParticipants) {
        return `begrenzt auf ${maxParticipants} Teilnehmer`;
      }
      if (maxUses) {
        return `begrenzt auf ${maxUses} Verwendung${maxUses > 1 ? 'en' : ''}`;
      }
      return 'für alle geöffnet';
    
    case 'it':
      if (!hasLimit || isPublic) {
        return 'aperto a tutti';
      }
      if (maxParticipants) {
        return `limitato a ${maxParticipants} partecipante${maxParticipants > 1 ? 'i' : ''}`;
      }
      if (maxUses) {
        return `limitato a ${maxUses} uso${maxUses > 1 ? 'i' : ''}`;
      }
      return 'aperto a tutti';
    
    case 'pt':
      if (!hasLimit || isPublic) {
        return 'aberto a todos';
      }
      if (maxParticipants) {
        return `limitado a ${maxParticipants} participante${maxParticipants > 1 ? 's' : ''}`;
      }
      if (maxUses) {
        return `limitado a ${maxUses} uso${maxUses > 1 ? 's' : ''}`;
      }
      return 'aberto a todos';
    
    case 'zh':
      if (!hasLimit || isPublic) {
        return '对所有人开放';
      }
      if (maxParticipants) {
        return `限制 ${maxParticipants} 位参与者`;
      }
      if (maxUses) {
        return `限制 ${maxUses} 次使用`;
      }
      return '对所有人开放';
    
    case 'ja':
      if (!hasLimit || isPublic) {
        return 'すべての人に公開';
      }
      if (maxParticipants) {
        return `${maxParticipants}人の参加者に制限`;
      }
      if (maxUses) {
        return `${maxUses}回の使用に制限`;
      }
      return 'すべての人に公開';
    
    case 'ar':
      if (!hasLimit || isPublic) {
        return 'مفتوح للجميع';
      }
      if (maxParticipants) {
        return `محدود لـ ${maxParticipants} مشارك${maxParticipants > 1 ? 'ين' : ''}`;
      }
      if (maxUses) {
        return `محدود لـ ${maxUses} استخدام${maxUses > 1 ? 'ات' : ''}`;
      }
      return 'مفتوح للجميع';
    
    default:
      if (!hasLimit || isPublic) {
        return 'open to all';
      }
      if (maxParticipants) {
        return `limited to ${maxParticipants} participant${maxParticipants > 1 ? 's' : ''}`;
      }
      if (maxUses) {
        return `limited to ${maxUses} use${maxUses > 1 ? 's' : ''}`;
      }
      return 'open to all';
  }
}

/**
 * Retourne le texte de durée selon la langue
 */
function getDurationText(durationDays: number | undefined, language: string): string {
  if (!durationDays) {
    switch (language) {
      case 'fr':
        return 'indéfiniment';
      case 'en':
        return 'indefinitely';
      case 'es':
        return 'indefinidamente';
      case 'de':
        return 'unbegrenzt';
      case 'it':
        return 'indefinitamente';
      case 'pt':
        return 'indefinidamente';
      case 'zh':
        return '无限期';
      case 'ja':
        return '無期限';
      case 'ar':
        return 'إلى أجل غير مسمى';
      default:
        return 'indefinitely';
    }
  }

  switch (language) {
    case 'fr':
      return `${durationDays} jour${durationDays > 1 ? 's' : ''}`;
    
    case 'en':
      return `${durationDays} day${durationDays > 1 ? 's' : ''}`;
    
    case 'es':
      return `${durationDays} día${durationDays > 1 ? 's' : ''}`;
    
    case 'de':
      return `${durationDays} Tag${durationDays > 1 ? 'e' : ''}`;
    
    case 'it':
      return `${durationDays} giorno${durationDays > 1 ? 'i' : ''}`;
    
    case 'pt':
      return `${durationDays} dia${durationDays > 1 ? 's' : ''}`;
    
    case 'zh':
      return `${durationDays} 天`;
    
    case 'ja':
      return `${durationDays} 日`;
    
    case 'ar':
      return `${durationDays} يوم${durationDays > 1 ? 'اً' : ''}`;
    
    default:
      return `${durationDays} day${durationDays > 1 ? 's' : ''}`;
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

