#!/usr/bin/env node

/**
 * Script pour ajouter automatiquement les métadonnées SEO aux pages principales
 */

const fs = require('fs');
const path = require('path');

const pagesToUpdate = [
  { file: 'app/partners/page.tsx', page: 'partners' },
  { file: 'app/privacy/page.tsx', page: 'privacy' },
  { file: 'app/terms/page.tsx', page: 'terms' },
];

const baseDir = path.join(__dirname, '..');

pagesToUpdate.forEach(({ file, page }) => {
  const filePath = path.join(baseDir, file);
  
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  Fichier non trouvé: ${file}`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  
  // Vérifier si les métadonnées SEO sont déjà présentes
  if (content.includes('generateSEOMetadata')) {
    console.log(`✅ Métadonnées SEO déjà présentes dans ${file}`);
    return;
  }

  // Ajouter les imports nécessaires
  const importRegex = /^('use client';|import.*from.*next.*;)/m;
  const match = content.match(importRegex);
  
  if (match) {
    const insertPoint = match.index + match[0].length;
    const newImports = `\nimport { Metadata } from 'next';\nimport { generateSEOMetadata } from '@/lib/seo-metadata';\n`;
    content = content.slice(0, insertPoint) + newImports + content.slice(insertPoint);
  }

  // Ajouter les métadonnées SEO
  const exportRegex = /^(export default function)/m;
  const exportMatch = content.match(exportRegex);
  
  if (exportMatch) {
    const insertPoint = exportMatch.index;
    const metadataExport = `// Métadonnées SEO pour la page ${page}\nexport const metadata: Metadata = generateSEOMetadata('${page}', 'fr');\n\n`;
    content = content.slice(0, insertPoint) + metadataExport + content.slice(insertPoint);
  }

  // Écrire le fichier modifié
  fs.writeFileSync(filePath, content);
  console.log(`✅ Métadonnées SEO ajoutées à ${file}`);
});

console.log('\n🎉 Toutes les métadonnées SEO ont été ajoutées !');
