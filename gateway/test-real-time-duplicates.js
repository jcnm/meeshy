// Test en temps réel pour détecter l'origine des doublons
const { PrismaClient } = require('./shared/prisma/client');
const io = require('socket.io-client');

const prisma = new PrismaClient();
const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3000';

let testMessageId = null;
const translationsReceived = [];
const translationsInDB = [];

async function authenticateUser() {
  console.log('🔐 Authentification...');
  
  const response = await fetch(`${GATEWAY_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  });

  const data = await response.json();
  
  if (!data.success || !data.data?.token) {
    throw new Error('Authentification échouée');
  }

  console.log(`✅ Authentifié: ${data.data.user.username}\n`);
  return data.data.token;
}

async function testRealTime() {
  let socket;
  
  try {
    console.log('🚀 TEST EN TEMPS RÉEL - DÉTECTION DE DOUBLONS\n');
    console.log('=' .repeat(70));
    console.log('');
    
    // 1. S'authentifier
    const token = await authenticateUser();
    
    // 2. Connecter WebSocket
    console.log('🔌 Connexion WebSocket...');
    socket = io(GATEWAY_URL, {
      auth: { authToken: token, tokenType: 'jwt' },
      transports: ['websocket'],
      reconnection: false,
    });
    
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout connexion')), 5000);
      
      socket.on('connect', () => {
        clearTimeout(timeout);
        console.log(`✅ Connecté: ${socket.id}\n`);
        resolve();
      });
      
      socket.on('connect_error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
    
    // 3. Rejoindre la conversation
    console.log('🔗 Rejoindre la conversation "meeshy"...');
    socket.emit('conversation:join', { conversationId: 'meeshy' });
    await new Promise(resolve => setTimeout(resolve, 500));
    console.log('✅ Conversation rejointe\n');
    
    // 4. Écouter les traductions
    console.log('👂 Écoute des traductions...\n');
    
    socket.on('message:translation', (data) => {
      const timestamp = new Date().toISOString();
      
      if (data.translation) {
        // Format singulier
        translationsReceived.push({
          messageId: data.messageId,
          targetLanguage: data.translation.targetLanguage,
          translatedContent: data.translation.translatedContent,
          receivedAt: timestamp,
          id: data.translation.id
        });
        
        console.log(`📡 [${timestamp}] Traduction reçue via WebSocket:`);
        console.log(`   Message: ${data.messageId.substring(0, 12)}...`);
        console.log(`   Langue: ${data.translation.targetLanguage}`);
        console.log(`   ID: ${data.translation.id ? data.translation.id.substring(0, 12) + '...' : 'N/A'}`);
        console.log(`   Contenu: "${data.translation.translatedContent.substring(0, 40)}..."`);
        console.log('');
      } else if (data.translations && Array.isArray(data.translations)) {
        // Format pluriel
        data.translations.forEach(t => {
          translationsReceived.push({
            messageId: data.messageId,
            targetLanguage: t.targetLanguage,
            translatedContent: t.translatedContent,
            receivedAt: timestamp,
            id: t.id
          });
          
          console.log(`📡 [${timestamp}] Traduction reçue via WebSocket:`);
          console.log(`   Message: ${data.messageId.substring(0, 12)}...`);
          console.log(`   Langue: ${t.targetLanguage}`);
          console.log(`   ID: ${t.id ? t.id.substring(0, 12) + '...' : 'N/A'}`);
          console.log(`   Contenu: "${t.translatedContent.substring(0, 40)}..."`);
          console.log('');
        });
      }
    });
    
    socket.on('message:sent', (data) => {
      testMessageId = data.messageId;
      console.log(`✅ Message envoyé: ${testMessageId}\n`);
    });
    
    socket.on('message:new', (data) => {
      if (!testMessageId) {
        testMessageId = data.id || data.messageId;
        console.log(`✅ Message confirmé: ${testMessageId}\n`);
      }
    });
    
    // 5. Envoyer un message de test
    console.log('📤 Envoi d\'un message de test...');
    const testContent = `Test doublons - ${new Date().toISOString()}`;
    console.log(`   Contenu: "${testContent}"\n`);
    
    socket.emit('message:send', {
      conversationId: 'meeshy',
      content: testContent,
      originalLanguage: 'fr',
      messageType: 'text'
    });
    
    // 6. Attendre les traductions (20 secondes)
    console.log('⏳ Attente des traductions (20 secondes)...\n');
    await new Promise(resolve => setTimeout(resolve, 20000));
    
    // 7. Analyser les résultats
    console.log('=' .repeat(70));
    console.log('📊 ANALYSE DES RÉSULTATS');
    console.log('=' .repeat(70));
    console.log('');
    
    if (!testMessageId) {
      console.log('❌ Aucun message envoyé, test annulé\n');
      return;
    }
    
    // 7a. Traductions reçues via WebSocket
    console.log('📡 TRADUCTIONS REÇUES VIA WEBSOCKET:');
    console.log(`   Total d'événements: ${translationsReceived.length}`);
    
    const wsGrouped = new Map();
    translationsReceived.forEach(t => {
      if (!wsGrouped.has(t.targetLanguage)) {
        wsGrouped.set(t.targetLanguage, []);
      }
      wsGrouped.get(t.targetLanguage).push(t);
    });
    
    console.log(`   Langues uniques: ${wsGrouped.size}`);
    
    let wsDuplicates = false;
    for (const [lang, translations] of wsGrouped) {
      if (translations.length > 1) {
        wsDuplicates = true;
        console.log(`   ❌ ${lang}: ${translations.length} fois (DOUBLON!)`);
      } else {
        console.log(`   ✅ ${lang}: ${translations.length} fois`);
      }
    }
    console.log('');
    
    // 7b. Traductions en base de données
    console.log('🗄️  TRADUCTIONS EN BASE DE DONNÉES:');
    
    const dbTranslations = await prisma.messageTranslation.findMany({
      where: { messageId: testMessageId },
      orderBy: { createdAt: 'asc' }
    });
    
    console.log(`   Total en base: ${dbTranslations.length}`);
    
    const dbGrouped = new Map();
    dbTranslations.forEach(t => {
      if (!dbGrouped.has(t.targetLanguage)) {
        dbGrouped.set(t.targetLanguage, []);
      }
      dbGrouped.get(t.targetLanguage).push(t);
    });
    
    console.log(`   Langues uniques: ${dbGrouped.size}`);
    
    let dbDuplicates = false;
    for (const [lang, translations] of dbGrouped) {
      if (translations.length > 1) {
        dbDuplicates = true;
        console.log(`   ❌ ${lang}: ${translations.length} entrées (DOUBLON!)`);
        translations.forEach((t, idx) => {
          console.log(`      [${idx + 1}] ID: ${t.id.substring(0, 12)}... - ${t.createdAt.toISOString()}`);
        });
      } else {
        console.log(`   ✅ ${lang}: ${translations.length} entrée`);
      }
    }
    console.log('');
    
    // 7c. Comparaison
    console.log('🔍 COMPARAISON:');
    console.log(`   WebSocket: ${translationsReceived.length} événements`);
    console.log(`   Base de données: ${dbTranslations.length} documents`);
    
    if (translationsReceived.length !== dbTranslations.length) {
      console.log(`   ⚠️  DIFFÉRENCE de ${Math.abs(translationsReceived.length - dbTranslations.length)}`);
    } else {
      console.log(`   ✅ Même nombre`);
    }
    console.log('');
    
    // 8. DIAGNOSTIC FINAL
    console.log('=' .repeat(70));
    console.log('🎯 DIAGNOSTIC FINAL');
    console.log('=' .repeat(70));
    console.log('');
    
    if (!wsDuplicates && !dbDuplicates) {
      console.log('✅ AUCUN DOUBLON DÉTECTÉ!');
      console.log('   - Les traductions WebSocket sont uniques');
      console.log('   - Les traductions en base sont uniques');
      console.log('   - Les corrections fonctionnent correctement!');
    } else {
      console.log('❌ DOUBLONS DÉTECTÉS:');
      
      if (wsDuplicates) {
        console.log('   🔴 PROBLÈME WebSocket: Même traduction reçue plusieurs fois');
        console.log('      → Vérifier: MeeshySocketIOManager._handleTranslationReady()');
        console.log('      → Vérifier: Déduplication des événements');
      }
      
      if (dbDuplicates) {
        console.log('   🔴 PROBLÈME Base de données: Doublons créés en base');
        console.log('      → Vérifier: TranslationService._saveTranslationToDatabase()');
        console.log('      → Vérifier: Index unique MongoDB');
      }
      
      if (wsDuplicates && dbDuplicates) {
        console.log('');
        console.log('   ⚠️  Les doublons sont créés ET diffusés');
        console.log('   → Le problème est à la SOURCE (création des traductions)');
      } else if (!wsDuplicates && dbDuplicates) {
        console.log('');
        console.log('   ⚠️  Les doublons sont en base mais pas diffusés');
        console.log('   → Le problème est dans la SAUVEGARDE');
      } else if (wsDuplicates && !dbDuplicates) {
        console.log('');
        console.log('   ⚠️  Les doublons sont diffusés mais pas en base');
        console.log('   → Le problème est dans la DIFFUSION');
      }
    }
    
    console.log('');
    console.log('=' .repeat(70));
    console.log('');
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    if (socket) {
      socket.disconnect();
    }
    await prisma.$disconnect();
  }
}

testRealTime();

