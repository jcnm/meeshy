#!/usr/bin/env node

/**
 * Script de validation de la configuration Meeshy
 * Vérifie la cohérence des ports et URLs dans tous les fichiers de configuration
 */

const fs = require('fs');
const path = require('path');

// Couleurs pour les logs
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(color, message) {
  console.log(`${color}${message}${colors.reset}`);
}

function loadEnvFile() {
  const envPath = path.join(__dirname, '../.env');
  const envVars = {};
  
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach(line => {
      const match = line.match(/^([^#][^=]*?)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim().replace(/^["']|["']$/g, '');
        envVars[key] = value;
      }
    });
  }
  
  return envVars;
}

function validateConfiguration() {
  log(colors.cyan, '🔍 Validation de la configuration Meeshy...\n');
  
  const env = loadEnvFile();
  let errors = 0;
  let warnings = 0;
  
  // Validation des ports
  const expectedPorts = {
    frontend: '3100',
    backend: '3000', 
    translation: '8000'
  };
  
  // Extraction des ports depuis les URLs
  const frontendPort = env.NEXT_PUBLIC_FRONTEND_URL?.split(':')[2] || 'UNKNOWN';
  const backendPort = env.NEXT_PUBLIC_BACKEND_URL?.split(':')[2] || 'UNKNOWN';
  const translationPort = env.NEXT_PUBLIC_TRANSLATION_URL?.split(':')[2] || 'UNKNOWN';
  
  log(colors.blue, '📊 Ports configurés:');
  console.log(`  Frontend: ${frontendPort} (attendu: ${expectedPorts.frontend})`);
  console.log(`  Backend: ${backendPort} (attendu: ${expectedPorts.backend})`);
  console.log(`  Translation: ${translationPort} (attendu: ${expectedPorts.translation})`);
  console.log(`  PORT env var: ${env.PORT || 'UNDEFINED'}`);
  console.log(`  WS_PORT env var: ${env.WS_PORT || 'UNDEFINED'}\n`);
  
  // Vérification des ports
  if (frontendPort !== expectedPorts.frontend) {
    log(colors.red, `❌ Port frontend incorrect: ${frontendPort} (attendu: ${expectedPorts.frontend})`);
    errors++;
  } else {
    log(colors.green, '✅ Port frontend correct');
  }
  
  if (backendPort !== expectedPorts.backend) {
    log(colors.red, `❌ Port backend incorrect: ${backendPort} (attendu: ${expectedPorts.backend})`);
    errors++;
  } else {
    log(colors.green, '✅ Port backend correct');
  }
  
  if (translationPort !== expectedPorts.translation) {
    log(colors.red, `❌ Port translation incorrect: ${translationPort} (attendu: ${expectedPorts.translation})`);
    errors++;
  } else {
    log(colors.green, '✅ Port translation correct');
  }
  
  // Vérification de la cohérence PORT vs URL backend
  if (env.PORT !== expectedPorts.backend) {
    log(colors.red, `❌ Variable PORT incohérente: ${env.PORT} (attendu: ${expectedPorts.backend})`);
    errors++;
  } else {
    log(colors.green, '✅ Variable PORT cohérente');
  }
  
  // Vérification WebSocket
  const wsUrl = env.NEXT_PUBLIC_WS_URL || '';
  const wsPort = wsUrl.split(':')[2] || 'UNKNOWN';
  if (wsPort !== expectedPorts.backend) {
    log(colors.red, `❌ Port WebSocket incorrect: ${wsPort} (attendu: ${expectedPorts.backend})`);
    errors++;
  } else {
    log(colors.green, '✅ Port WebSocket correct');
  }
  
  // Vérification CORS
  const corsOrigin = env.CORS_ORIGIN || '';
  const expectedCorsOrigin = `http://localhost:${expectedPorts.frontend}`;
  if (corsOrigin !== expectedCorsOrigin) {
    log(colors.yellow, `⚠️  CORS_ORIGIN: ${corsOrigin} (attendu: ${expectedCorsOrigin})`);
    warnings++;
  } else {
    log(colors.green, '✅ CORS_ORIGIN correct');
  }
  
  // Vérification modèles ML
  console.log('\n');
  log(colors.blue, '🤖 Configuration ML:');
  console.log(`  BASIC_MODEL: ${env.BASIC_MODEL || 'UNDEFINED'}`);
  console.log(`  MEDIUM_MODEL: ${env.MEDIUM_MODEL || 'UNDEFINED'}`);
  console.log(`  PREMIUM_MODEL: ${env.PREMIUM_MODEL || 'UNDEFINED'}`);
  console.log(`  MODELS_PATH: ${env.MODELS_PATH || 'UNDEFINED'}`);
  
  // Vérification des modèles
  if (env.MODELS_PATH && fs.existsSync(env.MODELS_PATH)) {
    log(colors.green, '✅ Dossier des modèles existe');
    
    const modelsToCheck = [env.BASIC_MODEL, env.MEDIUM_MODEL, env.PREMIUM_MODEL];
    modelsToCheck.forEach(model => {
      if (model) {
        const modelPath = path.join(env.MODELS_PATH, model);
        if (fs.existsSync(modelPath)) {
          log(colors.green, `✅ Modèle ${model} trouvé`);
        } else {
          log(colors.yellow, `⚠️  Modèle ${model} non trouvé à ${modelPath}`);
          warnings++;
        }
      }
    });
  } else {
    log(colors.yellow, `⚠️  Dossier des modèles non trouvé: ${env.MODELS_PATH}`);
    warnings++;
  }
  
  // Résumé final
  console.log('\n');
  log(colors.cyan, '📋 Résumé de la validation:');
  
  if (errors === 0 && warnings === 0) {
    log(colors.green, '🎉 Configuration parfaite ! Aucun problème détecté.');
  } else {
    if (errors > 0) {
      log(colors.red, `❌ ${errors} erreur(s) critique(s) trouvée(s)`);
    }
    if (warnings > 0) {
      log(colors.yellow, `⚠️  ${warnings} avertissement(s)`);
    }
  }
  
  return errors === 0;
}

// Exécution du script
if (require.main === module) {
  const isValid = validateConfiguration();
  process.exit(isValid ? 0 : 1);
}

module.exports = { validateConfiguration };
