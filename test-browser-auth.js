// Script pour tester l'authentification dans le browser
// À exécuter dans la console du navigateur sur http://localhost:3100

async function loginAndSetToken() {
  try {
    console.log('🔐 Tentative de login...');
    
    const response = await fetch('http://localhost:3000/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: 'admin',
        password: 'admin123'
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      const token = data.data.token;
      
      // Stocker le token dans localStorage
      localStorage.setItem('token', token);
      
      console.log('✅ Token stocké:', token.substring(0, 20) + '...');
      console.log('🔄 Rechargez la page pour utiliser le token');
      
      return token;
    } else {
      console.error('❌ Login failed:', response.status);
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Fonction pour tester l'API avec le token
async function testAPI() {
  const token = localStorage.getItem('token');
  if (!token) {
    console.log('⚠️ Pas de token. Exécutez loginAndSetToken() d\'abord');
    return;
  }
  
  console.log('🧪 Test API avec token...');
  
  // Test conversations
  const convResponse = await fetch('http://localhost:3000/conversations', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  console.log('Conversations status:', convResponse.status);
  if (convResponse.ok) {
    const conversations = await convResponse.json();
    console.log('Conversations:', conversations);
  }
}

console.log('🚀 Scripts disponibles:');
console.log('- loginAndSetToken() : Se connecter et stocker le token');
console.log('- testAPI() : Tester l\'API avec le token stocké');