"""
Module de segmentation de texte pour traduction structurée
Préserve les paragraphes, sauts de ligne et emojis dans les traductions
"""

import re
from typing import List, Tuple, Dict
import logging

logger = logging.getLogger(__name__)

# Regex pour identifier les emojis (Unicode ranges)
EMOJI_PATTERN = re.compile(
    "["
    "\U0001F600-\U0001F64F"  # emoticons
    "\U0001F300-\U0001F5FF"  # symbols & pictographs
    "\U0001F680-\U0001F6FF"  # transport & map symbols
    "\U0001F1E0-\U0001F1FF"  # flags (iOS)
    "\U00002702-\U000027B0"  # dingbats
    "\U000024C2-\U0001F251"
    "\U0001F900-\U0001F9FF"  # supplemental symbols
    "\U0001FA00-\U0001FAFF"  # extended pictographs
    "]+",
    flags=re.UNICODE
)

# Marqueur spécial pour les emojis (utilise format XML qui survit aux tokenizers)
# Format: __EMOJI_X__ où X est l'index
# Les underscores doubles + majuscules sont généralement préservés par les tokenizers
EMOJI_PLACEHOLDER = "__EMOJI_{index}__"

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
        Extrait les emojis et les remplace par des marqueurs

        Returns:
            (texte_sans_emojis, mapping_index_vers_emoji)
        """
        emojis_map = {}
        emoji_index = 0

        def replacer(match):
            nonlocal emoji_index
            emoji = match.group(0)
            emojis_map[emoji_index] = emoji
            placeholder = EMOJI_PLACEHOLDER.format(index=emoji_index)
            emoji_index += 1
            return placeholder

        text_without_emojis = EMOJI_PATTERN.sub(replacer, text)

        if emojis_map:
            logger.debug(f"[SEGMENTER] Extracted {len(emojis_map)} emojis: {emojis_map}")

        return text_without_emojis, emojis_map

    def restore_emojis(self, text: str, emojis_map: Dict[int, str]) -> str:
        """
        Restaure les emojis à partir des marqueurs
        """
        result = text
        for index, emoji in emojis_map.items():
            placeholder = EMOJI_PLACEHOLDER.format(index=index)
            result = result.replace(placeholder, emoji)

        return result

    def segment_by_lines(self, text: str) -> List[Tuple[str, str]]:
        """
        Segmente le texte ligne par ligne pour préserver les listes et la structure

        Returns:
            Liste de tuples (segment, type)
            - segment: texte de la ligne
            - type: 'line' (ligne avec contenu) ou 'empty_line' (ligne vide) ou 'paragraph_break' (double \n)
        """
        # Séparer le texte en lignes individuelles
        lines = text.split('\n')

        segments = []
        i = 0
        while i < len(lines):
            line = lines[i]

            # Vérifier si c'est une ligne vide
            if not line.strip():
                # Compter les lignes vides consécutives
                empty_count = 1
                while i + empty_count < len(lines) and not lines[i + empty_count].strip():
                    empty_count += 1

                # Si plusieurs lignes vides = séparateur de paragraphes
                if empty_count >= 1:
                    segments.append(("", "paragraph_break"))
                    i += empty_count
                else:
                    segments.append(("", "empty_line"))
                    i += 1
            else:
                # Ligne avec contenu
                segments.append((line, "line"))
                i += 1

        logger.debug(f"[SEGMENTER] Split into {len(segments)} lines")
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
        Segmente le texte complet ligne par ligne en préservant la structure

        Returns:
            (liste_segments, mapping_emojis)
            Chaque segment est un dict: {
                'text': str,
                'type': 'line' | 'empty_line' | 'paragraph_break',
                'index': int
            }
        """
        # 1. Extraire les emojis
        text_no_emojis, emojis_map = self.extract_emojis(text)

        # 2. Segmenter ligne par ligne
        lines = self.segment_by_lines(text_no_emojis)

        # 3. Créer les segments
        segments = []
        segment_index = 0

        for line_text, line_type in lines:
            segments.append({
                'text': line_text,
                'type': line_type,
                'index': segment_index
            })
            segment_index += 1

        logger.info(f"[SEGMENTER] Text segmented into {len(segments)} lines with {len(emojis_map)} emojis")
        return segments, emojis_map

    def reassemble_text(self, translated_segments: List[Dict], emojis_map: Dict[int, str]) -> str:
        """
        Réassemble les segments traduits ligne par ligne en préservant la structure

        Args:
            translated_segments: Liste de segments avec 'text' et 'type'
            emojis_map: Mapping des emojis à restaurer
        """
        result_lines = []

        for i, segment in enumerate(translated_segments):
            segment_type = segment['type']
            segment_text = segment['text']

            if segment_type == 'line':
                # Ligne avec contenu
                result_lines.append(segment_text)
            elif segment_type in ['paragraph_break', 'empty_line']:
                # Ligne vide (simple ou double)
                result_lines.append('')

        # Joindre toutes les lignes avec \n
        reassembled = '\n'.join(result_lines)

        # Restaurer les emojis
        final_text = self.restore_emojis(reassembled, emojis_map)

        logger.info(f"[SEGMENTER] Text reassembled: {len(final_text)} chars from {len(translated_segments)} lines")
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
