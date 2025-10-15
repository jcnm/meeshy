/**
 * Script de migration pour mettre à jour les shortUrl des liens de tracking existants
 * Convertit de "meeshy.me/l/<token>" vers "/l/<token>" pour flexibilité du domaine
 */

import { PrismaClient } from '../shared/prisma/client';

const prisma = new PrismaClient();

async function migrateTrackingLinks() {
  console.log('🔄 Migration des liens de tracking...\n');

  try {
    // 1. Compter tous les liens
    const totalCount = await prisma.trackingLink.count();
    console.log(`📊 Total de liens de tracking: ${totalCount}`);

    // 2. Trouver les liens avec l'ancien format
    const linksToUpdate = await prisma.trackingLink.findMany({
      where: {
        shortUrl: {
          contains: 'meeshy.me/l/'
        }
      }
    });

    console.log(`📝 Liens à mettre à jour: ${linksToUpdate.length}\n`);

    if (linksToUpdate.length === 0) {
      console.log('✅ Aucun lien à mettre à jour. Migration terminée!');
      return;
    }

    // 3. Mettre à jour chaque lien
    let updatedCount = 0;
    for (const link of linksToUpdate) {
      try {
        // Extraire le token et créer le nouveau format
        const newShortUrl = `/l/${link.token}`;
        
        await prisma.trackingLink.update({
          where: { id: link.id },
          data: { shortUrl: newShortUrl }
        });

        updatedCount++;
        console.log(`✅ [${updatedCount}/${linksToUpdate.length}] ${link.shortUrl} → ${newShortUrl}`);
      } catch (error) {
        console.error(`❌ Erreur lors de la mise à jour du lien ${link.id}:`, error);
      }
    }

    console.log(`\n✅ Migration terminée: ${updatedCount}/${linksToUpdate.length} liens mis à jour`);

  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error);
  } finally {
    await prisma.$disconnect();
  }
}

migrateTrackingLinks();
