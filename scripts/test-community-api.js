#!/usr/bin/env node

/**
 * Script de test pour diagnostiquer le problème avec l'API des communautés
 */

const axios = require('axios');

const GATEWAY_URL = 'http://localhost:3000';

// Fonction pour tester l'authentification
async function testAuth() {
  try {
    console.log('🔐 Test d\'authentification...');
    
    // Connexion avec un utilisateur existant
    const loginResponse = await axios.post(`${GATEWAY_URL}/auth/login`, {
      email: 'admin@meeshy.com', // Ajustez selon votre configuration
      password: 'admin123' // Ajustez selon votre configuration
    });

    if (loginResponse.data.success) {
      console.log('✅ Authentification réussie');
      return loginResponse.data.data.token;
    } else {
      console.log('❌ Échec de l\'authentification');
      return null;
    }
  } catch (error) {
    console.log('❌ Erreur d\'authentification:', error.response?.data?.message || error.message);
    
    // Essayer avec d'autres credentials
    try {
      const loginResponse2 = await axios.post(`${GATEWAY_URL}/auth/login`, {
        email: 'meeshy@meeshy.com',
        password: 'meeshy123'
      });

      if (loginResponse2.data.success) {
        console.log('✅ Authentification réussie avec meeshy@meeshy.com');
        return loginResponse2.data.data.token;
      }
    } catch (error2) {
      console.log('❌ Échec avec meeshy@meeshy.com aussi');
    }
    
    return null;
  }
}

// Fonction pour lister les communautés
async function testListCommunities(token) {
  try {
    console.log('\n📋 Test de la liste des communautés...');
    
    const response = await axios.get(`${GATEWAY_URL}/communities`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.data.success) {
      const communities = response.data.data;
      console.log('✅ Liste des communautés récupérée avec succès:');
      console.log(`   - Nombre de communautés: ${communities.length}`);
      
      if (communities.length > 0) {
        console.log('\n   Communautés disponibles:');
        communities.forEach((community, index) => {
          console.log(`   ${index + 1}. ${community.name} (${community.identifier || community.id})`);
          console.log(`      - ID: ${community.id}`);
          console.log(`      - Identifier: ${community.identifier || 'Non défini'}`);
          console.log(`      - Créateur: ${community.creator?.username || 'Inconnu'}`);
          console.log(`      - Membres: ${community._count?.members || 0}`);
          console.log(`      - Conversations: ${community._count?.Conversation || 0}`);
        });
        
        return communities;
      } else {
        console.log('   Aucune communauté trouvée');
        return [];
      }
    } else {
      console.log('❌ Échec de la récupération de la liste des communautés');
      return [];
    }
  } catch (error) {
    console.log('❌ Erreur lors de la récupération de la liste des communautés:', error.response?.data?.message || error.message);
    return [];
  }
}

// Fonction pour tester l'accès à une communauté spécifique
async function testCommunityAccess(token, communityId) {
  try {
    console.log(`\n🔍 Test d'accès à la communauté: ${communityId}`);
    
    const response = await axios.get(`${GATEWAY_URL}/communities/${communityId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.data.success) {
      const community = response.data.data;
      console.log('✅ Accès à la communauté réussi:');
      console.log(`   - Nom: ${community.name}`);
      console.log(`   - ID: ${community.id}`);
      console.log(`   - Identifier: ${community.identifier || 'Non défini'}`);
      console.log(`   - Créateur: ${community.creator?.username || 'Inconnu'}`);
      console.log(`   - Membres: ${community._count?.members || 0}`);
      console.log(`   - Conversations: ${community._count?.Conversation || 0}`);
      return true;
    } else {
      console.log('❌ Échec de l\'accès à la communauté');
      return false;
    }
  } catch (error) {
    console.log('❌ Erreur lors de l\'accès à la communauté:', error.response?.data?.message || error.message);
    if (error.response?.data) {
      console.log('   Détails de l\'erreur:', JSON.stringify(error.response.data, null, 2));
    }
    return false;
  }
}

// Fonction pour créer une communauté de test
async function testCreateCommunity(token) {
  try {
    console.log('\n➕ Test de création d\'une communauté...');
    
    const testCommunity = {
      name: 'Test Community',
      description: 'Communauté créée pour les tests',
      isPrivate: false
    };
    
    const response = await axios.post(`${GATEWAY_URL}/communities`, testCommunity, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.data.success) {
      const community = response.data.data;
      console.log('✅ Communauté créée avec succès:');
      console.log(`   - Nom: ${community.name}`);
      console.log(`   - ID: ${community.id}`);
      console.log(`   - Identifier: ${community.identifier || 'Non défini'}`);
      return community;
    } else {
      console.log('❌ Échec de la création de la communauté');
      return null;
    }
  } catch (error) {
    console.log('❌ Erreur lors de la création de la communauté:', error.response?.data?.message || error.message);
    if (error.response?.data) {
      console.log('   Détails de l\'erreur:', JSON.stringify(error.response.data, null, 2));
    }
    return null;
  }
}

// Fonction principale
async function main() {
  console.log('🚀 Démarrage des tests de l\'API des communautés\n');
  
  // Test d'authentification
  const token = await testAuth();
  if (!token) {
    console.log('\n❌ Impossible de continuer sans authentification');
    process.exit(1);
  }
  
  // Test de la liste des communautés
  const communities = await testListCommunities(token);
  
  // Test d'accès aux communautés existantes
  if (communities.length > 0) {
    console.log('\n🔍 Test d\'accès aux communautés existantes...');
    for (const community of communities.slice(0, 3)) { // Tester les 3 premières
      await testCommunityAccess(token, community.id);
      if (community.identifier) {
        await testCommunityAccess(token, community.identifier);
      }
    }
  } else {
    console.log('\n➕ Aucune communauté existante, test de création...');
    const newCommunity = await testCreateCommunity(token);
    if (newCommunity) {
      await testCommunityAccess(token, newCommunity.id);
      if (newCommunity.identifier) {
        await testCommunityAccess(token, newCommunity.identifier);
      }
    }
  }
  
  console.log('\n📋 Tests terminés');
}

// Gestion des erreurs non capturées
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Erreur non gérée:', reason);
  process.exit(1);
});

// Exécution du script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  testAuth,
  testListCommunities,
  testCommunityAccess,
  testCreateCommunity
};
