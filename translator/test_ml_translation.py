"""
Test de traduction ML réelle avec préservation de structure
Utilise le service MLTranslationService existant
"""

import sys
import asyncio
import os
sys.path.insert(0, 'src')

# Importer les settings
from config.settings import get_settings

# Importer directement le module ML sans passer par __init__.py (pour éviter psutil)
import importlib.util
spec = importlib.util.spec_from_file_location(
    "translation_ml_service",
    "src/services/translation_ml_service.py"
)
translation_ml_module = importlib.util.module_from_spec(spec)
sys.modules['translation_ml_service'] = translation_ml_module
spec.loader.exec_module(translation_ml_module)
TranslationMLService = translation_ml_module.TranslationMLService

def print_comparison(title, original, translated, source_lang, target_lang, result_info):
    """Affiche une comparaison côte-à-côte avec analyse de structure"""
    print("\n" + "="*80)
    print(f"{title}")
    print("="*80)
    print(f"\n📝 ORIGINAL ({source_lang.upper()}):")
    print("-" * 80)
    print(original)
    print(f"\n🌐 TRANSLATED ({target_lang.upper()}):")
    print("-" * 80)
    print(translated)

    # Vérifier la préservation
    original_paragraphs = original.split('\n\n')
    translated_paragraphs = translated.split('\n\n')

    # Compter les emojis
    import re
    emoji_pattern = re.compile("[\U0001F600-\U0001F64F\U0001F300-\U0001F5FF\U0001F680-\U0001F6FF\U0001F1E0-\U0001F1FF\U00002702-\U000027B0\U000024C2-\U0001F251\U0001F900-\U0001F9FF\U0001FA00-\U0001FAFF]+")
    original_emojis = emoji_pattern.findall(original)
    translated_emojis = emoji_pattern.findall(translated)

    print("\n📊 STRUCTURE ANALYSIS:")
    print(f"  Original paragraphs: {len(original_paragraphs)}")
    print(f"  Translated paragraphs: {len(translated_paragraphs)}")
    print(f"  Structure preserved: {'✅ YES' if len(original_paragraphs) == len(translated_paragraphs) else '❌ NO'}")

    print(f"\n🎨 EMOJI ANALYSIS:")
    print(f"  Original emojis: {original_emojis}")
    print(f"  Translated emojis: {translated_emojis}")
    print(f"  All emojis preserved: {'✅ YES' if original_emojis == translated_emojis else '❌ NO'}")

    print(f"\n⚙️ TRANSLATION INFO:")
    print(f"  Model used: {result_info.get('model_used', 'N/A')}")
    print(f"  Segments count: {result_info.get('segments_count', 'N/A')}")
    print(f"  Emojis count: {result_info.get('emojis_count', 'N/A')}")
    print(f"  Processing time: {result_info.get('processing_time', 0):.2f}s")
    print(f"  From cache: {result_info.get('from_cache', False)}")
    print("="*80)


async def test_english_to_french(service):
    """Test EN → FR avec paragraphes et emojis"""
    print("\n" + "#"*80)
    print("TEST 1: ENGLISH → FRENCH")
    print("#"*80)

    text = """Hello everyone! 👋

This is a test message with multiple paragraphs.

Here are some features:
- Real-time translation 🌍
- Emoji preservation ✨
- Structure maintained 🚀

Thank you for testing! 🎉"""

    print("\n🔄 Translation in progress...")
    result = await service.translate_with_structure(
        text=text,
        source_language="en",
        target_language="fr",
        model_type="basic",
        source_channel="test"
    )

    print_comparison(
        "English to French Translation",
        text,
        result['translated_text'],
        "en",
        "fr",
        result
    )


async def test_english_to_german(service):
    """Test EN → DE avec emojis"""
    print("\n" + "#"*80)
    print("TEST 2: ENGLISH → GERMAN")
    print("#"*80)

    text = """Good morning! ☀️

How are you today?

I hope you have a wonderful day! 😊"""

    print("\n🔄 Translation in progress...")
    result = await service.translate_with_structure(
        text=text,
        source_language="en",
        target_language="de",
        model_type="basic",
        source_channel="test"
    )

    print_comparison(
        "English to German Translation",
        text,
        result['translated_text'],
        "en",
        "de",
        result
    )


async def test_french_to_english(service):
    """Test FR → EN avec structure complexe"""
    print("\n" + "#"*80)
    print("TEST 3: FRENCH → ENGLISH")
    print("#"*80)

    text = """Bonjour à tous! 🎉

Je vous présente notre nouveau projet de traduction.

Les fonctionnalités principales:
- Traduction en temps réel 🌐
- Support de plusieurs langues 🗣️
- Préservation des emojis ✨

Merci de votre attention! 🙏"""

    print("\n🔄 Translation in progress...")
    result = await service.translate_with_structure(
        text=text,
        source_language="fr",
        target_language="en",
        model_type="basic",
        source_channel="test"
    )

    print_comparison(
        "French to English Translation",
        text,
        result['translated_text'],
        "fr",
        "en",
        result
    )


async def test_french_to_spanish(service):
    """Test FR → ES avec emojis multiples"""
    print("\n" + "#"*80)
    print("TEST 4: FRENCH → SPANISH")
    print("#"*80)

    text = """Bienvenue! 👋

Ceci est un message de test.

Bonne journée! 🎊"""

    print("\n🔄 Translation in progress...")
    result = await service.translate_with_structure(
        text=text,
        source_language="fr",
        target_language="es",
        model_type="basic",
        source_channel="test"
    )

    print_comparison(
        "French to Spanish Translation",
        text,
        result['translated_text'],
        "fr",
        "es",
        result
    )


async def main():
    """Exécute tous les tests de traduction ML réels"""
    print("\n" + "="*80)
    print("TESTS DE TRADUCTION ML RÉELLE AVEC PRÉSERVATION DE STRUCTURE")
    print("Utilise TranslationMLService avec modèles T5/NLLB")
    print("="*80)

    # Charger les settings
    settings = get_settings()

    # Initialiser le service ML
    print("\n🔧 Initializing ML Translation Service...")
    service = TranslationMLService(
        settings=settings,
        model_type="basic",  # Charger uniquement le modèle basic pour les tests
        max_workers=2
    )

    # Charger les modèles ML
    print("📦 Loading ML models (this may take a moment)...")
    success = await service.initialize()

    if not success:
        print("❌ Failed to initialize ML models! Using fallback.")
        return

    print("✅ Service and models initialized!")

    # Exécuter les tests
    await test_english_to_french(service)
    await test_english_to_german(service)
    await test_french_to_english(service)
    await test_french_to_spanish(service)

    print("\n" + "="*80)
    print("✅ ALL TESTS COMPLETED!")
    print("="*80 + "\n")


if __name__ == "__main__":
    asyncio.run(main())
