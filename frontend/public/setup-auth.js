// Script pour configurer l'authentification automatiquement avec un token valide
const setupAuth = async () => {
  console.log('🔐 Configuration de l\'authentification...');
  
  try {
    // Login avec les credentials admin pour obtenir un token valide
    const loginResponse = await fetch('http://localhost:3000/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: 'admin',
        password: 'admin123'
      })
    });

    if (!loginResponse.ok) {
      throw new Error('Échec de la connexion');
    }

    const loginData = await loginResponse.json();
    
    if (!loginData.success) {
      throw new Error('Connexion échouée: ' + (loginData.error || 'Erreur inconnue'));
    }

    const { user, token } = loginData.data;
    
    // Configurer localStorage avec les données reçues
    localStorage.setItem('auth_token', token);
    localStorage.setItem('user', JSON.stringify(user));
    
    console.log('✅ Authentification configurée avec succès');
    console.log('👤 Utilisateur connecté:', user.username, '(' + user.role + ')');
    console.log('🔄 Rechargement de la page...');
    
    // Recharger la page après un court délai
    setTimeout(() => {
      window.location.reload();
    }, 1000);
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'authentification:', error);
    alert('Erreur lors de l\'authentification: ' + error.message);
  }
};

// Exécuter automatiquement
setupAuth();
