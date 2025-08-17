// Script pour nettoyer les données d'authentification redondantes
const cleanupAuth = () => {
  console.log('🧹 Nettoyage des données d\'authentification...');
  
  // Supprimer les clés redondantes
  const keysToRemove = [
    'auth_user', // Redondant avec 'user'
    'token',     // Redondant avec 'auth_token'
  ];
  
  let cleaned = 0;
  keysToRemove.forEach(key => {
    if (localStorage.getItem(key)) {
      localStorage.removeItem(key);
      console.log(`✅ Supprimé: ${key}`);
      cleaned++;
    }
  });
  
  // Vérifier la cohérence des données restantes
  const authToken = localStorage.getItem('auth_token');
  const user = localStorage.getItem('user');
  
  if (authToken && !user) {
    console.log('⚠️ Token présent mais utilisateur absent, nettoyage...');
    localStorage.removeItem('auth_token');
    cleaned++;
  }
  
  if (!authToken && user) {
    console.log('⚠️ Utilisateur présent mais token absent, nettoyage...');
    localStorage.removeItem('user');
    cleaned++;
  }
  
  console.log(`✅ Nettoyage terminé. ${cleaned} éléments supprimés.`);
  console.log('🔄 Rechargement de la page...');
  
  // Recharger la page après un court délai
  setTimeout(() => {
    window.location.reload();
  }, 1000);
};

// Exécuter automatiquement
cleanupAuth();
