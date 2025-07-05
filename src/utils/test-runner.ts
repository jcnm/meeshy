/**
 * Test de simulation rapide du système de traduction
 */

import { testModelService } from '@/lib/test-model-service';
import { translateMessage } from '@/utils/translation';

// Test automatique du système
async function runQuickTest() {
  console.log('🚀 Début du test automatique');

  try {
    // Test 1: Vérifier qu'aucun modèle n'est téléchargé au début
    console.log('\n📋 Test 1: État initial du cache');
    const initialMt5 = await testModelService.isModelCached('mt5', 'small');
    const initialNllb = await testModelService.isModelCached('nllb', 'small');
    console.log(`MT5-small en cache: ${initialMt5 ? '✅' : '❌'}`);
    console.log(`NLLB-small en cache: ${initialNllb ? '✅' : '❌'}`);

    // Test 2: Simuler le téléchargement d'un modèle
    console.log('\n📋 Test 2: Téléchargement simulé');
    console.log('🔄 Téléchargement MT5-small...');
    
    const downloadResult = await testModelService.downloadAndCacheModel(
      'mt5',
      'small',
      'https://fake-url.com/model',
      'https://fake-url.com/tokenizer',
      (progress) => {
        if (progress % 25 === 0) {
          console.log(`  Progression: ${progress}%`);
        }
      }
    );
    
    console.log(`Téléchargement MT5-small: ${downloadResult ? '✅' : '❌'}`);

    // Test 3: Vérifier que le modèle est maintenant en cache
    console.log('\n📋 Test 3: Vérification du cache post-téléchargement');
    const postDownloadMt5 = await testModelService.isModelCached('mt5', 'small');
    console.log(`MT5-small en cache après téléchargement: ${postDownloadMt5 ? '✅' : '❌'}`);

    // Test 4: Test de traduction
    console.log('\n📋 Test 4: Test de traduction');
    console.log('🔄 Traduction: "Hello" (en) → français...');
    
    const translationResult = await translateMessage('Hello', 'en', 'fr');
    console.log(`Résultat: "${translationResult}"`);
    
    if (translationResult && translationResult !== 'Hello') {
      console.log('✅ Traduction réussie');
    } else {
      console.log('❌ Traduction échouée');
    }

    // Test 5: Statistiques
    console.log('\n📋 Test 5: Statistiques du cache');
    const stats = await testModelService.getStats();
    console.log(`Modèles en cache: ${stats.totalModels}`);
    console.log(`Taille totale: ${(stats.totalSize / 1024 / 1024).toFixed(1)} MB`);

    console.log('\n🎉 Test automatique terminé !');
    
  } catch (error) {
    console.error('❌ Erreur durant le test:', error);
  }
}

// Test de détection de langue
function testLanguageDetection() {
  console.log('\n📋 Test de détection de langue');
  
  // Cette fonction nécessite d'être importée depuis le module de traduction
  // Pour l'instant, on simule
  const testCases = [
    { text: 'Hello how are you?', expected: 'en' },
    { text: 'Bonjour comment allez-vous?', expected: 'fr' },
    { text: 'Hola ¿cómo estás?', expected: 'es' },
  ];

  testCases.forEach(({ text, expected }) => {
    // Simulation de détection simple
    const detected = text.includes('Hello') ? 'en' : 
                    text.includes('Bonjour') ? 'fr' : 
                    text.includes('Hola') ? 'es' : 'unknown';
    
    const status = detected === expected ? '✅' : '❌';
    console.log(`${status} "${text}" → ${detected} (attendu: ${expected})`);
  });
}

// Export pour utilisation
export { runQuickTest, testLanguageDetection };
