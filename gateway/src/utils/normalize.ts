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
 * Normalise un username
 * Préserve la capitalisation telle qu'entrée par l'utilisateur
 */
export function normalizeUsername(username: string): string {
  return username.trim();
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
 * Normalise un displayName
 * Préserve la capitalisation, émojis et caractères spéciaux
 * Enlève uniquement les espaces avant/après et les retours à la ligne/tabulations
 */
export function normalizeDisplayName(displayName: string): string {
  return displayName.trim().replace(/[\n\t]/g, '');
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

