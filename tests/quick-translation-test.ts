/**
 * TEST RAPIDE: Vérification basique du flux de traduction
 * 
 * Ce script effectue un test rapide pour vérifier:
 * 1. Connexion au WebSocket
 * 2. Envoi d'un message
 * 3. Réception des traductions
 * 
 * Usage: ts-node quick-translation-test.ts [conversationId]
 */

import { io, Socket } from 'socket.io-client';

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3001';
const TEST_USER_ID = process.env.TEST_USER_ID || 'test-user-1';
const TEST_USER_LANGUAGE = process.env.TEST_USER_LANGUAGE || 'fr';

interface TranslationEvent {
  messageId: string;
  translations: Array<{
    targetLanguage: string;
    translatedContent: string;
  }>;
}

async function quickTest(conversationId: string): Promise<void> {
  console.log('🚀 Démarrage du test rapide...\n');
  console.log(`📍 Gateway: ${GATEWAY_URL}`);
  console.log(`📍 Conversation: ${conversationId}`);
  console.log(`👤 User: ${TEST_USER_ID} (${TEST_USER_LANGUAGE})\n`);

  return new Promise((resolve, reject) => {
    let messageId: string | null = null;
    const receivedTranslations: string[] = [];
    let timeout: NodeJS.Timeout;

    // Créer le socket
    const socket: Socket = io(GATEWAY_URL, {
      auth: {
        userId: TEST_USER_ID,
        language: TEST_USER_LANGUAGE,
      },
      transports: ['websocket'],
      reconnection: false,
    });

    // Timeout global
    const globalTimeout = setTimeout(() => {
      console.log('\n❌ Timeout global (30s)');
      socket.disconnect();
      reject(new Error('Timeout'));
    }, 30000);

    // Connexion établie
    socket.on('connect', () => {
      console.log('✅ Connecté au WebSocket');
      console.log(`📍 Socket ID: ${socket.id}\n`);

      // Rejoindre la conversation
      console.log(`🔗 Rejoindre la conversation ${conversationId}...`);
      socket.emit('conversation:join', { conversationId });

      // Attendre un peu puis envoyer le message
      setTimeout(() => {
        const testMessage = {
          conversationId,
          content: `Test rapide - ${new Date().toISOString()}`,
          originalLanguage: TEST_USER_LANGUAGE,
          messageType: 'text'
        };

        console.log(`📤 Envoi du message: "${testMessage.content}"\n`);
        socket.emit('message:send', testMessage);

        // Timeout pour les traductions
        timeout = setTimeout(() => {
          console.log('\n⏱️  Fin de l\'attente des traductions\n');
          printResults();
          cleanup();
        }, 10000);
      }, 1000);
    });

    // Message envoyé avec succès
    socket.on('message:sent', (data: any) => {
      messageId = data.messageId;
      console.log(`✅ Message envoyé: ${messageId}`);
      console.log(`📊 Status: ${data.status}\n`);
    });

    // Message original reçu
    socket.on('message:new', (data: any) => {
      console.log(`📨 Message original reçu: ${data.id || data.messageId}`);
    });

    // Traduction reçue
    socket.on('message:translation', (data: TranslationEvent) => {
      console.log(`\n🌐 Traduction reçue pour message ${data.messageId}`);
      
      if (data.translations && Array.isArray(data.translations)) {
        data.translations.forEach(translation => {
          console.log(`  ➜ ${translation.targetLanguage}: "${translation.translatedContent.substring(0, 60)}..."`);
          receivedTranslations.push(translation.targetLanguage);
        });
      }
    });

    // Erreur
    socket.on('error', (error: any) => {
      console.error(`❌ Erreur: ${JSON.stringify(error)}`);
    });

    socket.on('connect_error', (error) => {
      console.error(`❌ Erreur de connexion: ${error.message}`);
      cleanup();
      reject(error);
    });

    socket.on('disconnect', (reason) => {
      console.log(`\n🔌 Déconnecté: ${reason}`);
    });

    function printResults() {
      console.log('='.repeat(60));
      console.log('📊 RÉSULTATS');
      console.log('='.repeat(60));
      console.log(`Message ID: ${messageId || 'N/A'}`);
      console.log(`Traductions reçues: ${receivedTranslations.length}`);
      
      if (receivedTranslations.length > 0) {
        console.log(`Langues: ${[...new Set(receivedTranslations)].join(', ')}`);
        console.log('\n✅ Au moins une traduction a été reçue');
      } else {
        console.log('\n❌ Aucune traduction reçue');
        console.log('\n🔍 Possibles causes:');
        console.log('  - Le service de traduction n\'est pas démarré');
        console.log('  - La conversation n\'a qu\'un seul participant');
        console.log('  - Les traductions ne sont pas diffusées correctement');
      }
      console.log('='.repeat(60) + '\n');
    }

    function cleanup() {
      clearTimeout(timeout);
      clearTimeout(globalTimeout);
      socket.disconnect();
      resolve();
    }
  });
}

// Point d'entrée
async function main() {
  const conversationId = process.argv[2];
  
  if (!conversationId) {
    console.error('❌ Erreur: ID de conversation requis');
    console.log('\nUsage: ts-node quick-translation-test.ts <conversationId>');
    console.log('Exemple: ts-node quick-translation-test.ts meeshy\n');
    process.exit(1);
  }

  try {
    await quickTest(conversationId);
    process.exit(0);
  } catch (error) {
    console.error('❌ Test échoué:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { quickTest };

