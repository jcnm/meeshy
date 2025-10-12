# 🛠️ Commandes Utiles - Tests E2E Meeshy

## 🚀 Tests Rapides

### Vérification de l'absence de doublons
```bash
cd /Users/smpceo/Documents/Services/Meeshy/meeshy/tests
./verify-no-duplicates.sh
```
**Résultat attendu:** ✅ AUCUN DOUBLON DÉTECTÉ

### Test complet authentifié
```bash
pnpm ts-node authenticated-translation-test.ts admin admin123 meeshy
```
**Résultat attendu:** 5 traductions (EN, DE, RU, ZH, ES), chacune 1x

### Test avec un autre utilisateur
```bash
pnpm ts-node authenticated-translation-test.ts charles charles123 meeshy
```

---

## 🔍 Diagnostic

### Analyser une conversation
```bash
# Via le script de diagnostic
pnpm diagnostic:analyze meeshy

# Résultat: Membres, langues, messages récents, traductions
```

### Statistiques globales
```bash
pnpm diagnostic:stats

# Résultat: Total messages, traductions, répartition par langue
```

---

## 🗄️ Base de Données

### Voir les langues de la conversation
```bash
mongosh "mongodb://meeshy:MeeshyPassword123@localhost:27017/meeshy?authSource=admin" --quiet --eval '
const conv = db.Conversation.findOne({identifier: "meeshy"});
const members = db.ConversationMember.find({conversationId: conv._id, isActive: true}).toArray();
const languages = new Set();

members.forEach(m => {
  const user = db.User.findOne({_id: m.userId});
  if (user) {
    console.log(user.username, ":", user.systemLanguage);
    languages.add(user.systemLanguage);
  }
});

console.log("\nLangues:", Array.from(languages).join(", "));
'
```

### Activer les langues régionales pour un utilisateur
```bash
mongosh "mongodb://meeshy:MeeshyPassword123@localhost:27017/meeshy?authSource=admin" --quiet --eval '
db.User.updateOne(
  {username: "NOM_UTILISATEUR"},
  {$set: {
    translateToRegionalLanguage: true,
    regionalLanguage: "es"  // ou de, ru, zh, etc.
  }}
);
console.log("✅ Langue régionale activée");
'
```

### Voir les traductions d'un message
```bash
mongosh "mongodb://meeshy:MeeshyPassword123@localhost:27017/meeshy?authSource=admin" --quiet --eval '
const msgId = "MESSAGE_ID_ICI";
const translations = db.MessageTranslation.find({messageId: msgId}).toArray();
console.log("Traductions:", translations.length);
translations.forEach(t => {
  console.log("  -", t.targetLanguage + ":", t.translatedContent.substring(0, 50) + "...");
});
'
```

---

## 📊 Monitoring

### Logs du Gateway en temps réel
```bash
# Si en mode local
tail -f ../gateway/gateway.log | grep -E "(Translation|DEBUG|Broadcasting)"

# Si en Docker
docker logs meeshy-gateway-1 -f | grep -E "(Translation|DEBUG|Broadcasting)"
```

### Logs du Translator
```bash
docker logs meeshy-translator-1 -f
```

### Vérifier les services actifs
```bash
curl -s http://localhost:3000/health | jq '.'
```

---

## 🧹 Nettoyage

### Supprimer les messages de test
```bash
mongosh "mongodb://meeshy:MeeshyPassword123@localhost:27017/meeshy?authSource=admin" --quiet --eval '
const result = db.Message.deleteMany({
  content: {$regex: /^Test authentifié/}
});
console.log("Messages supprimés:", result.deletedCount);
'
```

### Réinitialiser les langues à la configuration par défaut
```bash
mongosh "mongodb://meeshy:MeeshyPassword123@localhost:27017/meeshy?authSource=admin" --quiet --eval '
db.User.updateMany(
  {},
  {$set: {
    translateToRegionalLanguage: false,
    useCustomDestination: false
  }}
);
console.log("✅ Configuration réinitialisée");
'
```

---

## 🎯 Scénarios de Test

### Test avec 2 langues (minimal)
```bash
# Désactiver les langues régionales/personnalisées
mongosh "mongodb://meeshy:MeeshyPassword123@localhost:27017/meeshy?authSource=admin" --quiet --eval '
db.User.updateMany({}, {$set: {
  translateToRegionalLanguage: false,
  useCustomDestination: false
}});
'

# Tester
pnpm ts-node authenticated-translation-test.ts admin admin123 meeshy

# Résultat attendu: 1 traduction (EN)
```

### Test avec 6 langues (complet)
```bash
# Activer toutes les langues
mongosh "mongodb://meeshy:MeeshyPassword123@localhost:27017/meeshy?authSource=admin" --quiet --eval '
db.User.updateMany(
  {username: {$in: ["meeshy", "admin"]}},
  {$set: {
    translateToRegionalLanguage: true,
    useCustomDestination: true
  }}
);
'

# Tester
pnpm ts-node authenticated-translation-test.ts admin admin123 meeshy

# Résultat attendu: 5 traductions (EN, DE, RU, ZH, ES)
```

---

## 📈 Performance

### Mesurer la latence de traduction
```bash
pnpm ts-node authenticated-translation-test.ts admin admin123 meeshy 2>&1 | grep "TRADUCTION REÇUE" | awk '{print $1}'

# Compare les timestamps pour calculer la latence
```

### Test de charge (300 traductions)
```bash
# À implémenter: Script qui envoie plusieurs messages simultanément
# et vérifie que toutes les traductions arrivent sans perte
```

---

## 🔧 Troubleshooting

### Aucune traduction reçue
```bash
# 1. Vérifier que le service translator est actif
docker ps | grep translator

# 2. Vérifier les logs
docker logs meeshy-translator-1 --tail 50

# 3. Vérifier la connexion ZMQ
docker logs meeshy-gateway-1 --tail 50 | grep ZMQ
```

### Doublons détectés
```bash
# 1. Vérifier le code de diffusion
grep -A20 "_handleTranslationReady" ../gateway/src/socketio/MeeshySocketIOManager.ts

# 2. Vérifier qu'il n'y a qu'un seul emit par traduction
```

### Traductions manquantes
```bash
# 1. Vérifier les langues extraites
tail -f ../gateway/gateway.log | grep "Langues extraites"

# 2. Vérifier les langues filtrées
tail -f ../gateway/gateway.log | grep "Langues filtrées"
```

---

## ✅ Checklist de Validation

Avant de déployer en production:

- [x] Tests E2E passent à 100%
- [x] Aucun doublon détecté
- [x] Toutes les langues configurées reçoivent les traductions
- [x] Performance < 1s pour 5 traductions
- [x] Frontend compatible avec le nouveau format
- [ ] Tests manuels depuis le frontend ← **À FAIRE MAINTENANT**
- [ ] Tests avec plusieurs utilisateurs simultanés
- [ ] Monitoring en production configuré

---

**Dernière mise à jour:** 12 octobre 2025  
**Status:** ✅ Système validé et opérationnel

