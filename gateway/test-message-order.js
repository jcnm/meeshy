// Test pour vérifier l'ordre des messages retournés par l'API
const fetch = require('node-fetch');

async function testMessageOrder() {
  try {
    // Authentification
    const authResponse = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    
    const authData = await authResponse.json();
    const token = authData.data.token;
    
    // Récupérer les messages
    const messagesResponse = await fetch('http://localhost:3000/api/conversations/meeshy/messages?limit=10&offset=0', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const messagesData = await messagesResponse.json();
    const messages = messagesData.data.messages;
    
    console.log('📊 ORDRE DES MESSAGES RETOURNÉS PAR LE BACKEND:\n');
    console.log(`Total: ${messages.length} messages\n`);
    
    messages.forEach((msg, index) => {
      const date = new Date(msg.createdAt);
      const content = msg.content.substring(0, 50);
      console.log(`[${index}] ${date.toISOString()} - "${content}..."`);
    });
    
    console.log('\n📊 ANALYSE:\n');
    
    const firstDate = new Date(messages[0].createdAt);
    const lastDate = new Date(messages[messages.length - 1].createdAt);
    
    console.log(`Premier message (index 0): ${firstDate.toISOString()}`);
    console.log(`Dernier message (index ${messages.length - 1}): ${lastDate.toISOString()}`);
    
    if (firstDate > lastDate) {
      console.log('\n✅ Ordre: DESC (Plus RÉCENT en premier)');
      console.log('   → Index 0 = Plus récent');
      console.log('   → Index N = Plus ancien');
    } else {
      console.log('\n✅ Ordre: ASC (Plus ANCIEN en premier)');
      console.log('   → Index 0 = Plus ancien');
      console.log('   → Index N = Plus récent');
    }
    
    console.log('\n📋 POUR AFFICHER RÉCENTS EN HAUT, ANCIENS EN BAS:');
    if (firstDate > lastDate) {
      console.log('   reverseOrder = FALSE (garder l\'ordre DESC du backend)');
    } else {
      console.log('   reverseOrder = TRUE (inverser l\'ordre ASC du backend)');
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

testMessageOrder();

