import { useState, useCallback, useMemo } from 'react';
import type { BubbleTranslation, User, Message } from '@shared/types';

interface BubbleStreamMessage extends Message {
  location?: string;
  originalLanguage: string;
  isTranslated: boolean;
  translatedFrom?: string;
  translations: BubbleTranslation[];
  originalContent: string; // Nouveau : contenu original de l'auteur
}

interface UseMessageTranslationsProps {
  currentUser: User;
}

interface UseMessageTranslationsReturn {
  processMessageWithTranslations: (message: any) => BubbleStreamMessage;
  getPreferredLanguageContent: (message: BubbleStreamMessage) => {
    content: string;
    isTranslated: boolean;
    translatedFrom?: string;
  };
  getUserLanguagePreferences: () => string[];
  resolveUserPreferredLanguage: () => string;
  shouldRequestTranslation: (message: BubbleStreamMessage, targetLanguage?: string) => boolean;
  getRequiredTranslations: (message: BubbleStreamMessage) => string[];
}

/**
 * Hook personnalisé pour gérer les traductions des messages
 * Selon les instructions Copilot pour Meeshy
 */
export function useMessageTranslations({ 
  currentUser 
}: UseMessageTranslationsProps): UseMessageTranslationsReturn {
  
  /**
   * Résout la langue préférée de l'utilisateur selon la logique Meeshy
   */
  const resolveUserPreferredLanguage = useCallback((): string => {
    if (currentUser.useCustomDestination && currentUser.customDestinationLanguage) {
      return currentUser.customDestinationLanguage;
    }
    
    if (currentUser.translateToSystemLanguage) {
      return currentUser.systemLanguage;
    }
    
    if (currentUser.translateToRegionalLanguage) {
      return currentUser.regionalLanguage;
    }
    
    return currentUser.systemLanguage; // fallback
  }, [currentUser]);

  /**
   * Obtient toutes les langues configurées par l'utilisateur
   */
  const getUserLanguagePreferences = useCallback((): string[] => {
    const languages = new Set<string>();
    
    // Langue système (toujours incluse)
    languages.add(currentUser.systemLanguage);
    
    // Langue régionale si différente et activée
    if (currentUser.translateToRegionalLanguage && 
        currentUser.regionalLanguage !== currentUser.systemLanguage) {
      languages.add(currentUser.regionalLanguage);
    }
    
    // Langue personnalisée si différente et activée
    if (currentUser.useCustomDestination && 
        currentUser.customDestinationLanguage &&
        currentUser.customDestinationLanguage !== currentUser.systemLanguage &&
        currentUser.customDestinationLanguage !== currentUser.regionalLanguage) {
      languages.add(currentUser.customDestinationLanguage);
    }
    
    return Array.from(languages);
  }, [currentUser]);

  /**
   * Traite un message brut et le convertit en BubbleStreamMessage avec traductions
   */
  const processMessageWithTranslations = useCallback((message: any): BubbleStreamMessage => {
    console.log(`🔄 [TRANSLATION_PROCESSOR] Début traitement message ${message.id}:`);
    console.log(`  - Original Language: ${message.originalLanguage}`);
    console.log(`  - Raw translations count: ${message.translations?.length || 0}`);
    console.log(`  - Raw translations data:`, message.translations);
    console.log(`  - Message content: ${message.content?.substring(0, 50)}...`);

    // Convertir les traductions backend vers le format BubbleTranslation
    // CORRECTION: Déduplication des traductions par langue pour éviter les doublons
    const translationsMap = new Map<string, BubbleTranslation>();
    
    // 🔍 DEBUG: Examiner les traductions brutes avant filtrage
    console.log(`  🔍 FILTRAGE-DEBUG Message ${message.id}:`);
    (message.translations || []).forEach((t: any, idx: number) => {
      console.log(`    [${idx}] Traduction brute:`, {
        id: t.id,
        targetLanguage: t.targetLanguage,
        translatedContent: t.translatedContent?.substring(0, 30) + '...',
        language: t.language, // Propriété alternative
        content: t.content?.substring(0, 30) + '...', // Propriété alternative
        hasTargetLanguage: !!t.targetLanguage,
        hasTranslatedContent: !!t.translatedContent,
        hasLanguage: !!t.language,
        hasContent: !!t.content
      });
    });
    
    const validTranslations = (message.translations || [])
      .filter((t: any) => {
        // Support des deux formats possibles: targetLanguage/translatedContent OU language/content
        const hasValidStructure = t && (
          (t.targetLanguage && t.translatedContent) || 
          (t.language && t.content)
        );
        
        // CORRECTION CRITIQUE: Ne pas filtrer les traductions valides avec du contenu
        if (!hasValidStructure) {
          console.log(`    ❌ Traduction filtrée (structure invalide):`, { 
            t, 
            hasTargetLanguage: !!t?.targetLanguage, 
            hasTranslatedContent: !!t?.translatedContent, 
            hasLanguage: !!t?.language, 
            hasContent: !!t?.content 
          });
          return false;
        }
        
        // Vérifier si le contenu traduit n'est pas vide
        const translatedContent = t.translatedContent || t.content;
        if (!translatedContent || translatedContent.trim() === '') {
          console.log(`    ❌ Traduction filtrée (contenu vide):`, { t });
          return false;
        }
        
        console.log(`    ✅ Traduction valide conservée:`, { 
          language: t.targetLanguage || t.language,
          contentPreview: translatedContent.substring(0, 30) + '...'
        });
        
        return true;
      });
    
    console.log(`  📊 Traductions après filtrage: ${validTranslations.length}/${(message.translations || []).length}`);
    
    validTranslations.forEach((t: any) => {
        // Support des deux formats de propriétés
        const language = t.targetLanguage || t.language;
        const content = t.translatedContent || t.content;
        const currentTimestamp = new Date(t.createdAt || message.createdAt);
        
        console.log(`    ✅ Traitement traduction ${language}:`, { 
          content: content?.substring(0, 30) + '...',
          translationModel: t.translationModel,
          cacheKey: t.cacheKey,
          cached: t.cached
        });
        
        // CORRECTION: Améliorer la logique de déduplication des traductions
        const existingTranslation = translationsMap.get(language);
        const shouldReplace = !existingTranslation || 
          currentTimestamp > new Date(existingTranslation.timestamp) ||
          (t.translationModel === 'premium' && existingTranslation.confidence < 0.95);
        
        if (shouldReplace) {
          const translation: BubbleTranslation = {
            language: language,
            content: content,
            status: 'completed' as const,
            timestamp: currentTimestamp,
            confidence: t.confidenceScore || t.confidence || 0.9
          };
          
          translationsMap.set(language, translation);
          console.log(`    📦 Traduction ${language} ${existingTranslation ? 'remplacée' : 'ajoutée'} dans la map`);
        } else {
          console.log(`    ⏭️ Traduction ${language} existante conservée (plus récente ou meilleure qualité)`);
        }
      });
    
    const translations: BubbleTranslation[] = Array.from(translationsMap.values());
    
    // Log des traductions dédupliquées
    translations.forEach(translation => {
      console.log(`  📝 Traduction ${translation.language}:`, {
        language: translation.language,
        content: translation.content.substring(0, 50) + '...',
        status: translation.status,
        confidence: translation.confidence
      });
    });

    const originalLanguage = message.originalLanguage || 'fr';
    const preferredLanguage = resolveUserPreferredLanguage();
    
    console.log(`  🎯 Langues:`, {
      original: originalLanguage,
      preferred: preferredLanguage,
      availableTranslations: translations.map(t => t.language)
    });
    
    // Déterminer le contenu à afficher selon les préférences utilisateur
    let displayContent = message.content;
    let isTranslated = false;
    let translatedFrom: string | undefined;
    
    // Si le message n'est pas dans la langue préférée de l'utilisateur
    if (originalLanguage !== preferredLanguage) {
      // Chercher une traduction dans la langue préférée
      const preferredTranslation = translations.find(t => 
        t.language === preferredLanguage && t.status === 'completed'
      );
      
      if (preferredTranslation) {
        displayContent = preferredTranslation.content;
        isTranslated = true;
        translatedFrom = originalLanguage;
        console.log(`  ✅ Utilisation traduction ${originalLanguage} → ${preferredLanguage}`);
      } else {
        // Pas de traduction disponible, marquer comme nécessitant une traduction
        isTranslated = false;
        translatedFrom = originalLanguage;
        console.log(`  ⏳ Traduction nécessaire ${originalLanguage} → ${preferredLanguage}`);
      }
    } else {
      console.log(`  📍 Message déjà dans la langue préférée (${preferredLanguage})`);
    }

    const result: BubbleStreamMessage = {
      ...message,
      content: displayContent, // Contenu d'affichage (peut être traduit)
      originalContent: message.originalContent || message.content, // CORRECTION: Préserver le contenu original de l'auteur
      originalLanguage,
      isTranslated,
      translatedFrom,
      location: message.location || 'Paris',
      translations
    };

    console.log(`🏁 [TRANSLATION_PROCESSOR] Résultat final message ${result.id}:`);
    console.log(`  - Is Translated: ${result.isTranslated}`);
    console.log(`  - Processed translations count: ${result.translations.length}`);
    console.log(`  - Display content: ${result.content.substring(0, 50)}...`);
    console.log(`  - Processed translations:`, result.translations);
    console.log(`  - Available languages:`, result.translations.map(t => t.language));

    return result;
  }, [resolveUserPreferredLanguage]);

  /**
   * Obtient le contenu dans la langue préférée de l'utilisateur
   */
  const getPreferredLanguageContent = useCallback((message: BubbleStreamMessage) => {
    const preferredLanguage = resolveUserPreferredLanguage();
    
    // Si c'est déjà dans la langue préférée
    if (message.originalLanguage === preferredLanguage) {
      return {
        content: message.content,
        isTranslated: false
      };
    }
    
    // Chercher une traduction dans la langue préférée
    const preferredTranslation = message.translations?.find(t => 
      t.language === preferredLanguage && t.status === 'completed'
    );
    
    if (preferredTranslation) {
      return {
        content: preferredTranslation.content,
        isTranslated: true,
        translatedFrom: message.originalLanguage
      };
    }
    
    // Pas de traduction disponible
    return {
      content: message.content,
      isTranslated: false,
      translatedFrom: message.originalLanguage
    };
  }, [resolveUserPreferredLanguage]);

  /**
   * Vérifie si une traduction est nécessaire pour un message
   */
  const shouldRequestTranslation = useCallback((message: BubbleStreamMessage, targetLanguage?: string): boolean => {
    const targetLang = targetLanguage || resolveUserPreferredLanguage();
    
    // Pas besoin de traduire si c'est déjà dans la langue cible
    if (message.originalLanguage === targetLang) {
      return false;
    }
    
    // Vérifier si la traduction existe déjà
    const existingTranslation = message.translations?.find(t => 
      t.language === targetLang && t.status === 'completed'
    );
    
    return !existingTranslation;
  }, [resolveUserPreferredLanguage]);

  /**
   * Obtient la liste des langues pour lesquelles des traductions sont nécessaires
   */
  const getRequiredTranslations = useCallback((message: BubbleStreamMessage): string[] => {
    const userLanguagePrefs = getUserLanguagePreferences();
    const missingTranslations: string[] = [];
    
    userLanguagePrefs.forEach(lang => {
      if (shouldRequestTranslation(message, lang)) {
        missingTranslations.push(lang);
      }
    });
    
    return missingTranslations;
  }, [getUserLanguagePreferences, shouldRequestTranslation]);

  return {
    processMessageWithTranslations,
    getPreferredLanguageContent,
    getUserLanguagePreferences,
    resolveUserPreferredLanguage,
    shouldRequestTranslation,
    getRequiredTranslations
  };
}
