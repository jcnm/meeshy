"""
Test COMPLET de préservation de TOUS les types d'emojis
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from utils.text_segmentation import TextSegmenter

def test_all_emoji_types():
    """Test exhaustif de tous les types d'emojis"""

    segmenter = TextSegmenter(max_segment_length=100)

    # Test 1: Emojis de base (emoticons)
    print("=" * 80)
    print("TEST 1: EMOJIS DE BASE (Emoticons)")
    print("=" * 80)
    test1 = "Happy 😀 😃 😄 😁 😆 😅 😂 🤣 Sad 😢 😭 Angry 😡 😠"
    segments1, emojis1 = segmenter.segment_text(test1)
    result1 = segmenter.reassemble_text(segments1, emojis1)
    print(f"Original:  {test1}")
    print(f"Résultat:  {result1}")
    print(f"Match:     {test1 == result1} ✅" if test1 == result1 else f"Match:     {test1 == result1} ❌")
    print(f"Emojis:    {len(emojis1)} extraits")
    print()

    # Test 2: Symboles et pictogrammes
    print("=" * 80)
    print("TEST 2: SYMBOLES & PICTOGRAMMES")
    print("=" * 80)
    test2 = "Weather ☀️ ⛅ ☁️ 🌧️ ⛈️ 🌩️ Animals 🐶 🐱 🐭 🐹 Food 🍕 🍔 🍟 🍗"
    segments2, emojis2 = segmenter.segment_text(test2)
    result2 = segmenter.reassemble_text(segments2, emojis2)
    print(f"Original:  {test2}")
    print(f"Résultat:  {result2}")
    print(f"Match:     {test2 == result2} ✅" if test2 == result2 else f"Match:     {test2 == result2} ❌")
    print(f"Emojis:    {len(emojis2)} extraits")
    print()

    # Test 3: Transport et symboles de carte
    print("=" * 80)
    print("TEST 3: TRANSPORT & SYMBOLES DE CARTE")
    print("=" * 80)
    test3 = "Transport 🚗 🚕 🚙 🚌 🚎 ✈️ 🚀 🚁 Buildings 🏠 🏢 🏰 🗽"
    segments3, emojis3 = segmenter.segment_text(test3)
    result3 = segmenter.reassemble_text(segments3, emojis3)
    print(f"Original:  {test3}")
    print(f"Résultat:  {result3}")
    print(f"Match:     {test3 == result3} ✅" if test3 == result3 else f"Match:     {test3 == result3} ❌")
    print(f"Emojis:    {len(emojis3)} extraits")
    print()

    # Test 4: Drapeaux (Regional Indicators)
    print("=" * 80)
    print("TEST 4: DRAPEAUX (Regional Indicators)")
    print("=" * 80)
    test4 = "Flags 🇫🇷 🇺🇸 🇬🇧 🇩🇪 🇪🇸 🇮🇹 🇯🇵 🇨🇳 Countries"
    segments4, emojis4 = segmenter.segment_text(test4)
    result4 = segmenter.reassemble_text(segments4, emojis4)
    print(f"Original:  {test4}")
    print(f"Résultat:  {result4}")
    print(f"Match:     {test4 == result4} ✅" if test4 == result4 else f"Match:     {test4 == result4} ❌")
    print(f"Emojis:    {len(emojis4)} extraits")
    print()

    # Test 5: Emojis avec modificateurs de peau
    print("=" * 80)
    print("TEST 5: EMOJIS AVEC MODIFICATEURS DE PEAU (Skin Tones)")
    print("=" * 80)
    test5 = "Hands 👋 👋🏻 👋🏼 👋🏽 👋🏾 👋🏿 Faces 👶 👶🏻 👶🏼"
    segments5, emojis5 = segmenter.segment_text(test5)
    result5 = segmenter.reassemble_text(segments5, emojis5)
    print(f"Original:  {test5}")
    print(f"Résultat:  {result5}")
    print(f"Match:     {test5 == result5} ✅" if test5 == result5 else f"Match:     {test5 == result5} ❌")
    print(f"Emojis:    {len(emojis5)} extraits")
    print()

    # Test 6: Symboles spéciaux (checkmarks, croix, etc.)
    print("=" * 80)
    print("TEST 6: SYMBOLES SPÉCIAUX (✅ ❌ ⭐ etc.)")
    print("=" * 80)
    test6 = "Symbols ✅ ❌ ⚠️ ℹ️ ⭐ ⚡ ♥️ ♦️ ♣️ ♠️ © ® ™"
    segments6, emojis6 = segmenter.segment_text(test6)
    result6 = segmenter.reassemble_text(segments6, emojis6)
    print(f"Original:  {test6}")
    print(f"Résultat:  {result6}")
    print(f"Match:     {test6 == result6} ✅" if test6 == result6 else f"Match:     {test6 == result6} ❌")
    print(f"Emojis:    {len(emojis6)} extraits")
    print()

    # Test 7: Keycaps
    print("=" * 80)
    print("TEST 7: KEYCAPS (Chiffres encerclés)")
    print("=" * 80)
    test7 = "Numbers 0️⃣ 1️⃣ 2️⃣ 3️⃣ 4️⃣ 5️⃣ 6️⃣ 7️⃣ 8️⃣ 9️⃣ #️⃣ *️⃣"
    segments7, emojis7 = segmenter.segment_text(test7)
    result7 = segmenter.reassemble_text(segments7, emojis7)
    print(f"Original:  {test7}")
    print(f"Résultat:  {result7}")
    print(f"Match:     {test7 == result7} ✅" if test7 == result7 else f"Match:     {test7 == result7} ❌")
    print(f"Emojis:    {len(emojis7)} extraits")
    print()

    # Test 8: Emojis composés (ZWJ sequences)
    print("=" * 80)
    print("TEST 8: EMOJIS COMPOSÉS (ZWJ Sequences)")
    print("=" * 80)
    test8 = "Families 👨‍👩‍👧‍👦 👨‍👩‍👦 Jobs 👨‍⚕️ 👩‍⚕️ 👨‍🎓 👩‍🎓"
    segments8, emojis8 = segmenter.segment_text(test8)
    result8 = segmenter.reassemble_text(segments8, emojis8)
    print(f"Original:  {test8}")
    print(f"Résultat:  {result8}")
    print(f"Match:     {test8 == result8} ✅" if test8 == result8 else f"Match:     {test8 == result8} ❌")
    print(f"Emojis:    {len(emojis8)} extraits")
    print()

    # Test 9: Emojis récents
    print("=" * 80)
    print("TEST 9: EMOJIS RÉCENTS (Unicode 13.0+)")
    print("=" * 80)
    test9 = "New 🥱 🤌 🫀 🫁 🥲 🥸 🤩 🥳 🤯"
    segments9, emojis9 = segmenter.segment_text(test9)
    result9 = segmenter.reassemble_text(segments9, emojis9)
    print(f"Original:  {test9}")
    print(f"Résultat:  {result9}")
    print(f"Match:     {test9 == result9} ✅" if test9 == result9 else f"Match:     {test9 == result9} ❌")
    print(f"Emojis:    {len(emojis9)} extraits")
    print()

    # Test 10: Message complet (comme celui de l'utilisateur)
    print("=" * 80)
    print("TEST 10: MESSAGE COMPLET (Fichiers non utilisés)")
    print("=" * 80)
    test10 = """Fichiers NON UTILISÉS Confirmés (3 fichiers)
use-anonymous-messages.ts

❌ Aucun import en production
Uniquement référencé dans scripts d'analyse temporaires
use-translation-performance.ts

❌ Aucun import en production
Dépend de advanced-translation.service (lui aussi non utilisé)."""

    segments10, emojis10 = segmenter.segment_text(test10)
    result10 = segmenter.reassemble_text(segments10, emojis10)
    print(f"Original lignes: {len(test10.split(chr(10)))}")
    print(f"Résultat lignes: {len(result10.split(chr(10)))}")
    print(f"Emojis extraits: {len(emojis10)}")
    print(f"Emojis: {list(emojis10.values())}")
    print(f"Match:     {test10 == result10} ✅" if test10 == result10 else f"Match:     {test10 == result10} ❌")

    if test10 != result10:
        print("\nDIFFÉRENCES:")
        for i, (o, r) in enumerate(zip(test10.split('\n'), result10.split('\n'))):
            if o != r:
                print(f"  Ligne {i+1}:")
                print(f"    Original: {repr(o)}")
                print(f"    Résultat: {repr(r)}")

    # Résumé final
    print("\n" + "=" * 80)
    print("RÉSUMÉ FINAL")
    print("=" * 80)
    total_tests = 10
    passed_tests = sum([
        test1 == result1,
        test2 == result2,
        test3 == result3,
        test4 == result4,
        test5 == result5,
        test6 == result6,
        test7 == result7,
        test8 == result8,
        test9 == result9,
        test10 == result10
    ])
    print(f"Tests réussis: {passed_tests}/{total_tests}")
    print(f"Taux de succès: {(passed_tests/total_tests)*100:.1f}%")

    if passed_tests == total_tests:
        print("✅ TOUS LES TESTS PASSENT !")
    else:
        print("❌ CERTAINS TESTS ÉCHOUENT")

if __name__ == "__main__":
    test_all_emoji_types()
