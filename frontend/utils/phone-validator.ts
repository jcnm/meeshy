/**
 * Validation des numéros de téléphone
 *
 * Règles:
 * - Obligatoire
 * - Peut commencer par + ou 00
 * - Contient uniquement des chiffres après le préfixe
 * - Longueur totale: 8-15 caractères
 */

export interface PhoneValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Valide un numéro de téléphone selon les règles définies
 */
export function validatePhoneNumber(phone: string): PhoneValidationResult {
  // Vérifier si vide
  if (!phone || phone.trim() === '') {
    return {
      isValid: false,
      error: 'Le numéro de téléphone est obligatoire'
    };
  }

  const trimmed = phone.trim();

  // Vérifier la longueur totale
  if (trimmed.length < 8) {
    return {
      isValid: false,
      error: 'Le numéro de téléphone doit contenir au moins 8 caractères'
    };
  }

  if (trimmed.length > 15) {
    return {
      isValid: false,
      error: 'Le numéro de téléphone ne peut pas dépasser 15 caractères'
    };
  }

  // Vérifier le format
  // Peut commencer par + ou 00, suivi uniquement de chiffres
  const phoneRegex = /^(\+|00)\d+$/;

  if (!phoneRegex.test(trimmed)) {
    return {
      isValid: false,
      error: 'Le numéro doit commencer par + ou 00 et contenir uniquement des chiffres'
    };
  }

  return {
    isValid: true
  };
}

/**
 * Formate un numéro de téléphone en temps réel pendant la saisie
 * Enlève tous les caractères invalides sauf +, 00 au début et chiffres
 */
export function formatPhoneNumberInput(value: string): string {
  // Si vide, retourner tel quel
  if (!value) return '';

  // Si commence par 00, garder et ajouter seulement des chiffres après
  if (value.startsWith('00')) {
    const rest = value.slice(2).replace(/\D/g, ''); // Enlever tous les non-chiffres
    return '00' + rest;
  }

  // Si commence par +, garder et ajouter seulement des chiffres après
  if (value.startsWith('+')) {
    const rest = value.slice(1).replace(/\D/g, ''); // Enlever tous les non-chiffres
    return '+' + rest;
  }

  // Si ne commence pas par + ou 00, on peut soit:
  // 1. Forcer à commencer par + (option choisie)
  // 2. Ou nettoyer et laisser l'utilisateur choisir

  // Option: nettoyer et laisser vide si pas de préfixe valide
  const cleaned = value.replace(/\D/g, '');
  return cleaned ? '+' + cleaned : '';
}

/**
 * Obtient un message d'erreur de validation lisible
 */
export function getPhoneValidationError(phone: string): string | null {
  const result = validatePhoneNumber(phone);
  return result.isValid ? null : result.error || 'Numéro de téléphone invalide';
}

/**
 * Vérifie si le numéro de téléphone est valide (version simple)
 */
export function isValidPhoneNumber(phone: string): boolean {
  return validatePhoneNumber(phone).isValid;
}

/**
 * Exemples de numéros valides:
 * - +33612345678 (11 caractères)
 * - 0033612345678 (13 caractères)
 * - +1234567890 (11 caractères)
 * - 001234567890 (13 caractères)
 *
 * Exemples de numéros invalides:
 * - 123456 (trop court, < 8 caractères)
 * - +123456789012345678 (trop long, > 15 caractères)
 * - 612345678 (pas de préfixe + ou 00)
 * - +33 6 12 34 56 78 (espaces non autorisés)
 * - +33-6-12-34-56-78 (tirets non autorisés)
 */
