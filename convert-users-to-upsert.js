#!/usr/bin/env node

/**
 * Script pour convertir tous les user.create en user.upsert dans le seed.ts
 */

const fs = require('fs');
const path = require('path');

const seedFile = '/Users/smpceo/Downloads/Meeshy/meeshy/shared/prisma/seed.ts';

// Lire le contenu du fichier
let content = fs.readFileSync(seedFile, 'utf8');

// Pattern pour détecter les user.create
const userCreatePattern = /const\s+(\w+)\s+=\s+await\s+prisma\.user\.create\(\{\s+data:\s+\{/g;

// Remplacer chaque occurrence
content = content.replace(userCreatePattern, (match, varName) => {
  // Chercher l'email dans la section data
  const emailMatch = content.match(new RegExp(`const\\s+${varName}\\s+=\\s+await\\s+prisma\\.user\\.create\\(\\{\\s+data:\\s+\\{[^}]*email:\\s+['"]([^'"]+)['"]`, 's'));
  
  if (emailMatch) {
    const email = emailMatch[1];
    return `const ${varName} = await prisma.user.upsert({
    where: { email: '${email}' },
    update: {},
    create: {`;
  }
  
  return match;
});

// Écrire le fichier modifié
fs.writeFileSync(seedFile, content, 'utf8');

console.log('✅ Conversion terminée: tous les user.create ont été convertis en user.upsert');
