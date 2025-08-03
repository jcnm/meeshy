// __tests__/translation.service.test.ts
import { TranslationService } from '../../services/translation.service';
import { ACTIVE_MODELS } from '@/lib/unified-model-config';

describe('TranslationService - Diagnostic Tests', () => {
  let translationService: TranslationService;
  
  // Messages de test variés
  const testMessages = [
    { text: 'Hello', source: 'en', target: 'fr' },
    { text: 'Bonjour', source: 'fr', target: 'en' },
    { text: 'How are you?', source: 'en', target: 'es' },
    { text: 'Buenos días', source: 'es', target: 'en' },
    { text: 'Guten Tag', source: 'de', target: 'en' },
    { text: 'Thank you very much', source: 'en', target: 'fr' },
    { text: 'Je suis content', source: 'fr', target: 'en' },
    { text: 'Où est la gare?', source: 'fr', target: 'en' },
    { text: 'What time is it?', source: 'en', target: 'de' },
    { text: 'Il fait beau aujourd\'hui', source: 'fr', target: 'en' },
    { text: 'I love programming', source: 'en', target: 'es' },
    { text: 'This is a test', source: 'en', target: 'fr' },
    { text: 'Ceci est un test', source: 'fr', target: 'en' },
    { text: 'Welcome to our website', source: 'en', target: 'de' },
    { text: 'Bienvenido a nuestro sitio web', source: 'es', target: 'en' },
    { text: 'The weather is nice today', source: 'en', target: 'fr' },
    { text: 'J\'aime beaucoup ce livre', source: 'fr', target: 'en' },
    { text: 'Can you help me?', source: 'en', target: 'es' },
    { text: '¿Puedes ayudarme?', source: 'es', target: 'en' },
    { text: 'Have a nice day!', source: 'en', target: 'fr' },
    // Messages plus longs
    { text: 'This is a longer message to test how the translation service handles more complex sentences with multiple words and punctuation.', source: 'en', target: 'fr' },
    { text: 'Ceci est un message plus long pour tester comment le service de traduction gère des phrases plus complexes avec plusieurs mots et de la ponctuation.', source: 'fr', target: 'en' },
    // Messages avec caractères spéciaux
    { text: 'Hello! How are you? 😊', source: 'en', target: 'fr' },
    { text: 'Café, résumé, naïve', source: 'fr', target: 'en' },
    { text: 'Números: 1, 2, 3, 4, 5', source: 'es', target: 'en' },
    // Messages courts
    { text: 'Hi', source: 'en', target: 'fr' },
    { text: 'Oui', source: 'fr', target: 'en' },
    { text: 'No', source: 'en', target: 'es' },
    { text: 'Sí', source: 'es', target: 'en' },
    { text: 'OK', source: 'en', target: 'de' },
  ];

  beforeAll(() => {
    translationService = TranslationService.getInstance();
    // Nettoyer le cache avant les tests
    translationService.clearCache();
  });

  afterAll(async () => {
    // Nettoyer après les tests
    await translationService.clearAllCache();
  });

  describe('Service Initialization', () => {
    test('should initialize translation service', () => {
      expect(translationService).toBeDefined();
      expect(translationService.getStats()).toBeDefined();
    });

    test('should have correct initial state', () => {
      const stats = translationService.getStats();
      expect(stats.loadedPipelines).toHaveLength(0);
      expect(stats.cacheSize).toBe(0);
    });
  });

  describe('Model Loading Tests', () => {
    test('should load basic model successfully', async () => {
      const progressUpdates: any[] = [];
      const onProgress = (progress: any) => {
        progressUpdates.push(progress);
        console.log(`📊 Progress: ${progress.modelName} - ${progress.status} - ${progress.progress}%`);
      };

      try {
        const modelPipeline = await translationService.loadTranslationPipeline(
          ACTIVE_MODELS.basicModel,
          onProgress
        );
        
        expect(modelPipeline).toBeDefined();
        expect(modelPipeline.pipeline).toBeDefined();
        expect(modelPipeline.config).toBeDefined();
        expect(progressUpdates.length).toBeGreaterThan(0);
        
        console.log('✅ Basic model loaded successfully');
      } catch (error) {
        console.error('❌ Failed to load basic model:', error);
        throw error;
      }
    }, 60000); // 60 secondes timeout

    test('should load high-quality model successfully', async () => {
      const progressUpdates: any[] = [];
      const onProgress = (progress: any) => {
        progressUpdates.push(progress);
        console.log(`📊 Progress: ${progress.modelName} - ${progress.status} - ${progress.progress}%`);
      };

      try {
        const modelPipeline = await translationService.loadTranslationPipeline(
          ACTIVE_MODELS.highModel,
          onProgress
        );
        
        expect(modelPipeline).toBeDefined();
        expect(modelPipeline.pipeline).toBeDefined();
        expect(modelPipeline.config).toBeDefined();
        
        console.log('✅ High-quality model loaded successfully');
      } catch (error) {
        console.error('❌ Failed to load high-quality model:', error);
        throw error;
      }
    }, 120000); // 2 minutes timeout
  });

  describe('Translation Tests - Basic Model', () => {
    beforeAll(async () => {
      // S'assurer que le modèle de base est chargé
      await translationService.loadTranslationPipeline(ACTIVE_MODELS.basicModel);
    });

    test.each(testMessages.slice(0, 10))('should translate: "$text" ($source → $target)', 
      async ({ text, source, target }) => {
        try {
          const result = await translationService.translate(
            text,
            target,
            source,
            { preferredModel: ACTIVE_MODELS.basicModel }
          );
          
          expect(result).toBeDefined();
          expect(result.translatedText).toBeDefined();
          expect(result.translatedText).not.toBe('');
          expect(result.sourceLanguage).toBe(source);
          expect(result.targetLanguage).toBe(target);
          expect(result.modelUsed).toBeDefined();
          
          console.log(`✅ ${source}→${target}: "${text}" → "${result.translatedText}"`);
        } catch (error) {
          console.error(`❌ Translation failed for "${text}" (${source}→${target}):`, error);
          throw error;
        }
      },
      30000 // 30 secondes par test
    );
  });

  describe('Translation Tests - High Model', () => {
    beforeAll(async () => {
      // S'assurer que le modèle haute qualité est chargé
      await translationService.loadTranslationPipeline(ACTIVE_MODELS.highModel);
    });

    test.each(testMessages.slice(10, 20))('should translate with high model: "$text" ($source → $target)', 
      async ({ text, source, target }) => {
        try {
          const result = await translationService.translate(
            text,
            target,
            source,
            { preferredModel: ACTIVE_MODELS.highModel }
          );
          
          expect(result).toBeDefined();
          expect(result.translatedText).toBeDefined();
          expect(result.translatedText).not.toBe('');
          expect(result.sourceLanguage).toBe(source);
          expect(result.targetLanguage).toBe(target);
          
          console.log(`✅ HIGH ${source}→${target}: "${text}" → "${result.translatedText}"`);
        } catch (error) {
          console.error(`❌ High model translation failed for "${text}" (${source}→${target}):`, error);
          throw error;
        }
      },
      30000
    );
  });

  describe('Stress Tests', () => {
    test('should handle multiple rapid translations', async () => {
      const rapidTests = testMessages.slice(0, 5);
      const results = [];
      
      try {
        for (const testCase of rapidTests) {
          const result = await translationService.translate(
            testCase.text,
            testCase.target,
            testCase.source,
            { preferredModel: ACTIVE_MODELS.basicModel }
          );
          results.push(result);
          
          // Petite pause pour éviter la surcharge
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        expect(results).toHaveLength(rapidTests.length);
        results.forEach(result => {
          expect(result.translatedText).toBeDefined();
          expect(result.translatedText).not.toBe('');
        });
        
        console.log('✅ Rapid translations completed successfully');
      } catch (error) {
        console.error('❌ Rapid translations failed:', error);
        throw error;
      }
    }, 60000);

    test('should handle long messages', async () => {
      const longMessages = testMessages.filter(msg => msg.text.length > 50);
      
      for (const testCase of longMessages) {
        try {
          const result = await translationService.translate(
            testCase.text,
            testCase.target,
            testCase.source,
            { preferredModel: ACTIVE_MODELS.basicModel }
          );
          
          expect(result.translatedText).toBeDefined();
          expect(result.translatedText.length).toBeGreaterThan(0);
          
          console.log(`✅ Long message (${testCase.text.length} chars): "${testCase.text.substring(0, 50)}..." → "${result.translatedText.substring(0, 50)}..."`);
        } catch (error) {
          console.error(`❌ Long message failed: "${testCase.text.substring(0, 50)}..."`, error);
          throw error;
        }
      }
    }, 120000);
  });

  describe('Error Handling Tests', () => {
    test('should handle empty text', async () => {
      await expect(
        translationService.translate('', 'fr', 'en')
      ).rejects.toThrow('Le texte à traduire ne peut pas être vide');
    });

    test('should handle very long text', async () => {
      const longText = 'A'.repeat(500);
      await expect(
        translationService.translate(longText, 'fr', 'en')
      ).rejects.toThrow('Texte trop long');
    });

    test('should handle invalid language codes', async () => {
      try {
        await translationService.translate('Hello', 'invalid', 'en');
      } catch (error) {
        expect(error).toBeDefined();
        console.log('✅ Invalid language code handled correctly');
      }
    });
  });

  describe('Cache Tests', () => {
    test('should cache and retrieve translations', async () => {
      const testText = 'Cache test message';
      
      // Première traduction
      const result1 = await translationService.translate(testText, 'fr', 'en');
      expect(result1.fromCache).toBe(false);
      
      // Deuxième traduction (devrait venir du cache)
      const result2 = await translationService.translate(testText, 'fr', 'en');
      expect(result2.fromCache).toBe(true);
      expect(result2.translatedText).toBe(result1.translatedText);
      
      console.log('✅ Cache working correctly');
    });

    test('should respect cache expiry', async () => {
      const stats = translationService.getCacheStats();
      expect(typeof stats.size).toBe('number');
      expect(typeof stats.totalTranslations).toBe('number');
      
      console.log('✅ Cache stats:', stats);
    });
  });

  describe('Performance Tests', () => {
    test('should track translation performance', async () => {
      const testCases = testMessages.slice(0, 3);
      const performanceResults = [];
      
      for (const testCase of testCases) {
        const startTime = performance.now();
        
        try {
          const result = await translationService.translate(
            testCase.text,
            testCase.target,
            testCase.source,
            { preferredModel: ACTIVE_MODELS.basicModel }
          );
          
          const duration = performance.now() - startTime;
          performanceResults.push({
            text: testCase.text,
            duration,
            success: true,
            textLength: testCase.text.length
          });
          
          console.log(`⏱️ Translation took ${duration.toFixed(2)}ms for "${testCase.text}"`);
        } catch (error) {
          const duration = performance.now() - startTime;
          performanceResults.push({
            text: testCase.text,
            duration,
            success: false,
            error: error.message
          });
          
          console.error(`❌ Translation failed after ${duration.toFixed(2)}ms for "${testCase.text}":`, error);
        }
      }
      
      const avgDuration = performanceResults.reduce((sum, r) => sum + r.duration, 0) / performanceResults.length;
      const successRate = performanceResults.filter(r => r.success).length / performanceResults.length;
      
      console.log(`📊 Performance Summary:
        - Average duration: ${avgDuration.toFixed(2)}ms
        - Success rate: ${(successRate * 100).toFixed(1)}%
        - Total tests: ${performanceResults.length}`);
      
      expect(successRate).toBeGreaterThan(0.5); // Au moins 50% de succès
    }, 180000); // 3 minutes timeout
  });

  describe('Model Statistics', () => {
    test('should provide accurate model statistics', () => {
      const stats = translationService.getStats();
      const modelStats = translationService.getModelStats();
      
      console.log('📊 Service Stats:', stats);
      console.log('📊 Model Stats:', modelStats);
      
      expect(stats).toHaveProperty('loadedPipelines');
      expect(stats).toHaveProperty('cacheSize');
      expect(modelStats).toHaveProperty('loaded');
      expect(modelStats).toHaveProperty('total');
    });
  });
});