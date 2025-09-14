// Test de l'API conversations et messages
// Usage: node test-conversation-messages.js

const API_BASE_URL = 'http://localhost:3000'; // Gateway URL

async function testConversationsAPI() {
  console.log('🧪 Test de l\'API Conversations et Messages\n');

  try {
    // Test 1: Obtenir les utilisateurs
    console.log('📋 1. Test des utilisateurs...');
    const usersResponse = await fetch(`${API_BASE_URL}/users`);
    if (usersResponse.ok) {
      const users = await usersResponse.json();
      console.log('✅ Utilisateurs trouvés:', users.length);
      if (users.length > 0) {
        console.log('👤 Premier utilisateur:', users[0].username, '(ID:', users[0].id, ')');
      }
    } else {
      console.log('❌ Erreur lors de la récupération des utilisateurs:', usersResponse.status);
    }

    // Test 2: Obtenir les conversations
    console.log('\n📋 2. Test des conversations...');
    const conversationsResponse = await fetch(`${API_BASE_URL}/conversations`);
    if (conversationsResponse.ok) {
      const conversations = await conversationsResponse.json();
      console.log('✅ Conversations trouvées:', conversations.length);
      
      if (conversations.length > 0) {
        const firstConv = conversations[0];
        console.log('💬 Première conversation:', firstConv.id, firstConv.type);
        
        // Test 3: Obtenir les messages de cette conversation
        console.log('\n📋 3. Test des messages pour conversation:', firstConv.id);
        const messagesResponse = await fetch(`${API_BASE_URL}/conversations/${firstConv.id}/messages`);
        if (messagesResponse.ok) {
          const messages = await messagesResponse.json();
          console.log('✅ Messages trouvés:', Array.isArray(messages) ? messages.length : 'Structure:', typeof messages);
          if (Array.isArray(messages) && messages.length > 0) {
            console.log('📨 Premier message:', messages[0].content);
          }
        } else {
          console.log('❌ Erreur lors de la récupération des messages:', messagesResponse.status);
        }
      }
    } else {
      console.log('❌ Erreur lors de la récupération des conversations:', conversationsResponse.status);
    }

  } catch (error) {
    console.error('❌ Erreur durant le test:', error.message);
  }
}

testConversationsAPI();