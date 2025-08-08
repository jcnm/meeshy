// Script pour configurer l'authentification automatiquement
const setupAuth = () => {
  const userData = {
    "id": "cme2pnbqm0001244fvxgepe5u",
    "username": "admin",
    "firstName": "Admin",
    "lastName": "User",
    "email": "admin@meeshy.com",
    "phoneNumber": null,
    "displayName": null,
    "avatar": null,
    "isOnline": true,
    "lastSeen": "2025-08-08T10:56:13.871Z",
    "lastActiveAt": "2025-08-08T12:08:50.723Z",
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
    "createdAt": "2025-08-08T10:56:13.871Z",
    "updatedAt": "2025-08-08T12:08:50.724Z"
  };
  
  const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjbWUycG5icW0wMDAxMjQ0ZnZ4Z2VwZTV1IiwiZW1haWwiOiJhZG1pbkBtZWVzaHkuY29tIiwidXNlcm5hbWUiOiJhZG1pbiIsImlhdCI6MTc1NDY1NjMxMSwiZXhwIjoxNzU0NjU5OTExfQ.DUTc8DcRtsLgTZ0x06tH4Hxzpnrj9tsi4VCp6szaQFw";
  
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
