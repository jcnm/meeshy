# 🚀 Scripts de Déploiement Meeshy - Version Fusionnée

Ce dossier contient tous les scripts nécessaires pour déployer et gérer la plateforme Meeshy sur DigitalOcean avec MongoDB.

## 📋 Scripts Disponibles

### 1. 🚀 `start-deployment.sh` - Script Principal Unifié
**Script de démarrage interactif qui guide l'utilisateur à travers tout le processus de déploiement.**

```bash
# Démarrage interactif
./scripts/start-deployment.sh

# Démarrage avec IP pré-configurée
./scripts/start-deployment.sh 157.230.15.51
```

**Fonctionnalités:**
- Menu interactif avec toutes les options
- Configuration automatique de l'IP du droplet
- Déploiement guidé étape par étape
- Tests automatiques post-déploiement

### 2. 🔧 `deploy-merged.sh` - Script de Déploiement Fusionné
**Script principal qui combine les meilleures fonctionnalités des scripts existants.**

```bash
# Déploiement complet
./scripts/deploy-merged.sh deploy 157.230.15.51

# Correction rapide
./scripts/deploy-merged.sh fix 157.230.15.51

# Vérification de santé
./scripts/deploy-merged.sh health-check 157.230.15.51

# Redémarrage des services
./scripts/deploy-merged.sh restart 157.230.15.51

# Recréation du droplet
./scripts/deploy-merged.sh recreate
```

**Options disponibles:**
- `--force-refresh` : Force le téléchargement des images Docker
- `deploy` : Déploiement complet initial
- `fix` : Correction et redéploiement rapide
- `status` : Vérifier l'état des services
- `logs` : Voir les logs des services
- `restart` : Redémarrer tous les services
- `stop` : Arrêter tous les services
- `health-check` : Vérifier la santé de tous les services

### 3. 🧪 `test-deployment.sh` - Script de Test Post-Déploiement
**Script pour tester que tous les services fonctionnent correctement après déploiement.**

```bash
# Test complet de tous les services
./scripts/test-deployment.sh 157.230.15.51

# Test rapide des endpoints de santé
./scripts/test-deployment.sh 157.230.15.51 --quick

# Test complet avec vérifications détaillées
./scripts/test-deployment.sh 157.230.15.51 --full
```

**Tests effectués:**
- ✅ État des services Docker
- ✅ Connexion MongoDB
- ✅ Connexion Redis
- ✅ Endpoints de santé (/health)
- ✅ Accessibilité Frontend
- ✅ Performance et latence
- ✅ Communication inter-services

### 4. 🔌 `verify-connections.sh` - Script de Vérification des Connexions
**Script pour vérifier que tous les services sont correctement connectés.**

```bash
# Vérification complète de toutes les connexions
./scripts/verify-connections.sh 157.230.15.51

# Vérification MongoDB + Prisma uniquement
./scripts/verify-connections.sh 157.230.15.51 --prisma

# Vérification ZMQ uniquement
./scripts/verify-connections.sh 157.230.15.51 --zmq

# Vérification REST uniquement
./scripts/verify-connections.sh 157.230.15.51 --rest
```

**Connexions vérifiées:**
- 🗄️ **MongoDB + Prisma** : Gateway et Translator connectés à MongoDB
- 🔌 **ZMQ** : Communication entre Gateway et Translator
- 🌐 **REST** : Endpoints de santé et API accessibles

## 🎯 Connexions Garanties

Le système assure que les services suivants fonctionnent correctement :

### 1. 🗄️ Gateway ↔ MongoDB (via Prisma)
- Connexion à la base de données MongoDB
- Initialisation du client Prisma
- Opérations de lecture/écriture

### 2. 🗄️ Translator ↔ MongoDB (via Prisma)
- Connexion à la base de données MongoDB
- Initialisation du client Prisma
- Gestion des modèles de traduction

### 3. 🔌 Gateway ↔ Translator (via ZMQ)
- Communication asynchrone
- Ports 5555 (PUSH/PULL) et 5558 (PUB/SUB)
- Gestion des traductions en temps réel

### 4. 🌐 Tous les Services (via REST /health)
- Gateway : `http://localhost:3000/health`
- Translator : `http://localhost:8000/health`
- Frontend : `http://localhost:3100`
- Nginx : `http://localhost:80`

## 🚀 Workflow de Déploiement Recommandé

### Étape 1 : Démarrage
```bash
# Lancer le script principal
./scripts/start-deployment.sh
```

### Étape 2 : Configuration
- Entrer l'IP de votre droplet DigitalOcean
- Choisir l'option "1" pour le déploiement complet

### Étape 3 : Déploiement Automatique
Le script va automatiquement :
1. Copier les fichiers de configuration
2. Déployer MongoDB et Redis
3. Déployer Translator avec Prisma
4. Déployer Gateway avec Prisma et ZMQ
5. Déployer Frontend et Nginx
6. Vérifier la santé de tous les services

### Étape 4 : Tests Post-Déploiement
```bash
# Test rapide
./scripts/test-deployment.sh 157.230.15.51 --quick

# Test complet
./scripts/test-deployment.sh 157.230.15.51 --full
```

### Étape 5 : Vérification des Connexions
```bash
# Vérification complète
./scripts/verify-connections.sh 157.230.15.51 --all
```

## 🔧 Dépannage

### Problème de Connexion SSH
```bash
# Recréer le droplet
./scripts/deploy-merged.sh recreate
```

### Services qui ne démarrent pas
```bash
# Correction rapide
./scripts/deploy-merged.sh fix 157.230.15.51

# Vérification des logs
./scripts/deploy-merged.sh logs 157.230.15.51
```

### Problème de Connexion MongoDB
```bash
# Vérifier Prisma
./scripts/verify-connections.sh 157.230.15.51 --prisma

# Redémarrer les services
./scripts/deploy-merged.sh restart 157.230.15.51
```

### Problème de Communication ZMQ
```bash
# Vérifier ZMQ
./scripts/verify-connections.sh 157.230.15.51 --zmq

# Vérifier les ports
ssh root@157.230.15.51 "netstat -tuln | grep 555"
```

## 📊 Monitoring et Maintenance

### Vérification de l'État
```bash
# État des services
./scripts/deploy-merged.sh status 157.230.15.51

# Logs en temps réel
./scripts/deploy-merged.sh logs 157.230.15.51
```

### Mise à Jour
```bash
# Mise à jour forcée des images
./scripts/deploy-merged.sh --force-refresh deploy 157.230.15.51
```

### Redémarrage
```bash
# Redémarrage complet
./scripts/deploy-merged.sh restart 157.230.15.51
```

## 🎯 Avantages de la Version Fusionnée

1. **🚀 Déploiement Séquentiel** : Services démarrés dans le bon ordre
2. **🔍 Vérifications Automatiques** : Santé des services vérifiée à chaque étape
3. **📁 Copie Intelligente** : Seuls les fichiers modifiés sont copiés
4. **🧪 Tests Complets** : Vérification automatique post-déploiement
5. **🔌 Connexions Garanties** : MongoDB, ZMQ et REST vérifiés
6. **📊 Monitoring Intégré** : Logs et statuts facilement accessibles
7. **🔄 Récupération Automatique** : Correction automatique des problèmes
8. **🎨 Interface Utilisateur** : Menu interactif pour toutes les opérations

## 🚨 Points d'Attention

- **MongoDB** : Doit être démarré en premier et être prêt avant les autres services
- **Prisma** : Les clients sont générés automatiquement, pas besoin de `prisma generate`
- **ZMQ** : Les ports 5555 et 5558 doivent être accessibles entre services
- **Images Docker** : Utilise les images pré-construites pour un déploiement plus rapide
- **SSH** : Assurez-vous que votre clé SSH est configurée sur le droplet

## 📞 Support

En cas de problème :
1. Vérifiez les logs : `./scripts/deploy-merged.sh logs 157.230.15.51`
2. Testez les connexions : `./scripts/verify-connections.sh 157.230.15.51 --all`
3. Lancez une correction : `./scripts/deploy-merged.sh fix 157.230.15.51`
4. Si rien ne fonctionne : `./scripts/deploy-merged.sh recreate`

---

**🎉 Avec ces scripts, Meeshy sera déployé et opérationnel en quelques minutes !**
