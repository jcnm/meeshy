/**
 * Page de test pour la détection automatique de langue
 */

'use client';

import React from 'react';
import { useLanguage as useLanguageHook } from '@/hooks/use-language';
import { useLanguage } from '@/context/LanguageContext';
import { detectBestInterfaceLanguage, getUserPreferredLanguage } from '@/utils/language-detection';
import { logLanguageDetectionInfo, testLanguageDetection } from '@/utils/language-detection-logger';

export default function LanguageTestPage() {
  const { 
    detectedInterfaceLanguage, 
    detectedSystemLanguage, 
    isDetectionComplete,
    browserLanguages 
  } = useLanguageHook();
  const { currentInterfaceLanguage, userLanguageConfig } = useLanguage();

  const handleLogInfo = () => {
    logLanguageDetectionInfo();
  };

  const handleTestDetection = () => {
    testLanguageDetection();
  };

  const handleRunDetection = () => {
    const interfaceLang = detectBestInterfaceLanguage();
    const systemLang = getUserPreferredLanguage();
    console.log('🔄 Manual detection results:', { interfaceLang, systemLang });
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Test de Détection Automatique de Langue</h1>
      
      {/* Status de détection */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
        <h2 className="text-xl font-semibold mb-4">Statut de la Détection</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="font-medium">Détection complète:</span>
            <span className={`ml-2 px-2 py-1 rounded text-sm ${isDetectionComplete ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
              {isDetectionComplete ? '✅ Oui' : '⏳ En cours'}
            </span>
          </div>
          <div>
            <span className="font-medium">Langues du navigateur:</span>
            <span className="ml-2 text-sm">{browserLanguages.join(', ')}</span>
          </div>
        </div>
      </div>

      {/* Résultats de détection */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-3">Langues Détectées</h3>
          <div className="space-y-2">
            <div>
              <span className="font-medium">Interface:</span>
              <span className="ml-2 text-blue-600 dark:text-blue-400">{detectedInterfaceLanguage}</span>
            </div>
            <div>
              <span className="font-medium">Système:</span>
              <span className="ml-2 text-green-600 dark:text-green-400">{detectedSystemLanguage}</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-3">Configuration Actuelle</h3>
          <div className="space-y-2">
            <div>
              <span className="font-medium">Interface:</span>
              <span className="ml-2 text-purple-600 dark:text-purple-400">{currentInterfaceLanguage}</span>
            </div>
            <div>
              <span className="font-medium">Système:</span>
              <span className="ml-2 text-purple-600 dark:text-purple-400">{userLanguageConfig.systemLanguage}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Analyse détaillée */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-6">
        <h3 className="text-lg font-semibold mb-3">Analyse Détaillée</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <h4 className="font-medium mb-2">Langues du navigateur:</h4>
            <ul className="text-sm space-y-1">
              {languageInfo.allLanguages.map((lang, index) => (
                <li key={index} className="flex justify-between">
                  <span>{lang}</span>
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    languageInfo.supportedLanguages.includes(lang) 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {languageInfo.supportedLanguages.includes(lang) ? 'Supportée' : 'Non supportée'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-2">Configuration utilisateur:</h4>
            <div className="text-sm space-y-1">
              <div><span className="font-medium">Système:</span> {userLanguageConfig.systemLanguage}</div>
              <div><span className="font-medium">Régionale:</span> {userLanguageConfig.regionalLanguage}</div>
              <div><span className="font-medium">Personnalisée:</span> {userLanguageConfig.customDestinationLanguage || 'Aucune'}</div>
              <div><span className="font-medium">Auto-traduction:</span> {userLanguageConfig.autoTranslateEnabled ? 'Activée' : 'Désactivée'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Boutons de test */}
      <div className="flex flex-wrap gap-4">
        <button
          onClick={handleLogInfo}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Afficher les logs détaillés
        </button>
        
        <button
          onClick={handleTestDetection}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          Tester différents scénarios
        </button>
        
        <button
          onClick={handleRunDetection}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          Relancer la détection
        </button>
      </div>

      {/* Instructions */}
      <div className="mt-8 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-3">Instructions de Test</h3>
        <ol className="list-decimal list-inside space-y-2 text-sm">
          <li>Ouvrez les outils de développement (F12)</li>
          <li>Cliquez sur "Afficher les logs détaillés" pour voir les informations complètes</li>
          <li>Changez la langue de votre navigateur et rechargez la page</li>
          <li>Vérifiez que la langue d'interface est détectée automatiquement</li>
          <li>Testez avec différentes langues supportées (en, fr, pt) et non supportées</li>
        </ol>
      </div>
    </div>
  );
}
