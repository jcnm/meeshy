/**
 * Générateur d'identifiants uniques pour conversations et liens
 * Génère des identifiants basés sur un texte avec suffixe hexadécimal aléatoire de 6-10 caractères
 *
 * Format: "base-identifier-<6-10 hex chars>"
 * Exemple: "ma-conversation-3f8a2b" ou "lien-communaute-9c4e1bd8a"
 */

/**
 * Génère un identifiant unique basé sur un texte avec suffixe hexadécimal aléatoire
 *
 * @param baseText - Texte de base (titre de conversation, nom de lien, etc.)
 * @param maxBaseLength - Longueur maximale de la partie base (default: 30)
 * @returns Identifiant formaté: "base-identifier-<6-10 hex>"
 *
 * @example
 * generateIdentifier("Ma Super Conversation")
 * // => "ma-super-conversation-7f3a2b"
 *
 * generateIdentifier("Lien Communauté Développeurs")
 * // => "lien-communaute-developpeurs-9c4e1bd8"
 */
export function generateIdentifier(baseText: string, maxBaseLength: number = 30): string {
  if (!baseText.trim()) return '';

  // Nettoyer et normaliser le texte de base
  const baseIdentifier = baseText
    .toLowerCase()
    .normalize('NFD') // Décompose les caractères accentués
    .replace(/[\u0300-\u036f]/g, '') // Supprime les accents
    .replace(/[^a-z0-9\s-]/g, '') // Garde uniquement lettres, chiffres, espaces et tirets
    .replace(/\s+/g, '-') // Remplace les espaces par des tirets
    .replace(/-+/g, '-') // Remplace les tirets multiples par un seul
    .replace(/^-|-$/g, '') // Supprime les tirets en début/fin
    .substring(0, maxBaseLength); // Limite la longueur

  if (!baseIdentifier) return '';

  // Génère un suffixe hexadécimal aléatoire de 6-10 caractères
  const hexLength = Math.floor(Math.random() * 5) + 6; // Random entre 6 et 10
  const hexBytes = Math.ceil(hexLength / 2);
  const hexSuffix = Array.from(crypto.getRandomValues(new Uint8Array(hexBytes)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .substring(0, hexLength); // Coupe à la longueur exacte

  return `${baseIdentifier}-${hexSuffix}`;
}

/**
 * Valide un identifiant
 * Accepte: lettres minuscules, chiffres, tirets, underscores, @
 *
 * @param identifier - Identifiant à valider
 * @returns true si valide, false sinon
 *
 * @example
 * validateIdentifier("ma-conversation-7f3a2b") // => true
 * validateIdentifier("Ma Conversation!") // => false
 * validateIdentifier("test@user-123abc") // => true
 */
export function validateIdentifier(identifier: string): boolean {
  if (!identifier || !identifier.trim()) return false;

  // Accepte: lettres, chiffres, tirets, underscores et @
  // Le suffixe hex sera composé de a-f0-9 après un tiret
  const regex = /^[a-zA-Z0-9\-_@]+$/;
  return regex.test(identifier);
}

/**
 * Génère un identifiant court (pour URLs très courtes)
 * Génère uniquement 6 caractères hexadécimaux sans base
 *
 * @returns Identifiant court de 6 caractères hex
 *
 * @example
 * generateShortIdentifier() // => "7f3a2b"
 */
export function generateShortIdentifier(): string {
  const hexBytes = 3; // 3 bytes = 6 hex chars
  return Array.from(crypto.getRandomValues(new Uint8Array(hexBytes)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Génère un identifiant de longueur spécifique
 *
 * @param length - Longueur souhaitée (6-16 caractères)
 * @returns Identifiant hexadécimal de la longueur spécifiée
 *
 * @example
 * generateFixedLengthIdentifier(8) // => "7f3a2bc9"
 * generateFixedLengthIdentifier(12) // => "7f3a2bc9d4e1"
 */
export function generateFixedLengthIdentifier(length: number = 8): string {
  // Limite la longueur entre 6 et 16
  const clampedLength = Math.max(6, Math.min(16, length));
  const hexBytes = Math.ceil(clampedLength / 2);

  return Array.from(crypto.getRandomValues(new Uint8Array(hexBytes)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .substring(0, clampedLength);
}

/**
 * Extrait la partie base d'un identifiant (sans le suffixe hex)
 *
 * @param identifier - Identifiant complet
 * @returns Partie base de l'identifiant
 *
 * @example
 * extractBaseIdentifier("ma-conversation-7f3a2b") // => "ma-conversation"
 * extractBaseIdentifier("lien-test-abc123def") // => "lien-test"
 */
export function extractBaseIdentifier(identifier: string): string {
  if (!identifier) return '';

  // Cherche le dernier tiret suivi de 6-10 caractères hex
  const match = identifier.match(/^(.+)-([a-f0-9]{6,10})$/);
  return match ? match[1] : identifier;
}
