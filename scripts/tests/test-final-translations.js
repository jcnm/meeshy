#!/usr/bin/env node

/**
 * Script de test final pour vérifier que les traductions fonctionnent correctement
 */

const https = require('https');
const http = require('http');

async function testFinalTranslations() {
  console.log('🔍 Test final des traductions...\n');
  
  try {
    // 1. Authentification
    console.log('1️⃣ Authentification...');
    
    const loginData = JSON.stringify({
      username: 'admin',
      password: 'admin123'
    });
    
    const loginResponse = await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: 'localhost',
        port: 3000,
        path: '/auth/login',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(loginData)
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            resolve({ error: 'Invalid JSON', data });
          }
        });
      });
      
      req.on('error', reject);
      req.write(loginData);
      req.end();
    });
    
    if (!loginResponse.success || !loginResponse.data?.token) {
      console.log('❌ Échec de l\'authentification');
      return;
    }
    
    const token = loginResponse.data.token;
    const user = loginResponse.data.user;
    console.log('✅ Authentification réussie');
    console.log(`   Utilisateur: ${user.username}`);
    console.log(`   Langue préférée: ${user.useCustomDestination ? user.customDestinationLanguage : user.systemLanguage}`);
    console.log('');
    
    // 2. Chargement des messages
    console.log('2️⃣ Chargement des messages...');
    
    const messagesResponse = await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: 'localhost',
        port: 3000,
        path: '/conversations/meeshy/messages?limit=50',
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            resolve({ error: 'Invalid JSON', data });
          }
        });
      });
      
      req.on('error', reject);
      req.end();
    });
    
    if (!messagesResponse.success || !messagesResponse.data?.messages) {
      console.log('❌ Erreur lors du chargement des messages');
      return;
    }
    
    const messages = messagesResponse.data.messages;
    const messagesWithTranslations = messages.filter(m => m.translations?.length > 0);
    
    console.log(`✅ ${messages.length} messages chargés`);
    console.log(`✅ ${messagesWithTranslations.length} messages avec traductions`);
    console.log('');
    
    // 3. Analyse des traductions
    console.log('3️⃣ Analyse des traductions...');
    
    if (messagesWithTranslations.length > 0) {
      console.log('📊 Messages avec traductions:');
      messagesWithTranslations.forEach((msg, index) => {
        console.log(`   Message ${index + 1}:`);
        console.log(`     ID: ${msg.id}`);
        console.log(`     Contenu original: ${msg.content.substring(0, 40)}...`);
        console.log(`     Langue originale: ${msg.originalLanguage}`);
        console.log(`     Traductions: ${msg.translations.length}`);
        
        msg.translations.forEach(t => {
          console.log(`       - ${t.targetLanguage}: ${t.translatedContent.substring(0, 30)}...`);
        });
        
        // Vérifier si la traduction sera affichée
        const preferredLanguage = user.useCustomDestination ? user.customDestinationLanguage : user.systemLanguage;
        const willBeTranslated = msg.originalLanguage !== preferredLanguage && 
          msg.translations.some(t => t.targetLanguage === preferredLanguage);
        
        console.log(`     Sera traduit: ${willBeTranslated ? '✅ Oui' : '❌ Non'} (préféré: ${preferredLanguage})`);
        console.log('');
      });
    } else {
      console.log('⚠️ Aucun message avec traductions trouvé');
    }
    
    // 4. Test de simulation frontend
    console.log('4️⃣ Simulation du traitement frontend...');
    
    const preferredLanguage = user.useCustomDestination ? user.customDestinationLanguage : user.systemLanguage;
    
    messagesWithTranslations.forEach((msg, index) => {
      console.log(`   Message ${index + 1} (${msg.id}):`);
      
      // Simuler processMessageWithTranslations
      const translations = (msg.translations || [])
        .filter(t => t && t.targetLanguage && t.translatedContent)
        .map(t => ({
          language: t.targetLanguage,
          content: t.translatedContent,
          status: 'completed',
          timestamp: new Date(t.createdAt || msg.createdAt),
          confidence: t.confidenceScore || 0.9
        }));
      
      const originalLanguage = msg.originalLanguage || 'fr';
      
      // Déterminer le contenu à afficher
      let displayContent = msg.content;
      let isTranslated = false;
      let translatedFrom;
      
      if (originalLanguage !== preferredLanguage) {
        const preferredTranslation = translations.find(t => 
          t.language === preferredLanguage && t.status === 'completed'
        );
        
        if (preferredTranslation) {
          displayContent = preferredTranslation.content;
          isTranslated = true;
          translatedFrom = originalLanguage;
        } else {
          isTranslated = false;
          translatedFrom = originalLanguage;
        }
      }
      
      console.log(`     Langue originale: ${originalLanguage}`);
      console.log(`     Langue préférée: ${preferredLanguage}`);
      console.log(`     Contenu affiché: ${displayContent.substring(0, 40)}...`);
      console.log(`     Est traduit: ${isTranslated ? '✅ Oui' : '❌ Non'}`);
      console.log(`     Traductions disponibles: ${translations.length}`);
      console.log('');
    });
    
    console.log('✅ Test final terminé !');
    console.log('🔄 Maintenant, rechargez la conversation dans le frontend pour voir les traductions.');
    
  } catch (error) {
    console.error('❌ Erreur lors du test:', error);
  }
}

// Exécuter le test
testFinalTranslations().catch(console.error);
