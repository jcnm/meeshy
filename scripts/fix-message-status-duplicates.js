/**
 * Script pour nettoyer les doublons dans la collection message_status
 * 
 * Problème : Index unique sur (messageId, userId) échoue à cause de doublons
 * Solution : Garder le dernier document et supprimer les anciens
 * 
 * Usage:
 *   docker-compose exec meeshy-database mongosh meeshy /tmp/fix-message-status-duplicates.js
 */

print("🔍 [FIX] Recherche des doublons dans message_status...");

// Agrégation pour trouver les doublons
const duplicates = db.message_status.aggregate([
  {
    $group: {
      _id: { messageId: "$messageId", userId: "$userId" },
      count: { $sum: 1 },
      ids: { $push: "$_id" }
    }
  },
  {
    $match: { count: { $gt: 1 } }
  }
]).toArray();

print(`📊 [FIX] Trouvé ${duplicates.length} paires (messageId, userId) en double`);

if (duplicates.length === 0) {
  print("✅ [FIX] Aucun doublon trouvé, la base est propre!");
  quit(0);
}

// Compteurs
let totalDuplicates = 0;
let totalDeleted = 0;

// Pour chaque doublon, garder le plus récent et supprimer les autres
duplicates.forEach((dup, index) => {
  const { messageId, userId } = dup._id;
  const ids = dup.ids;
  
  totalDuplicates += ids.length;
  
  print(`\n📝 [${index + 1}/${duplicates.length}] Traitement doublon:`);
  print(`   messageId: ${messageId}`);
  print(`   userId: ${userId}`);
  print(`   ${ids.length} documents trouvés`);
  
  // Récupérer tous les documents pour ce doublon (triés par date de lecture décroissante)
  const docs = db.message_status.find({
    messageId: ObjectId(messageId),
    userId: ObjectId(userId)
  }).sort({ readAt: -1, receivedAt: -1, _id: -1 }).toArray();
  
  if (docs.length > 0) {
    // Garder le premier (le plus récent)
    const keepId = docs[0]._id;
    print(`   ✅ Conservation du document: ${keepId}`);
    
    // Supprimer tous les autres
    const idsToDelete = docs.slice(1).map(d => d._id);
    
    if (idsToDelete.length > 0) {
      const result = db.message_status.deleteMany({
        _id: { $in: idsToDelete }
      });
      
      totalDeleted += result.deletedCount;
      print(`   🗑️  Supprimés: ${result.deletedCount} documents`);
    }
  }
});

print("\n" + "=".repeat(60));
print("📊 [FIX] Résumé du nettoyage:");
print(`   Total de documents en double: ${totalDuplicates}`);
print(`   Documents conservés: ${duplicates.length}`);
print(`   Documents supprimés: ${totalDeleted}`);
print("=".repeat(60));

// Vérification finale
const remainingDuplicates = db.message_status.aggregate([
  {
    $group: {
      _id: { messageId: "$messageId", userId: "$userId" },
      count: { $sum: 1 }
    }
  },
  {
    $match: { count: { $gt: 1 } }
  }
]).toArray();

if (remainingDuplicates.length === 0) {
  print("\n✅ [FIX] Succès! Aucun doublon restant.");
  print("💡 [FIX] Vous pouvez maintenant redémarrer le translator:");
  print("   docker-compose restart meeshy-translator");
} else {
  print(`\n⚠️  [FIX] Attention: ${remainingDuplicates.length} doublons restants`);
  print("   Une vérification manuelle peut être nécessaire");
}

print("\n✅ [FIX] Script terminé");
