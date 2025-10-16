#!/usr/bin/env node
/**
 * Script pour corriger les ConversationShareLink sans identifier
 * Génère des identifiers au format: mshy_<conversationIdentifier>_<random>
 */

const { PrismaClient } = require('./shared/prisma/client');

const prisma = new PrismaClient();

async function generateUniqueIdentifier(conversationIdentifier, linkId) {
  // Format: mshy_<conversation>_<6chars>
  const randomSuffix = linkId.substring(0, 6);
  const baseIdentifier = `mshy_${conversationIdentifier}_${randomSuffix}`;
  
  // Vérifier l'unicité
  let identifier = baseIdentifier;
  let counter = 1;
  
  while (true) {
    const existing = await prisma.conversationShareLink.findUnique({
      where: { identifier }
    });
    
    if (!existing) {
      return identifier;
    }
    
    // Si déjà pris, ajouter un suffixe numérique
    identifier = `${baseIdentifier}_${counter}`;
    counter++;
  }
}

async function fixShareLinkIdentifiers() {
  console.log('🔍 Recherche des ConversationShareLink sans identifier...\n');
  
  try {
    // Trouver tous les liens de partage
    const shareLinks = await prisma.conversationShareLink.findMany({
      include: {
        conversation: {
          select: { identifier: true }
        }
      }
    });
    
    console.log(`📊 Total de liens trouvés: ${shareLinks.length}\n`);
    
    let fixedCount = 0;
    let alreadyOkCount = 0;
    
    for (const link of shareLinks) {
      // Vérifier si identifier est null, undefined ou vide
      if (!link.identifier || link.identifier === '' || link.identifier === 'null') {
        console.log(`🔧 Correction du lien ${link.id} (linkId: ${link.linkId})`);
        console.log(`   Conversation: ${link.conversation.identifier}`);
        
        // Générer un identifier unique
        const newIdentifier = await generateUniqueIdentifier(
          link.conversation.identifier,
          link.linkId
        );
        
        console.log(`   Nouvel identifier: ${newIdentifier}`);
        
        // Mettre à jour le lien
        await prisma.conversationShareLink.update({
          where: { id: link.id },
          data: { identifier: newIdentifier }
        });
        
        console.log(`   ✅ Lien mis à jour\n`);
        fixedCount++;
      } else {
        alreadyOkCount++;
      }
    }
    
    console.log('\n═══════════════════════════════════════════════');
    console.log('📊 RÉSUMÉ');
    console.log('═══════════════════════════════════════════════');
    console.log(`✅ Liens corrigés: ${fixedCount}`);
    console.log(`✓  Liens déjà OK: ${alreadyOkCount}`);
    console.log(`📋 Total: ${shareLinks.length}`);
    console.log('═══════════════════════════════════════════════\n');
    
    if (fixedCount > 0) {
      console.log('🎉 Base de données nettoyée avec succès !');
    } else {
      console.log('✨ Aucune correction nécessaire - tout est en ordre !');
    }
    
  } catch (error) {
    console.error('❌ Erreur lors de la correction:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le script
fixShareLinkIdentifiers()
  .then(() => {
    console.log('\n✅ Script terminé avec succès\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erreur fatale:', error);
    process.exit(1);
  });
