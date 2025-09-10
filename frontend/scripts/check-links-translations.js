#!/usr/bin/env node

/**
 * Script pour vérifier que toutes les clés de traduction de la page links sont définies
 */

const fs = require('fs');
const path = require('path');

// Clés de traduction utilisées dans la page links et ses composants
const requiredKeys = [
  // Page principale
  'title', 'pageTitle', 'pageDescription', 'searchPlaceholder',
  'tabs.active', 'tabs.expired', 'tabs.disabled',
  'noLinks', 'unnamedLink', 'conversation',
  'status.active', 'status.inactive', 'status.expired', 'status.never', 
  'status.daysRemaining', 'status.hoursRemaining',
  'actions.copy', 'actions.viewDetails', 'actions.edit', 'actions.disable', 
  'actions.enable', 'actions.extend7Days', 'actions.delete',
  'stats.uses', 'stats.active', 'stats.created', 'stats.expires',
  'success.linkCopied', 'success.linkDisabled', 'success.linkEnabled', 
  'success.linkExtended', 'success.linkDeleted',
  'errors.loadFailed', 'errors.toggleFailed', 'errors.extendFailed', 'errors.deleteFailed',
  'confirm.delete',
  
  // Modal de détails
  'details.title', 'details.basicInfo', 'details.linkName', 'details.description', 
  'details.conversation', 'details.linkUrl', 'details.usage', 'details.totalUses', 
  'details.activeUsers', 'details.totalParticipants', 'details.languages',
  'details.permissions', 'details.dates', 'details.created', 'details.expires', 
  'details.lastUpdated', 'details.creator',
  'permissions.messages', 'permissions.images', 'permissions.files', 'permissions.viewHistory',
  'permissions.allowed', 'permissions.denied',
  
  // Modal d'édition
  'edit.title', 'edit.linkName', 'edit.linkNamePlaceholder', 'edit.description', 
  'edit.descriptionPlaceholder', 'edit.maxUses', 'edit.maxUsesDescription', 
  'edit.expiresAt', 'edit.expiresAtDescription', 'edit.selectDate',
  'edit.permissions', 'edit.requirements',
  'permissions.messagesDescription', 'permissions.imagesDescription', 
  'permissions.filesDescription', 'permissions.viewHistoryDescription',
  'requirements.nickname', 'requirements.nicknameDescription', 
  'requirements.email', 'requirements.emailDescription',
  'actions.cancel', 'actions.saving', 'actions.save',
  'success.linkUpdated', 'errors.updateFailed'
];

// Fonction pour obtenir une valeur imbriquée d'un objet
function getNestedValue(obj, key) {
  return key.split('.').reduce((current, part) => current?.[part], obj);
}

// Fonction pour vérifier les traductions d'un fichier
function checkTranslations(filePath, language) {
  console.log(`\n🔍 Vérification des traductions ${language}...`);
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const translations = JSON.parse(content);
    
    const missingKeys = [];
    const presentKeys = [];
    
    requiredKeys.forEach(key => {
      const value = getNestedValue(translations.links, key);
      if (value === undefined || value === null || value === '') {
        missingKeys.push(key);
      } else {
        presentKeys.push(key);
      }
    });
    
    console.log(`✅ Clés présentes: ${presentKeys.length}/${requiredKeys.length}`);
    
    if (missingKeys.length > 0) {
      console.log(`❌ Clés manquantes (${missingKeys.length}):`);
      missingKeys.forEach(key => {
        console.log(`   - ${key}`);
      });
      return false;
    } else {
      console.log(`🎉 Toutes les clés sont définies pour ${language}!`);
      return true;
    }
    
  } catch (error) {
    console.error(`❌ Erreur lors de la lecture du fichier ${filePath}:`, error.message);
    return false;
  }
}

// Fonction principale
function main() {
  console.log('🚀 Vérification des traductions de la page links...\n');
  
  const localesDir = path.join(__dirname, '..', 'locales');
  const languages = ['fr', 'en', 'pt'];
  
  let allValid = true;
  
  languages.forEach(lang => {
    const filePath = path.join(localesDir, `${lang}.json`);
    const isValid = checkTranslations(filePath, lang);
    if (!isValid) {
      allValid = false;
    }
  });
  
  console.log('\n' + '='.repeat(50));
  
  if (allValid) {
    console.log('🎉 Toutes les traductions de la page links sont complètes!');
    process.exit(0);
  } else {
    console.log('❌ Certaines traductions sont manquantes.');
    process.exit(1);
  }
}

// Exécuter le script
if (require.main === module) {
  main();
}

module.exports = { checkTranslations, requiredKeys };
