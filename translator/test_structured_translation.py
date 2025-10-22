"""
Test de la traduction structurée avec préservation de paragraphes et emojis
"""

import sys
sys.path.insert(0, 'src')

from utils.text_segmentation import TextSegmenter

def test_simple_emoji():
    """Test avec emojis simples"""
    segmenter = TextSegmenter(max_segment_length=50)

    text = "Hello! 😊 How are you today? 🎉"
    print("\n" + "="*60)
    print("TEST 1: Simple text with emojis")
    print("="*60)
    print(f"Original: {text}")

    segments, emojis = segmenter.segment_text(text)
    print(f"\nExtracted {len(emojis)} emojis: {emojis}")
    print(f"Segments: {len(segments)}")
    for seg in segments:
        print(f"  [{seg['type']}] {repr(seg['text'])}")

    # Simuler traduction (garder tel quel)
    translated_segments = segments.copy()
    result = segmenter.reassemble_text(translated_segments, emojis)

    print(f"\nReassembled: {result}")
    print(f"Match: {result == text}")

def test_paragraphs():
    """Test avec paragraphes multiples"""
    segmenter = TextSegmenter(max_segment_length=50)

    text = """Bonjour à tous! 👋

Comment allez-vous aujourd'hui?

Voici le dernier paragraphe avec des emojis 🎊🎉🚀"""

    print("\n" + "="*60)
    print("TEST 2: Multiple paragraphs with emojis")
    print("="*60)
    print(f"Original:\n{text}")

    segments, emojis = segmenter.segment_text(text)
    print(f"\nExtracted {len(emojis)} emojis: {emojis}")
    print(f"Segments: {len(segments)}")
    for seg in segments:
        print(f"  [{seg['type']}] {repr(seg['text'][:40])}")

    # Simuler traduction (garder tel quel)
    translated_segments = segments.copy()
    result = segmenter.reassemble_text(translated_segments, emojis)

    print(f"\nReassembled:\n{result}")
    print(f"\nMatch: {result.strip() == text.strip()}")

def test_long_text():
    """Test avec texte long"""
    segmenter = TextSegmenter(max_segment_length=50)

    text = """Voici un message très long avec plusieurs paragraphes! 😊

Le premier paragraphe contient des informations importantes sur le projet Meeshy. C'est une plateforme de messagerie multilingue innovante. 🌐

Le deuxième paragraphe explique les fonctionnalités:
- Traduction automatique 🌍
- Support multi-langues 🗣️
- Préservation des emojis ✨

Et voici le dernier paragraphe avec une conclusion! 🎉🚀"""

    print("\n" + "="*60)
    print("TEST 3: Long text with multiple paragraphs and structure")
    print("="*60)
    print(f"Original ({len(text)} chars):\n{text}")

    segments, emojis = segmenter.segment_text(text)
    print(f"\nExtracted {len(emojis)} emojis: {list(emojis.values())}")
    print(f"Segments: {len(segments)}")
    for i, seg in enumerate(segments):
        if seg['type'] == 'empty_line':
            print(f"  {i}. [EMPTY LINE]")
        else:
            print(f"  {i}. [{seg['type']}] {repr(seg['text'][:40])}...")

    # Simuler traduction (garder tel quel)
    translated_segments = segments.copy()
    result = segmenter.reassemble_text(translated_segments, emojis)

    print(f"\nReassembled ({len(result)} chars):\n{result}")

    # Vérifier que les paragraphes sont préservés
    original_paragraphs = text.split('\n\n')
    result_paragraphs = result.split('\n\n')
    print(f"\nOriginal paragraphs: {len(original_paragraphs)}")
    print(f"Result paragraphs: {len(result_paragraphs)}")
    print(f"Structure preserved: {len(original_paragraphs) == len(result_paragraphs)}")

def test_edge_cases():
    """Test des cas limites"""
    segmenter = TextSegmenter(max_segment_length=50)

    print("\n" + "="*60)
    print("TEST 4: Edge cases")
    print("="*60)

    # Test 1: Texte avec uniquement des emojis
    text1 = "😊🎉🚀🌍✨"
    print(f"\n4.1. Only emojis: {text1}")
    segments1, emojis1 = segmenter.segment_text(text1)
    result1 = segmenter.reassemble_text(segments1, emojis1)
    print(f"Result: {result1}")
    print(f"Match: {result1 == text1}")

    # Test 2: Texte avec multiples sauts de ligne
    text2 = "Line 1\n\n\n\nLine 2"
    print(f"\n4.2. Multiple newlines: {repr(text2)}")
    segments2, emojis2 = segmenter.segment_text(text2)
    print(f"Segments: {len(segments2)}")
    for seg in segments2:
        print(f"  [{seg['type']}] {repr(seg['text'])}")

    # Test 3: Texte avec emoji au milieu d'une phrase
    text3 = "Hello 😊 this is 🎉 a test 🚀 with emojis"
    print(f"\n4.3. Emojis in middle: {text3}")
    segments3, emojis3 = segmenter.segment_text(text3)
    result3 = segmenter.reassemble_text(segments3, emojis3)
    print(f"Result: {result3}")
    print(f"Match: {result3 == text3}")

if __name__ == "__main__":
    print("\n" + "="*60)
    print("TESTS DE SEGMENTATION ET PRÉSERVATION DE STRUCTURE")
    print("="*60)

    test_simple_emoji()
    test_paragraphs()
    test_long_text()
    test_edge_cases()

    print("\n" + "="*60)
    print("TESTS TERMINÉS!")
    print("="*60 + "\n")
