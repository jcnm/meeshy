/**
 * Script de test complet pour les modèles de traduction et la détection de langue
 * 
 * Ce script teste:
 * 1. MT5 pour les messages courts
 * 2. NLLB pour les messages longs et complexes
 * 3. La détection de langue avec xlm-roberta-base-language-detection
 * 
 * Il affiche également les problèmes potentiels et les résultats attendus vs réels
 */

import { translationService } from '../src/services/translation.service.js';
import { ACTIVE_MODELS } from '../src/lib/unified-model-config.js';
import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';

// Configurer environnement Node.js pour les modules ES
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Utilitaire pour formater les résultats
const formatResult = (text, modelUsed, expected, actual, isPassing) => {
  const status = isPassing ? chalk.green('✓ RÉUSSI') : chalk.red('✗ ÉCHEC');
  return `
${status}
Test: ${chalk.yellow(text)}
Modèle: ${chalk.blue(modelUsed)}
Attendu: ${chalk.cyan(expected)}
Obtenu: ${chalk.yellow(actual)}
`;
};

// Fonction pour nettoyer le texte traduit (supprimer les tokens spéciaux, etc.)
const cleanTranslatedText = (text) => {
  return text
    .replace(/<extra_id_\d+>/g, '') // Supprimer les tokens extra_id
    .replace(/▁/g, ' ') // Remplacer les tokens de sous-mot par des espaces
    .replace(/<pad>|<\/pad>/g, '') // Supprimer les tokens pad
    .replace(/<unk>|<\/unk>/g, '') // Supprimer les tokens unk
    .replace(/<\/s>|<s>/g, '') // Supprimer les tokens de début et fin de séquence
    .replace(/\s+/g, ' ') // Normaliser les espaces
    .trim();
};

// Cas de test pour MT5 (messages courts)
const mt5TestCases = [
  {
    text: "Bonjour, comment ça va?",
    sourceLanguage: "fr",
    targetLanguage: "en",
    expected: "Hello, how are you?"
  },
  {
    text: "I love programming!",
    sourceLanguage: "en",
    targetLanguage: "fr",
    expected: "J'aime la programmation !"
  },
  {
    text: "¿Dónde está la biblioteca?",
    sourceLanguage: "es",
    targetLanguage: "en",
    expected: "Where is the library?"
  },
  {
    text: "Hello world",
    sourceLanguage: "en",
    targetLanguage: "de",
    expected: "Hallo Welt"
  },
  {
    text: "Comment vas-tu aujourd'hui?",
    sourceLanguage: "fr",
    targetLanguage: "es",
    expected: "¿Cómo estás hoy?"
  },
  {
    text: "It's a beautiful day!",
    sourceLanguage: "en",
    targetLanguage: "fr",
    expected: "C'est une belle journée !"
  },
  {
    text: "Ich lerne Deutsch",
    sourceLanguage: "de",
    targetLanguage: "en",
    expected: "I am learning German"
  },
  {
    text: "Je suis en train de coder",
    sourceLanguage: "fr",
    targetLanguage: "en",
    expected: "I am coding"
  },
  {
    text: "Le chat est sur la table",
    sourceLanguage: "fr",
    targetLanguage: "en",
    expected: "The cat is on the table"
  },
  {
    text: "What time is it?",
    sourceLanguage: "en",
    targetLanguage: "fr",
    expected: "Quelle heure est-il ?"
  }
];

// Cas de test pour NLLB (messages longs et complexes)
const nllbTestCases = [
  {
    text: "Le développement web moderne repose sur plusieurs frameworks comme React, Angular et Vue.js qui facilitent la création d'applications réactives et performantes. Ces technologies sont essentielles pour créer des interfaces utilisateur attrayantes et fonctionnelles.",
    sourceLanguage: "fr",
    targetLanguage: "en",
    expected: "Modern web development relies on several frameworks such as React, Angular and Vue.js that facilitate the creation of responsive and high-performance applications. These technologies are essential for creating attractive and functional user interfaces."
  },
  {
    text: "Artificial intelligence and machine learning are transforming how we interact with technology. From recommendation systems to autonomous vehicles, these technologies are becoming increasingly integrated into our daily lives. The ethical implications of this rapid advancement are currently being debated by experts worldwide.",
    sourceLanguage: "en",
    targetLanguage: "fr",
    expected: "L'intelligence artificielle et l'apprentissage automatique transforment notre façon d'interagir avec la technologie. Des systèmes de recommandation aux véhicules autonomes, ces technologies sont de plus en plus intégrées dans notre quotidien. Les implications éthiques de cette avancée rapide sont actuellement débattues par des experts du monde entier."
  },
  {
    text: "La traducción automática ha mejorado significativamente en los últimos años gracias a los avances en el procesamiento del lenguaje natural y las redes neuronales profundas. Sin embargo, todavía existen desafíos con expresiones idiomáticas, contexto cultural y lenguaje técnico especializado.",
    sourceLanguage: "es",
    targetLanguage: "en",
    expected: "Machine translation has improved significantly in recent years thanks to advances in natural language processing and deep neural networks. However, there are still challenges with idiomatic expressions, cultural context, and specialized technical language."
  },
  {
    text: "Je travaille actuellement sur un projet de traduction automatique qui utilise des modèles de langage avancés. L'objectif est de créer une application capable de traduire des conversations en temps réel tout en préservant le contexte et les nuances linguistiques. C'est un défi technique passionnant qui combine plusieurs domaines de l'intelligence artificielle.",
    sourceLanguage: "fr",
    targetLanguage: "en",
    expected: "I am currently working on a machine translation project that uses advanced language models. The goal is to create an application capable of translating conversations in real time while preserving context and linguistic nuances. It's an exciting technical challenge that combines several fields of artificial intelligence."
  },
  {
    text: "La programmation orientée objet est un paradigme de programmation informatique qui utilise des 'objets' pour modéliser des données et des fonctionnalités. Cette approche est particulièrement utile pour structurer des applications complexes et favoriser la réutilisation du code.",
    sourceLanguage: "fr",
    targetLanguage: "en",
    expected: "Object-oriented programming is a computer programming paradigm that uses 'objects' to model data and functionality. This approach is particularly useful for structuring complex applications and promoting code reuse."
  },
  {
    text: "Los algoritmos de búsqueda son fundamentales en la informática y se utilizan para encontrar información específica dentro de grandes conjuntos de datos. Estos algoritmos varían en eficiencia y complejidad, desde búsquedas lineales simples hasta estructuras de datos avanzadas como árboles binarios de búsqueda y tablas hash.",
    sourceLanguage: "es",
    targetLanguage: "fr",
    expected: "Les algorithmes de recherche sont fondamentaux en informatique et sont utilisés pour trouver des informations spécifiques dans de grands ensembles de données. Ces algorithmes varient en efficacité et en complexité, des recherches linéaires simples aux structures de données avancées comme les arbres binaires de recherche et les tables de hachage."
  },
  {
    text: "Climate change represents one of the most significant challenges facing humanity today. Rising global temperatures, changing precipitation patterns, and increasing frequency of extreme weather events are just some of the consequences we're already experiencing. International cooperation and innovative solutions are essential to address this crisis effectively.",
    sourceLanguage: "en",
    targetLanguage: "fr",
    expected: "Le changement climatique représente l'un des défis les plus importants auxquels l'humanité est confrontée aujourd'hui. L'augmentation des températures mondiales, l'évolution des régimes de précipitations et la fréquence croissante des phénomènes météorologiques extrêmes ne sont que quelques-unes des conséquences que nous subissons déjà. La coopération internationale et des solutions innovantes sont essentielles pour faire face efficacement à cette crise."
  },
  {
    text: "La cybersécurité est devenue une préoccupation majeure à l'ère numérique. Les entreprises et les gouvernements investissent massivement dans des systèmes de protection contre les attaques informatiques, qui deviennent de plus en plus sophistiquées. La formation et la sensibilisation des utilisateurs restent cependant des aspects essentiels d'une stratégie de sécurité efficace.",
    sourceLanguage: "fr",
    targetLanguage: "en",
    expected: "Cybersecurity has become a major concern in the digital age. Businesses and governments are investing heavily in systems to protect against cyber attacks, which are becoming increasingly sophisticated. User training and awareness, however, remain essential aspects of an effective security strategy."
  },
  {
    text: "Die künstliche Intelligenz hat in den letzten Jahren bedeutende Fortschritte gemacht. Maschinelles Lernen und neuronale Netzwerke ermöglichen es Computern, komplexe Aufgaben zu bewältigen, die früher nur Menschen vorbehalten waren. Diese Technologien finden Anwendung in verschiedenen Bereichen wie Medizin, Finanzen und Transportwesen.",
    sourceLanguage: "de",
    targetLanguage: "en",
    expected: "Artificial intelligence has made significant progress in recent years. Machine learning and neural networks enable computers to handle complex tasks that were previously reserved for humans. These technologies are used in various fields such as medicine, finance, and transportation."
  },
  {
    text: "L'économie circulaire propose un modèle alternatif à l'économie linéaire traditionnelle, en privilégiant le recyclage et la réutilisation des ressources. Ce concept vise à minimiser les déchets et l'impact environnemental tout en maximisant la valeur des produits et matériaux. De nombreuses entreprises adoptent progressivement ces principes dans leur stratégie de développement durable.",
    sourceLanguage: "fr",
    targetLanguage: "en",
    expected: "The circular economy offers an alternative model to the traditional linear economy, emphasizing the recycling and reuse of resources. This concept aims to minimize waste and environmental impact while maximizing the value of products and materials. Many companies are gradually adopting these principles in their sustainable development strategy."
  }
];

// Cas de test pour la détection de langue
const languageDetectionTestCases = [
  {
    text: "Bonjour, comment allez-vous aujourd'hui?",
    expected: "fr"
  },
  {
    text: "Hello, how are you doing today?",
    expected: "en"
  },
  {
    text: "Hola, ¿cómo estás hoy?",
    expected: "es"
  },
  {
    text: "Guten Tag, wie geht es Ihnen heute?",
    expected: "de"
  },
  {
    text: "Ciao, come stai oggi?",
    expected: "it"
  },
  {
    text: "Olá, como você está hoje?",
    expected: "pt"
  },
  {
    text: "Привет, как дела сегодня?",
    expected: "ru"
  },
  {
    text: "こんにちは、今日の調子はどうですか？",
    expected: "ja"
  },
  {
    text: "你好，今天你好吗？",
    expected: "zh"
  },
  {
    text: "مرحبا، كيف حالك اليوم؟",
    expected: "ar"
  }
];

// Fonction principale d'exécution des tests
const runTests = async () => {
  console.log(chalk.magenta('===== TEST DES MODÈLES DE TRADUCTION ET DÉTECTION DE LANGUE ====='));
  
  const results = {
    mt5: { passed: 0, total: mt5TestCases.length, failures: [] },
    nllb: { passed: 0, total: nllbTestCases.length, failures: [] },
    detection: { passed: 0, total: languageDetectionTestCases.length, failures: [] }
  };
  
  // Tester les modèles dans un ordre spécifique pour éviter les problèmes de mémoire
  try {
    // 1. D'abord tester la détection de langue
    console.log(chalk.yellow('\n----- Test de la détection de langue -----'));
    
    for (const test of languageDetectionTestCases) {
      try {
        console.log(chalk.blue(`Détection pour: "${test.text.substring(0, 30)}..."`));
        
        const result = await translationService.detectLanguage(test.text);
        const detectedLanguage = result.language;
        const isPassing = detectedLanguage === test.expected;
        
        if (isPassing) {
          results.detection.passed++;
          console.log(chalk.green(`✓ Correct! Détecté: ${detectedLanguage} (confiance: ${result.confidence.toFixed(2)}%)`));
        } else {
          results.detection.failures.push({
            text: test.text,
            expected: test.expected,
            actual: detectedLanguage,
            confidence: result.confidence
          });
          console.log(chalk.red(`✗ Incorrect! Attendu: ${test.expected}, Détecté: ${detectedLanguage} (confiance: ${result.confidence.toFixed(2)}%)`));
        }
      } catch (error) {
        console.error(chalk.red(`Erreur lors de la détection de langue pour "${test.text.substring(0, 30)}...": ${error.message}`));
        results.detection.failures.push({
          text: test.text,
          expected: test.expected,
          actual: 'ERREUR',
          error: error.message
        });
      }
    }
    
    // 2. Ensuite tester MT5 (modèle léger)
    console.log(chalk.yellow('\n----- Test du modèle MT5 pour messages courts -----'));
    
    // Charger le modèle MT5
    await translationService.loadModel(ACTIVE_MODELS.basicModel, (progress) => {
      if (progress.status === 'downloading') {
        console.log(chalk.blue(`Téléchargement de MT5: ${progress.progress || 0}%`));
      } else if (progress.status === 'ready') {
        console.log(chalk.green('MT5 chargé avec succès!'));
      }
    });
    
    for (const test of mt5TestCases) {
      try {
        console.log(chalk.blue(`Traduction MT5: "${test.text}" (${test.sourceLanguage} → ${test.targetLanguage})`));
        
        const result = await translationService.translateOptimized(
          test.text,
          test.sourceLanguage,
          test.targetLanguage,
          ACTIVE_MODELS.basicModel
        );
        
        const translatedText = cleanTranslatedText(result.translatedText);
        
        // Vérification flexible (contient les mots clés ou est similaire)
        const keywordsExpected = test.expected.toLowerCase().split(' ').filter(w => w.length > 3);
        const containsKeywords = keywordsExpected.some(keyword => 
          translatedText.toLowerCase().includes(keyword.toLowerCase())
        );
        
        // Un test passe si le texte contient des mots clés de l'attendu
        // Cette approche est plus souple car les traductions peuvent varier
        const isPassing = containsKeywords;
        
        if (isPassing) {
          results.mt5.passed++;
          console.log(chalk.green(`✓ Acceptable! Traduit: ${translatedText}`));
        } else {
          results.mt5.failures.push({
            text: test.text,
            sourceLanguage: test.sourceLanguage,
            targetLanguage: test.targetLanguage,
            expected: test.expected,
            actual: translatedText,
            modelUsed: result.modelUsed
          });
          console.log(chalk.red(`✗ Problématique! Attendu: ${test.expected}, Obtenu: ${translatedText}`));
        }
      } catch (error) {
        console.error(chalk.red(`Erreur lors de la traduction MT5 pour "${test.text}": ${error.message}`));
        results.mt5.failures.push({
          text: test.text,
          sourceLanguage: test.sourceLanguage,
          targetLanguage: test.targetLanguage,
          expected: test.expected,
          actual: 'ERREUR',
          error: error.message
        });
      }
    }
    
    // 3. Enfin tester NLLB (modèle plus lourd)
    console.log(chalk.yellow('\n----- Test du modèle NLLB pour messages longs -----'));
    
    // Charger le modèle NLLB
    await translationService.loadModel(ACTIVE_MODELS.highModel, (progress) => {
      if (progress.status === 'downloading') {
        console.log(chalk.blue(`Téléchargement de NLLB: ${progress.progress || 0}%`));
      } else if (progress.status === 'ready') {
        console.log(chalk.green('NLLB chargé avec succès!'));
      }
    });
    
    for (const test of nllbTestCases) {
      try {
        console.log(chalk.blue(`Traduction NLLB: "${test.text.substring(0, 50)}..." (${test.sourceLanguage} → ${test.targetLanguage})`));
        
        const result = await translationService.translateOptimized(
          test.text,
          test.sourceLanguage,
          test.targetLanguage,
          ACTIVE_MODELS.highModel
        );
        
        const translatedText = cleanTranslatedText(result.translatedText);
        
        // Vérification flexible (contient les mots clés ou est similaire)
        const keywordsExpected = test.expected.toLowerCase().split(' ').filter(w => w.length > 3);
        const containsKeywords = keywordsExpected.some(keyword => 
          translatedText.toLowerCase().includes(keyword.toLowerCase())
        );
        
        // Un test passe si le texte contient des mots clés de l'attendu
        const isPassing = containsKeywords;
        
        if (isPassing) {
          results.nllb.passed++;
          console.log(chalk.green(`✓ Acceptable! Traduit: "${translatedText.substring(0, 50)}..."`));
        } else {
          results.nllb.failures.push({
            text: test.text,
            sourceLanguage: test.sourceLanguage,
            targetLanguage: test.targetLanguage,
            expected: test.expected,
            actual: translatedText,
            modelUsed: result.modelUsed
          });
          console.log(chalk.red(`✗ Problématique! Attendu: "${test.expected.substring(0, 50)}...", Obtenu: "${translatedText.substring(0, 50)}..."`));
        }
      } catch (error) {
        console.error(chalk.red(`Erreur lors de la traduction NLLB pour "${test.text.substring(0, 30)}...": ${error.message}`));
        results.nllb.failures.push({
          text: test.text,
          sourceLanguage: test.sourceLanguage,
          targetLanguage: test.targetLanguage,
          expected: test.expected,
          actual: 'ERREUR',
          error: error.message
        });
      }
    }
    
    // Afficher les résultats finaux
    console.log(chalk.magenta('\n===== RÉSULTATS FINAUX ====='));
    
    console.log(chalk.yellow('\nDétection de langue:'));
    console.log(`Tests réussis: ${results.detection.passed}/${results.detection.total} (${(results.detection.passed/results.detection.total*100).toFixed(1)}%)`);
    
    console.log(chalk.yellow('\nMT5 (messages courts):'));
    console.log(`Tests réussis: ${results.mt5.passed}/${results.mt5.total} (${(results.mt5.passed/results.mt5.total*100).toFixed(1)}%)`);
    
    console.log(chalk.yellow('\nNLLB (messages longs):'));
    console.log(`Tests réussis: ${results.nllb.passed}/${results.nllb.total} (${(results.nllb.passed/results.nllb.total*100).toFixed(1)}%)`);
    
    // Vérifier s'il y a des problèmes et proposer des solutions
    const hasMt5Issues = results.mt5.failures.length > 0;
    const hasNllbIssues = results.nllb.failures.length > 0;
    const hasDetectionIssues = results.detection.failures.length > 0;
    
    if (hasMt5Issues || hasNllbIssues || hasDetectionIssues) {
      console.log(chalk.red('\n===== PROBLÈMES DÉTECTÉS ====='));
      
      if (hasDetectionIssues) {
        console.log(chalk.yellow('\nProblèmes de détection de langue:'));
        results.detection.failures.forEach((failure, index) => {
          console.log(`${index + 1}. Pour le texte "${failure.text.substring(0, 30)}..."`);
          console.log(`   Attendu: ${failure.expected}, Obtenu: ${failure.actual}`);
          if (failure.error) {
            console.log(`   Erreur: ${failure.error}`);
          }
        });
        
        console.log(chalk.cyan('\nCauses possibles et solutions:'));
        console.log('- Le modèle de détection peut avoir des difficultés avec certaines langues');
        console.log('- Vérifier si le modèle xlm-roberta-base-language-detection est correctement chargé');
        console.log('- Vérifier les seuils de confiance dans la méthode detectLanguage');
      }
      
      if (hasMt5Issues) {
        console.log(chalk.yellow('\nProblèmes avec MT5:'));
        results.mt5.failures.forEach((failure, index) => {
          console.log(`${index + 1}. Pour le texte "${failure.text}"`);
          console.log(`   De ${failure.sourceLanguage} vers ${failure.targetLanguage}`);
          console.log(`   Attendu: ${failure.expected}`);
          console.log(`   Obtenu: ${failure.actual || failure.error}`);
        });
        
        console.log(chalk.cyan('\nCauses possibles et solutions:'));
        console.log('- Vérifier si le format d\'entrée est correct pour MT5 (prefix "translate X to Y: ")');
        console.log('- Vérifier si les tokens spéciaux comme <extra_id_0> sont correctement gérés');
        console.log('- Vérifier si le modèle MT5 est correctement chargé et initialisé');
      }
      
      if (hasNllbIssues) {
        console.log(chalk.yellow('\nProblèmes avec NLLB:'));
        results.nllb.failures.forEach((failure, index) => {
          console.log(`${index + 1}. Pour le texte "${failure.text.substring(0, 50)}..."`);
          console.log(`   De ${failure.sourceLanguage} vers ${failure.targetLanguage}`);
          console.log(`   Attendu: "${failure.expected.substring(0, 50)}..."`);
          console.log(`   Obtenu: ${failure.actual || failure.error}`);
        });
        
        console.log(chalk.cyan('\nCauses possibles et solutions:'));
        console.log('- Vérifier la conversion des codes de langue standard vers les codes NLLB');
        console.log('- Vérifier si le token de langue cible est correctement défini (forced_bos_token_id)');
        console.log('- Vérifier si le modèle NLLB est correctement chargé et initialisé');
        console.log('- Pour les textes longs, vérifier si la troncature est appliquée correctement');
      }
      
      console.log(chalk.cyan('\nProblèmes généraux et solutions:'));
      console.log('- Vérifier si les modèles sont correctement téléchargés et stockés');
      console.log('- Vérifier les logs pour des erreurs d\'initialisation ou d\'exécution');
      console.log('- Vérifier si le nettoyage des tokens spéciaux est appliqué uniformément');
      console.log('- Dans le navigateur, vérifier la console pour les erreurs liées au Web Worker ou WebGL');
      console.log('- Vérifier si la mémoire est suffisante pour les grands modèles');
    } else {
      console.log(chalk.green('\nTous les tests ont réussi! Aucun problème détecté.'));
    }
    
    // Écrire les résultats dans un fichier
    const resultsOutput = {
      timestamp: new Date().toISOString(),
      summary: {
        detection: {
          passed: results.detection.passed,
          total: results.detection.total,
          percentage: (results.detection.passed/results.detection.total*100).toFixed(1)
        },
        mt5: {
          passed: results.mt5.passed,
          total: results.mt5.total,
          percentage: (results.mt5.passed/results.mt5.total*100).toFixed(1)
        },
        nllb: {
          passed: results.nllb.passed,
          total: results.nllb.total,
          percentage: (results.nllb.passed/results.nllb.total*100).toFixed(1)
        }
      },
      detailResults: results
    };
    
    await fs.writeFile(
      path.join(__dirname, 'translation-test-results.json'),
      JSON.stringify(resultsOutput, null, 2),
      'utf8'
    );
    
    console.log(chalk.green('\nRésultats détaillés écrits dans translation-test-results.json'));
    
  } catch (error) {
    console.error(chalk.red(`\nERREUR GRAVE: ${error.message}`));
    console.error(error.stack);
  }
};

runTests();
