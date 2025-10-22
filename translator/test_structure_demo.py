"""
Démonstration de la préservation de structure avec traductions simulées
Ce test montre comment la structure (paragraphes, emojis) est préservée
"""

import sys
sys.path.insert(0, 'src')

from utils.text_segmentation import TextSegmenter

def simulate_translation(text, source_lang, target_lang):
    """
    Simule une traduction simple (mot à mot basique pour la démo)
    Ceci n'est PAS une vraie traduction ML, juste pour montrer la structure
    """
    # Dictionnaires de traduction simplifiés
    translations = {
        'en_to_fr': {
            'Hello': 'Bonjour',
            'everyone': 'à tous',
            'This': 'Ceci',
            'is': 'est',
            'a': 'un',
            'test': 'test',
            'message': 'message',
            'with': 'avec',
            'multiple': 'plusieurs',
            'paragraphs': 'paragraphes',
            'Here': 'Voici',
            'are': 'sont',
            'some': 'quelques',
            'features': 'fonctionnalités',
            'Real-time': 'Temps réel',
            'translation': 'traduction',
            'Emoji': 'Emoji',
            'preservation': 'préservation',
            'Structure': 'Structure',
            'maintained': 'maintenue',
            'Thank': 'Merci',
            'you': 'vous',
            'for': 'pour',
            'testing': 'tester',
            'Good': 'Bon',
            'morning': 'matin',
            'How': 'Comment',
            'today': "aujourd'hui",
            'I': 'Je',
            'hope': 'espère',
            'have': 'avoir',
            'wonderful': 'merveilleuse',
            'day': 'journée',
        },
        'fr_to_en': {
            'Bonjour': 'Hello',
            'à': 'to',
            'tous': 'everyone',
            'Je': 'I',
            'vous': 'you',
            'présente': 'present',
            'notre': 'our',
            'nouveau': 'new',
            'projet': 'project',
            'de': 'of',
            'traduction': 'translation',
            'Les': 'The',
            'fonctionnalités': 'features',
            'principales': 'main',
            'Traduction': 'Translation',
            'en': 'in',
            'temps': 'time',
            'réel': 'real',
            'Support': 'Support',
            'plusieurs': 'multiple',
            'langues': 'languages',
            'Préservation': 'Preservation',
            'des': 'of',
            'emojis': 'emojis',
            'Merci': 'Thank you',
            'attention': 'attention',
            'Bienvenue': 'Welcome',
            'Ceci': 'This',
            'est': 'is',
            'un': 'a',
            'message': 'message',
            'test': 'test',
            'Bonne': 'Good',
            'journée': 'day',
        }
    }

    dict_key = f"{source_lang}_to_{target_lang}"
    trans_dict = translations.get(dict_key, {})

    # Traduction mot par mot simple
    words = text.split()
    translated_words = []
    for word in words:
        # Enlever la ponctuation pour la recherche
        clean_word = word.strip('.,!?;:-')
        punct = word[len(clean_word):] if len(word) > len(clean_word) else ''

        # Chercher la traduction
        translated = trans_dict.get(clean_word, word)
        translated_words.append(translated + punct)

    return ' '.join(translated_words)


def translate_with_structure(text, source_lang, target_lang):
    """Traduit en préservant la structure"""
    segmenter = TextSegmenter(max_segment_length=100)

    # 1. Segmenter le texte
    segments, emojis_map = segmenter.segment_text(text)
    print(f"  📋 Segmenté en {len(segments)} parties avec {len(emojis_map)} emojis")

    # 2. Traduire chaque segment
    translated_segments = []
    for i, segment in enumerate(segments):
        if segment['type'] == 'empty_line':
            translated_segments.append(segment)
            print(f"    [{i+1}/{len(segments)}] Ligne vide préservée")
        else:
            original = segment['text'][:50]
            translated_text = simulate_translation(segment['text'], source_lang, target_lang)
            translated_segments.append({
                'text': translated_text,
                'type': segment['type'],
                'index': segment['index']
            })
            print(f"    [{i+1}/{len(segments)}] '{original}...' traduit")

    # 3. Réassembler
    final_text = segmenter.reassemble_text(translated_segments, emojis_map)
    print(f"  ✅ Réassemblé: {len(final_text)} caractères")

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

    print("\n📊 ANALYSE DE STRUCTURE:")
    print(f"  Paragraphes originaux: {len(original_paragraphs)}")
    print(f"  Paragraphes traduits: {len(translated_paragraphs)}")
    print(f"  Segments traités: {segments}")
    print(f"  Emojis préservés: {emojis}")

    # Vérifier que chaque emoji est présent
    import re
    emoji_pattern = re.compile("[\U0001F600-\U0001F64F\U0001F300-\U0001F5FF\U0001F680-\U0001F6FF\U0001F1E0-\U0001F1FF\U00002702-\U000027B0\U000024C2-\U0001F251\U0001F900-\U0001F9FF\U0001FA00-\U0001FAFF]+")
    original_emojis = emoji_pattern.findall(original)
    translated_emojis = emoji_pattern.findall(translated)

    print(f"  Emojis originaux: {original_emojis}")
    print(f"  Emojis traduits: {translated_emojis}")
    print(f"  Emojis correspondent: {'✅ OUI' if original_emojis == translated_emojis else '❌ NON'}")
    print(f"  Structure préservée: {'✅ OUI' if len(original_paragraphs) == len(translated_paragraphs) else '❌ NON'}")
    print("="*80)


def main():
    """Exécute tous les tests de démonstration"""
    print("\n" + "="*80)
    print("DÉMONSTRATION DE PRÉSERVATION DE STRUCTURE")
    print("(Utilise des traductions simulées pour montrer la structure)")
    print("="*80)

    # TEST 1: EN → FR
    print("\n" + "#"*80)
    print("TEST 1: ENGLISH → FRENCH")
    print("#"*80)

    text1 = """Hello everyone! 👋

This is a test message with multiple paragraphs.

Here are some features:
- Real-time translation 🌍
- Emoji preservation ✨
- Structure maintained 🚀

Thank you for testing! 🎉"""

    print("\n🔄 Traduction en cours...")
    translated1, segments1, emojis1 = translate_with_structure(text1, "en", "fr")
    print_comparison("English to French Translation", text1, translated1, "en", "fr", segments1, emojis1)

    # TEST 2: EN → FR (court)
    print("\n" + "#"*80)
    print("TEST 2: ENGLISH → FRENCH (Message court)")
    print("#"*80)

    text2 = """Good morning! ☀️

How are you today?

I hope you have a wonderful day! 😊"""

    print("\n🔄 Traduction en cours...")
    translated2, segments2, emojis2 = translate_with_structure(text2, "en", "fr")
    print_comparison("English to French Translation", text2, translated2, "en", "fr", segments2, emojis2)

    # TEST 3: FR → EN
    print("\n" + "#"*80)
    print("TEST 3: FRENCH → ENGLISH")
    print("#"*80)

    text3 = """Bonjour à tous! 🎉

Je vous présente notre nouveau projet de traduction.

Les fonctionnalités principales:
- Traduction en temps réel 🌐
- Support de plusieurs langues 🗣️
- Préservation des emojis ✨

Merci de votre attention! 🙏"""

    print("\n🔄 Traduction en cours...")
    translated3, segments3, emojis3 = translate_with_structure(text3, "fr", "en")
    print_comparison("French to English Translation", text3, translated3, "fr", "en", segments3, emojis3)

    # TEST 4: FR → EN (court)
    print("\n" + "#"*80)
    print("TEST 4: FRENCH → ENGLISH (Message court)")
    print("#"*80)

    text4 = """Bienvenue! 👋

Ceci est un message de test.

Bonne journée! 🎊"""

    print("\n🔄 Traduction en cours...")
    translated4, segments4, emojis4 = translate_with_structure(text4, "fr", "en")
    print_comparison("French to English Translation", text4, translated4, "fr", "en", segments4, emojis4)

    print("\n" + "="*80)
    print("✅ DÉMONSTRATION TERMINÉE!")
    print("\n💡 NOTE: Ces traductions sont SIMULÉES (mot-à-mot basique)")
    print("   La vraie API utilise des modèles ML (T5, NLLB) pour de vraies traductions.")
    print("   Cette démo montre que la STRUCTURE (paragraphes + emojis) est PRÉSERVÉE.")
    print("="*80 + "\n")


if __name__ == "__main__":
    main()
