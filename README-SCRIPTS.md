# 🚀 Scripts Essentiels Meeshy - Guide Simplifié

## 🎯 **3 Scripts Uniques - Tout le reste est supprimé !**

### **1. 🚀 `./scripts/deploy.sh` - DÉPLOIEMENT PRINCIPAL**
```bash
# Déploiement complet
./scripts/deploy.sh deploy 209.97.149.115

# Correction rapide
./scripts/deploy.sh fix 209.97.149.115

# Vérifier l'état
./scripts/deploy.sh status 209.97.149.115

# Voir les logs
./scripts/deploy.sh logs 209.97.149.115

# Redémarrer
./scripts/deploy.sh restart 209.97.149.115

# Recréer le droplet (si problème SSH)
./scripts/deploy.sh recreate
```

### **2. 🏗️ `./scripts/build.sh` - CONSTRUCTION DES IMAGES**
```bash
# Construire toutes les images
./scripts/build.sh build

# Pousser sur Docker Hub
./scripts/build.sh push

# Construire ET pousser
./scripts/build.sh build-and-push

# Lister les images
./scripts/build.sh list

# Nettoyer
./scripts/build.sh clean
```

### **3. 📊 `./scripts/manage.sh` - GESTION ET MONITORING**
```bash
# Vérifier la santé
./scripts/manage.sh health 209.97.149.115

# Sauvegarde
./scripts/manage.sh backup 209.97.149.115

# Mise à jour
./scripts/manage.sh update 209.97.149.115

# Logs en temps réel
./scripts/manage.sh logs 209.97.149.115

# Accès shell
./scripts/manage.sh shell 209.97.149.115

# Monitoring continu
./scripts/manage.sh monitor 209.97.149.115
```

## 🔑 **Clé SSH**
- ✅ **AUTOMATIQUE** : Utilise votre clé SSH par défaut
- ❌ **PAS besoin** de spécifier le chemin de la clé
- ❌ **PAS besoin** de configurer quoi que ce soit

## 🚀 **Déploiement Rapide**
```bash
# 1. Vérifier la santé
./scripts/manage.sh health 209.97.149.115

# 2. Si problème, corriger rapidement
./scripts/deploy.sh fix 209.97.149.115

# 3. Si connexion SSH échoue, recréer le droplet
./scripts/deploy.sh recreate
```

## 📋 **Commandes Essentielles**
```bash
# Déploiement
./scripts/deploy.sh deploy 209.97.149.115

# Monitoring
./scripts/manage.sh monitor 209.97.149.115

# Construction d'images
./scripts/build.sh build-and-push
```

## 🎯 **Avantages**
- ✅ **3 scripts seulement** au lieu de 15+
- ✅ **Clé SSH automatique** - pas de configuration
- ✅ **Toutes les fonctionnalités** dans 3 scripts
- ✅ **Facile à maintenir** et mettre à jour
- ✅ **Documentation claire** et simple

---

**🚀 Prêt ! Utilisez `./scripts/deploy.sh help` pour commencer.**
