import { User, ConversationParticipant } from '@/types';
import { SUPPORTED_LANGUAGES } from '@/types';

/**
 * Retourne le nom complet d'un utilisateur en utilisant firstName/lastName 
 * ou displayName/username en fallback
 */
export function getUserDisplayName(user: User): string {
  if (user.firstName && user.lastName) {
    return `${user.firstName} ${user.lastName}`;
  }
  
  if (user.displayName) {
    return user.displayName;
  }
  
  return user.username;
}

/**
 * Retourne les initiales d'un utilisateur pour les avatars
 */
export function getUserInitials(user: User): string {
  if (user.firstName && user.lastName) {
    return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
  }
  
  if (user.displayName && user.displayName.includes(' ')) {
    const parts = user.displayName.split(' ');
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  
  if (user.displayName) {
    return user.displayName.substring(0, 2).toUpperCase();
  }
  
  return user.username.substring(0, 2).toUpperCase();
}

/**
 * Retourne le prénom ou displayName en fallback
 */
export function getUserFirstName(user: User): string {
  if (user.firstName) {
    return user.firstName;
  }
  
  if (user.displayName) {
    return user.displayName.split(' ')[0];
  }
  
  return user.username;
}

/**
 * Retourne le prénom d'un participant de conversation
 */
export function getParticipantFirstName(participant: ConversationParticipant): string {
  if (participant.displayName) {
    return participant.displayName.split(' ')[0];
  }
  
  return participant.username;
}

/**
 * Formate un utilisateur pour l'affichage dans une conversation
 * Retourne "firstName (username)" avec contact si disponible
 */
export function formatUserForConversation(user: User): string {
  const firstName = getUserFirstName(user);
  let result = `${firstName} (${user.username})`;
  
  // Ajouter le contact si disponible
  if (user.phoneNumber) {
    result += ` • ${user.phoneNumber}`;
  } else if (user.email) {
    result += ` • ${user.email}`;
  }
  
  return result;
}

/**
 * Formate un participant pour l'affichage dans une conversation
 * Retourne "firstName (username)"
 */
export function formatParticipantForConversation(participant: ConversationParticipant): string {
  const firstName = getParticipantFirstName(participant);
  return `${firstName} (${participant.username})`;
}

/**
 * Obtient le drapeau d'une langue basé sur son code
 */
export function getLanguageFlag(languageCode: string): string {
  const language = SUPPORTED_LANGUAGES.find(lang => lang.code === languageCode);
  return language?.flag || '🌐';
}

/**
 * Formate le titre d'une conversation basé sur ses participants
 * Pour conversations 1-1: "firstName (username)" + contact + drapeau (si disponible via member)
 * Pour conversations groupes: "firstName (username), firstName (username), firstName (username)"
 */
export function formatConversationTitle(
  participants: ConversationParticipant[], 
  currentUserId: string, 
  isGroup: boolean,
  members?: Array<{ user: User }>
): string {
  const otherParticipants = participants.filter(p => p.id !== currentUserId);
  
  if (otherParticipants.length === 0) {
    return "Conversation vide";
  }
  
  if (!isGroup && otherParticipants.length === 1) {
    // Conversation 1-1: afficher nom + contact + drapeau si disponible
    const participant = otherParticipants[0];
    let result = formatParticipantForConversation(participant);
    
    // Essayer de récupérer les infos complètes de l'utilisateur via members
    const memberInfo = members?.find(m => m.user.id === participant.id)?.user;
    if (memberInfo) {
      if (memberInfo.phoneNumber) {
        result += ` • ${memberInfo.phoneNumber}`;
      } else if (memberInfo.email) {
        result += ` • ${memberInfo.email}`;
      }
      
      const flag = getLanguageFlag(memberInfo.systemLanguage);
      result += ` ${flag}`;
    }
    
    return result;
  }
  
  // Conversation de groupe: afficher les 3 premiers participants
  const displayParticipants = otherParticipants.slice(0, 3);
  const participantNames = displayParticipants.map(participant => {
    return formatParticipantForConversation(participant);
  });
  
  if (otherParticipants.length > 3) {
    participantNames.push(`+${otherParticipants.length - 3} autres`);
  }
  
  return participantNames.join(', ');
}
