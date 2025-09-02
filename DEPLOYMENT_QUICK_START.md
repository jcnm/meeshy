# 🚀 Déploiement Rapide Meeshy - Guide Express

## 📋 Prérequis

- `doctl` configuré avec votre token DigitalOcean
- Clé SSH configurée dans votre système
- Droplet DigitalOcean actif

## 🔧 Solutions Disponibles

### 1. **Script de Correction Rapide** (Recommandé)
```bash
# Correction et redéploiement sans rebuild
./scripts/quick-fix.sh 209.97.149.115
```

### 2. **Script de Déploiement Complet**
```bash
# Déploiement complet depuis zéro
./scripts/deploy-complete.sh 209.97.149.115
```

### 3. **Script Principal avec Gestion SSH**
```bash
# Gestion avancée avec différentes commandes
./scripts/deploy-with-ssh-key.sh fix 209.97.149.115
./scripts/deploy-with-ssh-key.sh status 209.97.149.115
./scripts/deploy-with-ssh-key.sh logs 209.97.149.115
```

## 🆘 Si la Connexion SSH Échoue

### Option A: Recréer le Droplet
```bash
# Recréer le droplet avec la bonne clé SSH
./scripts/recreate-droplet.sh
```

### Option B: Vérifier la Configuration SSH
```bash
# Vérifier les clés SSH dans DigitalOcean
doctl compute ssh-key list

# Vérifier votre clé locale
ssh-keygen -lf ~/.ssh/id_rsa.pub

# Ajouter votre clé à l'agent SSH
ssh-add ~/.ssh/id_rsa
```

## 🌐 Accès aux Services

Une fois déployé, vos services seront accessibles sur :

- **Frontend**: `http://209.97.149.115`
- **Gateway API**: `http://209.97.149.115:3000`
- **Translator API**: `http://209.97.149.115:8000`

## 📊 Monitoring

### Vérifier l'état des services
```bash
ssh root@209.97.149.115 'cd /opt/meeshy && docker-compose ps'
```

### Voir les logs
```bash
ssh root@209.97.149.115 'cd /opt/meeshy && docker-compose logs -f'
```

### Redémarrer les services
```bash
ssh root@209.97.149.115 'cd /opt/meeshy && docker-compose restart'
```

## 🔍 Dépannage

### Problème de CPU
- ✅ **Résolu**: Limites CPU ajustées dans `docker-compose-mongodb-production.yml`
- Les services utilisent maintenant max 3 CPU au lieu de 6

### Problème MongoDB
- ✅ **Résolu**: Démarrage séquentiel avec vérification de santé
- MongoDB démarre en premier, puis Redis, puis les autres services

### Problème SSH
- ✅ **Résolu**: Utilisation de la clé SSH par défaut du système
- Plus besoin de spécifier le chemin de la clé

## ⚡ Déploiement en Mode Production

Le système utilise maintenant `docker-compose-mongodb-production.yml` qui :
- ✅ Télécharge les images pré-construites (pas de rebuild)
- ✅ Démarre les services par ordre de dépendance
- ✅ Vérifie la santé de MongoDB avant de continuer
- ✅ Optimise l'utilisation des ressources (CPU/Mémoire)

## 🎯 Temps de Déploiement

- **Avant**: 30-60 minutes (rebuild des images)
- **Maintenant**: 5-10 minutes (téléchargement des images)

## 📞 Support

Si vous rencontrez des problèmes :

1. Vérifiez les logs avec `docker-compose logs -f`
2. Utilisez `./scripts/deploy-with-ssh-key.sh status` pour diagnostiquer
3. Consultez ce guide et les scripts de correction

---

**🚀 Prêt pour le déploiement ! Utilisez `./scripts/quick-fix.sh` pour commencer.**
