#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔍 Recherche des problèmes de traduction...\n');

// Rechercher tous les fichiers TSX qui utilisent des traductions avec namespace incorrect
const problematicFiles = [
  // Files that use useTranslations with namespace but call with prefix
  'app/contact/page.tsx',
  'app/privacy/page.tsx', 
  'app/terms/page.tsx',
  'components/conversations/ConversationLayoutResponsive.tsx',
  'components/conversations/CreateConversationPage.tsx',
  'components/common/bubble-message.tsx',
  'components/common/language-switcher.tsx',
  'components/common/bubble-stream-page.tsx',
  'components/translation/language-settings.tsx',
  'components/auth/login-form.tsx',
  'components/auth/register-form.tsx',
  'components/auth/join-conversation-form.tsx',
  'components/layout/AppHeader.tsx',
  'components/layout/Header.tsx',
  'components/settings/user-settings.tsx',
  'components/settings/theme-settings.tsx',
  'components/settings/settings-layout.tsx',
  'components/settings/complete-user-settings.tsx',
  'app/settings/page.tsx',
  'app/login/page.tsx'
];

// Namespaces communs qui sont souvent mal utilisés
const namespaces = [
  'dashboard', 'conversations', 'bubbleStream', 'language', 'login', 
  'register', 'settings', 'header', 'layout', 'toasts', 'anonymousChat', 
  'joinConversation', 'contact', 'privacy', 'terms', 'auth'
];

let fixesApplied = 0;

for (const namespace of namespaces) {
  console.log(`🔧 Recherche des usages incorrects de "${namespace}"...`);
  
  // Rechercher les fichiers qui utilisent useTranslations(namespace) et t('namespace.xxx')
  try {
    const grepCommand = `grep -r "useTranslations('${namespace}')" frontend/ --include="*.tsx" -l`;
    const filesWithNamespace = execSync(grepCommand, { encoding: 'utf8' }).trim().split('\n').filter(f => f);
    
    for (const file of filesWithNamespace) {
      const cleanFile = file.replace('frontend/', '');
      console.log(`  📄 Vérification: ${cleanFile}`);
      
      // Vérifier si ce fichier contient aussi t('namespace.xxx')
      try {
        const grepUsage = `grep "t('${namespace}\\." "${file}"`;
        const hasIncorrectUsage = execSync(grepUsage, { encoding: 'utf8' });
        
        if (hasIncorrectUsage.trim()) {
          console.log(`    ❌ Problème détecté - utilise useTranslations('${namespace}') mais appelle t('${namespace}.xxx')`);
          console.log(`    🔧 Application du correctif...`);
          
          // Appliquer le correctif
          const sedCommand = `sed -i '' 's/t('\\''${namespace}\\./t('\\'/g' "${file}"`;
          execSync(sedCommand);
          
          fixesApplied++;
          console.log(`    ✅ Corrigé !`);
        } else {
          console.log(`    ✅ Correct`);
        }
      } catch (error) {
        // Pas d'usage incorrect trouvé
        console.log(`    ✅ Correct`);
      }
    }
  } catch (error) {
    // Aucun fichier trouvé avec ce namespace
    console.log(`  ℹ️  Aucun fichier trouvé avec le namespace "${namespace}"`);
  }
}

console.log(`\n📊 Résumé:`);
console.log(`  🔧 ${fixesApplied} correctifs appliqués`);

if (fixesApplied > 0) {
  console.log(`\n✅ Tous les problèmes de traduction ont été corrigés !`);
  console.log(`   Redémarrez l'application pour voir les changements.`);
} else {
  console.log(`\n✅ Aucun problème de traduction détecté !`);
}
