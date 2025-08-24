#!/usr/bin/env node

/**
 * Script de test pour l'API de chargement des messages avec traductions
 */

const https = require('https');
const http = require('http');

async function testApiTranslations() {
  console.log('🔍 Test de l\'API de chargement des messages...\n');
  
  try {
    // 1. D'abord, obtenir un token d'authentification
    console.log('1️⃣ Tentative d\'authentification...');
    
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
    
    console.log('📊 Réponse login:', loginResponse);
    
    if (!loginResponse.success || !loginResponse.data?.token) {
      console.log('❌ Échec de l\'authentification');
      return;
    }
    
    const token = loginResponse.data.token;
    console.log('✅ Authentification réussie\n');
    
    // 2. Tester l'API de chargement des messages
    console.log('2️⃣ Test de l\'API de chargement des messages...');
    
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
    
    console.log('📊 Réponse messages:', {
      success: messagesResponse.success,
      messageCount: messagesResponse.data?.messages?.length || 0,
      hasTranslations: messagesResponse.data?.messages?.some(m => m.translations?.length > 0) || false
    });
    
    if (messagesResponse.success && messagesResponse.data?.messages) {
      const messages = messagesResponse.data.messages;
      const messagesWithTranslations = messages.filter(m => m.translations?.length > 0);
      
      console.log(`   📊 ${messages.length} messages chargés`);
      console.log(`   📊 ${messagesWithTranslations.length} messages avec traductions`);
      
      if (messagesWithTranslations.length > 0) {
        console.log('   📝 Exemples de messages avec traductions:');
        messagesWithTranslations.slice(0, 3).forEach((msg, index) => {
          console.log(`      Message ${index + 1}:`);
          console.log(`        ID: ${msg.id}`);
          console.log(`        Contenu: ${msg.content.substring(0, 30)}...`);
          console.log(`        Traductions: ${msg.translations.length}`);
          msg.translations.forEach(t => {
            console.log(`          - ${t.targetLanguage}: ${t.translatedContent.substring(0, 20)}...`);
          });
        });
      } else {
        console.log('   ⚠️ Aucun message avec traductions trouvé dans la réponse API');
        
        // Debug: Afficher les premiers messages pour voir leur structure
        if (messages.length > 0) {
          console.log('   🔍 Structure du premier message:');
          const firstMsg = messages[0];
          console.log(`      ID: ${firstMsg.id}`);
          console.log(`      Contenu: ${firstMsg.content.substring(0, 30)}...`);
          console.log(`      Traductions: ${firstMsg.translations?.length || 0}`);
          console.log(`      Clés disponibles: ${Object.keys(firstMsg).join(', ')}`);
        }
      }
    } else {
      console.log('❌ Erreur API:', messagesResponse);
    }
    
  } catch (error) {
    console.error('❌ Erreur lors du test:', error);
  }
}

// Exécuter le test
testApiTranslations().catch(console.error);
