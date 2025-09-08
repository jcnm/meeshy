const { io } = require('socket.io-client');
const config = require('./test-config');

async function testWebSocketCommunication() {
    console.log('🔌 Test de communication WebSocket...');
    
    // Configuration depuis le fichier centralisé
    const JWT_TOKEN = config.auth.jwtToken;
    const GATEWAY_WS_URL = config.gateway.wsUrl;
    
    // Connexion au WebSocket via Traefik
    const socket = io(GATEWAY_WS_URL, {
        transports: ['websocket'],
        rejectUnauthorized: config.https.rejectUnauthorized,
        extraHeaders: {
            'Authorization': `Bearer ${JWT_TOKEN}`
        }
    });

    socket.on('connect', () => {
        console.log('✅ Connecté au WebSocket');
        console.log('🆔 Socket ID:', socket.id);
        
        // Rejoindre la conversation meeshy (événement optionnel)
        socket.emit('join_conversation', { conversationId: 'meeshy' });
        
        // Envoyer un message de test avec traduction automatique
        setTimeout(() => {
            console.log('📤 Envoi d\'un message de test...');
            socket.emit('message:send', {
                conversationId: config.conversations.meeshy.identifier,
                content: 'Hello world from WebSocket test',
                originalLanguage: 'en',
                messageType: 'TEXT'
            }, (response) => {
                console.log('📥 Réponse du message:', response);
                if (response.success) {
                    console.log('✅ Message envoyé avec succès, ID:', response.data.messageId);
                    console.log('🔄 Traduction automatique en cours via ZMQ...');
                }
            });
        }, 2000);
    });

    // Écouter les messages reçus
    socket.on('message_received', (data) => {
        console.log('📥 Message reçu:', data);
    });

    // Écouter les traductions (événements Socket.IO)
    socket.on('message_translated', (data) => {
        console.log('🔄 Message traduit:', data);
    });

    socket.on('translation_complete', (data) => {
        console.log('✅ Traduction terminée:', data);
    });

    // Écouter les traductions via ZMQ (événements personnalisés)
    socket.on('translation:ready', (data) => {
        console.log('🌍 Traduction ZMQ reçue:', {
            messageId: data.messageId,
            translatedText: data.translatedText,
            targetLanguage: data.targetLanguage,
            confidence: data.confidenceScore
        });
    });

    socket.on('error', (error) => {
        console.error('❌ Erreur WebSocket:', error);
    });

    socket.on('disconnect', (reason) => {
        console.log('🔌 Déconnecté:', reason);
    });

    // Attendre 10 secondes puis fermer
    setTimeout(() => {
        console.log('🔚 Fermeture de la connexion...');
        socket.disconnect();
        process.exit(0);
    }, 10000);
}

testWebSocketCommunication().catch(console.error);
