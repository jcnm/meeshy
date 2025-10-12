/**
 * TEST AUTHENTIFIÉ: Test de traduction avec utilisateur authentifié
 * 
 * Ce test s'authentifie avec admin:admin123 puis teste le flux de traduction
 */

import { io, Socket } from 'socket.io-client';

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3000';

interface AuthResponse {
  success: boolean;
  data?: {
    user: any;
    token: string;
  };
  error?: string;
}

interface TranslationEvent {
  messageId: string;
  translations: Array<{
    id?: string;
    targetLanguage: string;
    translatedContent: string;
    sourceLanguage?: string;
  }>;
}

async function authenticateUser(username: string, password: string): Promise<string> {
  console.log(`🔐 Authentification avec ${username}...`);
  
  const response = await fetch(`${GATEWAY_URL}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    throw new Error(`Authentification échouée: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as AuthResponse;
  
  if (!data.success || !data.data?.token) {
    throw new Error(`Authentification échouée: ${data.error || 'Token manquant'}`);
  }

  console.log(`✅ Authentifié: ${data.data.user.username} (${data.data.user.systemLanguage})`);
  return data.data.token;
}

async function runAuthenticatedTest(
  username: string,
  password: string,
  conversationId: string
): Promise<void> {
  console.log('🚀 Démarrage du test authentifié...\n');
  console.log(`📍 Gateway: ${GATEWAY_URL}`);
  console.log(`📍 Conversation: ${conversationId}`);
  console.log(`👤 User: ${username}\n`);

  return new Promise(async (resolve, reject) => {
    try {
      // 1. Authentification
      const token = await authenticateUser(username, password);
      console.log(`🔑 Token obtenu: ${token.substring(0, 20)}...\n`);

      let messageId: string | null = null;
      const receivedTranslations: Array<{
        language: string;
        content: string;
        timestamp: Date;
      }> = [];
      let timeout: NodeJS.Timeout;

      // 2. Connexion WebSocket avec token JWT
      console.log('🔌 Connexion au WebSocket...');
      const socket: Socket = io(GATEWAY_URL, {
        auth: {
          authToken: token, // Token JWT dans authToken
          tokenType: 'jwt',  // Spécifier que c'est un token JWT
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
        console.log(`✅ Connecté au WebSocket`);
        console.log(`📍 Socket ID: ${socket.id}\n`);

        // Rejoindre la conversation
        console.log(`🔗 Rejoindre la conversation ${conversationId}...`);
        socket.emit('conversation:join', { conversationId });

        // Attendre un peu puis envoyer le message
        setTimeout(() => {
          const testMessage = {
            conversationId,
            content: `Test authentifié - ${new Date().toISOString()}`,
            originalLanguage: 'fr',
            messageType: 'text'
          };

          console.log(`📤 Envoi du message: "${testMessage.content}"\n`);
          socket.emit('message:send', testMessage);

          // Timeout pour les traductions
          timeout = setTimeout(() => {
            console.log('\n⏱️  Fin de l\'attente des traductions (15s)\n');
            printResults();
            cleanup();
          }, 15000);
        }, 1000);
      });

      // Message envoyé avec succès
      socket.on('message:sent', (data: any) => {
        messageId = data.messageId;
        console.log(`✅ Message envoyé avec succès`);
        console.log(`📨 Message ID: ${messageId}`);
        console.log(`📊 Status: ${data.status}\n`);
      });

      // Message original reçu
      socket.on('message:new', (data: any) => {
        console.log(`📨 Message original reçu: ${data.id || data.messageId}`);
        console.log(`   Contenu: "${data.content}"`);
        console.log(`   Langue: ${data.originalLanguage}\n`);
      });

      // Traduction reçue - ÉVÉNEMENT CLÉ À OBSERVER
      socket.on('message:translation', (data: TranslationEvent) => {
        console.log(`\n🌐 TRADUCTION REÇUE pour message ${data.messageId}`);
        console.log(`📊 Nombre de traductions dans le payload: ${data.translations?.length || 0}`);
        
        if (data.translations && Array.isArray(data.translations)) {
          data.translations.forEach((translation, index) => {
            console.log(`  ${index + 1}. ${translation.targetLanguage?.toUpperCase() || 'UNKNOWN'}:`);
            console.log(`     "${translation.translatedContent.substring(0, 80)}..."`);
            
            receivedTranslations.push({
              language: translation.targetLanguage,
              content: translation.translatedContent,
              timestamp: new Date()
            });
          });
        } else {
          console.log(`  ⚠️  Aucune traduction dans le payload ou format incorrect`);
        }
      });

      // Erreur
      socket.on('error', (error: any) => {
        console.error(`❌ Erreur WebSocket: ${JSON.stringify(error)}`);
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
        console.log('='.repeat(80));
        console.log('📊 RÉSULTATS DU TEST');
        console.log('='.repeat(80));
        console.log(`Message ID: ${messageId || 'N/A'}`);
        console.log(`Événements 'message:translation' reçus: ${receivedTranslations.length > 0 ? Math.ceil(receivedTranslations.length / 4) : 0}`);
        console.log(`Total traductions reçues: ${receivedTranslations.length}`);
        
        if (receivedTranslations.length > 0) {
          const uniqueLanguages = [...new Set(receivedTranslations.map(t => t.language))];
          console.log(`Langues uniques: ${uniqueLanguages.join(', ')}`);
          console.log('');
          console.log('📋 Détail par langue:');
          uniqueLanguages.forEach(lang => {
            const count = receivedTranslations.filter(t => t.language === lang).length;
            console.log(`  - ${lang}: ${count} traduction(s)`);
          });
          
          console.log('\n✅ Des traductions ont été reçues');
          
          // Diagnostic sur le problème
          if (uniqueLanguages.length === 1) {
            console.log('\n⚠️  PROBLÈME DÉTECTÉ:');
            console.log('  Une seule langue reçue au lieu de toutes les langues des participants');
            console.log('\n🔍 CAUSE PROBABLE:');
            console.log('  L\'événement "message:translation" ne contient qu\'une traduction');
            console.log('  au lieu de toutes les traductions pour ce message.');
            console.log('\n💡 VÉRIFIER:');
            console.log('  gateway/src/socketio/MeeshySocketIOManager.ts');
            console.log('  Méthode: _handleTranslationReady()');
            console.log('  Ligne: ~847');
          } else {
            console.log('\n✅ Plusieurs langues reçues - Le système fonctionne correctement!');
          }
        } else {
          console.log('\n❌ Aucune traduction reçue');
          console.log('\n🔍 Possibles causes:');
          console.log('  - Le service de traduction n\'est pas démarré');
          console.log('  - La conversation n\'a qu\'un seul participant');
          console.log('  - L\'événement "translationReady" n\'est pas émis');
          console.log('  - La diffusion WebSocket ne fonctionne pas');
        }
        console.log('='.repeat(80) + '\n');
      }

      function cleanup() {
        clearTimeout(timeout);
        clearTimeout(globalTimeout);
        socket.disconnect();
        resolve();
      }

    } catch (error) {
      console.error('❌ Erreur durant le test:', error);
      reject(error);
    }
  });
}

// Point d'entrée
async function main() {
  const username = process.argv[2] || 'admin';
  const password = process.argv[3] || 'admin123';
  const conversationId = process.argv[4] || 'meeshy';
  
  try {
    await runAuthenticatedTest(username, password, conversationId);
    process.exit(0);
  } catch (error) {
    console.error('❌ Test échoué:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { runAuthenticatedTest };

