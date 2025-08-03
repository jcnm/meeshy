/**
 * Service Fastify Gateway avec ZeroMQ pour Meeshy
 * Architecture distribuée haute performance selon instructions Copilot
 */

const fastify = require('fastify')({ logger: true });
const zmq = require('zeromq');
const protobuf = require('protobufjs');
const path = require('path');

// Configuration ZeroMQ selon instructions
const TRANSLATION_REQUEST_PORT = 5555;  // Port vers service de traduction
const TRANSLATION_RESPONSE_PORT = 5556; // Port de réception des réponses
const FASTIFY_PORT = 3001;

class ZeroMQTranslationClient {
    constructor() {
        this.requestSocket = null;
        this.responseSocket = null;
        this.protobufRoot = null;
        this.TranslateRequest = null;
        this.TranslateResponse = null;
        this.TranslateBatchRequest = null;
        this.TranslateBatchResponse = null;
        
        // Map pour corréler les requêtes/réponses asynchrones
        this.pendingRequests = new Map();
        
        this.setupSockets();
        this.loadProtobuf();
    }
    
    setupSockets() {
        // Socket pour envoyer les requêtes au service de traduction
        this.requestSocket = new zmq.Push();
        this.requestSocket.connect(`tcp://localhost:${TRANSLATION_REQUEST_PORT}`);
        
        // Socket pour recevoir les réponses du service de traduction
        this.responseSocket = new zmq.Pull();
        this.responseSocket.bind(`tcp://*:${TRANSLATION_RESPONSE_PORT}`);
        
        // Écouter les réponses en continu
        this.startListening();
        
        console.log('✅ ZeroMQ sockets configured');
        console.log(`📤 Sending requests to translation service on port ${TRANSLATION_REQUEST_PORT}`);
        console.log(`📥 Receiving responses from translation service on port ${TRANSLATION_RESPONSE_PORT}`);
    }
    
    async startListening() {
        try {
            for await (const [messageBuffer] of this.responseSocket) {
                this.handleTranslationResponse(messageBuffer);
            }
        } catch (error) {
            console.error('Error in response listener:', error);
        }
    }
    
    async loadProtobuf() {
        try {
            const protoPath = path.join(__dirname, 'translation.proto');
            this.protobufRoot = await protobuf.load(protoPath);
            
            this.TranslateRequest = this.protobufRoot.lookupType('translation.TranslateRequest');
            this.TranslateResponse = this.protobufRoot.lookupType('translation.TranslateResponse');
            this.TranslateBatchRequest = this.protobufRoot.lookupType('translation.TranslateBatchRequest');
            this.TranslateBatchResponse = this.protobufRoot.lookupType('translation.TranslateBatchResponse');
            
            console.log('✅ Protobuf schemas loaded successfully');
        } catch (error) {
            console.error('❌ Failed to load protobuf schemas:', error);
            throw error;
        }
    }
    
    handleTranslationResponse(messageBuffer) {
        try {
            // Déterminer le type de réponse et désérialiser
            let response;
            let messageId;
            
            try {
                // Essayer TranslateResponse en premier
                response = this.TranslateResponse.decode(messageBuffer);
                messageId = response.messageId;
            } catch (e) {
                try {
                    // Essayer TranslateBatchResponse
                    response = this.TranslateBatchResponse.decode(messageBuffer);
                    messageId = response.messageId;
                } catch (e2) {
                    console.error('Failed to decode response:', e2);
                    return;
                }
            }
            
            // Trouver la requête en attente
            const pendingRequest = this.pendingRequests.get(messageId);
            if (!pendingRequest) {
                console.warn(`No pending request found for message ID: ${messageId}`);
                return;
            }
            
            // Supprimer de la map et résoudre la promesse
            this.pendingRequests.delete(messageId);
            clearTimeout(pendingRequest.timeout);
            pendingRequest.resolve(response);
            
        } catch (error) {
            console.error('Error handling translation response:', error);
        }
    }
    
    async translateMessage(messageId, text, targetLanguage, conversationId, options = {}) {
        const {
            sourceLanguage = '',
            modelTier = '',
            skipCache = false,
            timeoutMs = 5000
        } = options;
        
        // Construire la requête protobuf
        const requestData = {
            messageId,
            text,
            targetLanguage,
            conversationId,
            sourceLanguage,
            modelTier,
            skipCache
        };
        
        const request = this.TranslateRequest.create(requestData);
        const requestBuffer = this.TranslateRequest.encode(request).finish();
        
        // Créer une promesse pour la réponse asynchrone
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pendingRequests.delete(messageId);
                reject(new Error(`Translation timeout after ${timeoutMs}ms`));
            }, timeoutMs);
            
            this.pendingRequests.set(messageId, { resolve, reject, timeout });
            
            // Envoyer la requête via ZeroMQ
            this.requestSocket.send(requestBuffer).catch(reject);
        });
    }
    
    async translateToAllLanguages(messageId, text, targetLanguages, conversationId, options = {}) {
        const {
            sourceLanguage = '',
            timeoutMs = 10000
        } = options;
        
        // Construire la requête batch protobuf
        const requestData = {
            messageId,
            text,
            targetLanguages,
            conversationId,
            sourceLanguage
        };
        
        const request = this.TranslateBatchRequest.create(requestData);
        const requestBuffer = this.TranslateBatchRequest.encode(request).finish();
        
        // Créer une promesse pour la réponse asynchrone
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pendingRequests.delete(messageId);
                reject(new Error(`Batch translation timeout after ${timeoutMs}ms`));
            }, timeoutMs);
            
            this.pendingRequests.set(messageId, { resolve, reject, timeout });
            
            // Envoyer la requête via ZeroMQ
            this.requestSocket.send(requestBuffer).catch(reject);
        });
    }
    
    cleanup() {
        if (this.requestSocket) {
            this.requestSocket.close();
        }
        if (this.responseSocket) {
            this.responseSocket.close();
        }
        
        // Rejeter toutes les requêtes en attente
        for (const [, pending] of this.pendingRequests) {
            clearTimeout(pending.timeout);
            pending.reject(new Error('Service shutting down'));
        }
        this.pendingRequests.clear();
    }
}

class MeeshyGatewayService {
    constructor() {
        this.translationClient = new ZeroMQTranslationClient();
        this.connectedUsers = new Map(); // userId -> WebSocket
        this.userLanguagePreferences = new Map(); // userId -> language config
        
        this.setupRoutes();
        this.setupWebSocket();
    }
    
    setupRoutes() {
        // Route de test pour traduction
        fastify.post('/api/translate', async (request, reply) => {
            const { text, targetLanguage, sourceLanguage, modelTier } = request.body;
            
            if (!text || !targetLanguage) {
                return reply.code(400).send({ error: 'Text and targetLanguage are required' });
            }
            
            try {
                const messageId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                
                const response = await this.translationClient.translateMessage(
                    messageId,
                    text,
                    targetLanguage,
                    'test_conversation',
                    { sourceLanguage, modelTier }
                );
                
                return {
                    success: true,
                    messageId: response.messageId,
                    translatedText: response.translatedText,
                    detectedSourceLanguage: response.detectedSourceLanguage,
                    metadata: {
                        confidenceScore: response.metadata?.confidenceScore || 0,
                        fromCache: response.metadata?.fromCache || false,
                        modelUsed: response.metadata?.modelUsed || 'unknown'
                    }
                };
                
            } catch (error) {
                console.error('Translation error:', error);
                return reply.code(500).send({ 
                    error: 'Translation failed', 
                    details: error.message 
                });
            }
        });
        
        // Route de test pour traduction batch
        fastify.post('/api/translate-batch', async (request, reply) => {
            const { text, targetLanguages, sourceLanguage } = request.body;
            
            if (!text || !Array.isArray(targetLanguages) || targetLanguages.length === 0) {
                return reply.code(400).send({ 
                    error: 'Text and targetLanguages array are required' 
                });
            }
            
            try {
                const messageId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                
                const response = await this.translationClient.translateToAllLanguages(
                    messageId,
                    text,
                    targetLanguages,
                    'test_conversation',
                    { sourceLanguage }
                );
                
                return {
                    success: true,
                    messageId: response.messageId,
                    detectedSourceLanguage: response.detectedSourceLanguage,
                    translations: response.translations.map(t => ({
                        targetLanguage: t.targetLanguage,
                        translatedText: t.translatedText,
                        confidenceScore: t.confidenceScore,
                        fromCache: t.fromCache
                    }))
                };
                
            } catch (error) {
                console.error('Batch translation error:', error);
                return reply.code(500).send({ 
                    error: 'Batch translation failed', 
                    details: error.message 
                });
            }
        });
        
        // Route de santé
        fastify.get('/health', async (request, reply) => {
            return {
                status: 'UP',
                service: 'Meeshy Gateway',
                timestamp: new Date().toISOString(),
                zmq: {
                    translationRequestPort: TRANSLATION_REQUEST_PORT,
                    translationResponsePort: TRANSLATION_RESPONSE_PORT
                },
                pendingRequests: this.translationClient.pendingRequests.size
            };
        });
    }
    
    setupWebSocket() {
        fastify.register(require('@fastify/websocket'));
        
        const self = this;
        
        fastify.register(async function (fastify) {
            fastify.get('/ws', { websocket: true }, (connection, req) => {
                console.log('📱 New WebSocket connection established');
                
                connection.socket.on('message', async (message) => {
                    try {
                        const data = JSON.parse(message.toString());
                        await self.handleWebSocketMessage(connection, data);
                    } catch (error) {
                        console.error('WebSocket message error:', error);
                        connection.socket.send(JSON.stringify({
                            type: 'error',
                            message: 'Invalid message format'
                        }));
                    }
                });
                
                connection.socket.on('close', () => {
                    console.log('📱 WebSocket connection closed');
                    // Nettoyer les références utilisateur
                    for (const [userId, conn] of self.connectedUsers) {
                        if (conn === connection.socket) {
                            self.connectedUsers.delete(userId);
                            break;
                        }
                    }
                });
            });
        });
    }
    
    async handleWebSocketMessage(connection, data) {
        const { type, ...payload } = data;
        
        switch (type) {
            case 'auth':
                // Authentification utilisateur
                const { userId, languagePreferences } = payload;
                this.connectedUsers.set(userId, connection.socket);
                this.userLanguagePreferences.set(userId, languagePreferences);
                
                connection.socket.send(JSON.stringify({
                    type: 'auth_success',
                    userId
                }));
                break;
                
            case 'send_message':
                await this.handleSendMessage(connection, payload);
                break;
                
            case 'translation_request':
                await this.handleTranslationRequest(connection, payload);
                break;
                
            default:
                connection.socket.send(JSON.stringify({
                    type: 'error',
                    message: `Unknown message type: ${type}`
                }));
        }
    }
    
    async handleSendMessage(connection, payload) {
        const { 
            messageId, 
            text, 
            conversationId, 
            senderId,
            conversationParticipants 
        } = payload;
        
        try {
            // Déterminer les langues nécessaires pour tous les participants
            const requiredLanguages = new Set();
            const participantLanguageMap = new Map();
            
            for (const participant of conversationParticipants) {
                const langPrefs = this.userLanguagePreferences.get(participant.userId);
                if (langPrefs) {
                    let targetLang = langPrefs.systemLanguage;
                    
                    if (langPrefs.useCustomDestination && langPrefs.customDestinationLanguage) {
                        targetLang = langPrefs.customDestinationLanguage;
                    } else if (langPrefs.translateToRegionalLanguage) {
                        targetLang = langPrefs.regionalLanguage;
                    }
                    
                    requiredLanguages.add(targetLang);
                    participantLanguageMap.set(participant.userId, targetLang);
                } else {
                    // Langue par défaut
                    participantLanguageMap.set(participant.userId, 'fr');
                    requiredLanguages.add('fr');
                }
            }
            
            const targetLanguages = Array.from(requiredLanguages);
            
            // Traduction vers toutes les langues nécessaires via ZeroMQ
            const translationResponse = await this.translationClient.translateToAllLanguages(
                messageId,
                text,
                targetLanguages,
                conversationId
            );
            
            // Créer une map des traductions par langue
            const translationMap = new Map();
            for (const translation of translationResponse.translations) {
                translationMap.set(translation.targetLanguage, translation.translatedText);
            }
            
            // Diffuser le message à chaque participant dans sa langue préférée
            for (const participant of conversationParticipants) {
                const userSocket = this.connectedUsers.get(participant.userId);
                if (userSocket) {
                    const userLanguage = participantLanguageMap.get(participant.userId);
                    const translatedText = translationMap.get(userLanguage) || text;
                    
                    userSocket.send(JSON.stringify({
                        type: 'new_message',
                        data: {
                            messageId,
                            text: translatedText,
                            originalText: text,
                            conversationId,
                            senderId,
                            targetLanguage: userLanguage,
                            detectedSourceLanguage: translationResponse.detectedSourceLanguage,
                            timestamp: Date.now()
                        }
                    }));
                }
            }
            
            // Confirmer à l'expéditeur
            connection.socket.send(JSON.stringify({
                type: 'message_sent',
                messageId,
                success: true
            }));
            
        } catch (error) {
            console.error('Send message error:', error);
            connection.socket.send(JSON.stringify({
                type: 'message_sent',
                messageId,
                success: false,
                error: error.message
            }));
        }
    }
    
    async handleTranslationRequest(connection, payload) {
        const { messageId, text, targetLanguage, sourceLanguage, modelTier } = payload;
        
        try {
            const response = await this.translationClient.translateMessage(
                messageId || `ws_${Date.now()}`,
                text,
                targetLanguage,
                'ws_conversation',
                { sourceLanguage, modelTier }
            );
            
            connection.socket.send(JSON.stringify({
                type: 'translation_response',
                data: {
                    messageId: response.messageId,
                    translatedText: response.translatedText,
                    detectedSourceLanguage: response.detectedSourceLanguage,
                    metadata: response.metadata
                }
            }));
            
        } catch (error) {
            console.error('Translation request error:', error);
            connection.socket.send(JSON.stringify({
                type: 'translation_error',
                messageId: messageId || 'unknown',
                error: error.message
            }));
        }
    }
    
    async start() {
        try {
            await fastify.listen({ port: FASTIFY_PORT, host: '0.0.0.0' });
            console.log(`🚀 Meeshy Gateway running on port ${FASTIFY_PORT}`);
            console.log(`🔄 ZeroMQ translation integration active`);
        } catch (err) {
            fastify.log.error(err);
            process.exit(1);
        }
    }
    
    async stop() {
        this.translationClient.cleanup();
        await fastify.close();
    }
}

// Gestionnaire de signaux pour arrêt propre
const gateway = new MeeshyGatewayService();

process.on('SIGINT', async () => {
    console.log('🛑 Shutting down Meeshy Gateway...');
    await gateway.stop();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('🛑 Terminating Meeshy Gateway...');
    await gateway.stop();
    process.exit(0);
});

// Démarrer le service
gateway.start().catch(console.error);

module.exports = { MeeshyGatewayService };
