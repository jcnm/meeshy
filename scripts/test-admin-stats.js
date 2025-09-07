#!/usr/bin/env node

/**
 * Script de test pour vérifier les statistiques administrateur
 */

const axios = require('axios');

const GATEWAY_URL = 'http://localhost:3001';

// Fonction pour tester l'authentification admin
async function testAdminAuth() {
  try {
    console.log('🔐 Test d\'authentification admin...');
    
    // Connexion en tant qu'admin (vous devrez ajuster ces credentials)
    const loginResponse = await axios.post(`${GATEWAY_URL}/auth/login`, {
      email: 'admin@meeshy.com', // Ajustez selon votre configuration
      password: 'admin123' // Ajustez selon votre configuration
    });

    if (loginResponse.data.success) {
      console.log('✅ Authentification admin réussie');
      return loginResponse.data.data.token;
    } else {
      console.log('❌ Échec de l\'authentification admin');
      return null;
    }
  } catch (error) {
    console.log('❌ Erreur d\'authentification:', error.response?.data?.message || error.message);
    return null;
  }
}

// Fonction pour tester les statistiques du dashboard admin
async function testAdminDashboard(token) {
  try {
    console.log('\n📊 Test des statistiques du dashboard admin...');
    
    const response = await axios.get(`${GATEWAY_URL}/admin/dashboard`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.data.success) {
      const stats = response.data.data.statistics;
      console.log('✅ Statistiques récupérées avec succès:');
      console.log(`   - Utilisateurs totaux: ${stats.totalUsers}`);
      console.log(`   - Utilisateurs actifs: ${stats.activeUsers}`);
      console.log(`   - Utilisateurs inactifs: ${stats.inactiveUsers}`);
      console.log(`   - Conversations: ${stats.totalConversations}`);
      console.log(`   - Communautés: ${stats.totalCommunities}`);
      console.log(`   - Messages: ${stats.totalMessages}`);
      console.log(`   - Administrateurs: ${stats.adminUsers}`);
      console.log(`   - Utilisateurs anonymes totaux: ${stats.totalAnonymousUsers}`);
      console.log(`   - Utilisateurs anonymes actifs: ${stats.activeAnonymousUsers}`);
      console.log(`   - Liens de partage totaux: ${stats.totalShareLinks}`);
      console.log(`   - Liens de partage actifs: ${stats.activeShareLinks}`);
      
      if (stats.usersByRole) {
        console.log('   - Utilisateurs par rôle:');
        Object.entries(stats.usersByRole).forEach(([role, count]) => {
          console.log(`     * ${role}: ${count}`);
        });
      }
      
      if (stats.messagesByType) {
        console.log('   - Messages par type:');
        Object.entries(stats.messagesByType).forEach(([type, count]) => {
          console.log(`     * ${type}: ${count}`);
        });
      }

      const recentActivity = response.data.data.recentActivity;
      console.log('\n📈 Activité récente (7 derniers jours):');
      console.log(`   - Nouveaux utilisateurs: ${recentActivity.newUsers}`);
      console.log(`   - Nouvelles conversations: ${recentActivity.newConversations}`);
      console.log(`   - Nouveaux messages: ${recentActivity.newMessages}`);
      console.log(`   - Nouveaux utilisateurs anonymes: ${recentActivity.newAnonymousUsers}`);
      
      return true;
    } else {
      console.log('❌ Échec de la récupération des statistiques');
      return false;
    }
  } catch (error) {
    console.log('❌ Erreur lors de la récupération des statistiques:', error.response?.data?.message || error.message);
    return false;
  }
}

// Fonction pour tester la liste des utilisateurs
async function testAdminUsers(token) {
  try {
    console.log('\n👥 Test de la liste des utilisateurs...');
    
    const response = await axios.get(`${GATEWAY_URL}/admin/users`, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      params: {
        page: 1,
        limit: 5
      }
    });

    if (response.data.success) {
      const users = response.data.data.users;
      const pagination = response.data.data.pagination;
      
      console.log('✅ Liste des utilisateurs récupérée avec succès:');
      console.log(`   - Nombre d'utilisateurs affichés: ${users.length}`);
      console.log(`   - Total d'utilisateurs: ${pagination.total}`);
      console.log(`   - Page actuelle: ${pagination.page}`);
      console.log(`   - Limite par page: ${pagination.limit}`);
      console.log(`   - A plus de pages: ${pagination.hasMore}`);
      
      if (users.length > 0) {
        console.log('\n   Utilisateurs:');
        users.forEach((user, index) => {
          console.log(`   ${index + 1}. ${user.firstName} ${user.lastName} (${user.username})`);
          console.log(`      - Email: ${user.email}`);
          console.log(`      - Rôle: ${user.role}`);
          console.log(`      - Statut: ${user.isActive ? 'Actif' : 'Inactif'}`);
          console.log(`      - En ligne: ${user.isOnline ? 'Oui' : 'Non'}`);
          if (user._count) {
            console.log(`      - Messages envoyés: ${user._count.sentMessages}`);
            console.log(`      - Conversations: ${user._count.conversations}`);
            console.log(`      - Communautés: ${user._count.communityMemberships}`);
          }
        });
      }
      
      return true;
    } else {
      console.log('❌ Échec de la récupération de la liste des utilisateurs');
      return false;
    }
  } catch (error) {
    console.log('❌ Erreur lors de la récupération de la liste des utilisateurs:', error.response?.data?.message || error.message);
    return false;
  }
}

// Fonction pour tester la liste des utilisateurs anonymes
async function testAdminAnonymousUsers(token) {
  try {
    console.log('\n👤 Test de la liste des utilisateurs anonymes...');
    
    const response = await axios.get(`${GATEWAY_URL}/admin/anonymous-users`, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      params: {
        page: 1,
        limit: 5
      }
    });

    if (response.data.success) {
      const anonymousUsers = response.data.data.anonymousUsers;
      const pagination = response.data.data.pagination;
      
      console.log('✅ Liste des utilisateurs anonymes récupérée avec succès:');
      console.log(`   - Nombre d'utilisateurs anonymes affichés: ${anonymousUsers.length}`);
      console.log(`   - Total d'utilisateurs anonymes: ${pagination.total}`);
      console.log(`   - Page actuelle: ${pagination.page}`);
      console.log(`   - Limite par page: ${pagination.limit}`);
      console.log(`   - A plus de pages: ${pagination.hasMore}`);
      
      if (anonymousUsers.length > 0) {
        console.log('\n   Utilisateurs anonymes:');
        anonymousUsers.forEach((user, index) => {
          console.log(`   ${index + 1}. ${user.firstName} ${user.lastName} (${user.username})`);
          console.log(`      - Email: ${user.email || 'Non fourni'}`);
          console.log(`      - Pays: ${user.country || 'Non spécifié'}`);
          console.log(`      - Langue: ${user.language}`);
          console.log(`      - Statut: ${user.isActive ? 'Actif' : 'Inactif'}`);
          console.log(`      - En ligne: ${user.isOnline ? 'Oui' : 'Non'}`);
          console.log(`      - Messages envoyés: ${user._count.sentMessages}`);
          console.log(`      - Conversation: ${user.shareLink.conversation.title || user.shareLink.conversation.identifier || 'Sans titre'}`);
          console.log(`      - Lien de partage: ${user.shareLink.identifier || user.shareLink.linkId}`);
        });
      } else {
        console.log('   Aucun utilisateur anonyme trouvé');
      }
      
      return true;
    } else {
      console.log('❌ Échec de la récupération de la liste des utilisateurs anonymes');
      return false;
    }
  } catch (error) {
    console.log('❌ Erreur lors de la récupération de la liste des utilisateurs anonymes:', error.response?.data?.message || error.message);
    return false;
  }
}

// Fonction principale
async function main() {
  console.log('🚀 Démarrage des tests des statistiques administrateur\n');
  
  // Test d'authentification
  const token = await testAdminAuth();
  if (!token) {
    console.log('\n❌ Impossible de continuer sans authentification admin');
    process.exit(1);
  }
  
  // Tests des APIs
  const dashboardSuccess = await testAdminDashboard(token);
  const usersSuccess = await testAdminUsers(token);
  const anonymousUsersSuccess = await testAdminAnonymousUsers(token);
  
  // Résumé
  console.log('\n📋 Résumé des tests:');
  console.log(`   - Dashboard admin: ${dashboardSuccess ? '✅' : '❌'}`);
  console.log(`   - Liste des utilisateurs: ${usersSuccess ? '✅' : '❌'}`);
  console.log(`   - Liste des utilisateurs anonymes: ${anonymousUsersSuccess ? '✅' : '❌'}`);
  
  const allSuccess = dashboardSuccess && usersSuccess && anonymousUsersSuccess;
  console.log(`\n${allSuccess ? '🎉 Tous les tests sont passés avec succès!' : '⚠️  Certains tests ont échoué'}`);
  
  process.exit(allSuccess ? 0 : 1);
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
  testAdminAuth,
  testAdminDashboard,
  testAdminUsers,
  testAdminAnonymousUsers
};
