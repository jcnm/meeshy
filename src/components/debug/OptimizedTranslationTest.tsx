/**
 * Composant de test pour la stratégie de traduction optimisée
 * Démontre l'utilisation du système de chargement multi-niveaux
 */

'use client';

import React from 'react';
import { useOptimizedTranslation } from '@/hooks/use-optimized-translation';
import type { User } from '@/types';

interface OptimizedTranslationTestProps {
  user: User | null;
}

export function OptimizedTranslationTest({ user }: OptimizedTranslationTestProps) {
  const {
    conversationsMetadata,
    isLoading,
    loadingState,
    translations,
    error,
    initialize,
    clearCache,
    performanceMetrics
  } = useOptimizedTranslation({ 
    user, 
    autoInitialize: true,
    enableBackgroundProcessing: true 
  });

  const getPhaseIcon = (phase: typeof loadingState.phase) => {
    switch (phase) {
      case 'STARTUP': return '🚀';
      case 'PRIORITY_TRANSLATION': return '🎯';
      case 'LAZY_TRANSLATION': return '🔄';
      case 'COMPLETE': return '✅';
      default: return '❓';
    }
  };

  const getPhaseColor = (phase: typeof loadingState.phase) => {
    switch (phase) {
      case 'STARTUP': return 'text-blue-600';
      case 'PRIORITY_TRANSLATION': return 'text-orange-600';
      case 'LAZY_TRANSLATION': return 'text-purple-600';
      case 'COMPLETE': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  if (!user) {
    return (
      <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
        <h3 className="text-lg font-semibold text-yellow-800 mb-2">
          ⚠️ Utilisateur requis
        </h3>
        <p className="text-yellow-700">
          Veuillez vous connecter pour tester la stratégie de traduction optimisée.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="border-b pb-4">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          🧠 Test de la Stratégie de Traduction Optimisée
        </h2>
        <p className="text-gray-600">
          Démonstration du chargement hiérarchique et de la traduction intelligente par priorité
        </p>
      </div>

      {/* État de chargement */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-800">
            {getPhaseIcon(loadingState.phase)} État du chargement
          </h3>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getPhaseColor(loadingState.phase)} bg-opacity-10`}>
            {loadingState.phase}
          </span>
        </div>
        
        {/* Barre de progression */}
        <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${loadingState.progress}%` }}
          />
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Conversations:</span>
            <span className="font-semibold ml-1">
              {loadingState.conversationsLoaded}/{loadingState.totalConversations}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Traductions:</span>
            <span className="font-semibold ml-1">
              {loadingState.translationsCompleted}/{loadingState.totalTranslations}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Progression:</span>
            <span className="font-semibold ml-1">{loadingState.progress.toFixed(1)}%</span>
          </div>
          <div>
            <span className="text-gray-500">Temps estimé:</span>
            <span className="font-semibold ml-1">
              {loadingState.estimatedTimeRemaining > 0 ? `${loadingState.estimatedTimeRemaining}ms` : 'N/A'}
            </span>
          </div>
        </div>

        {loadingState.currentTask && (
          <div className="mt-3 text-sm text-gray-600">
            <span className="font-medium">Tâche actuelle:</span> {loadingState.currentTask}
          </div>
        )}
      </div>

      {/* Erreurs */}
      {error && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-red-800 mb-2">❌ Erreur</h3>
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Erreurs du système */}
      {loadingState.errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-red-800 mb-2">
            ⚠️ Erreurs système ({loadingState.errors.length})
          </h3>
          <div className="space-y-2">
            {loadingState.errors.slice(0, 3).map((err, index) => (
              <div key={index} className="text-sm text-red-700">
                <span className="font-medium">[{err.type}]</span> {err.message}
                {err.recoverable && <span className="text-green-600 ml-2">✓ Récupérable</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Résultats */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Métadonnées des conversations */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-blue-800 mb-3">
            📋 Métadonnées des conversations ({conversationsMetadata.length})
          </h3>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {conversationsMetadata.slice(0, 5).map((conv) => (
              <div key={conv.id} className="bg-white p-3 rounded border">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium text-gray-900">
                      {conv.title || 'Sans titre'}
                    </h4>
                    <p className="text-sm text-gray-600">
                      {conv.isGroup ? '👥 Groupe' : '💬 Direct'} • {conv.participantCount} participants
                    </p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    conv.priority === 'CRITICAL' ? 'bg-red-100 text-red-800' :
                    conv.priority === 'HIGH' ? 'bg-orange-100 text-orange-800' :
                    conv.priority === 'NORMAL' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {conv.priority}
                  </span>
                </div>
                {conv.lastMessage && (
                  <div className="mt-2 text-sm">
                    <p className="text-gray-700 truncate">
                      💬 {conv.lastMessage.content}
                    </p>
                    {conv.lastMessage.isTranslated && (
                      <p className="text-green-600 mt-1">
                        🌐 Traduit: {conv.lastMessage.translatedContent}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
            {conversationsMetadata.length > 5 && (
              <div className="text-center text-gray-500 text-sm">
                ... et {conversationsMetadata.length - 5} autres
              </div>
            )}
          </div>
        </div>

        {/* Traductions */}
        <div className="bg-green-50 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-green-800 mb-3">
            🌐 Traductions effectuées ({translations.size})
          </h3>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {Array.from(translations.entries()).slice(0, 5).map(([id, translation]) => (
              <div key={id} className="bg-white p-3 rounded border">
                <div className="text-sm">
                  <span className="font-medium text-gray-600">ID:</span>
                  <span className="ml-1 font-mono text-xs">{id}</span>
                </div>
                <div className="mt-1 text-sm text-gray-700">
                  {translation}
                </div>
              </div>
            ))}
            {translations.size > 5 && (
              <div className="text-center text-gray-500 text-sm">
                ... et {translations.size - 5} autres
              </div>
            )}
            {translations.size === 0 && (
              <div className="text-center text-gray-500 text-sm py-4">
                Aucune traduction effectuée
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Métriques de performance */}
      <div className="bg-purple-50 p-4 rounded-lg">
        <h3 className="text-lg font-semibold text-purple-800 mb-3">
          📊 Métriques de performance
        </h3>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-white p-3 rounded border">
            <h4 className="font-medium text-gray-800">Cache</h4>
            <pre className="text-xs text-gray-600 mt-1 overflow-hidden">
              {JSON.stringify(performanceMetrics.cache, null, 2).slice(0, 200)}...
            </pre>
          </div>
          <div className="bg-white p-3 rounded border">
            <h4 className="font-medium text-gray-800">Traduction</h4>
            <pre className="text-xs text-gray-600 mt-1 overflow-hidden">
              {JSON.stringify(performanceMetrics.translation, null, 2).slice(0, 200)}...
            </pre>
          </div>
          <div className="bg-white p-3 rounded border">
            <h4 className="font-medium text-gray-800">Queue</h4>
            <pre className="text-xs text-gray-600 mt-1 overflow-hidden">
              {JSON.stringify(performanceMetrics.queue, null, 2).slice(0, 200)}...
            </pre>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-4 pt-4 border-t">
        <button
          onClick={initialize}
          disabled={isLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? '⏳ Chargement...' : '🔄 Réinitialiser'}
        </button>
        
        <button
          onClick={clearCache}
          disabled={isLoading}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          🧹 Vider le cache
        </button>
      </div>
    </div>
  );
}
