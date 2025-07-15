#!/usr/bin/env node

/**
 * Script de test CLI pour Meeshy
 * 
 * Ce script permet de tester:
 * 1. La traduction avec MT5 et NLLB
 * 2. La détection de langue
 * 3. Le nettoyage des tokens spéciaux
 * 
 * Usage: node cli-test-translation.js [option]
 * Options:
 *   --detect <texte>  : Détecter la langue d'un texte
 *   --translate <texte> --from <langue> --to <langue> [--model <modèle>] : Traduire un texte
 *   --clean <texte>   : Nettoyer les tokens spéciaux
 *   --run-tests       : Exécuter les tests automatisés
 *   --help            : Afficher l'aide
 * 
 * Exemples:
 *   node cli-test-translation.js --detect "Bonjour, comment allez-vous?"
 *   node cli-test-translation.js --translate "Hello world" --from en --to fr
 *   node cli-test-translation.js --translate "Hello world" --from en --to fr --model MT5_SMALL
 *   node cli-test-translation.js --clean "<extra_id_0> Hello world"
 *   node cli-test-translation.js --run-tests
 */

import { pipeline } from '@xenova/transformers';

// Cache pour les modèles
const modelCache = {
  languageDetector: null,
  mt5: null,
  nllb: null
};

// Configuration des modèles
const MODEL_CONFIG = {
  LANGUAGE_DETECTION: 'papluca/xlm-roberta-base-language-detection',
  MT5_SMALL: 'Xenova/mt5-small',
  NLLB_DISTILLED_600M: 'Xenova/nllb-200-distilled-600M'
};

// Mapping des codes de langue pour NLLB
const NLLB_LANG_MAP = {
  'en': 'eng_Latn',
  'fr': 'fra_Latn',
  'es': 'spa_Latn',
  'de': 'deu_Latn',
  'it': 'ita_Latn',
  'pt': 'por_Latn',
  'ru': 'rus_Cyrl',
  'ja': 'jpn_Jpan',
  'ko': 'kor_Hang',
  'zh': 'zho_Hans',
  'ar': 'arb_Arab',
  'hi': 'hin_Deva',
  'nl': 'nld_Latn',
  'pl': 'pol_Latn',
  'tr': 'tur_Latn'
};

// Fonction pour nettoyer les tokens spéciaux
function cleanTranslationOutput(text) {
  if (!text) return '';
  
  return text
    .replace(/<extra_id_\d+>/g, '') // Tokens MT5
    .replace(/▁/g, ' ') // Tokens NLLB
    .replace(/<pad>|<\/pad>/g, '') // Tokens pad
    .replace(/<unk>|<\/unk>/g, '') // Tokens unknown
    .replace(/<\/s>|<s>/g, '') // Tokens start/end
    .replace(/\s{2,}/g, ' ') // Espaces multiples
    .trim();
}

// Service de traduction avec vrais modèles
const translationService = {
  async initLanguageDetector() {
    if (!modelCache.languageDetector) {
      console.log('🔄 Chargement du modèle de détection de langue...');
      modelCache.languageDetector = await pipeline(
        'text-classification',
        MODEL_CONFIG.LANGUAGE_DETECTION
      );
      console.log('✅ Modèle de détection de langue chargé');
    }
    return modelCache.languageDetector;
  },

  async initMT5() {
    if (!modelCache.mt5) {
      console.log('🔄 Chargement du modèle MT5...');
      modelCache.mt5 = await pipeline(
        'text2text-generation',
        MODEL_CONFIG.MT5_SMALL
      );
      console.log('✅ Modèle MT5 chargé');
    }
    return modelCache.mt5;
  },

  async initNLLB() {
    if (!modelCache.nllb) {
      console.log('🔄 Chargement du modèle NLLB...');
      modelCache.nllb = await pipeline(
        'translation',
        MODEL_CONFIG.NLLB_DISTILLED_600M
      );
      console.log('✅ Modèle NLLB chargé');
    }
    return modelCache.nllb;
  },

  async detectLanguage(text) {
    try {
      const detector = await this.initLanguageDetector();
      const result = await detector(text);
      
      // Trier par score de confiance
      const sortedResults = result.sort((a, b) => b.score - a.score);
      
      return {
        language: sortedResults[0].label,
        confidence: sortedResults[0].score,
        detectedLanguages: sortedResults.map(r => ({
          language: r.label,
          confidence: r.score
        }))
      };
    } catch (error) {
      console.error('Erreur lors de la détection de langue:', error);
      throw error;
    }
  },

  async translateWithMT5(text, sourceLanguage, targetLanguage) {
    try {
      const mt5 = await this.initMT5();
      
      // Format du prompt pour MT5
      const prompt = `translate ${sourceLanguage} to ${targetLanguage}: ${text}`;
      
      const result = await mt5(prompt, {
        max_length: 512,
        num_beams: 4,
        early_stopping: true
      });
      
      return cleanTranslationOutput(result[0].generated_text);
    } catch (error) {
      console.error('Erreur lors de la traduction MT5:', error);
      throw error;
    }
  },

  async translateWithNLLB(text, sourceLanguage, targetLanguage) {
    try {
      const nllb = await this.initNLLB();
      
      // Convertir les codes de langue pour NLLB
      const srcLang = NLLB_LANG_MAP[sourceLanguage];
      const tgtLang = NLLB_LANG_MAP[targetLanguage];
      
      if (!srcLang || !tgtLang) {
        throw new Error(`Langue non supportée par NLLB: ${sourceLanguage} -> ${targetLanguage}`);
      }
      
      const result = await nllb(text, {
        src_lang: srcLang,
        tgt_lang: tgtLang,
        max_length: 512
      });
      
      return cleanTranslationOutput(result[0].translation_text);
    } catch (error) {
      console.error('Erreur lors de la traduction NLLB:', error);
      throw error;
    }
  },

  async translateText(text, sourceLanguage, targetLanguage, modelType = "MT5_SMALL") {
    try {
      let translatedText;
      let detectedLanguage;
      
      // Détection automatique de la langue si nécessaire
      if (sourceLanguage === "auto") {
        const detection = await this.detectLanguage(text);
        detectedLanguage = detection.language;
        sourceLanguage = detection.language;
        console.log(`🔍 Langue détectée automatiquement: ${detectedLanguage} (confiance: ${(detection.confidence * 100).toFixed(1)}%)`);
      }
      
      // Traduction selon le modèle choisi
      if (modelType === "NLLB_DISTILLED_600M") {
        translatedText = await this.translateWithNLLB(text, sourceLanguage, targetLanguage);
      } else {
        translatedText = await this.translateWithMT5(text, sourceLanguage, targetLanguage);
      }
      
      return {
        translatedText,
        modelUsed: modelType,
        detectedLanguage
      };
    } catch (error) {
      console.error('Erreur lors de la traduction:', error);
      throw error;
    }
  }
};

// Fonction pour exécuter les tests automatisés
async function runAutomatedTests() {
  console.log("\n🧪 TESTS AUTOMATISÉS DE TRADUCTION 🧪\n");
  
  try {
    // Tests de détection de langue
    console.log("=== TESTS DE DÉTECTION DE LANGUE ===\n");
    const detectionTests = [
      { text: "Hello, how are you today?", expected: "en" },
      { text: "Bonjour, comment allez-vous aujourd'hui ?", expected: "fr" },
      { text: "Hola, ¿cómo estás hoy?", expected: "es" },
      { text: "Guten Tag, wie geht es Ihnen?", expected: "de" },
      { text: "Ciao, come stai oggi?", expected: "it" }
    ];
    
    for (const test of detectionTests) {
      console.log(`Test: "${test.text}"`);
      const result = await translationService.detectLanguage(test.text);
      const success = result.language === test.expected;
      
      console.log(`Langue détectée: ${result.language} (confiance: ${(result.confidence * 100).toFixed(1)}%)`);
      console.log(`Attendu: ${test.expected}`);
      console.log(`Résultat: ${success ? '✅ SUCCÈS' : '❌ ÉCHEC'}`);
      
      if (result.detectedLanguages.length > 1) {
        console.log("Autres langues possibles:");
        result.detectedLanguages.slice(1, 3).forEach(lang => {
          console.log(`  - ${lang.language}: ${(lang.confidence * 100).toFixed(1)}%`);
        });
      }
      console.log();
    }
    
    // Tests de traduction avec MT5
    console.log("=== TESTS DE TRADUCTION MT5 ===\n");
    const mt5Tests = [
      { text: "Hello world", from: "en", to: "fr" },
      { text: "Good morning", from: "en", to: "es" },
      { text: "Thank you", from: "en", to: "de" }
    ];
    
    for (const test of mt5Tests) {
      console.log(`Test MT5: "${test.text}" (${test.from} → ${test.to})`);
      const result = await translationService.translateText(test.text, test.from, test.to, "MT5_SMALL");
      console.log(`Traduction: "${result.translatedText}"`);
      console.log(`Modèle: ${result.modelUsed}`);
      console.log("✅ SUCCÈS\n");
    }
    
    // Tests de traduction avec NLLB
    console.log("=== TESTS DE TRADUCTION NLLB ===\n");
    const nllbTests = [
      { text: "Hello world", from: "en", to: "fr" },
      { text: "Good morning", from: "en", to: "es" },
      { text: "Thank you", from: "en", to: "de" }
    ];
    
    for (const test of nllbTests) {
      console.log(`Test NLLB: "${test.text}" (${test.from} → ${test.to})`);
      const result = await translationService.translateText(test.text, test.from, test.to, "NLLB_DISTILLED_600M");
      console.log(`Traduction: "${result.translatedText}"`);
      console.log(`Modèle: ${result.modelUsed}`);
      console.log("✅ SUCCÈS\n");
    }
    
    // Tests de nettoyage
    console.log("=== TESTS DE NETTOYAGE DES TOKENS ===\n");
    const cleaningTests = [
      { input: "Hello <extra_id_0> world", expected: "Hello world" },
      { input: "Bonjour▁le▁monde", expected: "Bonjour le monde" },
      { input: "<pad>Test</pad>", expected: "Test" },
      { input: "<s>Hello</s>", expected: "Hello" },
      { input: "Text   with   spaces", expected: "Text with spaces" }
    ];
    
    for (const test of cleaningTests) {
      const cleaned = cleanTranslationOutput(test.input);
      const success = cleaned === test.expected;
      
      console.log(`Test: "${test.input}"`);
      console.log(`Nettoyé: "${cleaned}"`);
      console.log(`Attendu: "${test.expected}"`);
      console.log(`Résultat: ${success ? '✅ SUCCÈS' : '❌ ÉCHEC'}\n`);
    }
    
  } catch (error) {
    console.error("Erreur lors des tests:", error);
  }
}

// Fonction pour analyser les arguments de la ligne de commande
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--detect' && i + 1 < args.length) {
      options.detect = args[++i];
    } else if (arg === '--translate' && i + 1 < args.length) {
      options.translate = args[++i];
    } else if (arg === '--from' && i + 1 < args.length) {
      options.from = args[++i];
    } else if (arg === '--to' && i + 1 < args.length) {
      options.to = args[++i];
    } else if (arg === '--model' && i + 1 < args.length) {
      options.model = args[++i];
    } else if (arg === '--clean' && i + 1 < args.length) {
      options.clean = args[++i];
    } else if (arg === '--run-tests') {
      options.runTests = true;
    } else if (arg === '--help') {
      options.help = true;
    }
  }
  
  return options;
}

// Fonction pour afficher l'aide
function showHelp() {
  console.log(`
Script de test CLI pour Meeshy - Version avec vrais modèles

Usage: node cli-test-translation.js [option]

Options:
  --detect <texte>      Détecter la langue d'un texte
  --translate <texte>   Traduire un texte (à utiliser avec --from et --to)
  --from <langue>       Langue source (en, fr, es, de, it, pt, ru, ja, ko, zh, ar, hi, nl, pl, tr)
  --to <langue>         Langue cible (mêmes codes que --from)
  --model <modèle>      Modèle à utiliser (MT5_SMALL ou NLLB_DISTILLED_600M)
  --clean <texte>       Nettoyer les tokens spéciaux
  --run-tests           Exécuter les tests automatisés
  --help                Afficher cette aide

Modèles disponibles:
  - MT5_SMALL: Modèle MT5 multilingue pour la traduction
  - NLLB_DISTILLED_600M: Modèle NLLB pour 200 langues

Exemples:
  node cli-test-translation.js --detect "Bonjour, comment allez-vous?"
  node cli-test-translation.js --translate "Hello world" --from en --to fr
  node cli-test-translation.js --translate "Hello world" --from en --to fr --model NLLB_DISTILLED_600M
  node cli-test-translation.js --translate "Hello world" --from auto --to fr
  node cli-test-translation.js --clean "<extra_id_0> Hello world"
  node cli-test-translation.js --run-tests

Note: Le premier lancement peut être long car les modèles doivent être téléchargés.
  `);
}

// Fonction principale
async function main() {
  const options = parseArgs();
  
  if (options.help) {
    showHelp();
    return;
  }
  
  try {
    if (options.detect) {
      console.log(`\n🔍 Détection de langue pour: "${options.detect}"\n`);
      const result = await translationService.detectLanguage(options.detect);
      console.log(`Langue détectée: ${result.language}`);
      console.log(`Confiance: ${(result.confidence * 100).toFixed(1)}%`);
      
      if (result.detectedLanguages && result.detectedLanguages.length > 1) {
        console.log("\nAutres langues possibles:");
        result.detectedLanguages.slice(1, 5).forEach(lang => {
          console.log(`- ${lang.language}: ${(lang.confidence * 100).toFixed(1)}%`);
        });
      }
    } else if (options.translate) {
      if (!options.from || !options.to) {
        console.log("❌ Erreur: Les options --from et --to sont requises pour la traduction.");
        showHelp();
        return;
      }
      
      const modelType = options.model || "MT5_SMALL";
      
      console.log(`\n🔄 Traduction de: "${options.translate}"`);
      console.log(`De: ${options.from}`);
      console.log(`Vers: ${options.to}`);
      console.log(`Modèle: ${modelType}\n`);
      
      const result = await translationService.translateText(
        options.translate,
        options.from,
        options.to,
        modelType
      );
      
      console.log(`✅ Résultat: "${result.translatedText}"`);
      console.log(`Modèle utilisé: ${result.modelUsed}`);
      
      if (result.detectedLanguage) {
        console.log(`Langue détectée: ${result.detectedLanguage}`);
      }
    } else if (options.clean) {
      console.log(`\n🧹 Nettoyage des tokens pour: "${options.clean}"\n`);
      const cleaned = cleanTranslationOutput(options.clean);
      console.log(`✅ Résultat: "${cleaned}"`);
    } else if (options.runTests) {
      await runAutomatedTests();
    } else {
      showHelp();
    }
  } catch (error) {
    console.error(`\n❌ Erreur: ${error.message}`);
    process.exit(1);
  }
}

// Exécuter le script
main().catch(error => {
  console.error(`\n❌ Erreur fatale: ${error.message}`);
  process.exit(1);
});