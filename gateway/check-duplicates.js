// Script pour vérifier les doublons de traductions
const { PrismaClient } = require('./shared/prisma/client');

const prisma = new PrismaClient();

async function checkDuplicates() {
  try {
    console.log('🔍 Recherche de doublons de traductions...\n');
    
    // Récupérer toutes les traductions
    const allTranslations = await prisma.messageTranslation.findMany({
      orderBy: [
        { messageId: 'asc' },
        { targetLanguage: 'asc' },
        { createdAt: 'desc' }
      ]
    });
    
    console.log(`📊 Total de traductions en base: ${allTranslations.length}\n`);
    
    // Grouper par messageId + targetLanguage
    const groups = new Map();
    
    for (const translation of allTranslations) {
      const key = `${translation.messageId}_${translation.targetLanguage}`;
      
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      
      groups.get(key).push(translation);
    }
    
    // Trouver les doublons
    const duplicates = Array.from(groups.entries())
      .filter(([key, translations]) => translations.length > 1)
      .slice(0, 20); // Limiter à 20 pour l'affichage
    
    if (duplicates.length === 0) {
      console.log('✅ Aucun doublon trouvé!\n');
      return;
    }
    
    console.log(`❌ ${duplicates.length} groupe(s) de doublons trouvés (sur les 20 premiers):\n`);
    
    let totalDuplicates = 0;
    duplicates.forEach(([key, translations], idx) => {
      const [messageId, targetLanguage] = key.split('_');
      console.log(`${idx + 1}. Message: ${messageId.substring(0, 12)}...`);
      console.log(`   Langue: ${targetLanguage}`);
      console.log(`   Nombre de traductions: ${translations.length}`);
      console.log(`   Doublons:`);
      
      translations.forEach((t, tIdx) => {
        console.log(`     [${tIdx + 1}] ID: ${t.id.substring(0, 12)}... - ${t.createdAt.toISOString()}`);
        console.log(`         Contenu: "${t.translatedContent.substring(0, 50)}..."`);
      });
      console.log('');
      
      totalDuplicates += (translations.length - 1);
    });
    
    console.log(`📊 Total de traductions en trop (dans les 20 premiers groupes): ${totalDuplicates}\n`);
    
    // Compter le total de groupes avec doublons
    const allDuplicateGroups = Array.from(groups.entries())
      .filter(([key, translations]) => translations.length > 1);
    
    console.log(`📊 Total de groupes de messages avec doublons: ${allDuplicateGroups.length}\n`);
    
    const totalAllDuplicates = allDuplicateGroups.reduce((sum, [key, translations]) => {
      return sum + (translations.length - 1);
    }, 0);
    
    console.log(`📊 Total de traductions en trop dans toute la base: ${totalAllDuplicates}\n`);
    
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

checkDuplicates();

