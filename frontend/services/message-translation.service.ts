/**
 * Service de traduction de messages pour Meeshy
 * Gère les demandes de traduction forcée via l'API Gateway
 */

import axios from 'axios';
import { buildApiUrl } from '@/lib/runtime-urls';

// === TYPES ET INTERFACES ===
export interface ForceTranslationRequest {
  messageId: string;
  targetLanguage: string;
  model?: 'basic' | 'medium' | 'premium';
}

export interface ForceTranslationResponse {
  messageId: string;
  targetLanguage: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  translationId?: string;
  estimatedTime?: number;
}

export interface MessageTranslationStatus {
  messageId: string;
  targetLanguage: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  translatedContent?: string;
  error?: string;
}

// === CONFIGURATION ===
const API_BASE_URL = buildApiUrl('');
const TIMEOUT = 30000; // 30 secondes

// === SERVICE DE TRADUCTION DE MESSAGES ===
class MessageTranslationService {
  /**
   * Demande une traduction forcée d'un message vers une langue spécifique
   */
  async requestTranslation(request: ForceTranslationRequest): Promise<ForceTranslationResponse> {
    try {
      const response = await axios.post(`${API_BASE_URL}/messages/${request.messageId}/translate`, {
        targetLanguage: request.targetLanguage,
        model: request.model || 'basic'
      }, {
        timeout: TIMEOUT,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      return {
        messageId: request.messageId,
        targetLanguage: request.targetLanguage,
        status: response.data.status || 'pending',
        translationId: response.data.translationId,
        estimatedTime: response.data.estimatedTime
      };
    } catch (error: any) {
      console.error('Erreur lors de la demande de traduction:', error);
      throw new Error(`Impossible de demander la traduction: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Vérifie le statut d'une traduction en cours
   */
  async getTranslationStatus(messageId: string, targetLanguage: string): Promise<MessageTranslationStatus> {
    try {
      const response = await axios.get(`${API_BASE_URL}/messages/${messageId}/translate/${targetLanguage}/status`, {
        timeout: 10000
      });

      return {
        messageId,
        targetLanguage,
        status: response.data.status,
        progress: response.data.progress,
        translatedContent: response.data.translatedContent,
        error: response.data.error
      };
    } catch (error: any) {
      console.error('Erreur lors de la vérification du statut:', error);
      return {
        messageId,
        targetLanguage,
        status: 'failed',
        error: 'Impossible de vérifier le statut'
      };
    }
  }

  /**
   * Annule une traduction en cours
   */
  async cancelTranslation(messageId: string, targetLanguage: string): Promise<boolean> {
    try {
      await axios.delete(`${API_BASE_URL}/messages/${messageId}/translate/${targetLanguage}`, {
        timeout: 10000
      });
      return true;
    } catch (error: any) {
      console.error('Erreur lors de l\'annulation:', error);
      return false;
    }
  }

  /**
   * Obtient toutes les traductions disponibles pour un message
   */
  async getMessageTranslations(messageId: string): Promise<MessageTranslationStatus[]> {
    try {
      const response = await axios.get(`${API_BASE_URL}/messages/${messageId}/translations`, {
        timeout: 10000
      });

      return response.data.translations || [];
    } catch (error: any) {
      console.error('Erreur lors de la récupération des traductions:', error);
      return [];
    }
  }
}

// Instance singleton
export const messageTranslationService = new MessageTranslationService();

// Export par défaut
export default messageTranslationService;
