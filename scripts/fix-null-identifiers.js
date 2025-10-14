#!/usr/bin/env node

/**
 * Script de migration pour corriger les identifiers null
 * Utilise mongosh pour accéder directement à MongoDB
 */

const { execSync } = require('child_process');

// Fonction pour générer un identifier unique
function generateIdentifier(type, index) {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 7);
  return `${type}_${timestamp}_${random}_${index}`;
}

async function fixNullIdentifiers() {
  const uri = process.env.DATABASE_URL || 'mongodb://localhost:27017/meeshy';
  
  console.log('✅ Connexion à MongoDB via mongosh...\n');

  // Collections à corriger
  const collections = [
    { name: 'Conversation', prefix: 'conv' },
    { name: 'ConversationShareLink', prefix: 'share' },
    { name: 'Community', prefix: 'comm' }
  ];

  for (const { name, prefix } of collections) {
    console.log(`🔍 Vérification de la collection ${name}...`);

    try {
      // Compter les documents avec identifier null
      const countScript = `db.${name}.countDocuments({ identifier: null })`;
      const nullCount = parseInt(
        execSync(`mongosh "${uri}" --quiet --eval "${countScript}"`, { 
          encoding: 'utf-8' 
        }).trim()
      );

      console.log(`   Trouvé ${nullCount} documents avec identifier: null`);

      if (nullCount === 0) {
        console.log(`   ✅ Aucune correction nécessaire pour ${name}\n`);
        continue;
      }

      // Mettre à jour avec des identifiers générés
      const updateScript = `db.${name}.find({ identifier: null }).forEach((doc, index) => { const newIdentifier = '${prefix}_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7) + '_' + index; db.${name}.updateOne({ _id: doc._id }, { \\$set: { identifier: newIdentifier } }); print('✅ ' + doc._id + ': ' + newIdentifier); });`;

      execSync(`mongosh "${uri}" --quiet --eval "${updateScript}"`, { 
        encoding: 'utf-8',
        stdio: 'inherit'
      });

      console.log(`   ✅ Documents mis à jour dans ${name}\n`);
    } catch (error) {
      console.error(`❌ Erreur lors de la correction de ${name}:`, error.message);
    }
  }

  console.log('✅ Migration terminée');
}

// Exécution
fixNullIdentifiers().catch(err => {
  console.error('❌ Erreur:', err);
  process.exit(1);
});
