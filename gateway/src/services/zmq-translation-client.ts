/**
 * Client ZMQ propre pour communication avec le service de traduction
 * Pattern REQ/REP synchrone selon l'implémentation du service Python
 */

import * as zmq from 'zeromq';
import * as protobuf from 'protobufjs';
import * as path from 'path';
import { randomUUID } from 'crypto';

interface TranslationRequest {
  messageId: string;
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
  modelType?: string; // Type de modèle (basic, medium, premium)
  conversationId?: string; // ID de la conversation pour récupérer les participants
  participantIds?: string[]; // IDs des participants (optionnel pour optimisation)
  requestType?: string; // Type de requête (conversation_translation, direct_translation, etc.)
}

interface TranslationResponse {
  messageId: string;
  translatedText: string;
  detectedSourceLanguage: string;
  status: number;
  metadata?: {
    confidenceScore: number;
    fromCache: boolean;
    modelUsed: string;
  };
}

export class ZMQTranslationClient {
  private socket: zmq.Request | null = null;
  private protobufRoot: protobuf.Root | null = null;
  private TranslateRequest: protobuf.Type | null = null;
  private TranslateResponse: protobuf.Type | null = null;
  private isInitialized = false;
  
  constructor(private port = 5555, private host = 'localhost') {}
  
  async initialize(): Promise<void> {
    try {
      console.log('🔌 Initialisation du client ZMQ traduction...');
      
      // 1. Créer le socket REQ
      this.socket = new zmq.Request();
      await this.socket.connect(`tcp://${this.host}:${this.port}`);
      
      // 2. Marquer comme initialisé (pas besoin de Protobuf pour JSON)
      this.isInitialized = true;
      console.log(`✅ Client ZMQ initialisé sur tcp://${this.host}:${this.port} (mode JSON)`);
      
    } catch (error) {
      console.error('❌ Erreur initialisation client ZMQ:', error);
      throw error;
    }
  }
  
  private async loadProtobuf(): Promise<void> {
    try {
      const protoPath = path.join(__dirname, 'translation.proto');
      this.protobufRoot = await protobuf.load(protoPath);
      
      this.TranslateRequest = this.protobufRoot.lookupType('translation.TranslateRequest');
      this.TranslateResponse = this.protobufRoot.lookupType('translation.TranslateResponse');
      
      console.log('✅ Schémas Protobuf chargés');
    } catch (error) {
      console.error('❌ Erreur chargement Protobuf:', error);
      throw error;
    }
  }
  
  async translateText(request: TranslationRequest): Promise<TranslationResponse> {
    if (!this.isInitialized || !this.socket) {
      throw new Error('Client ZMQ non initialisé');
    }
    
    try {
      console.log(`🔄 DÉBUT TRADUCTION CLIENT ZMQ:`);
      console.log(`   📝 Texte complet: "${request.text}"`);
      console.log(`   🌐 ${request.sourceLanguage} → ${request.targetLanguage}`);
      console.log(`   📏 Longueur: ${request.text.length} caractères`);
      console.log(`   🆔 Message ID: ${request.messageId}`);
      
      // 1. Créer la requête JSON avec toutes les informations pour le Translator
      const jsonRequest = {
        messageId: request.messageId || randomUUID(),
        text: request.text,
        sourceLanguage: request.sourceLanguage,
        targetLanguage: request.targetLanguage,
        modelType: request.modelType || 'basic',
        // Nouvelles propriétés pour la traduction de conversation
        conversationId: request.conversationId,
        participantIds: request.participantIds,
        requestType: request.requestType || 'direct_translation'
      };
      
      console.log(`   📦 Requête JSON créée:`, jsonRequest);
      
      // 2. Sérialiser en JSON
      const requestBuffer = Buffer.from(JSON.stringify(jsonRequest), 'utf-8');
      console.log(`   🔢 Buffer JSON: ${requestBuffer.length} octets`);
      
      console.log(`📤 Envoi traduction: "${request.text}" (${request.sourceLanguage} → ${request.targetLanguage})`);
      
      // 3. Envoyer et attendre la réponse
      await this.socket.send(requestBuffer);
      console.log(`   📨 Requête envoyée, attente de la réponse...`);
      
      const [responseBuffer] = await this.socket.receive();
      console.log(`   📥 Réponse reçue: ${responseBuffer.length} octets`);
      
      // 4. Désérialiser la réponse JSON
      const responseText = responseBuffer.toString('utf-8');
      const responseObj = JSON.parse(responseText);
      
      console.log(`   📦 Réponse JSON désérialisée:`, responseObj);
      
      const response: TranslationResponse = {
        messageId: responseObj.messageId as string,
        translatedText: responseObj.translatedText as string,
        detectedSourceLanguage: responseObj.detectedSourceLanguage as string,
        status: responseObj.status as number
      };
      
      // Ajouter les métadonnées si disponibles
      if (responseObj.metadata) {
        const metadata = responseObj.metadata;
        response.metadata = {
          confidenceScore: metadata.confidenceScore as number,
          fromCache: metadata.fromCache as boolean,
          modelUsed: metadata.modelUsed as string
        };
      }
      
      console.log(`   ✅ TRADUCTION FINALE CLIENT ZMQ:`);
      console.log(`      📝 Texte original: "${request.text}"`);
      console.log(`      🌟 Texte traduit: "${response.translatedText}"`);
      console.log(`      🎯 Modèle utilisé: ${response.metadata?.modelUsed || 'N/A'}`);
      console.log(`      💫 Confiance: ${response.metadata?.confidenceScore || 'N/A'}`);
      
      console.log(`📥 Traduction reçue: "${response.translatedText}" (confiance: ${response.metadata?.confidenceScore || 'N/A'})`);
      
      return response;
      
    } catch (error) {
      console.error('❌ Erreur traduction ZMQ:', error);
      throw error;
    }
  }
  
  async translateToMultipleLanguages(
    text: string, 
    sourceLanguage: string, 
    targetLanguages: string[],
    modelType?: 'basic' | 'medium' | 'premium'
  ): Promise<TranslationResponse[]> {
    // Auto-determine model type if not provided
    const effectiveModelType = modelType || this.getPredictedModelType(text);
    
    const results: TranslationResponse[] = [];
    
    for (const targetLang of targetLanguages) {
      try {
        const result = await this.translateText({
          messageId: randomUUID(),
          text,
          sourceLanguage,
          targetLanguage: targetLang,
          modelType: effectiveModelType
        });
        results.push(result);
      } catch (error) {
        console.error(`❌ Erreur traduction vers ${targetLang}:`, error);
        // Ajouter une réponse d'erreur
        results.push({
          messageId: randomUUID(),
          translatedText: text, // Texte original en cas d'erreur
          detectedSourceLanguage: sourceLanguage,
          status: 0, // Échec
          metadata: {
            confidenceScore: 0,
            fromCache: false,
            modelUsed: 'error'
          }
        });
      }
    }
    
    return results;
  }
  
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.translateText({
        messageId: 'health-check',
        text: 'Hello',
        sourceLanguage: 'en',
        targetLanguage: 'fr'
      });
      
      return response.status === 1; // SUCCESS selon le proto
    } catch (error) {
      console.error('❌ Health check ZMQ échoué:', error);
      return false;
    }
  }
  
  // Helper method to predict model type based on text length
  getPredictedModelType(text: string): 'basic' | 'medium' | 'premium' {
    const length = text.length;
    if (length < 20) return 'basic';
    if (length <= 100) return 'medium';
    return 'premium';
  }
  
  async close(): Promise<void> {
    if (this.socket) {
      await this.socket.close();
      console.log('✅ Client ZMQ fermé');
    }
  }
}
