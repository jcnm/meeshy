// Script pour vérifier les VRAIS doublons (documents différents avec même messageId + targetLanguage)
const { PrismaClient } = require('./shared/prisma/client');

const prisma = new PrismaClient();

async function checkRealDuplicates() {
  try {
    console.log('🔍 Vérification des VRAIS doublons (documents différents)...\n');
    
    // Utiliser une requête brute pour être sûr
    const result = await prisma.$queryRaw`
      SELECT 
        "messageId",
        "targetLanguage",
        COUNT(*) as count,
        array_agg("_id" ORDER BY "createdAt" DESC) as ids,
        array_agg("createdAt" ORDER BY "createdAt" DESC) as dates
      FROM "MessageTranslation"
      GROUP BY "messageId", "targetLanguage"
      HAVING COUNT(*) > 1
      LIMIT 20
    `;
    
    console.log(`Résultat de la requête SQL directe:`, result);
    console.log(`\n📊 Nombre de groupes de doublons: ${result.length}\n`);
    
    if (result.length > 0) {
      console.log('❌ Des VRAIS doublons existent!\n');
      result.forEach((row, idx) => {
        console.log(`${idx + 1}. Message: ${row.messageId.substring(0, 12)}...`);
        console.log(`   Langue: ${row.targetLanguage}`);
        console.log(`   Nombre: ${row.count}`);
        console.log(`   IDs: ${row.ids.map(id => id.substring(0, 8) + '...').join(', ')}`);
        console.log('');
      });
    } else {
      console.log('✅ Aucun vrai doublon trouvé!\n');
      console.log('Le problème est probablement dans la récupération/affichage.\n');
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.log('\n⚠️  MongoDB n\'est pas compatible avec $queryRaw de Prisma');
    console.log('Utilisons une méthode alternative...\n');
    
    // Méthode alternative avec aggregation
    const allTranslations = await prisma.messageTranslation.findMany({
      select: {
        id: true,
        messageId: true,
        targetLanguage: true,
        createdAt: true
      }
    });
    
    // Créer un Set d'IDs uniques
    const uniqueIds = new Set();
    const duplicateIds = new Set();
    
    allTranslations.forEach(t => {
      if (uniqueIds.has(t.id)) {
        duplicateIds.add(t.id);
        console.log(`❌ ID DUPLIQUÉ TROUVÉ: ${t.id}`);
      }
      uniqueIds.add(t.id);
    });
    
    console.log(`📊 Total de traductions: ${allTranslations.length}`);
    console.log(`📊 IDs uniques: ${uniqueIds.size}`);
    console.log(`📊 IDs dupliqués dans les résultats: ${duplicateIds.size}\n`);
    
    if (duplicateIds.size > 0) {
      console.log(`❌ PROBLÈME: Prisma retourne ${duplicateIds.size} IDs en doublon!`);
      console.log(`Cela signifie que findMany() retourne les mêmes documents plusieurs fois.\n`);
    } else {
      console.log(`✅ Tous les IDs sont uniques dans les résultats Prisma\n`);
    }
    
    // Maintenant, vérifier les vrais doublons (même messageId + targetLanguage)
    const groups = new Map();
    
    allTranslations.forEach(t => {
      const key = `${t.messageId}_${t.targetLanguage}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(t);
    });
    
    const duplicateGroups = Array.from(groups.entries())
      .filter(([key, translations]) => translations.length > 1);
    
    console.log(`📊 Groupes de messages avec même messageId+targetLanguage: ${duplicateGroups.length}\n`);
    
    if (duplicateGroups.length > 0) {
      console.log(`❌ ${duplicateGroups.length} groupes avec doublons (premiers 10):\n`);
      duplicateGroups.slice(0, 10).forEach(([key, translations], idx) => {
        const [messageId, targetLanguage] = key.split('_');
        console.log(`${idx + 1}. Message: ${messageId.substring(0, 12)}... - Langue: ${targetLanguage}`);
        console.log(`   Nombre de documents: ${translations.length}`);
        translations.forEach((t, tIdx) => {
          console.log(`     [${tIdx + 1}] ID: ${t.id.substring(0, 12)}... - ${t.createdAt.toISOString()}`);
        });
        console.log('');
      });
    }
  } finally {
    await prisma.$disconnect();
  }
}

checkRealDuplicates();

