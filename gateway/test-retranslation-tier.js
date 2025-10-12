// Test de la retraduction avec tier supérieur
const { PrismaClient } = require('./shared/prisma/client');
const io = require('socket.io-client');

const prisma = new PrismaClient();
const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3000';

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

async function testRetranslationTier() {
  let socket;
  
  try {
    console.log('🚀 TEST DE RETRADUCTION AVEC TIER SUPÉRIEUR\n');
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
    
    // 4. Envoyer un message de test COURT (sera traduit avec basic/medium par défaut)
    console.log('📤 Envoi d\'un message COURT (basic/medium attendu)...');
    const shortMessage = 'Bonjour';
    console.log(`   Contenu: "${shortMessage}" (${shortMessage.length} caractères)\n`);
    
    let testMessageId = null;
    const initialTranslations = [];
    const retranslations = [];
    
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
    
    socket.on('message:translation', (data) => {
      const timestamp = new Date().toISOString();
      
      if (data.translation) {
        const translation = {
          messageId: data.messageId,
          targetLanguage: data.translation.targetLanguage,
          translatedContent: data.translation.translatedContent,
          translationModel: data.translation.translationModel || 'unknown',
          receivedAt: timestamp,
          id: data.translation.id
        };
        
        // Déterminer si c'est une traduction initiale ou une retraduction
        const existing = initialTranslations.find(t => t.targetLanguage === translation.targetLanguage);
        if (existing) {
          retranslations.push(translation);
          console.log(`🔄 [${timestamp}] RETRADUCTION reçue:`);
          console.log(`   Langue: ${translation.targetLanguage}`);
          console.log(`   Model: ${translation.translationModel}`);
          console.log(`   Contenu: "${translation.translatedContent}"`);
          console.log(`   (Ancienne: "${existing.translatedContent}")`);
        } else {
          initialTranslations.push(translation);
          console.log(`📡 [${timestamp}] Traduction initiale:`);
          console.log(`   Langue: ${translation.targetLanguage}`);
          console.log(`   Model: ${translation.translationModel}`);
          console.log(`   Contenu: "${translation.translatedContent}"`);
        }
        console.log('');
      }
    });
    
    socket.emit('message:send', {
      conversationId: 'meeshy',
      content: shortMessage,
      originalLanguage: 'fr',
      messageType: 'text'
    });
    
    // 5. Attendre les traductions initiales
    console.log('⏳ Attente des traductions initiales (10 secondes)...\n');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    console.log('=' .repeat(70));
    console.log('📊 TRADUCTIONS INITIALES REÇUES');
    console.log('=' .repeat(70));
    console.log(`Total: ${initialTranslations.length}`);
    initialTranslations.forEach(t => {
      console.log(`  - ${t.targetLanguage}: "${t.translatedContent}" (model: ${t.translationModel})`);
    });
    console.log('');
    
    if (initialTranslations.length === 0) {
      console.log('❌ Aucune traduction initiale reçue, test annulé\n');
      return;
    }
    
    // 6. Demander une retraduction avec PREMIUM pour l'anglais
    const targetLang = 'en';
    const targetModel = 'premium';
    
    console.log('=' .repeat(70));
    console.log(`🚀 DEMANDE DE RETRADUCTION`);
    console.log('=' .repeat(70));
    console.log(`Message: ${testMessageId}`);
    console.log(`Langue cible: ${targetLang}`);
    console.log(`Model demandé: ${targetModel}`);
    console.log('');
    
    const retranslationResponse = await fetch(`${GATEWAY_URL}/api/translate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        message_id: testMessageId,
        target_language: targetLang,
        model_type: targetModel
      })
    });
    
    const retranslationData = await retranslationResponse.json();
    console.log('📡 Réponse de l\'API /translate:');
    console.log(JSON.stringify(retranslationData, null, 2));
    console.log('');
    
    if (!retranslationData.success) {
      console.log(`❌ Erreur lors de la demande de retraduction: ${retranslationData.error || 'Unknown error'}\n`);
      return;
    }
    
    console.log(`✅ Demande de retraduction acceptée\n`);
    
    // 7. Attendre la retraduction
    console.log(`⏳ Attente de la retraduction (15 secondes)...\n`);
    await new Promise(resolve => setTimeout(resolve, 15000));
    
    // 8. Analyser les résultats
    console.log('=' .repeat(70));
    console.log('📊 RÉSULTATS FINAUX');
    console.log('=' .repeat(70));
    console.log('');
    
    console.log('📡 RETRADUCTIONS REÇUES VIA WEBSOCKET:');
    if (retranslations.length > 0) {
      console.log(`   ✅ ${retranslations.length} retraduction(s) reçue(s)`);
      retranslations.forEach(t => {
        console.log(`   - ${t.targetLanguage}: "${t.translatedContent}"`);
        console.log(`     Model: ${t.translationModel}`);
      });
    } else {
      console.log(`   ❌ Aucune retraduction reçue via WebSocket`);
    }
    console.log('');
    
    // 9. Vérifier en base de données
    console.log('🗄️  VÉRIFICATION EN BASE DE DONNÉES:');
    const dbTranslations = await prisma.messageTranslation.findMany({
      where: { 
        messageId: testMessageId,
        targetLanguage: targetLang
      },
      orderBy: { createdAt: 'desc' }
    });
    
    console.log(`   Total de traductions ${targetLang} en base: ${dbTranslations.length}`);
    
    if (dbTranslations.length > 0) {
      const latestTranslation = dbTranslations[0];
      console.log(`   Traduction la plus récente:`);
      console.log(`     ID: ${latestTranslation.id.substring(0, 12)}...`);
      console.log(`     Model: ${latestTranslation.translationModel}`);
      console.log(`     Contenu: "${latestTranslation.translatedContent}"`);
      console.log(`     Date: ${latestTranslation.createdAt.toISOString()}`);
      
      if (dbTranslations.length > 1) {
        console.log(`   ⚠️  ATTENTION: ${dbTranslations.length} traductions trouvées (doublon?)`);
        dbTranslations.forEach((t, idx) => {
          console.log(`     [${idx + 1}] Model: ${t.translationModel} - ${t.createdAt.toISOString()}`);
        });
      }
    } else {
      console.log(`   ❌ Aucune traduction ${targetLang} en base`);
    }
    console.log('');
    
    // 10. VERDICT
    console.log('=' .repeat(70));
    console.log('🎯 VERDICT');
    console.log('=' .repeat(70));
    console.log('');
    
    const retranslationReceived = retranslations.length > 0;
    const retranslationInDB = dbTranslations.length > 0;
    const correctModel = dbTranslations.length > 0 && 
      dbTranslations[0].translationModel.includes(targetModel);
    
    console.log(`✅/❌ Retraduction reçue via WebSocket: ${retranslationReceived ? '✅ OUI' : '❌ NON'}`);
    console.log(`✅/❌ Retraduction en base de données: ${retranslationInDB ? '✅ OUI' : '❌ NON'}`);
    console.log(`✅/❌ Model correct (${targetModel}): ${correctModel ? '✅ OUI' : '❌ NON'}`);
    console.log('');
    
    if (retranslationReceived && retranslationInDB && correctModel) {
      console.log('✅ TEST RÉUSSI!');
      console.log('   La retraduction avec tier supérieur fonctionne correctement.');
    } else {
      console.log('❌ TEST ÉCHOUÉ!');
      
      if (!retranslationReceived) {
        console.log('   🔴 Problème: Retraduction non reçue via WebSocket');
        console.log('      → Vérifier les logs du gateway');
        console.log('      → Vérifier que la diffusion Socket.IO fonctionne');
      }
      
      if (!retranslationInDB) {
        console.log('   🔴 Problème: Retraduction non en base de données');
        console.log('      → Vérifier TranslationService._saveTranslationToDatabase()');
      }
      
      if (!correctModel) {
        console.log(`   🔴 Problème: Model incorrect (attendu: ${targetModel}, reçu: ${dbTranslations[0]?.translationModel || 'N/A'})`);
        console.log('      → Vérifier que le modelType est bien transmis');
        console.log('      → Vérifier les logs du translator');
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

testRetranslationTier();

