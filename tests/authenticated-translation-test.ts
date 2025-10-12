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
  translation: {
    id?: string;
    targetLanguage: string;
    translatedContent: string;
    sourceLanguage?: string;
  };
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
      // FORMAT: Une traduction par événement (diffusion immédiate)
      socket.on('message:translation', (data: TranslationEvent) => {
        console.log(`\n🌐 TRADUCTION REÇUE pour message ${data.messageId}`);
        console.log(`📊 Format: Traduction unique (diffusion immédiate)`);
        
        if (data.translation) {
          console.log(`  ➜ ${data.translation.targetLanguage?.toUpperCase() || 'UNKNOWN'}:`);
          console.log(`     "${data.translation.translatedContent.substring(0, 80)}..."`);
          
          receivedTranslations.push({
            language: data.translation.targetLanguage,
            content: data.translation.translatedContent,
            timestamp: new Date()
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
        console.log(`Format: Diffusion immédiate (une traduction par événement)`);
        console.log(`Événements 'message:translation' reçus: ${receivedTranslations.length}`);
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
          console.log(`💡 Note: Chaque traduction arrive dans un événement séparé (diffusion immédiate)`);
          
          // Vérifier si toutes les langues attendues sont reçues
          // Pour la conversation "meeshy", on devrait avoir au moins 2-3 langues
          if (uniqueLanguages.length >= 2) {
            console.log('\n✅ Plusieurs langues reçues - Le système fonctionne correctement!');
            console.log('   Le format de diffusion immédiate fonctionne comme prévu.');
          } else if (uniqueLanguages.length === 1) {
            console.log('\n⚠️  UNE SEULE LANGUE REÇUE');
            console.log('🔍 Vérifications à faire:');
            console.log('  1. La conversation a-t-elle plusieurs participants avec des langues différentes?');
            console.log('  2. Les traductions sont-elles générées pour toutes les langues?');
            console.log('  3. Vérifier les logs du TranslationService pour voir les langues extraites');
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

