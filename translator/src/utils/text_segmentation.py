"""
Module de segmentation de texte pour traduction structurée
Préserve les paragraphes, sauts de ligne et emojis dans les traductions
"""

import re
from typing import List, Tuple, Dict
import logging

logger = logging.getLogger(__name__)

# Pattern ULTRA-ROBUSTE pour tous les types d'emojis
# Inclut tous les ranges Unicode emoji + modificateurs + ZWJ sequences
EMOJI_PATTERN = re.compile(
    "(?:"
    # Emojis avec modificateurs de peau (skin tone) et ZWJ
    "[\U0001F3FB-\U0001F3FF]|"  # Modificateurs de peau
    "\U0000200D|"  # Zero Width Joiner (ZWJ)
    "\U0000FE0F|"  # Variation Selector-16 (présentation emoji)
    "\U0000FE0E|"  # Variation Selector-15 (présentation texte)
    # Emojis de base
    "[\U0001F600-\U0001F64F]|"  # Emoticons
    "[\U0001F300-\U0001F5FF]|"  # Symbols & Pictographs
    "[\U0001F680-\U0001F6FF]|"  # Transport & Map Symbols
    "[\U0001F700-\U0001F77F]|"  # Alchemical Symbols
    "[\U0001F780-\U0001F7FF]|"  # Geometric Shapes Extended
    "[\U0001F800-\U0001F8FF]|"  # Supplemental Arrows-C
    "[\U0001F900-\U0001F9FF]|"  # Supplemental Symbols and Pictographs
    "[\U0001FA00-\U0001FA6F]|"  # Chess Symbols
    "[\U0001FA70-\U0001FAFF]|"  # Symbols and Pictographs Extended-A
    "[\U00002702-\U000027B0]|"  # Dingbats
    "[\U000024C2-\U0001F251]|"  # Enclosed characters
    "[\U0001F1E0-\U0001F1FF]|"  # Regional Indicator Symbols (flags)
    "[\U00002600-\U000026FF]|"  # Miscellaneous Symbols
    "[\U00002700-\U000027BF]|"  # Dingbats
    "[\U0001F900-\U0001F9FF]|"  # Supplemental Symbols
    "[\U0001FA00-\U0001FAFF]|"  # Extended Pictographs
    # Symboles additionnels souvent utilisés comme emojis
    "[\u2600-\u26FF]|"  # Miscellaneous Symbols
    "[\u2700-\u27BF]|"  # Dingbats
    "[\u2B50]|"  # Star
    "[\u2934-\u2935]|"  # Arrows
    "[\u3030]|"  # Wavy dash
    "[\u303D]|"  # Part alternation mark
    "[\u3297]|"  # Circled Ideograph Congratulation
    "[\u3299]|"  # Circled Ideograph Secret
    # Keycap sequences
    "[\u0023\u002A\u0030-\u0039]\uFE0F?\u20E3|"  # Keycaps
    # Copyright, registered, trademark
    "[\u00A9\u00AE\u203C\u2049\u2122\u2139]|"
    # Arrows
    "[\u2194-\u2199\u21A9-\u21AA]|"
    # Checkmarks, crosses
    "[\u231A-\u231B\u2328\u23CF\u23E9-\u23F3\u23F8-\u23FA\u24C2]|"
    # Geometric shapes
    "[\u25AA-\u25AB\u25B6\u25C0\u25FB-\u25FE]|"
    # Additional symbols
    "[\u2934-\u2935\u2B05-\u2B07\u2B1B-\u2B1C\u2B50\u2B55]|"
    # Emojis récents (Unicode 13.0+)
    "[\U0001F90C-\U0001F971]|"  # Nouveaux emojis
    "[\U0001F973-\U0001F976]|"
    "[\U0001F97A-\U0001F9A2]|"
    "[\U0001F9A5-\U0001F9AA]|"
    "[\U0001F9AE-\U0001F9CA]|"
    "[\U0001F9CD-\U0001F9FF]|"
    "[\U0001FA70-\U0001FA74]|"
    "[\U0001FA78-\U0001FA7A]|"
    "[\U0001FA80-\U0001FA86]|"
    "[\U0001FA90-\U0001FAA8]|"
    "[\U0001FAB0-\U0001FAB6]|"
    "[\U0001FAC0-\U0001FAC2]|"
    "[\U0001FAD0-\U0001FAD6]"
    ")+",
    flags=re.UNICODE
)

# Marqueur spécial pour les emojis - Format XML/HTML plus robuste
# Format: <EMOJI_X/> où X est l'index
# Les balises XML sont mieux préservées par les tokenizers ML que les underscores
# Utilisation de balise auto-fermante pour éviter confusion avec HTML réel
EMOJI_PLACEHOLDER = "<EMOJI_{index}/>"

# Marqueur pour les sauts de ligne (pour préservation explicite)
NEWLINE_MARKER = "__NL__"

class TextSegmenter:
    """Gère la segmentation de texte pour traduction avec préservation de structure"""

    def __init__(self, max_segment_length: int = 100):
        """
        Args:
            max_segment_length: Nombre maximum de caractères par segment (en dessous de max_length du modèle)
        """
        self.max_segment_length = max_segment_length

    def extract_emojis(self, text: str) -> Tuple[str, Dict[int, str]]:
        """
        Extrait TOUS les emojis (y compris complexes avec ZWJ, modificateurs de peau, etc.)
        et les remplace par des marqueurs robustes

        Returns:
            (texte_sans_emojis, mapping_index_vers_emoji)
        """
        emojis_map = {}
        emoji_index = 0

        # Log du texte avant extraction
        logger.debug(f"[SEGMENTER] Texte avant extraction emojis: {repr(text[:100])}")

        def replacer(match):
            nonlocal emoji_index
            emoji = match.group(0)
            # Log chaque emoji extrait avec son code Unicode pour debug
            emoji_codes = ' '.join([f'U+{ord(c):04X}' for c in emoji])
            logger.debug(f"[SEGMENTER] Emoji {emoji_index} extrait: {emoji} ({emoji_codes})")

            emojis_map[emoji_index] = emoji
            placeholder = EMOJI_PLACEHOLDER.format(index=emoji_index)
            emoji_index += 1
            return placeholder

        text_without_emojis = EMOJI_PATTERN.sub(replacer, text)

        if emojis_map:
            logger.info(f"[SEGMENTER] ✅ Extracted {len(emojis_map)} emojis: {list(emojis_map.values())}")
        else:
            logger.debug(f"[SEGMENTER] ℹ️  No emojis found in text")

        # Vérification: s'assurer qu'aucun emoji n'est resté
        remaining_emojis = EMOJI_PATTERN.findall(text_without_emojis)
        if remaining_emojis:
            logger.warning(f"[SEGMENTER] ⚠️  {len(remaining_emojis)} emojis NOT extracted: {remaining_emojis}")

        return text_without_emojis, emojis_map

    def restore_emojis(self, text: str, emojis_map: Dict[int, str]) -> str:
        """
        Restaure TOUS les emojis à partir des marqueurs avec vérification
        """
        result = text
        restored_count = 0
        not_found_placeholders = []

        for index, emoji in emojis_map.items():
            placeholder = EMOJI_PLACEHOLDER.format(index=index)

            # Vérifier si le placeholder est présent
            if placeholder in result:
                result = result.replace(placeholder, emoji)
                restored_count += 1
                logger.debug(f"[SEGMENTER] Emoji {index} restauré: {emoji}")
            else:
                not_found_placeholders.append((index, emoji, placeholder))
                logger.warning(f"[SEGMENTER] ⚠️  Placeholder {placeholder} NOT FOUND for emoji {emoji}")

        # Log final
        if emojis_map:
            logger.info(f"[SEGMENTER] ✅ Restored {restored_count}/{len(emojis_map)} emojis")

        if not_found_placeholders:
            logger.error(f"[SEGMENTER] ❌ {len(not_found_placeholders)} emojis NOT restored:")
            for idx, emoji, placeholder in not_found_placeholders:
                logger.error(f"    - Index {idx}: {emoji} (placeholder: {placeholder})")

        # Vérification finale: s'assurer qu'il ne reste aucun placeholder
        remaining_placeholders = re.findall(r'<EMOJI_\d+/>', result)
        if remaining_placeholders:
            logger.error(f"[SEGMENTER] ❌ {len(remaining_placeholders)} placeholders NOT replaced: {remaining_placeholders}")

        return result

    def is_list_item(self, line: str) -> bool:
        """
        Détecte si une ligne est un élément de liste

        Patterns reconnus:
        - Tirets: -, •, *, →
        - Numéros: 1., 2., 3., etc.
        - Lettres: a), b), c)
        - Lettres romaines: I), II), III), etc.
        """
        stripped = line.strip()
        if not stripped:
            return False

        # Pattern pour listes à puces
        bullet_pattern = r'^[+-•*→]\s+'
        # Pattern pour listes numérotées (1., 2., etc.)
        numbered_pattern = r'^\d+\.\s+'
        # Pattern pour listes avec lettres (a), b), etc.)
        lettered_pattern = r'^[a-z]\)\s+'
        # Pattern pour listes avec lettres (I), II), etc.)
        roman_lettered_pattern = r'^[IVXLCDM]+\)\s+'

        return (re.match(bullet_pattern, stripped) is not None or
                re.match(numbered_pattern, stripped) is not None or
                re.match(lettered_pattern, stripped) is not None or
                re.match(roman_lettered_pattern, stripped) is not None)

    def segment_by_sentences_and_lines(self, text: str) -> List[Tuple[str, str]]:
        """
        Segmente le texte avec priorité aux paragraphes et retours à la ligne :
        - PRIORITÉ 1: Découper par paragraphes (double \\n ou plus)
        - PRIORITÉ 2: Préserver chaque retour à la ligne dans un paragraphe
        - Chaque paragraphe est traduit comme une unité cohérente
        - Les lignes individuelles au sein d'un paragraphe sont préservées

        Returns:
            Liste de tuples (segment, type)
            - type: 'paragraph' (paragraphe complet), 'line' (ligne simple), 
                   'list_item' (élément de liste), 'paragraph_break' (double \\n), 
                   'empty_line' (ligne vide)
        """
        # Séparer en paragraphes (par double \n ou plus)
        # On considère 2+ sauts de ligne comme séparateur de paragraphe
        paragraphs = re.split(r'\n\s*\n+', text)

        segments = []

        for para_idx, paragraph in enumerate(paragraphs):
            if not paragraph.strip():
                continue

            # Ajouter séparateur de paragraphe sauf pour le premier
            if para_idx > 0:
                segments.append(("", "paragraph_break"))

            # Traiter le paragraphe entier comme une unité
            # Cela permet de préserver le contexte pour une meilleure traduction
            paragraph = paragraph.strip()
            
            # Vérifier si le paragraphe contient des éléments de liste
            lines = paragraph.split('\n')
            has_list_items = any(self.is_list_item(line.strip()) for line in lines)
            
            if has_list_items:
                # Si c'est une liste, traiter chaque élément séparément pour préserver la structure
                for line in lines:
                    line_stripped = line.strip()
                    if not line_stripped:
                        continue
                    
                    if self.is_list_item(line_stripped):
                        segments.append((line, "list_item"))
                    else:
                        segments.append((line, "line"))
            else:
                # Paragraphe normal sans liste: le traiter comme une unité complète
                # Cela permet au modèle de mieux comprendre le contexte
                segments.append((paragraph, "paragraph"))

        logger.debug(f"[SEGMENTER] Segmented into {len(segments)} parts (paragraphs and lines)")
        return segments

    def segment_by_sentences(self, text: str) -> List[str]:
        """
        Segmente un paragraphe en phrases si trop long
        Préserve les sauts de ligne simples
        """
        # Si le texte est court, retourner tel quel
        if len(text) <= self.max_segment_length:
            return [text]

        # Remplacer temporairement les sauts de ligne simples
        text_with_markers = text.replace('\n', NEWLINE_MARKER)

        # Découper par phrases (., !, ?, ;)
        sentences = re.split(r'([.!?;]+\s+)', text_with_markers)

        # Regrouper les phrases avec leur ponctuation
        segments = []
        current_segment = ""

        for i, part in enumerate(sentences):
            # Les indices pairs sont les phrases, impairs sont les séparateurs
            if i % 2 == 0:
                current_segment += part
            else:
                current_segment += part

                # Si le segment est assez long, l'ajouter
                if len(current_segment) >= self.max_segment_length * 0.7:
                    segments.append(current_segment.strip())
                    current_segment = ""

        # Ajouter le dernier segment s'il existe
        if current_segment.strip():
            segments.append(current_segment.strip())

        # Restaurer les sauts de ligne
        segments = [s.replace(NEWLINE_MARKER, '\n') for s in segments]

        logger.debug(f"[SEGMENTER] Split long paragraph into {len(segments)} sentences")
        return segments if segments else [text]

    def segment_text(self, text: str) -> Tuple[List[Dict], Dict[int, str]]:
        """
        Segmente le texte intelligemment en préservant la structure

        Returns:
            (liste_segments, mapping_emojis)
            Chaque segment est un dict: {
                'text': str,
                'type': 'sentence' | 'list_item' | 'paragraph_break',
                'index': int
            }
        """
        # 1. Extraire les emojis
        text_no_emojis, emojis_map = self.extract_emojis(text)

        # 2. Segmenter intelligemment (phrases + listes)
        parts = self.segment_by_sentences_and_lines(text_no_emojis)

        # 3. Créer les segments
        segments = []
        segment_index = 0

        for part_text, part_type in parts:
            segments.append({
                'text': part_text,
                'type': part_type,
                'index': segment_index
            })
            segment_index += 1

        logger.info(f"[SEGMENTER] Text segmented into {len(segments)} parts ({len([s for s in segments if s['type'] in ['line', 'sentence', 'list_item']])} translatable) with {len(emojis_map)} emojis")
        return segments, emojis_map

    def reassemble_text(self, translated_segments: List[Dict], emojis_map: Dict[int, str]) -> str:
        """
        Réassemble les segments traduits en préservant la structure

        Args:
            translated_segments: Liste de segments avec 'text' et 'type'
            emojis_map: Mapping des emojis à restaurer
        """
        result_parts = []

        for i, segment in enumerate(translated_segments):
            segment_type = segment['type']
            segment_text = segment['text']

            if segment_type == 'paragraph_break':
                # Ajouter une ligne vide pour créer le double \n
                result_parts.append('\n\n')
            elif segment_type == 'paragraph':
                # Paragraphe complet - préserver les sauts de ligne internes
                if i > 0 and translated_segments[i-1]['type'] not in ['paragraph_break']:
                    # Pas le premier élément et pas après un paragraph_break
                    # Ajouter un saut de ligne avant
                    result_parts.append('\n')
                result_parts.append(segment_text)
            elif segment_type in ['line', 'sentence', 'list_item']:
                # Ajouter le contenu avec saut de ligne
                if i > 0 and translated_segments[i-1]['type'] not in ['paragraph_break']:
                    # Pas le premier élément et pas après un paragraph_break
                    # Ajouter un saut de ligne avant
                    result_parts.append('\n')
                result_parts.append(segment_text)

        # Joindre toutes les parties
        reassembled = ''.join(result_parts)

        # Restaurer les emojis
        final_text = self.restore_emojis(reassembled, emojis_map)

        logger.info(f"[SEGMENTER] Text reassembled: {len(final_text)} chars from {len(translated_segments)} segments")
        return final_text


def test_segmenter():
    """Test du segmenteur"""
    segmenter = TextSegmenter(max_segment_length=50)

    test_text = """Hello! 😊 How are you today?

This is a new paragraph with some emojis 🎉🎊.

And this is the final paragraph! 🚀"""

    print("Original text:")
    print(test_text)
    print("\n" + "="*50 + "\n")

    # Segmenter
    segments, emojis = segmenter.segment_text(test_text)

    print("Segments:")
    for seg in segments:
        print(f"[{seg['type']}] {repr(seg['text'])}")

    print(f"\nEmojis extracted: {emojis}")

    # Simuler une traduction (garder tel quel)
    translated = [{'text': s['text'], 'type': s['type'], 'index': s['index']} for s in segments]

    # Réassembler
    result = segmenter.reassemble_text(translated, emojis)

    print("\n" + "="*50 + "\n")
    print("Reassembled text:")
    print(result)

    print("\n" + "="*50 + "\n")
    print(f"Match original: {result == test_text}")


if __name__ == "__main__":
    test_segmenter()
