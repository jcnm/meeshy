#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔍 Analyse de l\'utilisation des hooks i18n...\n');

// Trouver tous les fichiers utilisant des hooks de traduction
const files = execSync(
  'grep -r "useTranslations\\|useI18n\\|useTranslation" app/ components/ --include="*.tsx" --include="*.ts" | cut -d: -f1 | sort -u',
  { encoding: 'utf-8' }
)
  .trim()
  .split('\n')
  .filter(Boolean);

const results = [];

files.forEach((filePath) => {
  const content = fs.readFileSync(filePath, 'utf-8');
  
  // Détecter les imports
  const importMatches = content.match(/import\s+\{[^}]*use(Translations|I18n|Translation)[^}]*\}\s+from\s+['"]([^'"]+)['"]/g);
  
  // Détecter les usages
  const usageMatches = content.match(/const\s+\{[^}]*\}\s*=\s*use(Translations|I18n|Translation)\s*\([^)]*\)/g);
  
  if (!usageMatches) return;
  
  const imports = [];
  const usages = [];
  
  if (importMatches) {
    importMatches.forEach(match => {
      const hookMatch = match.match(/use(Translations|I18n|Translation)/);
      const sourceMatch = match.match(/from\s+['"]([^'"]+)['"]/);
      if (hookMatch && sourceMatch) {
        imports.push({
          hook: hookMatch[0],
          source: sourceMatch[1]
        });
      }
    });
  }
  
  usageMatches.forEach(match => {
    const hookMatch = match.match(/use(Translations|I18n|Translation)/);
    const namespaceMatch = match.match(/\(['"]([^'"]+)['"]\)/);
    const varsMatch = match.match(/const\s+\{([^}]+)\}/);
    
    if (hookMatch) {
      usages.push({
        hook: hookMatch[0],
        namespace: namespaceMatch ? namespaceMatch[1] : 'none',
        variables: varsMatch ? varsMatch[1].trim() : ''
      });
    }
  });
  
  results.push({
    file: filePath,
    imports,
    usages
  });
});

// Générer le rapport Markdown
console.log('# 📊 Rapport d\'analyse i18n\n');
console.log(`**Total de fichiers analysés**: ${results.length}\n`);

// Regrouper par hook
const hookStats = {};
results.forEach(r => {
  r.usages.forEach(u => {
    if (!hookStats[u.hook]) {
      hookStats[u.hook] = { count: 0, namespaces: new Set() };
    }
    hookStats[u.hook].count++;
    hookStats[u.hook].namespaces.add(u.namespace);
  });
});

console.log('## 📈 Statistiques par hook\n');
Object.entries(hookStats).forEach(([hook, stats]) => {
  console.log(`- **${hook}**: ${stats.count} utilisations`);
  console.log(`  - Namespaces: ${Array.from(stats.namespaces).join(', ')}`);
});

console.log('\n## 🔍 Détails par fichier\n');
console.log('| Fichier | Hook | Source | Namespace | Variables |');
console.log('|---------|------|--------|-----------|-----------|');

results.forEach(result => {
  const fileName = result.file.replace(/^(app|components)\//, '');
  
  result.usages.forEach((usage, idx) => {
    const importInfo = result.imports.find(i => i.hook === usage.hook);
    const source = importInfo ? importInfo.source : 'N/A';
    
    console.log(
      `| ${idx === 0 ? fileName : ''} | ${usage.hook} | ${source} | \`${usage.namespace}\` | \`${usage.variables}\` |`
    );
  });
});

// Détecter les incohérences
console.log('\n## ⚠️ Détection d\'incohérences\n');

const sources = new Set();
const hooks = new Set();

results.forEach(r => {
  r.imports.forEach(i => sources.add(i.source));
  r.usages.forEach(u => hooks.add(u.hook));
});

console.log(`**Hooks utilisés**: ${Array.from(hooks).join(', ')}`);
console.log(`**Sources d'import**: ${Array.from(sources).join(', ')}\n`);

if (sources.size > 2) {
  console.log('⚠️ **ATTENTION**: Plusieurs sources d\'import détectées!');
  console.log('   Recommandation: Utiliser une seule source d\'import (@/hooks/useTranslations)\n');
}

if (hooks.size > 1) {
  console.log('⚠️ **ATTENTION**: Plusieurs hooks différents utilisés!');
  console.log('   Hooks détectés:', Array.from(hooks).join(', '));
  console.log('   Recommandation: Utiliser uniquement `useTranslations` pour la cohérence\n');
}

// Namespaces utilisés
const namespaceStats = {};
results.forEach(r => {
  r.usages.forEach(u => {
    if (!namespaceStats[u.namespace]) {
      namespaceStats[u.namespace] = 0;
    }
    namespaceStats[u.namespace]++;
  });
});

console.log('\n## 📂 Namespaces utilisés\n');
Object.entries(namespaceStats)
  .sort((a, b) => b[1] - a[1])
  .forEach(([ns, count]) => {
    console.log(`- **${ns}**: ${count} utilisations`);
  });

console.log('\n---\n');
console.log('✅ **Recommandation**: Tous les fichiers devraient utiliser:');
console.log('   - `import { useTranslations } from \'@/hooks/useTranslations\'`');
console.log('   - `const { t } = useTranslations(\'namespace\')`');
console.log('   - Accès aux traductions: `t(\'key.subkey\')`\n');
