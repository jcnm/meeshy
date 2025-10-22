"""
Test de traduction avec listes (retours à la ligne simples)
"""

import sys
sys.path.insert(0, 'src')

from utils.text_segmentation import TextSegmenter

def test_lists_structure():
    """Test avec des listes à puces"""
    segmenter = TextSegmenter(max_segment_length=100)

    text = """Voici les fonctionnalités: 🎉

- Traduction en temps réel 🌍
- Support multi-langues 🗣️
- Préservation des emojis ✨

Merci! 🙏"""

    print("\n" + "="*80)
    print("TEST: MESSAGE AVEC LISTE À PUCES")
    print("="*80)
    print("\n📝 ORIGINAL:")
    print(text)
    print(f"\nNombre de lignes: {len(text.split(chr(10)))}")
    print(f"Nombre de paragraphes (\\n\\n): {len(text.split(chr(10)+chr(10)))}")

    # Segmenter
    segments, emojis = segmenter.segment_text(text)

    print(f"\n📊 SEGMENTATION:")
    print(f"Total segments: {len(segments)}")
    print(f"Emojis extraits: {len(emojis)} → {list(emojis.values())}")

    print(f"\n🔍 DÉTAIL DES SEGMENTS:")
    for i, seg in enumerate(segments):
        seg_type = seg['type']
        seg_text = seg['text']
        if seg_type == 'line':
            print(f"  {i}. [LINE] '{seg_text}'")
        elif seg_type == 'paragraph_break':
            print(f"  {i}. [PARAGRAPH_BREAK]")
        elif seg_type == 'empty_line':
            print(f"  {i}. [EMPTY_LINE]")

    # Simuler traduction (garder tel quel pour test de structure)
    translated_segments = []
    for seg in segments:
        if seg['type'] in ['paragraph_break', 'empty_line']:
            translated_segments.append(seg)
        else:
            # Simuler une traduction simple
            translated_text = seg['text'].replace('Voici', 'Here are')
            translated_text = translated_text.replace('Traduction', 'Translation')
            translated_text = translated_text.replace('temps réel', 'real-time')
            translated_text = translated_text.replace('Support', 'Support')
            translated_text = translated_text.replace('multi-langues', 'multi-language')
            translated_text = translated_text.replace('Préservation', 'Preservation')
            translated_text = translated_text.replace('des emojis', 'of emojis')
            translated_text = translated_text.replace('Merci', 'Thank you')

            translated_segments.append({
                'text': translated_text,
                'type': seg['type'],
                'index': seg['index']
            })

    # Réassembler
    result = segmenter.reassemble_text(translated_segments, emojis)

    print(f"\n🌐 RÉSULTAT TRADUIT:")
    print(result)

    # Vérifications
    print(f"\n✅ VÉRIFICATIONS:")
    original_lines = text.split('\n')
    result_lines = result.split('\n')

    print(f"  Lignes originales: {len(original_lines)}")
    print(f"  Lignes traduites: {len(result_lines)}")
    print(f"  Structure préservée: {'✅ OUI' if len(original_lines) == len(result_lines) else '❌ NON'}")

    # Vérifier les emojis
    import re
    emoji_pattern = re.compile("[\U0001F600-\U0001F64F\U0001F300-\U0001F5FF\U0001F680-\U0001F6FF\U0001F1E0-\U0001F1FF\U00002702-\U000027B0\U000024C2-\U0001F251\U0001F900-\U0001F9FF\U0001FA00-\U0001FAFF]+")
    original_emojis = emoji_pattern.findall(text)
    result_emojis = emoji_pattern.findall(result)

    print(f"  Emojis originaux: {original_emojis}")
    print(f"  Emojis traduits: {result_emojis}")
    print(f"  Emojis préservés: {'✅ OUI' if original_emojis == result_emojis else '❌ NON'}")

    # Vérifier que les lignes de liste sont préservées
    original_list_items = [line for line in original_lines if line.strip().startswith('-')]
    result_list_items = [line for line in result_lines if line.strip().startswith('-')]

    print(f"  Éléments de liste originaux: {len(original_list_items)}")
    print(f"  Éléments de liste traduits: {len(result_list_items)}")
    print(f"  Liste préservée: {'✅ OUI' if len(original_list_items) == len(result_list_items) else '❌ NON'}")

    print("="*80)


def test_complex_list():
    """Test avec liste numérotée et paragraphes"""
    segmenter = TextSegmenter(max_segment_length=100)

    text = """Introduction au projet 🚀

Voici le plan:
1. Phase de conception 📝
2. Développement 💻
3. Tests et validation ✅

Chaque phase est importante.

Conclusion finale 🎉"""

    print("\n" + "="*80)
    print("TEST: LISTE NUMÉROTÉE AVEC PARAGRAPHES")
    print("="*80)
    print("\n📝 ORIGINAL:")
    print(text)

    # Segmenter
    segments, emojis = segmenter.segment_text(text)

    print(f"\n📊 SEGMENTATION:")
    print(f"Total segments: {len(segments)}")
    print(f"Emojis extraits: {len(emojis)}")

    print(f"\n🔍 STRUCTURE:")
    for i, seg in enumerate(segments):
        seg_type = seg['type']
        seg_text = seg['text'][:40] if seg['text'] else ""
        if seg_type == 'line':
            print(f"  {i}. [LINE] '{seg_text}...'")
        elif seg_type == 'paragraph_break':
            print(f"  {i}. [PARAGRAPH_BREAK]")

    # Simuler traduction
    translated_segments = []
    for seg in segments:
        if seg['type'] in ['paragraph_break', 'empty_line']:
            translated_segments.append(seg)
        else:
            # Traduction simulée
            t = seg['text']
            t = t.replace('Introduction', 'Introduction to')
            t = t.replace('au projet', 'the project')
            t = t.replace('Voici le plan', 'Here is the plan')
            t = t.replace('Phase de conception', 'Design phase')
            t = t.replace('Développement', 'Development')
            t = t.replace('Tests et validation', 'Testing and validation')
            t = t.replace('Chaque phase est importante', 'Each phase is important')
            t = t.replace('Conclusion finale', 'Final conclusion')

            translated_segments.append({
                'text': t,
                'type': seg['type'],
                'index': seg['index']
            })

    # Réassembler
    result = segmenter.reassemble_text(translated_segments, emojis)

    print(f"\n🌐 RÉSULTAT:")
    print(result)

    # Vérifications
    original_lines = text.split('\n')
    result_lines = result.split('\n')

    print(f"\n✅ VÉRIFICATIONS:")
    print(f"  Lignes: {len(original_lines)} → {len(result_lines)} {'✅' if len(original_lines) == len(result_lines) else '❌'}")

    # Paragraphes
    original_paragraphs = text.split('\n\n')
    result_paragraphs = result.split('\n\n')
    print(f"  Paragraphes: {len(original_paragraphs)} → {len(result_paragraphs)} {'✅' if len(original_paragraphs) == len(result_paragraphs) else '❌'}")

    print("="*80)


if __name__ == "__main__":
    print("\n" + "="*80)
    print("TESTS DE TRADUCTION AVEC LISTES")
    print("="*80)

    test_lists_structure()
    test_complex_list()

    print("\n" + "="*80)
    print("✅ TESTS TERMINÉS!")
    print("="*80 + "\n")
