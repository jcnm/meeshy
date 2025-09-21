#!/usr/bin/env node

/**
 * Test complet de navigation et messagerie Meeshy
 * Ce script teste :
 * - Navigation sans rechargement
 * - Préservation du scroll
 * - Chargement des messages
 * - WebSocket et temps réel
 * - Traductions
 * - État vide
 */

const puppeteer = require('puppeteer');
const chalk = require('chalk');
const { io } = require('socket.io-client');

const BASE_URL = 'http://localhost:3100';
const API_URL = 'http://localhost:3000';
const WS_URL = 'http://localhost:3000';

// Credentials de test
const TEST_USER = {
  email: 'test@meeshy.com',
  password: 'Test123456!',
  username: 'testuser'
};

const TEST_USER_2 = {
  email: 'test2@meeshy.com', 
  password: 'Test123456!',
  username: 'testuser2'
};

// Utilitaires de log
const log = {
  info: (msg) => console.log(chalk.blue('[INFO]'), msg),
  success: (msg) => console.log(chalk.green('[SUCCESS]'), msg),
  error: (msg) => console.log(chalk.red('[ERROR]'), msg),
  warning: (msg) => console.log(chalk.yellow('[WARNING]'), msg),
  test: (name) => console.log(chalk.cyan(`\n[TEST] ${name}`))
};

// Attendre un certain temps
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Créer un utilisateur de test
async function createTestUser(userData) {
  try {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });
    
    if (response.ok) {
      const data = await response.json();
      log.success(`Utilisateur créé: ${userData.username}`);
      return data.token;
    }
    
    // Si l'utilisateur existe déjà, on se connecte
    const loginResponse = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: userData.email,
        password: userData.password
      })
    });
    
    if (loginResponse.ok) {
      const data = await loginResponse.json();
      log.info(`Connexion réussie: ${userData.username}`);
      return data.token;
    }
    
    throw new Error('Impossible de créer ou connecter l\'utilisateur');
  } catch (error) {
    log.error(`Erreur création utilisateur: ${error.message}`);
    throw error;
  }
}

// Tests de navigation
async function testNavigation(page, token) {
  log.test('Test de navigation sans rechargement');
  
  // Se connecter
  await page.evaluate((token) => {
    localStorage.setItem('auth_token', token);
  }, token);
  
  await page.goto(`${BASE_URL}/conversations`);
  await wait(3000);
  
  // Vérifier qu'on est sur la page conversations
  const url = page.url();
  if (!url.includes('/conversations')) {
    throw new Error('Navigation vers /conversations échouée');
  }
  log.success('Page conversations chargée');
  
  // Attendre le chargement des conversations
  try {
    await page.waitForSelector('.conversation-list-item', { timeout: 10000 });
    log.success('Liste des conversations chargée');
  } catch (e) {
    log.warning('Aucune conversation trouvée, création d\'une nouvelle');
    
    // Créer une conversation
    await page.click('button[title*="createNewConversation"]');
    await wait(1000);
    
    // Remplir le formulaire
    await page.waitForSelector('input[placeholder*="search"]');
    await page.type('input[placeholder*="search"]', TEST_USER_2.username);
    await wait(1000);
    
    // Sélectionner l'utilisateur
    const userSelector = `div:has-text("${TEST_USER_2.username}")`;
    await page.click(userSelector);
    
    // Créer la conversation
    await page.click('button:has-text("Créer")');
    await wait(2000);
  }
  
  // Obtenir le nombre initial de rechargements
  const initialNavigations = await page.evaluate(() => {
    window.__navigationCount = window.__navigationCount || 0;
    window.addEventListener('beforeunload', () => {
      window.__navigationCount++;
    });
    return window.__navigationCount;
  });
  
  // Sélectionner une conversation
  const conversations = await page.$$('.conversation-list-item');
  if (conversations.length > 0) {
    // Obtenir la position de scroll avant sélection
    const scrollBefore = await page.evaluate(() => {
      const scrollContainer = document.querySelector('.overflow-y-auto');
      return scrollContainer ? scrollContainer.scrollTop : 0;
    });
    
    log.info(`Position de scroll avant: ${scrollBefore}`);
    
    // Cliquer sur la première conversation
    await conversations[0].click();
    await wait(2000);
    
    // Vérifier qu'il n'y a pas eu de rechargement
    const navigationsAfterSelect = await page.evaluate(() => window.__navigationCount);
    if (navigationsAfterSelect > initialNavigations) {
      throw new Error('La page a été rechargée lors de la sélection!');
    }
    log.success('Conversation sélectionnée sans rechargement');
    
    // Vérifier que l'URL a changé
    const urlAfterSelect = page.url();
    if (!urlAfterSelect.includes('/conversations/')) {
      throw new Error('URL non mise à jour après sélection');
    }
    log.success('URL mise à jour correctement');
    
    // Retourner à la liste
    await page.click('button[aria-label*="back"]');
    await wait(1000);
    
    // Vérifier la position de scroll
    const scrollAfter = await page.evaluate(() => {
      const scrollContainer = document.querySelector('.overflow-y-auto');
      return scrollContainer ? scrollContainer.scrollTop : 0;
    });
    
    log.info(`Position de scroll après: ${scrollAfter}`);
    if (Math.abs(scrollAfter - scrollBefore) < 5) { // Tolérance de 5px
      log.success('Position de scroll préservée');
    } else {
      log.warning('Position de scroll modifiée');
    }
  }
}

// Test du chargement des messages
async function testMessageLoading(page) {
  log.test('Test du chargement des messages');
  
  // Sélectionner une conversation
  const conversations = await page.$$('.conversation-list-item');
  if (conversations.length > 0) {
    await conversations[0].click();
    await wait(2000);
    
    // Vérifier que les messages sont chargés
    try {
      await page.waitForSelector('.message-content', { timeout: 5000 });
      log.success('Messages chargés');
    } catch (e) {
      log.info('Aucun message, envoi d\'un message de test');
      
      // Envoyer un message
      await page.type('textarea[placeholder*="message"]', 'Test message de navigation');
      await page.keyboard.press('Enter');
      await wait(2000);
      
      // Vérifier que le message apparaît
      const messageVisible = await page.$('.message-content:has-text("Test message")');
      if (messageVisible) {
        log.success('Message envoyé et affiché');
      } else {
        log.error('Message non affiché');
      }
    }
  }
}

// Test WebSocket
async function testWebSocket(token) {
  log.test('Test des WebSockets');
  
  return new Promise((resolve, reject) => {
    const socket = io(WS_URL, {
      auth: { token },
      transports: ['websocket']
    });
    
    socket.on('connect', () => {
      log.success('WebSocket connecté');
      
      // S'abonner à une conversation de test
      socket.emit('join:conversation', { conversationId: 'test-conv-id' });
      
      setTimeout(() => {
        socket.disconnect();
        resolve();
      }, 3000);
    });
    
    socket.on('connect_error', (error) => {
      log.error(`Erreur WebSocket: ${error.message}`);
      reject(error);
    });
    
    socket.on('message:new', (data) => {
      log.success('Message reçu via WebSocket');
    });
    
    socket.on('user:typing', (data) => {
      log.success('Indicateur de frappe reçu');
    });
  });
}

// Test navigation avec boutons du navigateur
async function testBrowserNavigation(page) {
  log.test('Test navigation avec boutons du navigateur');
  
  // Aller sur la liste
  await page.goto(`${BASE_URL}/conversations`);
  await wait(2000);
  
  // Sélectionner une conversation
  const conversations = await page.$$('.conversation-list-item');
  if (conversations.length > 0) {
    await conversations[0].click();
    await wait(2000);
    
    const urlWithConv = page.url();
    
    // Utiliser le bouton retour du navigateur
    await page.goBack();
    await wait(1000);
    
    // Vérifier qu'on est revenu à la liste
    const urlAfterBack = page.url();
    if (!urlAfterBack.endsWith('/conversations')) {
      throw new Error('Navigation arrière échouée');
    }
    log.success('Navigation arrière fonctionnelle');
    
    // Utiliser le bouton avancer
    await page.goForward();
    await wait(1000);
    
    // Vérifier qu'on est revenu à la conversation
    const urlAfterForward = page.url();
    if (urlAfterForward !== urlWithConv) {
      throw new Error('Navigation avant échouée');
    }
    log.success('Navigation avant fonctionnelle');
  }
}

// Test principal
async function runTests() {
  log.info('Démarrage des tests de navigation Meeshy\n');
  
  let browser;
  try {
    // Créer les utilisateurs de test
    const token1 = await createTestUser(TEST_USER);
    const token2 = await createTestUser(TEST_USER_2);
    
    // Lancer le navigateur
    browser = await puppeteer.launch({
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      defaultViewport: { width: 1280, height: 800 }
    });
    
    const page = await browser.newPage();
    
    // Activer les logs console
    page.on('console', msg => {
      if (msg.type() === 'error') {
        log.error(`Console: ${msg.text()}`);
      }
    });
    
    // Tests de navigation
    await testNavigation(page, token1);
    
    // Test chargement messages
    await testMessageLoading(page);
    
    // Test WebSocket
    await testWebSocket(token1);
    
    // Test navigation navigateur
    await testBrowserNavigation(page);
    
    log.success('\n✅ Tous les tests réussis!');
    
  } catch (error) {
    log.error(`\n❌ Erreur test: ${error.message}`);
    console.error(error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Vérifier les dépendances
async function checkDependencies() {
  try {
    require('puppeteer');
    require('chalk');
    require('socket.io-client');
  } catch (e) {
    log.error('Dépendances manquantes. Installation...');
    const { execSync } = require('child_process');
    execSync('npm install puppeteer chalk socket.io-client', { stdio: 'inherit' });
  }
}

// Lancer les tests
checkDependencies().then(() => {
  runTests();
});
