#!/usr/bin/env node

/**
 * Script de test pour vérifier l'upload d'avatar
 */

const API_URL = process.env.API_URL || 'http://localhost:4000';

async function testAvatarUpload() {
  console.log('🧪 Test de l\'upload d\'avatar\n');

  // 1. D'abord, se connecter pour obtenir un token
  console.log('1️⃣ Connexion...');
  const loginResponse = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'admin',
      password: 'password123'
    })
  });

  if (!loginResponse.ok) {
    console.error('❌ Échec de la connexion');
    const error = await loginResponse.text();
    console.error(error);
    process.exit(1);
  }

  const loginData = await loginResponse.json();
  const token = loginData.data.token;
  console.log('✅ Connecté avec succès\n');

  // 2. Tester avec une URL valide
  console.log('2️⃣ Test avec une URL HTTPS valide...');
  const validUrl = 'https://example.com/avatar.jpg';
  const validResponse = await fetch(`${API_URL}/api/users/me/avatar`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ avatar: validUrl })
  });

  console.log(`Status: ${validResponse.status}`);
  const validData = await validResponse.json();
  console.log('Réponse:', JSON.stringify(validData, null, 2));

  if (validResponse.ok) {
    console.log('✅ URL HTTPS acceptée\n');
  } else {
    console.log('❌ URL HTTPS rejetée\n');
  }

  // 3. Tester avec une URL HTTP
  console.log('3️⃣ Test avec une URL HTTP...');
  const httpUrl = 'http://localhost:3000/i/p/2024/10/avatar_123.jpg';
  const httpResponse = await fetch(`${API_URL}/api/users/me/avatar`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ avatar: httpUrl })
  });

  console.log(`Status: ${httpResponse.status}`);
  const httpData = await httpResponse.json();
  console.log('Réponse:', JSON.stringify(httpData, null, 2));

  if (httpResponse.ok) {
    console.log('✅ URL HTTP acceptée\n');
  } else {
    console.log('❌ URL HTTP rejetée\n');
  }

  // 4. Tester avec une data URL (base64)
  console.log('4️⃣ Test avec une data URL (base64)...');
  const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const dataResponse = await fetch(`${API_URL}/api/users/me/avatar`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ avatar: dataUrl })
  });

  console.log(`Status: ${dataResponse.status}`);
  const dataData = await dataResponse.json();
  console.log('Réponse:', JSON.stringify(dataData, null, 2));

  if (dataResponse.ok) {
    console.log('✅ Data URL acceptée\n');
  } else {
    console.log('❌ Data URL rejetée\n');
  }

  // 5. Tester avec une URL invalide
  console.log('5️⃣ Test avec une URL invalide...');
  const invalidUrl = 'ftp://example.com/avatar.jpg';
  const invalidResponse = await fetch(`${API_URL}/api/users/me/avatar`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ avatar: invalidUrl })
  });

  console.log(`Status: ${invalidResponse.status}`);
  const invalidData = await invalidResponse.json();
  console.log('Réponse:', JSON.stringify(invalidData, null, 2));

  if (!invalidResponse.ok) {
    console.log('✅ URL invalide correctement rejetée\n');
  } else {
    console.log('❌ URL invalide acceptée (problème de validation!)\n');
  }

  // 6. Tester avec des champs supplémentaires (devrait échouer avec .strict())
  console.log('6️⃣ Test avec champs supplémentaires...');
  const extraFieldsResponse = await fetch(`${API_URL}/api/users/me/avatar`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ 
      avatar: validUrl,
      firstName: 'Test',
      lastName: 'User'
    })
  });

  console.log(`Status: ${extraFieldsResponse.status}`);
  const extraFieldsData = await extraFieldsResponse.json();
  console.log('Réponse:', JSON.stringify(extraFieldsData, null, 2));

  if (!extraFieldsResponse.ok) {
    console.log('✅ Champs supplémentaires correctement rejetés\n');
  } else {
    console.log('⚠️  Champs supplémentaires acceptés (pas de .strict())\n');
  }

  console.log('🎉 Tests terminés!');
}

// Exécuter les tests
testAvatarUpload().catch(error => {
  console.error('❌ Erreur lors du test:', error);
  process.exit(1);
});

