"""
Test de traduction ML réelle du message avec fichiers non utilisés
"""

import sys
import os
import asyncio
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from services.translation_ml_service import TranslationMLService
from config.settings import get_settings

async def test_real_translation():
    """Test avec traduction ML réelle"""

    # Message original
    test_text = """Fichiers NON UTILISÉS Confirmés (3 fichiers)
use-anonymous-messages.ts

❌ Aucun import en production
Uniquement référencé dans scripts d'analyse temporaires
use-translation-performance.ts

❌ Aucun import en production
Dépend de advanced-translation.service (lui aussi non utilisé)."""

    print("=" * 80)
    print("TEXTE ORIGINAL (Français):")
    print("=" * 80)
    print(test_text)
    print(f"\nNombre de lignes: {len(test_text.split(chr(10)))}")
    print(f"Nombre de paragraphes (\\n\\n): {test_text.count(chr(10)+chr(10))}")
    print("\n")

    # Créer le service ML
    settings = get_settings()
    ml_service = TranslationMLService(settings, max_workers=4)

    # Initialiser
    print("🔄 Initialisation du service ML...")
    initialized = await ml_service.initialize()

    if not initialized:
        print("❌ Impossible d'initialiser le service ML")
        return

    print("✅ Service ML initialisé\n")

    # Traduction avec structure
    print("🌐 Traduction FR → EN avec préservation de structure...")
    result = await ml_service.translate_with_structure(
        text=test_text,
        source_language="fr",
        target_language="en",
        model_type="basic",
        source_channel="test"
    )

    translated_text = result['translated_text']

    print("\n")
    print("=" * 80)
    print("TEXTE TRADUIT (Anglais):")
    print("=" * 80)
    print(translated_text)
    print(f"\nNombre de lignes: {len(translated_text.split(chr(10)))}")
    print(f"Nombre de paragraphes (\\n\\n): {translated_text.count(chr(10)+chr(10))}")

    print("\n")
    print("=" * 80)
    print("VÉRIFICATION DE LA STRUCTURE:")
    print("=" * 80)

    original_lines = test_text.split('\n')
    translated_lines = translated_text.split('\n')

    print(f"Lignes originales: {len(original_lines)}")
    print(f"Lignes traduites:  {len(translated_lines)}")

    structure_preserved = len(original_lines) == len(translated_lines)

    if structure_preserved:
        print("✅ Structure préservée (même nombre de lignes)")
    else:
        print("❌ Structure NON préservée")
        print(f"   Différence: {len(translated_lines) - len(original_lines):+d} lignes")

    print("\n")
    print("=" * 80)
    print("COMPARAISON LIGNE PAR LIGNE:")
    print("=" * 80)

    max_lines = max(len(original_lines), len(translated_lines))
    for i in range(max_lines):
        if i < len(original_lines) and i < len(translated_lines):
            print(f"\n{i+1}. Original:  {repr(original_lines[i])}")
            print(f"   Traduit:  {repr(translated_lines[i])}")
        elif i < len(original_lines):
            print(f"\n{i+1}. Original:  {repr(original_lines[i])}")
            print(f"   Traduit:  <MANQUANT>")
        else:
            print(f"\n{i+1}. Original:  <MANQUANT>")
            print(f"   Traduit:  {repr(translated_lines[i])}")

    # Vérifier les paragraphes
    print("\n")
    print("=" * 80)
    print("PARAGRAPHES:")
    print("=" * 80)
    original_paras = test_text.count('\n\n')
    translated_paras = translated_text.count('\n\n')
    print(f"Original:  {original_paras} doubles retours")
    print(f"Traduit:   {translated_paras} doubles retours")

    if original_paras == translated_paras:
        print("✅ Paragraphes préservés")
    else:
        print("❌ Paragraphes NON préservés")

    # Vérifier les emojis
    print("\n")
    print("=" * 80)
    print("EMOJIS:")
    print("=" * 80)
    original_emojis = [c for c in test_text if ord(c) > 0x1F300]
    translated_emojis = [c for c in translated_text if ord(c) > 0x1F300]
    print(f"Original:  {len(original_emojis)} emojis")
    print(f"Traduit:   {len(translated_emojis)} emojis")

    if len(original_emojis) == len(translated_emojis):
        print("✅ Emojis préservés")
    else:
        print("❌ Emojis NON préservés")

if __name__ == "__main__":
    asyncio.run(test_real_translation())
