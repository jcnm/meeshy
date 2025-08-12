// Script pour configurer l'authentification automatiquement
const setupAuth = () => {
  const userData = {
    "id": "alice_fr",
    "username": "alice_fr",
    "firstName": "Alice",
    "lastName": "Dubois",
    "email": "alice@meeshy.com",
    "phoneNumber": null,
    "displayName": null,
    "avatar": null,
    "isOnline": true,
    "lastSeen": "2025-08-12T22:56:13.871Z",
    "lastActiveAt": "2025-08-12T22:08:50.723Z",
    "systemLanguage": "fr",
    "regionalLanguage": "fr",
    "customDestinationLanguage": null,
    "autoTranslateEnabled": true,
    "translateToSystemLanguage": true,
    "translateToRegionalLanguage": false,
    "useCustomDestination": false,
    "role": "ADMIN",
    "isActive": true,
    "deactivatedAt": null,
    "createdAt": "2025-08-12T22:56:13.871Z",
    "updatedAt": "2025-08-12T22:08:50.724Z"
  };
  
  const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJhbGljZV9mciIsImVtYWlsIjoiYWxpY2VAbWVlc2h5LmNvbSIsInVzZXJuYW1lIjoiYWxpY2VfZnIiLCJpYXQiOjE3NTQ2NTYzMTEsImV4cCI6MTc1NDY1OTkxMX0.EXAMPLE_TOKEN_FOR_ALICE";
  
  // Configurer localStorage
  localStorage.setItem('auth_token', token);
  localStorage.setItem('user', JSON.stringify(userData));
  
  console.log('✅ Authentification configurée');
  console.log('🔄 Rechargement de la page...');
  
  // Recharger la page après un court délai
  setTimeout(() => {
    window.location.reload();
  }, 500);
};

// Exécuter automatiquement
setupAuth();
