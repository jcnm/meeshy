// Script pour fixer les doublons IMMÉDIATEMENT
const { PrismaClient } = require('./shared/prisma/client');
const { MongoClient } = require('mongodb');

const prisma = new PrismaClient();

async function fixDuplicatesNow() {
  let mongoClient;
  
  try {
    console.log('🚀 CORRECTION DES DOUBLONS EN COURS...\n');
    
    // Étape 1: Se connecter directement à MongoDB
    console.log('1️⃣  Connexion à MongoDB...');
    
    // Lire l'URL depuis .env
    require('dotenv').config({ path: '.env' });
    const dbUrl = process.env.DATABASE_URL;
    
    if (!dbUrl) {
      throw new Error('DATABASE_URL non trouvée dans .env');
    }
    
    console.log(`   URL: ${dbUrl.replace(/:[^:@]+@/, ':***@')}`);
    
    mongoClient = new MongoClient(dbUrl);
    await mongoClient.connect();
    const db = mongoClient.db('meeshy');
    console.log('✅ Connecté\n');
    
    // Étape 2: Vérifier les index existants
    console.log('2️⃣  Vérification des index...');
    const indexes = await db.collection('MessageTranslation').indexes();
    const hasUniqueIndex = indexes.some(idx => idx.name === 'message_target_language_unique');
    
    if (hasUniqueIndex) {
      console.log('✅ L\'index unique existe déjà');
    } else {
      console.log('❌ L\'index unique N\'EXISTE PAS');
    }
    console.log('');
    
    // Étape 3: Trouver les doublons
    console.log('3️⃣  Recherche des doublons...');
    const duplicates = await db.collection('MessageTranslation').aggregate([
      {
        $group: {
          _id: { messageId: '$messageId', targetLanguage: '$targetLanguage' },
          count: { $sum: 1 },
          docs: { $push: { id: '$_id', createdAt: '$createdAt' } }
        }
      },
      { $match: { count: { $gt: 1 } } }
    ]).toArray();
    
    console.log(`📊 Groupes de doublons trouvés: ${duplicates.length}\n`);
    
    if (duplicates.length > 0) {
      // Étape 4: Supprimer les doublons (garder le plus récent)
      console.log('4️⃣  Suppression des doublons...');
      let deletedCount = 0;
      
      for (const dup of duplicates) {
        // Trier par date (le plus récent en premier)
        dup.docs.sort((a, b) => b.createdAt - a.createdAt);
        
        // Garder le premier, supprimer les autres
        const toDelete = dup.docs.slice(1).map(d => d.id);
        
        if (toDelete.length > 0) {
          const result = await db.collection('MessageTranslation').deleteMany({
            _id: { $in: toDelete }
          });
          deletedCount += result.deletedCount;
        }
      }
      
      console.log(`✅ ${deletedCount} doublons supprimés\n`);
    } else {
      console.log('✅ Aucun doublon à supprimer\n');
    }
    
    // Étape 5: Créer l'index unique
    console.log('5️⃣  Création de l\'index unique...');
    
    if (hasUniqueIndex) {
      console.log('⚠️  Suppression de l\'ancien index...');
      await db.collection('MessageTranslation').dropIndex('message_target_language_unique');
    }
    
    try {
      await db.collection('MessageTranslation').createIndex(
        { messageId: 1, targetLanguage: 1 },
        { unique: true, name: 'message_target_language_unique' }
      );
      console.log('✅ Index unique créé avec succès!\n');
    } catch (error) {
      console.error('❌ Erreur création index:', error.message);
      console.log('⚠️  Il reste peut-être des doublons. Relancez le script.\n');
    }
    
    // Étape 6: Vérification finale
    console.log('6️⃣  Vérification finale...');
    const remainingDuplicates = await db.collection('MessageTranslation').aggregate([
      {
        $group: {
          _id: { messageId: '$messageId', targetLanguage: '$targetLanguage' },
          count: { $sum: 1 }
        }
      },
      { $match: { count: { $gt: 1 } } }
    ]).toArray();
    
    if (remainingDuplicates.length === 0) {
      console.log('✅ Aucun doublon restant!\n');
    } else {
      console.log(`❌ ${remainingDuplicates.length} doublons restants. Relancez le script.\n`);
    }
    
    // Étape 7: Compter les traductions
    const totalCount = await db.collection('MessageTranslation').countDocuments();
    console.log(`📊 Total de traductions: ${totalCount}\n`);
    
    console.log('='.repeat(60));
    console.log('✅ CORRECTION TERMINÉE!');
    console.log('='.repeat(60));
    console.log('');
    console.log('Prochaines étapes:');
    console.log('1. Redémarrer le gateway: docker-compose restart gateway');
    console.log('2. Tester l\'application');
    console.log('3. Les nouveaux doublons seront automatiquement empêchés\n');
    
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  } finally {
    if (mongoClient) {
      await mongoClient.close();
    }
    await prisma.$disconnect();
  }
}

fixDuplicatesNow();

