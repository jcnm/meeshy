#!/usr/bin/env node

/**
 * Script pour vérifier la cohérence des types entre frontend et gateway
 */

const fs = require('fs');
const path = require('path');

// Configuration
const SHARED_TYPES_PATH = path.join(__dirname, '../shared/types');
const FRONTEND_TYPES_PATH = path.join(__dirname, '../frontend/types');
const GATEWAY_TYPES_PATH = path.join(__dirname, '../gateway/shared/types');

// Types critiques à vérifier
const CRITICAL_TYPES = [
  'Conversation',
  'Message',
  'User',
  'SocketIOUser',
  'ThreadMember',
  'TranslationData',
  'AuthRequest',
  'AuthResponse'
];

function checkFileExists(filePath) {
  return fs.existsSync(filePath);
}

function readFileContent(filePath) {
  if (!checkFileExists(filePath)) {
    return null;
  }
  return fs.readFileSync(filePath, 'utf8');
}

function extractTypeDefinitions(content) {
  if (!content) return [];
  
  const typeRegex = /(?:export\s+)?(?:interface|type)\s+(\w+)/g;
  const types = [];
  let match;
  
  while ((match = typeRegex.exec(content)) !== null) {
    types.push(match[1]);
  }
  
  return types;
}

function getAllTypesFromDirectory(dirPath) {
  const types = [];
  
  if (!fs.existsSync(dirPath)) {
    return types;
  }
  
  const files = fs.readdirSync(dirPath);
  
  for (const file of files) {
    if (file.endsWith('.ts') && !file.endsWith('.d.ts')) {
      const filePath = path.join(dirPath, file);
      const content = readFileContent(filePath);
      if (content) {
        const fileTypes = extractTypeDefinitions(content);
        types.push(...fileTypes);
      }
    }
  }
  
  return types;
}

function checkTypeConsistency() {
  console.log('🔍 Vérification de la cohérence des types...\n');

  // Lire les fichiers de types
  const sharedTypesContent = readFileContent(path.join(SHARED_TYPES_PATH, 'index.ts'));
  const frontendTypesContent = readFileContent(path.join(FRONTEND_TYPES_PATH, 'index.ts'));
  const gatewayTypesContent = readFileContent(path.join(GATEWAY_TYPES_PATH, 'index.ts'));

  if (!sharedTypesContent) {
    console.error('❌ Fichier shared/types/index.ts non trouvé');
    return false;
  }

  // Extraire les définitions de types (incluant tous les fichiers .ts)
  const sharedTypes = getAllTypesFromDirectory(SHARED_TYPES_PATH);
  const frontendTypes = getAllTypesFromDirectory(FRONTEND_TYPES_PATH);
  const gatewayTypes = getAllTypesFromDirectory(GATEWAY_TYPES_PATH);

  console.log(`📊 Types trouvés:`);
  console.log(`   - Shared: ${sharedTypes.length} types`);
  console.log(`   - Frontend: ${frontendTypes.length} types`);
  console.log(`   - Gateway: ${gatewayTypes.length} types\n`);

  // Vérifier les types critiques
  console.log('🔑 Vérification des types critiques:');
  let allCriticalTypesPresent = true;

  for (const criticalType of CRITICAL_TYPES) {
    const inShared = sharedTypes.includes(criticalType);
    const inFrontend = frontendTypes.includes(criticalType);
    const inGateway = gatewayTypes.includes(criticalType);

    console.log(`   ${criticalType}:`);
    console.log(`     - Shared: ${inShared ? '✅' : '❌'}`);
    console.log(`     - Frontend: ${inFrontend ? '✅' : '❌'}`);
    console.log(`     - Gateway: ${inGateway ? '✅' : '❌'}`);

    if (!inShared) {
      console.log(`     ⚠️  ${criticalType} manquant dans shared/types`);
      allCriticalTypesPresent = false;
    }

    if (inFrontend && !inShared) {
      console.log(`     ⚠️  ${criticalType} défini dans frontend mais pas dans shared`);
    }

    if (inGateway && !inShared) {
      console.log(`     ⚠️  ${criticalType} défini dans gateway mais pas dans shared`);
    }
  }

  console.log('\n📋 Résumé:');
  if (allCriticalTypesPresent) {
    console.log('✅ Tous les types critiques sont présents dans shared/types');
  } else {
    console.log('❌ Certains types critiques manquent dans shared/types');
  }

  // Vérifier les doublons
  const frontendOnlyTypes = frontendTypes.filter(type => !sharedTypes.includes(type));
  const gatewayOnlyTypes = gatewayTypes.filter(type => !sharedTypes.includes(type));

  if (frontendOnlyTypes.length > 0) {
    console.log(`\n⚠️  Types définis uniquement dans frontend (${frontendOnlyTypes.length}):`);
    frontendOnlyTypes.forEach(type => console.log(`   - ${type}`));
  }

  if (gatewayOnlyTypes.length > 0) {
    console.log(`\n⚠️  Types définis uniquement dans gateway (${gatewayOnlyTypes.length}):`);
    gatewayOnlyTypes.forEach(type => console.log(`   - ${type}`));
  }

  // Vérifier les imports
  console.log('\n🔗 Vérification des imports:');
  
  if (frontendTypesContent) {
    const hasSharedImport = frontendTypesContent.includes("export * from '../../shared/types'");
    console.log(`   - Frontend importe shared/types: ${hasSharedImport ? '✅' : '❌'}`);
  }

  if (gatewayTypesContent) {
    const hasSharedImport = gatewayTypesContent.includes("export * from '../../shared/types'");
    console.log(`   - Gateway importe shared/types: ${hasSharedImport ? '✅' : '❌'}`);
  }

  return allCriticalTypesPresent;
}

function main() {
  try {
    const isConsistent = checkTypeConsistency();
    
    if (isConsistent) {
      console.log('\n🎉 Types cohérents !');
      process.exit(0);
    } else {
      console.log('\n⚠️  Incohérences détectées dans les types');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Erreur lors de la vérification:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { checkTypeConsistency };
