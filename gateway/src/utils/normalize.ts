/**
 * Utilitaires de normalisation des données utilisateur
 */

/**
 * Normalise un email en minuscules
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Normalise un username en minuscules
 */
export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

/**
 * Capitalise un nom (première lettre en majuscule, reste en minuscules)
 * Gère les noms composés avec espaces
 */
export function capitalizeName(name: string): string {
  return name
    .trim()
    .split(' ')
    .map(word => {
      if (word.length === 0) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

/**
 * Normalise un displayName en minuscules
 */
export function normalizeDisplayName(displayName: string): string {
  return displayName.trim().toLowerCase();
}

/**
 * Normalise toutes les données d'un utilisateur pour l'inscription
 */
export interface UserDataToNormalize {
  email?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
}

export function normalizeUserData(data: UserDataToNormalize): UserDataToNormalize {
  const normalized: UserDataToNormalize = {};

  if (data.email) {
    normalized.email = normalizeEmail(data.email);
  }

  if (data.username) {
    normalized.username = normalizeUsername(data.username);
  }

  if (data.firstName) {
    normalized.firstName = capitalizeName(data.firstName);
  }

  if (data.lastName) {
    normalized.lastName = capitalizeName(data.lastName);
  }

  if (data.displayName) {
    normalized.displayName = normalizeDisplayName(data.displayName);
  }

  return normalized;
}

