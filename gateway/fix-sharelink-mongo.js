#!/usr/bin/env node
/**
 * Script MongoDB pour corriger les ConversationShareLink sans identifier
 * Utilise MongoDB directement pour bypasser Prisma
 */

const { MongoClient } = require('mongodb');

// Générer un identifier unique
function generateIdentifier(conversationIdentifier, linkId) {
  const randomSuffix = linkId.substring(0, 6);
  return `mshy_${conversationIdentifier}_${randomSuffix}`;
}

async function fixShareLinkIdentifiers() {
  const mongoUrl = process.env.DATABASE_URL || 'mongodb://meeshy-database:27017/meeshy?replicaSet=rs0';
  const client = new MongoClient(mongoUrl);
  
  try {
    console.log('🔗 Connexion à MongoDB...');
    await client.connect();
    console.log('✅ Connecté à MongoDB\n');
    
    const db = client.db();
    const shareLinksColl = db.collection('ConversationShareLink');
    const conversationsColl = db.collection('Conversation');
    
    console.log('🔍 Recherche des ConversationShareLink sans identifier...\n');
    
    // Trouver tous les liens sans identifier (null, undefined ou vide)
    const linksWithoutIdentifier = await shareLinksColl.find({
      $or: [
        { identifier: null },
        { identifier: { $exists: false } },
        { identifier: '' }
      ]
    }).toArray();
    
    console.log(`📊 Liens sans identifier trouvés: ${linksWithoutIdentifier.length}\n`);
    
    if (linksWithoutIdentifier.length === 0) {
      console.log('✨ Aucune correction nécessaire - tout est en ordre !');
      return;
    }
    
    let fixedCount = 0;
    let errorCount = 0;
    
    for (const link of linksWithoutIdentifier) {
      try {
        console.log(`🔧 Correction du lien ${link._id}`);
        console.log(`   linkId: ${link.linkId}`);
        
        // Récupérer la conversation
        const conversation = await conversationsColl.findOne({
          _id: link.conversationId
        });
        
        if (!conversation) {
          console.log(`   ⚠️  Conversation non trouvée: ${link.conversationId}`);
          errorCount++;
          continue;
        }
        
        console.log(`   Conversation: ${conversation.identifier}`);
        
        // Générer le nouvel identifier
        let newIdentifier = generateIdentifier(conversation.identifier, link.linkId);
        
        // Vérifier l'unicité et ajuster si nécessaire
        let counter = 1;
        while (true) {
          const existing = await shareLinksColl.findOne({ identifier: newIdentifier });
          if (!existing) break;
          
          newIdentifier = generateIdentifier(conversation.identifier, link.linkId) + `_${counter}`;
          counter++;
        }
        
        console.log(`   Nouvel identifier: ${newIdentifier}`);
        
        // Mettre à jour le document
        await shareLinksColl.updateOne(
          { _id: link._id },
          { $set: { identifier: newIdentifier } }
        );
        
        console.log(`   ✅ Lien mis à jour\n`);
        fixedCount++;
        
      } catch (error) {
        console.error(`   ❌ Erreur pour le lien ${link._id}:`, error.message);
        errorCount++;
      }
    }
    
    console.log('\n═══════════════════════════════════════════════');
    console.log('📊 RÉSUMÉ');
    console.log('═══════════════════════════════════════════════');
    console.log(`✅ Liens corrigés: ${fixedCount}`);
    console.log(`❌ Erreurs: ${errorCount}`);
    console.log(`📋 Total trouvés: ${linksWithoutIdentifier.length}`);
    console.log('═══════════════════════════════════════════════\n');
    
    if (fixedCount > 0) {
      console.log('🎉 Base de données nettoyée avec succès !');
    }
    
  } catch (error) {
    console.error('❌ Erreur fatale:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\n🔌 Connexion MongoDB fermée');
  }
}

// Exécuter le script
fixShareLinkIdentifiers()
  .then(() => {
    console.log('\n✅ Script terminé avec succès\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erreur:', error);
    process.exit(1);
  });
