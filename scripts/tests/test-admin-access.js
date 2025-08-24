#!/usr/bin/env node

/**
 * Script pour tester l'accès admin via l'API
 * Usage: node scripts/test-admin-access.js
 */

import fetch from 'node-fetch';

async function testAdminAccess() {
  try {
    console.log('🔍 Test d\'accès à l\'administration...');

    // 1. Connexion avec l'utilisateur meeshy
    console.log('\n1️⃣ Connexion avec meeshy/meeshy123...');
    const loginResponse = await fetch('http://localhost:3000/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: 'meeshy',
        password: 'meeshy123'
      })
    });

    if (!loginResponse.ok) {
      console.error('❌ Échec de la connexion');
      return;
    }

    const loginData = await loginResponse.json();
    const token = loginData.data.token;
    const user = loginData.data.user;

    console.log('✅ Connexion réussie');
    console.log(`   Utilisateur: ${user.username}`);
    console.log(`   Rôle: ${user.role}`);
    console.log(`   canAccessAdmin: ${user.permissions?.canAccessAdmin}`);

    // 2. Test de l'endpoint /auth/me
    console.log('\n2️⃣ Test de l\'endpoint /auth/me...');
    const meResponse = await fetch('http://localhost:3000/auth/me', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!meResponse.ok) {
      console.error('❌ Échec de la récupération du profil');
      return;
    }

    const meData = await meResponse.json();
    const meUser = meData.data.user;

    console.log('✅ Profil récupéré avec succès');
    console.log(`   Utilisateur: ${meUser.username}`);
    console.log(`   Rôle: ${meUser.role}`);
    console.log(`   canAccessAdmin: ${meUser.permissions?.canAccessAdmin}`);

    // 3. Test de l'endpoint admin
    console.log('\n3️⃣ Test de l\'endpoint admin...');
    const adminResponse = await fetch('http://localhost:3000/admin/dashboard', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    console.log(`   Status: ${adminResponse.status}`);
    if (adminResponse.ok) {
      const adminData = await adminResponse.json();
      console.log('✅ Accès admin autorisé');
      console.log('   Données admin:', JSON.stringify(adminData, null, 2));
    } else {
      console.log('❌ Accès admin refusé');
      const errorData = await adminResponse.text();
      console.log('   Erreur:', errorData);
    }

    // 4. Test avec l'utilisateur admin
    console.log('\n4️⃣ Test avec admin/admin123...');
    const adminLoginResponse = await fetch('http://localhost:3000/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: 'admin',
        password: 'admin123'
      })
    });

    if (adminLoginResponse.ok) {
      const adminLoginData = await adminLoginResponse.json();
      const adminToken = adminLoginData.data.token;
      const adminUser = adminLoginData.data.user;

      console.log('✅ Connexion admin réussie');
      console.log(`   Utilisateur: ${adminUser.username}`);
      console.log(`   Rôle: ${adminUser.role}`);
      console.log(`   canAccessAdmin: ${adminUser.permissions?.canAccessAdmin}`);

      // Test admin avec admin
      const adminAdminResponse = await fetch('http://localhost:3000/admin/dashboard', {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      });

      console.log(`   Status admin: ${adminAdminResponse.status}`);
      if (adminAdminResponse.ok) {
        console.log('✅ Accès admin autorisé pour admin');
      } else {
        console.log('❌ Accès admin refusé pour admin');
      }
    }

  } catch (error) {
    console.error('❌ Erreur lors du test:', error);
  }
}

// Exécuter le test
testAdminAccess();
