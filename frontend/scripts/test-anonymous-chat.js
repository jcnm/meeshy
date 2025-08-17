// Script pour tester et diagnostiquer le problème des conversations anonymes
const testAnonymousChat = async () => {
  console.log('🔍 Test des conversations anonymes...');
  
  // Récupérer le linkId depuis l'URL
  const pathParts = window.location.pathname.split('/');
  const linkId = pathParts[pathParts.length - 1];
  
  console.log(`📋 Test pour le lien: ${linkId}`);
  
  // Vérifier les données d'authentification
  const authToken = localStorage.getItem('auth_token');
  const sessionToken = localStorage.getItem('anonymous_session_token');
  const user = localStorage.getItem('user');
  
  console.log('🔐 Données d\'authentification:');
  console.log('  - auth_token:', authToken ? `${authToken.substring(0, 20)}...` : 'Absent');
  console.log('  - session_token:', sessionToken ? `${sessionToken.substring(0, 20)}...` : 'Absent');
  console.log('  - user:', user ? 'Présent' : 'Absent');
  
  // Test 1: Informations de base du lien (public)
  console.log('\n📋 Test 1: Informations de base du lien');
  try {
    const response1 = await fetch(`/api/anonymous/link/${linkId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    console.log(`📊 Réponse: ${response1.status} ${response1.statusText}`);
    
    if (response1.ok) {
      const data1 = await response1.json();
      console.log('✅ Informations du lien:', data1);
    } else {
      const error1 = await response1.json().catch(() => ({}));
      console.error('❌ Erreur informations du lien:', error1);
    }
  } catch (error) {
    console.error('❌ Erreur réseau (informations du lien):', error);
  }
  
  // Test 2: Données complètes avec sessionToken
  if (sessionToken) {
    console.log('\n📋 Test 2: Données complètes avec sessionToken');
    try {
      const response2 = await fetch(`/api/links/${linkId}?limit=10&offset=0`, {
        method: 'GET',
        headers: {
          'X-Session-Token': sessionToken
        }
      });
      
      console.log(`📊 Réponse: ${response2.status} ${response2.statusText}`);
      
      if (response2.ok) {
        const data2 = await response2.json();
        console.log('✅ Données complètes:', data2);
      } else {
        const error2 = await response2.json().catch(() => ({}));
        console.error('❌ Erreur données complètes:', error2);
      }
    } catch (error) {
      console.error('❌ Erreur réseau (données complètes):', error);
    }
  }
  
  // Test 3: Données complètes avec authToken
  if (authToken) {
    console.log('\n📋 Test 3: Données complètes avec authToken');
    try {
      const response3 = await fetch(`/api/links/${linkId}?limit=10&offset=0`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      console.log(`📊 Réponse: ${response3.status} ${response3.statusText}`);
      
      if (response3.ok) {
        const data3 = await response3.json();
        console.log('✅ Données complètes (auth):', data3);
      } else {
        const error3 = await response3.json().catch(() => ({}));
        console.error('❌ Erreur données complètes (auth):', error3);
      }
    } catch (error) {
      console.error('❌ Erreur réseau (données complètes auth):', error);
    }
  }
  
  console.log('\n✅ Test terminé');
};

// Exécuter le test
testAnonymousChat();

