/**
 * Utilitaire pour copier du texte dans le presse-papiers avec fallbacks
 */

export async function copyToClipboard(text: string, inputSelector?: string): Promise<{ success: boolean; message: string }> {
  try {
    // Essayer d'abord l'API Clipboard moderne
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return { success: true, message: 'Copié dans le presse-papiers' };
    } else {
      // Fallback pour les contextes non sécurisés ou navigateurs plus anciens
      if (inputSelector) {
        const inputElement = document.querySelector(inputSelector) as HTMLInputElement;
        if (inputElement) {
          inputElement.value = text;
          inputElement.select();
          inputElement.setSelectionRange(0, 99999);
          
          // Essayer l'ancienne méthode execCommand
          if (document.execCommand('copy')) {
            return { success: true, message: 'Copié dans le presse-papiers' };
          } else {
            return { success: false, message: 'Texte sélectionné - utilisez Ctrl+C pour copier' };
          }
        }
      }
      
      // Si pas d'élément input spécifié, on ne peut pas copier automatiquement
      return { success: false, message: 'Copie automatique non disponible dans ce contexte' };
    }
  } catch (error) {
    console.warn('Erreur lors de la copie:', error);
    
    // Dernier fallback: sélectionner le texte dans un input
    if (inputSelector) {
      const inputElement = document.querySelector(inputSelector) as HTMLInputElement;
      if (inputElement) {
        inputElement.value = text;
        inputElement.select();
        inputElement.setSelectionRange(0, 99999);
        return { success: false, message: 'Texte sélectionné - utilisez Ctrl+C pour copier' };
      }
    }
    
    return { success: false, message: 'Erreur lors de la copie' };
  }
}

/**
 * Vérifie si la copie automatique est disponible
 */
export function isClipboardSupported(): boolean {
  return !!(navigator.clipboard && window.isSecureContext);
}
