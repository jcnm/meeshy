/**
 * Calcule la position exacte du curseur dans un textarea
 * Retourne les coordonnées x et y du curseur pour positionner l'autocomplete
 */
export function getCursorPosition(
  textarea: HTMLTextAreaElement,
  cursorIndex: number
): { x: number; y: number } {
  // Créer un div miroir pour calculer la position du curseur
  const div = document.createElement('div');
  const computed = window.getComputedStyle(textarea);

  // Copier tous les styles du textarea vers le div
  const styles = [
    'boxSizing',
    'width',
    'paddingTop',
    'paddingRight',
    'paddingBottom',
    'paddingLeft',
    'borderTopWidth',
    'borderRightWidth',
    'borderBottomWidth',
    'borderLeftWidth',
    'fontFamily',
    'fontSize',
    'fontWeight',
    'lineHeight',
    'letterSpacing',
    'wordSpacing',
    'whiteSpace',
    'wordWrap',
    'wordBreak',
    'textAlign',
    'direction',
    'tabSize'
  ];

  styles.forEach(style => {
    (div.style as any)[style] = (computed as any)[style];
  });

  // Styles spéciaux pour le positionnement du div
  div.style.position = 'absolute';
  div.style.visibility = 'hidden';
  div.style.whiteSpace = 'pre-wrap'; // Important pour le wrapping comme textarea
  div.style.wordWrap = 'break-word';
  div.style.overflow = 'hidden';
  div.style.height = 'auto'; // Laisser le div grandir naturellement

  // Ajouter le texte avant le curseur
  const textBeforeCursor = textarea.value.substring(0, cursorIndex);
  const textNode = document.createTextNode(textBeforeCursor);
  div.appendChild(textNode);

  // Créer un span pour marquer la position exacte du curseur
  const span = document.createElement('span');
  span.textContent = '|';
  div.appendChild(span);

  // Ajouter le texte après le curseur (optionnel mais aide au wrapping)
  const textAfterCursor = textarea.value.substring(cursorIndex);
  const textNodeAfter = document.createTextNode(textAfterCursor);
  div.appendChild(textNodeAfter);

  // Ajouter temporairement au DOM
  document.body.appendChild(div);

  // Obtenir les positions
  const textareaRect = textarea.getBoundingClientRect();
  const spanRect = span.getBoundingClientRect();
  const divRect = div.getBoundingClientRect();

  // Calculer la position relative du span dans le div
  const offsetX = spanRect.left - divRect.left;
  const offsetY = spanRect.top - divRect.top;

  // Calculer la position absolue en tenant compte du scroll du textarea
  const x = textareaRect.left + offsetX - textarea.scrollLeft;
  const y = textareaRect.top + offsetY - textarea.scrollTop;

  // Nettoyer
  document.body.removeChild(div);

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
