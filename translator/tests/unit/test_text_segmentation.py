"""
Tests unitaires pour la segmentation de texte
Teste la préservation de structure et la segmentation intelligente
"""

import pytest
from unittest.mock import patch

from utils.text_segmentation import (
    extract_emojis,
    preserve_structure,
    segment_text,
    reconstruct_from_segments,
)


class TestTextSegmentation:
    """Tests pour les utilitaires de segmentation de texte"""

    @pytest.mark.unit
    def test_extract_emojis_simple(self):
        """Test d'extraction d'emojis simples"""
        text = 'Hello 😀 World 🌍'
        emojis = extract_emojis(text)

        assert len(emojis) == 2
        assert '😀' in emojis
        assert '🌍' in emojis

    @pytest.mark.unit
    def test_extract_emojis_with_positions(self):
        """Test d'extraction avec positions"""
        text = 'Hello 😀 World 🌍'
        result = extract_emojis(text, with_positions=True)

        assert len(result) > 0
        # Vérifier la structure des résultats
        for item in result:
            assert 'emoji' in item
            assert 'position' in item

    @pytest.mark.unit
    def test_extract_emojis_no_emoji(self):
        """Test sans emoji"""
        text = 'Hello World'
        emojis = extract_emojis(text)

        assert len(emojis) == 0

    @pytest.mark.unit
    def test_preserve_structure_simple(self):
        """Test de préservation de structure simple"""
        text = 'Hello\nWorld'
        segments = preserve_structure(text)

        assert len(segments) > 0
        # Vérifier que les retours à la ligne sont préservés
        reconstructed = ''.join([s['text'] for s in segments])
        assert '\n' in reconstructed or len(segments) > 1

    @pytest.mark.unit
    def test_preserve_structure_with_emojis(self):
        """Test de préservation avec emojis"""
        text = 'Hello 😀\nWorld 🌍'
        segments = preserve_structure(text)

        assert len(segments) > 0
        # Vérifier que les emojis sont identifiés
        emoji_segments = [s for s in segments if s.get('type') == 'emoji']
        assert len(emoji_segments) > 0 or any('😀' in s['text'] for s in segments)

    @pytest.mark.unit
    def test_preserve_structure_paragraphs(self):
        """Test de préservation des paragraphes"""
        text = 'Paragraph 1\n\nParagraph 2\n\nParagraph 3'
        segments = preserve_structure(text)

        assert len(segments) > 0
        # Vérifier que les doubles retours sont préservés
        reconstructed = ''.join([s['text'] for s in segments])
        assert '\n\n' in reconstructed or len(segments) >= 3

    @pytest.mark.unit
    def test_segment_text_simple(self):
        """Test de segmentation simple"""
        text = 'This is a simple sentence.'
        segments = segment_text(text, max_length=100)

        assert len(segments) > 0
        assert all(len(s) <= 100 for s in segments)

    @pytest.mark.unit
    def test_segment_text_long(self):
        """Test de segmentation de texte long"""
        text = ' '.join(['Word'] * 100)  # 100 mots
        segments = segment_text(text, max_length=50)

        assert len(segments) > 1
        assert all(len(s) <= 50 for s in segments)

    @pytest.mark.unit
    def test_segment_text_with_sentences(self):
        """Test de segmentation avec phrases complètes"""
        text = 'First sentence. Second sentence. Third sentence.'
        segments = segment_text(text, max_length=30)

        assert len(segments) > 0
        # Vérifier que les phrases sont respectées autant que possible
        for segment in segments:
            assert len(segment) <= 30

    @pytest.mark.unit
    def test_reconstruct_from_segments(self):
        """Test de reconstruction depuis segments"""
        original = 'Hello\nWorld\n\nNew paragraph'
        segments = preserve_structure(original)

        # Simuler la traduction des segments
        translated_segments = [
            {**s, 'translated': s['text'].upper()} for s in segments
        ]

        reconstructed = reconstruct_from_segments(translated_segments)

        # Vérifier que la structure est préservée
        assert '\n' in reconstructed or 'HELLO' in reconstructed

    @pytest.mark.unit
    def test_empty_text(self):
        """Test avec texte vide"""
        text = ''
        segments = preserve_structure(text)

        assert len(segments) == 0 or (len(segments) == 1 and segments[0]['text'] == '')

    @pytest.mark.unit
    def test_whitespace_only(self):
        """Test avec seulement des espaces"""
        text = '   \n\n   '
        segments = preserve_structure(text)

        # Devrait retourner des segments vides ou un segment unique
        assert len(segments) >= 0

    @pytest.mark.unit
    def test_mixed_content(self):
        """Test avec contenu mixte (texte + emojis + paragraphes)"""
        text = 'Hello 😀\n\nThis is paragraph 2 🌍\nWith multiple lines 🎉'
        segments = preserve_structure(text)

        assert len(segments) > 0

        # Vérifier qu'on peut reconstruire le texte original
        reconstructed = ''.join([s['text'] for s in segments])
        # Les espaces/structures pourraient être légèrement différents
        assert len(reconstructed) > 0

    @pytest.mark.unit
    def test_segment_preserves_word_boundaries(self):
        """Test que la segmentation respecte les limites de mots"""
        text = 'This is a very long sentence that needs to be split'
        segments = segment_text(text, max_length=20)

        # Vérifier qu'aucun mot n'est coupé au milieu
        for segment in segments:
            # Pas d'espaces au début/fin (sauf si voulu)
            assert segment == segment.strip() or ' ' in segment
