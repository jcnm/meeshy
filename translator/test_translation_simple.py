"""
Test de traduction réelle simplifié - Utilise directement les modèles
Tests: EN→FR, EN→JA, FR→EN, FR→ZH
"""

import sys
sys.path.insert(0, 'src')

from transformers import T5ForConditionalGeneration, T5Tokenizer
from utils.text_segmentation import TextSegmenter
import logging

# Configurer le logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class SimpleTranslator:
    """Traducteur simplifié pour les tests"""

    def __init__(self):
        logger.info("Chargement du modèle T5-small...")
        self.model_name = "t5-small"
        self.tokenizer = T5Tokenizer.from_pretrained(self.model_name)
        self.model = T5ForConditionalGeneration.from_pretrained(self.model_name)
        self.segmenter = TextSegmenter(max_segment_length=100)
        logger.info("✅ Modèle chargé!")

    def translate_segment(self, text, source_lang, target_lang):
        """Traduit un segment de texte"""
        # Format T5: "translate English to French: text"
        lang_map = {
            'en': 'English',
            'fr': 'French',
            'ja': 'Japanese',
            'zh': 'Chinese',
            'de': 'German',
            'es': 'Spanish'
        }

        source_name = lang_map.get(source_lang, source_lang)
        target_name = lang_map.get(target_lang, target_lang)

        prompt = f"translate {source_name} to {target_name}: {text}"

        inputs = self.tokenizer(prompt, return_tensors="pt", max_length=512, truncation=True)
        outputs = self.model.generate(
            **inputs,
            max_length=512,
            num_beams=4,
            early_stopping=True
        )

        translation = self.tokenizer.decode(outputs[0], skip_special_tokens=True)
        return translation

    def translate_with_structure(self, text, source_lang, target_lang):
        """Traduit en préservant la structure"""
        # 1. Segmenter le texte
        segments, emojis_map = self.segmenter.segment_text(text)
        logger.info(f"📋 Segmenté en {len(segments)} parties avec {len(emojis_map)} emojis")

        # 2. Traduire chaque segment
        translated_segments = []
        for i, segment in enumerate(segments):
            if segment['type'] == 'empty_line':
                translated_segments.append(segment)
            else:
                logger.info(f"  [{i+1}/{len(segments)}] Traduction: '{segment['text'][:40]}...'")
                translated_text = self.translate_segment(
                    segment['text'],
                    source_lang,
                    target_lang
                )
                translated_segments.append({
                    'text': translated_text,
                    'type': segment['type'],
                    'index': segment['index']
                })

        # 3. Réassembler
        final_text = self.segmenter.reassemble_text(translated_segments, emojis_map)
        logger.info(f"✅ Traduction terminée: {len(final_text)} caractères")

        return final_text, len(segments), len(emojis_map)


def print_comparison(title, original, translated, source_lang, target_lang, segments, emojis):
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

    # Vérifier la préservation
    original_paragraphs = original.split('\n\n')
    translated_paragraphs = translated.split('\n\n')

    print("\n📊 STRUCTURE ANALYSIS:")
    print(f"  Original paragraphs: {len(original_paragraphs)}")
    print(f"  Translated paragraphs: {len(translated_paragraphs)}")
    print(f"  Segments processed: {segments}")
    print(f"  Emojis preserved: {emojis}")
    print(f"  Structure preserved: {'✅ YES' if len(original_paragraphs) == len(translated_paragraphs) else '❌ NO'}")
    print("="*80)


def main():
    """Exécute tous les tests de traduction"""
    print("\n" + "="*80)
    print("TESTS DE TRADUCTION RÉELLE AVEC PRÉSERVATION DE STRUCTURE")
    print("="*80)

    translator = SimpleTranslator()

    # TEST 1: EN → FR
    print("\n" + "#"*80)
    print("TEST 1: ENGLISH → FRENCH")
    print("#"*80)

    text1 = """Hello everyone! 👋

This is a test message with multiple paragraphs.

Here are some features:
- Real-time translation 🌍
- Emoji preservation ✨

Thank you for testing! 🎉"""

    translated1, segments1, emojis1 = translator.translate_with_structure(text1, "en", "fr")
    print_comparison("English to French Translation", text1, translated1, "en", "fr", segments1, emojis1)

    # TEST 2: EN → JA (japonais peut ne pas être supporté par T5-small)
    print("\n" + "#"*80)
    print("TEST 2: ENGLISH → GERMAN (T5-small supporte mieux l'allemand)")
    print("#"*80)

    text2 = """Good morning! ☀️

How are you today?

I hope you have a wonderful day! 😊"""

    translated2, segments2, emojis2 = translator.translate_with_structure(text2, "en", "de")
    print_comparison("English to German Translation", text2, translated2, "en", "de", segments2, emojis2)

    # TEST 3: FR → EN
    print("\n" + "#"*80)
    print("TEST 3: FRENCH → ENGLISH")
    print("#"*80)

    text3 = """Bonjour à tous! 🎉

Je vous présente notre nouveau projet.

Les fonctionnalités principales:
- Traduction en temps réel 🌐
- Support de plusieurs langues 🗣️

Merci! 🙏"""

    translated3, segments3, emojis3 = translator.translate_with_structure(text3, "fr", "en")
    print_comparison("French to English Translation", text3, translated3, "fr", "en", segments3, emojis3)

    # TEST 4: FR → DE
    print("\n" + "#"*80)
    print("TEST 4: FRENCH → GERMAN")
    print("#"*80)

    text4 = """Bienvenue! 👋

Ceci est un message de test.

Bonne journée! 🎊"""

    translated4, segments4, emojis4 = translator.translate_with_structure(text4, "fr", "de")
    print_comparison("French to German Translation", text4, translated4, "fr", "de", segments4, emojis4)

    print("\n" + "="*80)
    print("TOUS LES TESTS TERMINÉS!")
    print("="*80 + "\n")


if __name__ == "__main__":
    main()
