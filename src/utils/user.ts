import { User } from '@/types';

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
