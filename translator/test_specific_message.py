"""
Test du message spécifique avec fichiers non utilisés
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from utils.text_segmentation import TextSegmenter

def test_unused_files_message():
    """Test avec le message des fichiers non utilisés"""

    # Message original de l'utilisateur
    test_text = """Fichiers NON UTILISÉS Confirmés (3 fichiers)
use-anonymous-messages.ts

❌ Aucun import en production
Uniquement référencé dans scripts d'analyse temporaires
use-translation-performance.ts

❌ Aucun import en production
Dépend de advanced-translation.service (lui aussi non utilisé)."""

    print("=" * 80)
    print("TEXTE ORIGINAL:")
    print("=" * 80)
    print(test_text)
    print("\n")

    # Créer le segmenteur
    segmenter = TextSegmenter(max_segment_length=100)

    # Segmenter le texte
    segments, emojis_map = segmenter.segment_text(test_text)

    print("=" * 80)
    print(f"SEGMENTS ({len(segments)} segments trouvés):")
    print("=" * 80)
    for i, segment in enumerate(segments):
        seg_type = segment['type']
        seg_text = segment['text']
        if seg_type == 'paragraph_break':
            print(f"{i+1}. [{seg_type:15}] <PARAGRAPH_BREAK>")
        else:
            print(f"{i+1}. [{seg_type:15}] {repr(seg_text)}")

    print("\n")
    print("=" * 80)
    print("ÉMOJIS EXTRAITS:")
    print("=" * 80)
    print(f"Nombre d'émojis: {len(emojis_map)}")
    for idx, emoji in emojis_map.items():
        print(f"  {idx}: {emoji}")

    # Simuler une "traduction" (on garde le même texte pour vérifier la structure)
    translated_segments = []
    for segment in segments:
        translated_segments.append({
            'text': segment['text'],
            'type': segment['type'],
            'index': segment['index']
        })

    # Réassembler
    reassembled = segmenter.reassemble_text(translated_segments, emojis_map)

    print("\n")
    print("=" * 80)
    print("TEXTE RÉASSEMBLÉ:")
    print("=" * 80)
    print(reassembled)

    print("\n")
    print("=" * 80)
    print("VÉRIFICATION:")
    print("=" * 80)

    # Comparer ligne par ligne
    original_lines = test_text.split('\n')
    reassembled_lines = reassembled.split('\n')

    print(f"Lignes originales: {len(original_lines)}")
    print(f"Lignes réassemblées: {len(reassembled_lines)}")
    print(f"Match parfait: {test_text == reassembled}")

    if test_text != reassembled:
        print("\nDIFFÉRENCES DÉTAILLÉES:")
        max_lines = max(len(original_lines), len(reassembled_lines))
        for i in range(max_lines):
            orig = original_lines[i] if i < len(original_lines) else "<MANQUANT>"
            reasm = reassembled_lines[i] if i < len(reassembled_lines) else "<MANQUANT>"

            match_symbol = "✅" if orig == reasm else "❌"
            print(f"\n  Ligne {i+1} {match_symbol}:")
            print(f"    Original:    {repr(orig)}")
            print(f"    Réassemblé:  {repr(reasm)}")

    print("\n")
    print("=" * 80)
    print("NOMBRE DE RETOURS À LA LIGNE:")
    print("=" * 80)
    original_newlines = test_text.count('\n')
    reassembled_newlines = reassembled.count('\n')
    print(f"Original:    {original_newlines} retours à la ligne")
    print(f"Réassemblé:  {reassembled_newlines} retours à la ligne")

    if original_newlines == reassembled_newlines:
        print(f"✅ PRÉSERVATION DES RETOURS À LA LIGNE: OUI")
    else:
        print(f"❌ PRÉSERVATION DES RETOURS À LA LIGNE: NON")
        print(f"   Différence: {reassembled_newlines - original_newlines:+d}")

    # Vérifier les paragraphes (double \n)
    print("\n")
    print("=" * 80)
    print("NOMBRE DE PARAGRAPHES (double \\n):")
    print("=" * 80)
    original_double_newlines = test_text.count('\n\n')
    reassembled_double_newlines = reassembled.count('\n\n')
    print(f"Original:    {original_double_newlines} doubles retours")
    print(f"Réassemblé:  {reassembled_double_newlines} doubles retours")

    if original_double_newlines == reassembled_double_newlines:
        print(f"✅ PRÉSERVATION DES PARAGRAPHES: OUI")
    else:
        print(f"❌ PRÉSERVATION DES PARAGRAPHES: NON")
        print(f"   Différence: {reassembled_double_newlines - original_double_newlines:+d}")

if __name__ == "__main__":
    test_unused_files_message()
