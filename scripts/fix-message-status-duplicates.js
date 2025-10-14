#!/usr/bin/env node

/**
 * Script pour supprimer les doublons dans message_status
 * Garde uniquement le plus récent pour chaque combinaison messageId+userId
 */

const { execSync } = require('child_process');

async function fixMessageStatusDuplicates() {
  const uri = process.env.DATABASE_URL || 'mongodb://localhost:27017/meeshy';
  
  console.log('✅ Nettoyage des doublons dans message_status...\n');

  try {
    // Script MongoDB pour trouver et supprimer les doublons
    const cleanupScript = `
      const duplicates = db.message_status.aggregate([
        {
          $group: {
            _id: { messageId: "$messageId", userId: "$userId" },
            docs: { $push: { _id: "$_id", createdAt: "$createdAt" } },
            count: { $sum: 1 }
          }
        },
        {
          $match: { count: { $gt: 1 } }
        }
      ]).toArray();

      print('🔍 Trouvé ' + duplicates.length + ' groupes de doublons');

      let totalDeleted = 0;
      duplicates.forEach(dup => {
        // Trier par date de création décroissante
        const sorted = dup.docs.sort((a, b) => {
          const dateA = a.createdAt || new Date(0);
          const dateB = b.createdAt || new Date(0);
          return dateB - dateA;
        });
        
        // Garder le premier (plus récent), supprimer les autres
        const toDelete = sorted.slice(1);
        toDelete.forEach(doc => {
          db.message_status.deleteOne({ _id: doc._id });
          totalDeleted++;
          print('🗑️  Supprimé doublon: ' + doc._id);
        });
      });

      print('\\n✅ ' + totalDeleted + ' doublons supprimés');
    `;

    execSync(`mongosh "${uri}" --quiet --eval "${cleanupScript}"`, { 
      encoding: 'utf-8',
      stdio: 'inherit'
    });

    console.log('\n✅ Nettoyage terminé');
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

// Exécution
fixMessageStatusDuplicates().catch(err => {
  console.error('❌ Erreur:', err);
  process.exit(1);
});
