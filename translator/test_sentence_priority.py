"""
Test pour vérifier que les phrases complètes sont prioritaires sur les lignes
Une phrase qui s'étend sur plusieurs lignes doit être traduite en un seul segment
"""

import sys
sys.path.insert(0, 'src')

from utils.text_segmentation import TextSegmenter

def test_multiline_sentence():
    """Test avec une phrase sur plusieurs lignes"""
    segmenter = TextSegmenter(max_segment_length=100)

    text = """Ceci est une très longue phrase qui
s'étend sur plusieurs lignes mais
qui se termine seulement ici.

Nouvelle phrase courte."""

    print("\n" + "="*80)
    print("TEST 1: PHRASE SUR PLUSIEURS LIGNES")
    print("="*80)
    print("\n📝 ORIGINAL:")
    print(text)

    # Segmenter
    segments, emojis = segmenter.segment_text(text)

    print(f"\n📊 SEGMENTATION:")
    print(f"Total segments: {len(segments)}")

    print(f"\n🔍 DÉTAIL DES SEGMENTS:")
    for i, seg in enumerate(segments):
        seg_type = seg['type']
        seg_text = seg['text']
        if seg_type == 'sentence':
            print(f"  {i}. [SENTENCE] '{seg_text}'")
        elif seg_type == 'list_item':
            print(f"  {i}. [LIST_ITEM] '{seg_text}'")
        elif seg_type == 'paragraph_break':
            print(f"  {i}. [PARAGRAPH_BREAK]")

    # Simuler traduction
    translated_segments = []
    for seg in segments:
        if seg['type'] == 'paragraph_break':
            translated_segments.append(seg)
        else:
            # Traduction simulée
            t = seg['text']
            t = t.replace('Ceci est une très longue phrase qui', 'This is a very long sentence that')
            t = t.replace("s'étend sur plusieurs lignes mais", "spans multiple lines but")
            t = t.replace('qui se termine seulement ici', 'only ends here')
            t = t.replace('Nouvelle phrase courte', 'New short sentence')

            translated_segments.append({
                'text': t,
                'type': seg['type'],
                'index': seg['index']
            })

    # Réassembler
    result = segmenter.reassemble_text(translated_segments, emojis)

    print(f"\n🌐 RÉSULTAT TRADUIT:")
    print(result)

    # Vérifications
    print(f"\n✅ VÉRIFICATIONS:")
    sentence_segments = [s for s in segments if s['type'] == 'sentence']
    print(f"  Nombre de phrases détectées: {len(sentence_segments)}")
    print(f"  Phrase 1 est complète (3 lignes en 1): {'✅ OUI' if 'longue phrase' in sentence_segments[0]['text'] and 'plusieurs lignes' in sentence_segments[0]['text'] else '❌ NON'}")

    print("="*80)


def test_list_vs_sentence():
    """Test avec listes et phrases mixtes"""
    segmenter = TextSegmenter(max_segment_length=100)

    text = """Introduction au projet qui
continue sur cette ligne.

Points importants:
- Premier point 🎯
- Deuxième point 🌟
- Troisième point ✨

Conclusion finale."""

    print("\n" + "="*80)
    print("TEST 2: LISTES ET PHRASES MIXTES")
    print("="*80)
    print("\n📝 ORIGINAL:")
    print(text)

    # Segmenter
    segments, emojis = segmenter.segment_text(text)

    print(f"\n📊 SEGMENTATION:")
    print(f"Total segments: {len(segments)}")
    print(f"Emojis: {len(emojis)}")

    print(f"\n🔍 DÉTAIL DES SEGMENTS:")
    for i, seg in enumerate(segments):
        seg_type = seg['type']
        seg_text = seg['text'][:50] if seg['text'] else ""
        if seg_type == 'sentence':
            print(f"  {i}. [SENTENCE] '{seg_text}...'")
        elif seg_type == 'list_item':
            print(f"  {i}. [LIST_ITEM] '{seg_text}...'")
        elif seg_type == 'paragraph_break':
            print(f"  {i}. [PARAGRAPH_BREAK]")

    # Vérifications
    print(f"\n✅ VÉRIFICATIONS:")
    sentence_segments = [s for s in segments if s['type'] == 'sentence']
    list_segments = [s for s in segments if s['type'] == 'list_item']

    print(f"  Phrases: {len(sentence_segments)}")
    print(f"  Éléments de liste: {len(list_segments)}")
    print(f"  Phrase intro est complète (2 lignes): {'✅ OUI' if 'continue sur cette ligne' in sentence_segments[0]['text'] else '❌ NON'}")
    print(f"  3 éléments de liste: {'✅ OUI' if len(list_segments) == 3 else '❌ NON'}")

    print("="*80)


def test_no_punctuation_multiline():
    """Test avec texte sur plusieurs lignes sans ponctuation finale"""
    segmenter = TextSegmenter(max_segment_length=100)

    text = """Ceci est une phrase
qui continue
et continue encore

- Liste élément 1
- Liste élément 2"""

    print("\n" + "="*80)
    print("TEST 3: PHRASE SANS PONCTUATION SUR PLUSIEURS LIGNES")
    print("="*80)
    print("\n📝 ORIGINAL:")
    print(text)

    # Segmenter
    segments, emojis = segmenter.segment_text(text)

    print(f"\n📊 SEGMENTATION:")
    print(f"Total segments: {len(segments)}")

    print(f"\n🔍 DÉTAIL DES SEGMENTS:")
    for i, seg in enumerate(segments):
        seg_type = seg['type']
        seg_text = seg['text']
        if seg_type == 'sentence':
            print(f"  {i}. [SENTENCE] '{seg_text}'")
        elif seg_type == 'list_item':
            print(f"  {i}. [LIST_ITEM] '{seg_text}'")
        elif seg_type == 'paragraph_break':
            print(f"  {i}. [PARAGRAPH_BREAK]")

    # Vérifications
    print(f"\n✅ VÉRIFICATIONS:")
    sentence_segments = [s for s in segments if s['type'] == 'sentence']
    list_segments = [s for s in segments if s['type'] == 'list_item']

    print(f"  Phrases: {len(sentence_segments)}")
    print(f"  Phrase regroupe les 3 lignes: {'✅ OUI' if 'continue et continue encore' in sentence_segments[0]['text'] else '❌ NON'}")
    print(f"  Liste a 2 éléments: {'✅ OUI' if len(list_segments) == 2 else '❌ NON'}")

    print("="*80)


if __name__ == "__main__":
    print("\n" + "="*80)
    print("TESTS DE PRIORITÉ PHRASE COMPLÈTE vs LIGNE")
    print("="*80)

    test_multiline_sentence()
    test_list_vs_sentence()
    test_no_punctuation_multiline()

    print("\n" + "="*80)
    print("✅ TESTS TERMINÉS!")
    print("="*80 + "\n")
