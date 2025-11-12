/**
 * Calcule la position exacte du curseur dans un textarea
 * Retourne les coordonnées x et y du curseur pour positionner l'autocomplete
 */
export function getCursorPosition(
  textarea: HTMLTextAreaElement,
  cursorIndex: number
): { x: number; y: number } {
  // Créer un div miroir invisible pour calculer la position du curseur
  const mirror = document.createElement('div');
  const computed = window.getComputedStyle(textarea);

  // Copier tous les styles pertinents du textarea vers le miroir
  const styles = [
    'boxSizing',
    'width',
    'height',
    'overflowX',
    'overflowY',
    'borderTopWidth',
    'borderRightWidth',
    'borderBottomWidth',
    'borderLeftWidth',
    'paddingTop',
    'paddingRight',
    'paddingBottom',
    'paddingLeft',
    'fontFamily',
    'fontSize',
    'fontWeight',
    'lineHeight',
    'textTransform',
    'letterSpacing',
    'wordSpacing',
    'whiteSpace',
    'wordWrap',
    'wordBreak'
  ];

  styles.forEach(style => {
    (mirror.style as any)[style] = (computed as any)[style];
  });

  // Styles supplémentaires pour le positionnement
  mirror.style.position = 'absolute';
  mirror.style.visibility = 'hidden';
  mirror.style.top = '0';
  mirror.style.left = '0';
  mirror.style.pointerEvents = 'none';

  // Ajouter le contenu jusqu'au curseur
  const textBeforeCursor = textarea.value.substring(0, cursorIndex);
  mirror.textContent = textBeforeCursor;

  // Créer un span pour marquer la position du curseur
  const cursorMarker = document.createElement('span');
  cursorMarker.textContent = '|';
  cursorMarker.style.color = 'transparent';
  mirror.appendChild(cursorMarker);

  // Ajouter le miroir au DOM temporairement
  document.body.appendChild(mirror);

  // Obtenir la position du textarea
  const textareaRect = textarea.getBoundingClientRect();

  // Obtenir la position du marqueur de curseur
  const markerRect = cursorMarker.getBoundingClientRect();

  // Calculer les coordonnées relatives
  const x = textareaRect.left + (markerRect.left - mirror.getBoundingClientRect().left);
  const y = textareaRect.top + (markerRect.top - mirror.getBoundingClientRect().top);

  // Nettoyer
  document.body.removeChild(mirror);

  return { x, y };
}

/**
 * Ajuste la position de l'autocomplete pour qu'elle reste visible dans le viewport
 */
export function adjustPositionForViewport(
  x: number,
  y: number,
  autocompleteWidth: number = 224,
  autocompleteHeight: number = 256
): { top?: number; bottom?: number; left: number } {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  // Ajuster la position horizontale
  let adjustedLeft = x;
  if (adjustedLeft + autocompleteWidth > viewportWidth - 20) {
    adjustedLeft = viewportWidth - autocompleteWidth - 20;
  }
  if (adjustedLeft < 20) {
    adjustedLeft = 20;
  }

  // Ajuster la position verticale
  // Si l'autocomplete dépasse en bas, l'afficher au-dessus du curseur
  const spaceBelow = viewportHeight - y;
  const spaceAbove = y;

  if (spaceBelow >= autocompleteHeight + 10) {
    // Assez d'espace en dessous - afficher en dessous du curseur
    return {
      top: y + 5, // Petit décalage sous le curseur
      left: adjustedLeft
    };
  } else if (spaceAbove >= autocompleteHeight + 10) {
    // Pas assez d'espace en dessous mais assez au-dessus - afficher au-dessus
    return {
      top: y - autocompleteHeight - 5, // Petit décalage au-dessus du curseur
      left: adjustedLeft
    };
  } else {
    // Pas assez d'espace des deux côtés - centrer verticalement
    return {
      top: Math.max(20, (viewportHeight - autocompleteHeight) / 2),
      left: adjustedLeft
    };
  }
}
