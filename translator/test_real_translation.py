"""
Test de traduction réelle avec préservation de structure
Tests: EN→FR, EN→JA, FR→EN, FR→ZH
"""

import sys
import asyncio
import os
sys.path.insert(0, 'src')

# Importer seulement ce dont nous avons besoin
os.environ['TRANSLATION_MODE'] = 'ml'  # Forcer le mode ML
os.environ['T5_MODEL'] = 'small'

# Importer juste le service ML sans passer par __init__
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent / 'src'))

# Import direct pour éviter les dépendances ZMQ
import importlib.util
spec = importlib.util.spec_from_file_location("translation_ml_service", "src/services/translation_ml_service.py")
translation_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(translation_module)
MLTranslationService = translation_module.MLTranslationService

def print_comparison(title, original, translated, source_lang, target_lang):
    """Affiche une comparaison côte-à-côte"""
    print("\n" + "="*80)
    print(f"{title}")
    print("="*80)
    print(f"\n📝 ORIGINAL ({source_lang.upper()}):")
    print("-" * 80)
    print(original)
    print("\n🌐 TRANSLATED ({}):")
    print("-" * 80)
    print(translated)
    print("\n" + "="*80)

async def test_english_to_french():
    """Test EN → FR avec paragraphes et emojis"""
    service = MLTranslationService()

    text = """Hello everyone! 👋

This is a test message with multiple paragraphs.

Here are some features:
- Real-time translation 🌍
- Emoji preservation ✨
- Structure maintained 🚀

Thank you for testing! 🎉"""

    print("\n" + "#"*80)
    print("TEST 1: ENGLISH → FRENCH")
    print("#"*80)

    result = await service.translate_with_structure(
        text=text,
        source_language="en",
        target_language="fr",
        model_type="basic"
    )

    print_comparison(
        "English to French Translation",
        text,
        result['translated_text'],
        "en",
        "fr"
    )

    # Vérifier la préservation
    original_paragraphs = text.split('\n\n')
    translated_paragraphs = result['translated_text'].split('\n\n')

    print(f"\n📊 STRUCTURE ANALYSIS:")
    print(f"  Original paragraphs: {len(original_paragraphs)}")
    print(f"  Translated paragraphs: {len(translated_paragraphs)}")
    print(f"  Segments processed: {result.get('segments_count', 'N/A')}")
    print(f"  Emojis preserved: {result.get('emojis_count', 'N/A')}")
    print(f"  Structure preserved: {'✅ YES' if len(original_paragraphs) == len(translated_paragraphs) else '❌ NO'}")

async def test_english_to_japanese():
    """Test EN → JA avec emojis"""
    service = MLTranslationService()

    text = """Good morning! ☀️

How are you today?

I hope you have a wonderful day! 😊"""

    print("\n" + "#"*80)
    print("TEST 2: ENGLISH → JAPANESE")
    print("#"*80)

    result = await service.translate_with_structure(
        text=text,
        source_language="en",
        target_language="ja",
        model_type="basic"
    )

    print_comparison(
        "English to Japanese Translation",
        text,
        result['translated_text'],
        "en",
        "ja"
    )

    # Vérifier la préservation
    original_paragraphs = text.split('\n\n')
    translated_paragraphs = result['translated_text'].split('\n\n')

    print(f"\n📊 STRUCTURE ANALYSIS:")
    print(f"  Original paragraphs: {len(original_paragraphs)}")
    print(f"  Translated paragraphs: {len(translated_paragraphs)}")
    print(f"  Segments processed: {result.get('segments_count', 'N/A')}")
    print(f"  Emojis preserved: {result.get('emojis_count', 'N/A')}")
    print(f"  Structure preserved: {'✅ YES' if len(original_paragraphs) == len(translated_paragraphs) else '❌ NO'}")

async def test_french_to_english():
    """Test FR → EN avec structure complexe"""
    service = MLTranslationService()

    text = """Bonjour à tous! 🎉

Je vous présente notre nouveau projet de traduction.

Les fonctionnalités principales:
- Traduction en temps réel 🌐
- Support de plusieurs langues 🗣️
- Préservation des emojis 😊

Merci de votre attention! 🙏"""

    print("\n" + "#"*80)
    print("TEST 3: FRENCH → ENGLISH")
    print("#"*80)

    result = await service.translate_with_structure(
        text=text,
        source_language="fr",
        target_language="en",
        model_type="basic"
    )

    print_comparison(
        "French to English Translation",
        text,
        result['translated_text'],
        "fr",
        "en"
    )

    # Vérifier la préservation
    original_paragraphs = text.split('\n\n')
    translated_paragraphs = result['translated_text'].split('\n\n')

    print(f"\n📊 STRUCTURE ANALYSIS:")
    print(f"  Original paragraphs: {len(original_paragraphs)}")
    print(f"  Translated paragraphs: {len(translated_paragraphs)}")
    print(f"  Segments processed: {result.get('segments_count', 'N/A')}")
    print(f"  Emojis preserved: {result.get('emojis_count', 'N/A')}")
    print(f"  Structure preserved: {'✅ YES' if len(original_paragraphs) == len(translated_paragraphs) else '❌ NO'}")

async def test_french_to_chinese():
    """Test FR → ZH avec emojis multiples"""
    service = MLTranslationService()

    text = """Bienvenue! 👋

Ceci est un message de test.

J'espère que tout fonctionne bien! 🎊🎉🚀"""

    print("\n" + "#"*80)
    print("TEST 4: FRENCH → CHINESE")
    print("#"*80)

    result = await service.translate_with_structure(
        text=text,
        source_language="fr",
        target_language="zh",
        model_type="basic"
    )

    print_comparison(
        "French to Chinese Translation",
        text,
        result['translated_text'],
        "fr",
        "zh"
    )

    # Vérifier la préservation
    original_paragraphs = text.split('\n\n')
    translated_paragraphs = result['translated_text'].split('\n\n')

    print(f"\n📊 STRUCTURE ANALYSIS:")
    print(f"  Original paragraphs: {len(original_paragraphs)}")
    print(f"  Translated paragraphs: {len(translated_paragraphs)}")
    print(f"  Segments processed: {result.get('segments_count', 'N/A')}")
    print(f"  Emojis preserved: {result.get('emojis_count', 'N/A')}")
    print(f"  Structure preserved: {'✅ YES' if len(original_paragraphs) == len(translated_paragraphs) else '❌ NO'}")

async def main():
    """Exécute tous les tests de traduction"""
    print("\n" + "="*80)
    print("TESTS DE TRADUCTION RÉELLE AVEC PRÉSERVATION DE STRUCTURE")
    print("="*80)

    await test_english_to_french()
    await test_english_to_japanese()
    await test_french_to_english()
    await test_french_to_chinese()

    print("\n" + "="*80)
    print("TOUS LES TESTS TERMINÉS!")
    print("="*80 + "\n")

if __name__ == "__main__":
    asyncio.run(main())
