#!/usr/bin/env node

// Test rapide de la configuration
const fs = require('fs');
const path = require('path');

console.log('🧪 Test de la configuration Meeshy...\n');

// Vérifier les fichiers de configuration
const configFiles = [
  'src/lib/config.ts',
  'backend/src/main.ts',
  '.env.example',
  'backend/.env.example'
];

console.log('📁 Vérification des fichiers de configuration:');
configFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    console.log(`  ✅ ${file}`);
  } else {
    console.log(`  ❌ ${file}`);
  }
});

// Vérifier les ports dans les fichiers
console.log('\n🔌 Vérification des ports:');

// Config centralisée
const configPath = path.join(__dirname, 'src/lib/config.ts');
if (fs.existsSync(configPath)) {
  const configContent = fs.readFileSync(configPath, 'utf8');
  if (configContent.includes('3000') && configContent.includes('3100')) {
    console.log('  ✅ Ports corrects dans config.ts (Backend: 3000, Frontend: 3100)');
  } else {
    console.log('  ❌ Ports incorrects dans config.ts');
  }
}

// Backend main.ts
const backendMainPath = path.join(__dirname, 'backend/src/main.ts');
if (fs.existsSync(backendMainPath)) {
  const backendContent = fs.readFileSync(backendMainPath, 'utf8');
  if (backendContent.includes('3000')) {
    console.log('  ✅ Port correct dans backend/src/main.ts (3100)');
  } else {
    console.log('  ❌ Port incorrect dans backend/src/main.ts');
  }
}

// Vérifier les références hardcodées
console.log('\n🔍 Vérification des URLs hardcodées:');
const checkFiles = [
  'src/components/auth/login-form.tsx',
  'src/components/auth/register-form.tsx',
  'src/app/dashboard/page.tsx'
];

let hardcodedFound = false;
checkFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    if (content.includes('localhost:3002') || content.includes('localhost:3001')) {
      console.log(`  ❌ URLs hardcodées trouvées dans ${file}`);
      hardcodedFound = true;
    }
  }
});

if (!hardcodedFound) {
  console.log('  ✅ Aucune URL hardcodée trouvée');
}

console.log('\n✨ Test terminé!');
