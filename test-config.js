/**
 * Configuration pour les tests Meeshy
 * Centralise les paramètres de test pour éviter la duplication
 */

const config = {
    // URLs des services
    gateway: {
        url: 'https://gate.meeshy.me',
        wsUrl: 'wss://gate.meeshy.me'
    },
    
    // Authentification
    auth: {
        // Token JWT pour atabeth (à mettre à jour si nécessaire)
        jwtToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OGJlMDE1ZTdhYzBhMTVjOTAzZjQ3YWUiLCJ1c2VybmFtZSI6ImF0YWJldGgiLCJyb2xlIjoiVVNFUiIsImlhdCI6MTc1NzM2MjM5NCwiZXhwIjoxNzU3NDQ4Nzk0fQ.0Ef63v3FvgzSMFAiaY88wMVJ07ASe_4edRUNc7am31U',
        userId: '68be015e7ac0a15c903f47ae',
        username: 'atabeth'
    },
    
    // Conversations
    conversations: {
        meeshy: {
            id: '68be015e7ac0a15c903f47a8',
            identifier: 'meeshy'
        }
    },
    
    // Langues de test
    languages: {
        source: ['en', 'fr', 'es'],
        target: ['fr', 'es', 'en']
    },
    
    // Textes de test
    testTexts: {
        en: [
            'Hello world from REST API test',
            'Good morning, how are you?',
            'This is a test message for ZMQ communication'
        ],
        fr: [
            'Bonjour le monde du test API REST',
            'Bonjour, comment allez-vous?',
            'Ceci est un message de test pour la communication ZMQ'
        ],
        es: [
            'Hola mundo del test de API REST',
            'Buenos días, ¿cómo estás?',
            'Este es un mensaje de prueba para la comunicación ZMQ'
        ]
    },
    
    // Configuration des tests
    tests: {
        timeout: 10000, // 10 secondes
        retries: 3,
        expectedConfidence: 0.9, // Confiance minimale attendue
        expectedModel: 'medium' // Modèle attendu (pas 'fallback')
    },
    
    // Configuration HTTPS
    https: {
        rejectUnauthorized: false // Pour les certificats auto-signés
    }
};

module.exports = config;
