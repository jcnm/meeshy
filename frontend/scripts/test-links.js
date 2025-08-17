// Script pour tester et diagnostiquer le problème des liens de conversation
const testLinks = async () => {
  console.log('🔍 Test des liens de conversation...');
  
  const token = localStorage.getItem('auth_token');
  if (!token) {
    console.error('❌ Aucun token d\'authentification trouvé');
    return;
  }
  
  // Récupérer l'ID de conversation depuis l'URL ou utiliser un ID de test
  const urlParams = new URLSearchParams(window.location.search);
  const conversationId = urlParams.get('conversationId') || 'any'; // Utiliser 'any' comme fallback
  
  console.log(`📋 Test pour la conversation: ${conversationId}`);
  
  try {
    const response = await fetch(`/api/conversations/${conversationId}/links`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log(`📊 Réponse: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Données reçues:', data);
      
      if (data.success && data.data) {
        console.log(`📋 ${data.data.length} liens trouvés`);
        data.data.forEach((link, index) => {
          console.log(`  ${index + 1}. ${link.name || 'Sans nom'} (${link.linkId})`);
        });
      } else {
        console.log('⚠️ Réponse sans données:', data);
      }
    } else {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ Erreur:', errorData);
      
      if (response.status === 403) {
        console.log('🔒 Problème de permissions - Vérifier les droits admin/modo');
      } else if (response.status === 404) {
        console.log('🔍 Endpoint non trouvé - Vérifier la route');
      }
    }
  } catch (error) {
    console.error('❌ Erreur réseau:', error);
  }
};

// Exécuter le test
testLinks();

