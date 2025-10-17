#!/usr/bin/env node

/**
 * Script de migration des URLs d'attachements
 * 
 * Ce script corrige les URLs d'attachements qui ont été créées avec localhost:3000
 * pour les remplacer par les URLs de production correctes (gate.meeshy.me)
 * 
 * Usage:
 *   node scripts/fix-attachment-urls.js
 *   
 * Variables d'environnement requises:
 *   - PUBLIC_URL: L'URL publique du gateway (ex: https://gate.meeshy.me)
 *   - DATABASE_URL: URL de connexion MongoDB
 */

const { MongoClient } = require('mongodb');

const OLD_URL_PATTERNS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://localhost:3000',
  'https://localhost:3001'
];

const NEW_PUBLIC_URL = process.env.PUBLIC_URL || 'https://gate.meeshy.me';
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL n\'est pas définie');
  process.exit(1);
}

console.log('🔧 Script de migration des URLs d\'attachements');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`📌 Nouvelle URL publique: ${NEW_PUBLIC_URL}`);
console.log(`🗄️  Base de données: ${DATABASE_URL.replace(/:[^:@]+@/, ':***@')}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

async function migrateAttachmentUrls() {
  const client = new MongoClient(DATABASE_URL);
  
  try {
    await client.connect();
    console.log('✅ Connecté à la base de données\n');
    
    const db = client.db();
    const attachmentsCollection = db.collection('Attachment');
    
    // Compter les attachements concernés
    let totalUpdated = 0;
    
    for (const oldPattern of OLD_URL_PATTERNS) {
      console.log(`\n🔍 Recherche des URLs contenant: ${oldPattern}`);
      
      // Rechercher les attachements avec des URLs localhost
      const attachmentsToUpdate = await attachmentsCollection.find({
        $or: [
          { fileUrl: { $regex: oldPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') } },
          { thumbnailUrl: { $regex: oldPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') } }
        ]
      }).toArray();
      
      if (attachmentsToUpdate.length === 0) {
        console.log(`   ℹ️  Aucun attachement trouvé avec ce pattern`);
        continue;
      }
      
      console.log(`   📊 ${attachmentsToUpdate.length} attachements trouvés\n`);
      
      // Mettre à jour chaque attachement
      for (const attachment of attachmentsToUpdate) {
        const updates = {};
        let hasChanges = false;
        
        // Mettre à jour fileUrl
        if (attachment.fileUrl && attachment.fileUrl.includes(oldPattern)) {
          updates.fileUrl = attachment.fileUrl.replace(oldPattern, NEW_PUBLIC_URL);
          hasChanges = true;
        }
        
        // Mettre à jour thumbnailUrl
        if (attachment.thumbnailUrl && attachment.thumbnailUrl.includes(oldPattern)) {
          updates.thumbnailUrl = attachment.thumbnailUrl.replace(oldPattern, NEW_PUBLIC_URL);
          hasChanges = true;
        }
        
        if (hasChanges) {
          await attachmentsCollection.updateOne(
            { _id: attachment._id },
            { $set: updates }
          );
          
          totalUpdated++;
          console.log(`   ✅ Mis à jour: ${attachment.fileName || attachment._id}`);
          if (updates.fileUrl) {
            console.log(`      • fileUrl: ${oldPattern}... → ${NEW_PUBLIC_URL}...`);
          }
          if (updates.thumbnailUrl) {
            console.log(`      • thumbnailUrl: ${oldPattern}... → ${NEW_PUBLIC_URL}...`);
          }
        }
      }
    }
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Migration terminée avec succès!`);
    console.log(`📊 Total d'attachements mis à jour: ${totalUpdated}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Vérification finale
    console.log('🔍 Vérification finale...');
    const remainingLocalhostUrls = await attachmentsCollection.countDocuments({
      $or: [
        { fileUrl: { $regex: /localhost/i } },
        { thumbnailUrl: { $regex: /localhost/i } }
      ]
    });
    
    if (remainingLocalhostUrls > 0) {
      console.warn(`⚠️  Il reste encore ${remainingLocalhostUrls} attachements avec des URLs localhost`);
      console.warn('   Cela peut être normal si certains fichiers utilisent des URLs locales intentionnellement');
    } else {
      console.log('✅ Aucune URL localhost restante trouvée!');
    }
    
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n👋 Connexion à la base de données fermée');
  }
}

// Exécuter la migration
migrateAttachmentUrls().catch(err => {
  console.error('❌ Erreur fatale:', err);
  process.exit(1);
});

