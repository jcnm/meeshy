// Test pour PROUVER que l'ordre des messages est correct
const { PrismaClient } = require('./shared/prisma/client');

const prisma = new PrismaClient();

async function authenticateAndFetchMessages() {
  try {
    console.log('🔐 Authentification...');
    
    const authResponse = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    
    const authData = await authResponse.json();
    const token = authData.data.token;
    console.log('✅ Authentifié\n');
    
    // Récupérer les 5 premiers messages
    console.log('📡 Récupération des 5 premiers messages (offset=0)...\n');
    
    const response1 = await fetch('http://localhost:3000/api/conversations/meeshy/messages?limit=5&offset=0', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const data1 = await response1.json();
    const messages1 = data1.data.messages;
    
    console.log('=' .repeat(80));
    console.log('📊 PREMIER CHARGEMENT (offset=0, limit=5)');
    console.log('=' .repeat(80));
    console.log('');
    
    messages1.forEach((msg, index) => {
      const date = new Date(msg.createdAt);
      console.log(`[${index}] DateTime: ${date.toISOString()}`);
      console.log(`    Contenu: "${msg.content.substring(0, 50)}..."`);
      console.log('');
    });
    
    // Vérifier l'ordre
    console.log('🔍 VÉRIFICATION ORDRE (doit être DÉCROISSANT):');
    let isDescending = true;
    for (let i = 0; i < messages1.length - 1; i++) {
      const current = new Date(messages1[i].createdAt);
      const next = new Date(messages1[i + 1].createdAt);
      
      if (current < next) {
        isDescending = false;
        console.log(`❌ [${i}] ${current.toISOString()} < [${i+1}] ${next.toISOString()} - ORDRE INCORRECT!`);
      } else {
        console.log(`✅ [${i}] ${current.toISOString()} >= [${i+1}] ${next.toISOString()}`);
      }
    }
    
    if (isDescending) {
      console.log('\n✅ ORDRE DÉCROISSANT CONFIRMÉ (Plus récent en premier)');
    } else {
      console.log('\n❌ ORDRE INCORRECT!');
    }
    
    console.log('');
    console.log('=' .repeat(80));
    console.log('');
    
    // Récupérer les 5 suivants (offset=5)
    console.log('📡 Récupération des 5 messages suivants (offset=5)...\n');
    
    const response2 = await fetch('http://localhost:3000/api/conversations/meeshy/messages?limit=5&offset=5', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const data2 = await response2.json();
    const messages2 = data2.data.messages;
    
    console.log('=' .repeat(80));
    console.log('📊 DEUXIÈME CHARGEMENT (offset=5, limit=5) - Simule "Load More"');
    console.log('=' .repeat(80));
    console.log('');
    
    messages2.forEach((msg, index) => {
      const date = new Date(msg.createdAt);
      console.log(`[${index}] DateTime: ${date.toISOString()}`);
      console.log(`    Contenu: "${msg.content.substring(0, 50)}..."`);
      console.log('');
    });
    
    // Vérifier que les messages du 2ème chargement sont plus anciens
    console.log('🔍 VÉRIFICATION: Messages du 2ème chargement sont-ils PLUS ANCIENS?');
    
    const lastFromFirst = new Date(messages1[messages1.length - 1].createdAt);
    const firstFromSecond = new Date(messages2[0].createdAt);
    
    console.log(`Dernier du 1er chargement: ${lastFromFirst.toISOString()}`);
    console.log(`Premier du 2ème chargement: ${firstFromSecond.toISOString()}`);
    
    if (firstFromSecond <= lastFromFirst) {
      console.log('✅ CORRECT: Premier du 2ème <= Dernier du 1er');
    } else {
      console.log('❌ INCORRECT: Premier du 2ème > Dernier du 1er');
    }
    
    console.log('');
    console.log('=' .repeat(80));
    console.log('📋 AFFICHAGE FINAL DANS L\'INTERFACE');
    console.log('=' .repeat(80));
    console.log('');
    
    const allMessages = [...messages1, ...messages2];
    
    console.log('┌─────────────────────────────────────────┐');
    allMessages.forEach((msg, index) => {
      const date = new Date(msg.createdAt);
      const position = index === 0 ? '← EN HAUT (Plus récent)' : 
                      index === allMessages.length - 1 ? '← EN BAS (Plus ancien)' : '';
      console.log(`│ [${String(index).padStart(2, '0')}] ${date.toISOString()} ${position}`);
      console.log(`│     "${msg.content.substring(0, 35)}..."`);
      if (index < allMessages.length - 1) {
        console.log('│     ↓');
      }
    });
    console.log('└─────────────────────────────────────────┘');
    
    console.log('');
    console.log('✅ ORDRE CONFIRMÉ:');
    console.log(`   - Index 0 (haut): ${new Date(allMessages[0].createdAt).toISOString()}`);
    console.log(`   - Index ${allMessages.length - 1} (bas): ${new Date(allMessages[allMessages.length - 1].createdAt).toISOString()}`);
    console.log(`   - DateTime décroissant: ${new Date(allMessages[0].createdAt) > new Date(allMessages[allMessages.length - 1].createdAt) ? '✅ OUI' : '❌ NON'}`);
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

authenticateAndFetchMessages();

