"""
Test de préservation des retours à la ligne dans la segmentation
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from utils.text_segmentation import TextSegmenter

def test_line_preservation():
    """Test avec l'exemple fourni par l'utilisateur"""

    # Texte original de l'utilisateur
    test_text = """AU PROGRAMME :
 • • •
Des ateliers sur mesure quel que soit ton profil :
avec une idée, en création, en développement ou en croissance :
 •        Savoir modéliser son business et générer du profit,
 •        Développer un réseau actif et bienveillant,
 •        Marquer les esprits avec l'art du pitch,
 •        Maximiser la communication et accroître l'influence,
 •        Créer de la valeur, générer de l'impact.
Des tables-rondes sur les enjeux clés du business :
 •        Les nouvelles tendances du sport business"""

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
        print("\nDIFFÉRENCES:")
        for i, (orig, reasm) in enumerate(zip(original_lines, reassembled_lines)):
            if orig != reasm:
                print(f"  Ligne {i+1}:")
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
    print(f"✅ PRÉSERVATION DES RETOURS À LA LIGNE: {original_newlines == reassembled_newlines}")

if __name__ == "__main__":
    test_line_preservation()
