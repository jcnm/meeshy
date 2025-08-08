// Script de test pour l'authentification frontend
// A exécuter dans la console du navigateur

async function testFrontendAuth() {
  console.log('🧪 Test d\'authentification frontend...');
  
  // 1. Test de connexion
  try {
    const response = await fetch('http://localhost:3000/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'admin@meeshy.com',
        password: 'password123'
      })
    });

    const data = await response.json();
    
    if (data.success && data.access_token) {
      console.log('✅ Authentification réussie');
      
      // Stocker le token dans localStorage
      localStorage.setItem('auth_token', data.access_token);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      console.log('💾 Token et utilisateur stockés dans localStorage');
      
      // 2. Test récupération conversations
      const convResponse = await fetch('http://localhost:3000/api/conversations', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${data.access_token}`
        }
      });

      const convData = await convResponse.json();
      
      if (convData.success && convData.data) {
        console.log(`✅ ${convData.data.length} conversations récupérées`);
        console.log('Conversations:', convData.data.map(c => c.title));
        
        // Recharger la page pour que le contexte se mette à jour
        console.log('🔄 Rechargement de la page...');
        setTimeout(() => window.location.reload(), 1000);
        
        return true;
      } else {
        console.error('❌ Échec récupération conversations:', convData);
        return false;
      }
    } else {
      console.error('❌ Échec authentification:', data);
      return false;
    }
  } catch (error) {
    console.error('❌ Erreur:', error);
    return false;
  }
}

// Lancer le test
testFrontendAuth();
