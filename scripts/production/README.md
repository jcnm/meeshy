# Scripts de Déploiement en Production Meeshy

Ce répertoire contient tous les scripts nécessaires pour déployer Meeshy en production sur Digital Ocean avec un reset complet de la base de données et des configurations sécurisées.

## 🚀 Scripts Disponibles

### 1. `generate-production-config.sh`
Génère des configurations de production sécurisées avec :
- Nouvelles clés JWT
- Mots de passe sécurisés pour tous les utilisateurs
- Configurations optimisées pour la production
- Fichier de secrets séparé et sécurisé

**Usage:**
```bash
./scripts/production/generate-production-config.sh [--force]
```

### 2. `reset-database.sh`
Reset complètement la base de données MongoDB sur Digital Ocean :
- Supprime tous les volumes de données
- Recrée une base de données vide
- Initialise le replica set MongoDB
- Redémarre tous les services

**Usage:**
```bash
./scripts/production/reset-database.sh [OPTIONS] DROPLET_IP
```

**Options:**
- `--force` : Forcer le reset sans confirmation
- `--no-backup` : Ne pas créer de backup avant le reset

### 3. `deploy-production.sh`
Script principal qui orchestre tout le processus de déploiement :
1. Génération des configurations sécurisées
2. Build et push des images Docker
3. Reset de la base de données
4. Déploiement final

**Usage:**
```bash
./scripts/production/deploy-production.sh [OPTIONS] DROPLET_IP
```

**Options:**
- `--skip-config` : Ignorer la génération des configurations
- `--skip-build` : Ignorer le build et push des images
- `--skip-db-reset` : Ignorer le reset de la base de données
- `--skip-deployment` : Ignorer le déploiement final
- `--force-rebuild` : Forcer la reconstruction des images
- `--force-db-reset` : Forcer le reset de la base de données
- `--verbose` : Mode verbeux

## 📋 Processus de Déploiement Complet

### Étape 1 : Génération des Configurations
```bash
./scripts/production/generate-production-config.sh
```

Ce script crée :
- `secrets/production-secrets.env` : Fichier de secrets sécurisé
- `config/production.env` : Configuration de production
- `secrets/.gitignore` : Protection des secrets

### Étape 2 : Build et Push des Images
```bash
./scripts/deployment/build-and-push-docker-images.sh
```

Ce script :
- Distribue les schémas Prisma
- Build les images Docker pour toutes les plateformes
- Push les images vers le registry Docker Hub

### Étape 3 : Reset de la Base de Données
```bash
./scripts/production/reset-database.sh DROPLET_IP
```

Ce script :
- Crée un backup de la base de données
- Supprime tous les volumes de données
- Recrée une base de données vide
- Initialise le replica set MongoDB

### Étape 4 : Déploiement Final
```bash
./scripts/meeshy-deploy.sh deploy DROPLET_IP
```

Ce script :
- Transfère les configurations sur le serveur
- Démarre tous les services
- Vérifie la santé des services

## 🔐 Sécurité

### Fichiers de Secrets
- **NE JAMAIS COMMITER** le fichier `secrets/production-secrets.env`
- Transférer ce fichier sur Digital Ocean dans un dossier sécurisé
- Utiliser des mots de passe forts générés automatiquement

### Utilisateurs par Défaut
Le système crée automatiquement ces utilisateurs :

#### Utilisateur Meeshy (BIGBOSS)
- **Username** : `meeshy` (FIXE)
- **Prénom** : `Meeshy` (FIXE)
- **Nom** : `Sama` (FIXE)
- **Rôle** : `BIGBOSS` (FIXE)
- **Mot de passe** : Généré automatiquement
- **Email** : `meeshy@meeshy.me`

#### Utilisateur Admin
- **Username** : `admin` (FIXE)
- **Prénom** : `Admin` (FIXE)
- **Nom** : `Manager` (FIXE)
- **Rôle** : `ADMIN` (FIXE)
- **Mot de passe** : Généré automatiquement
- **Email** : `admin@meeshy.me`

#### Utilisateur André Tabeth
- **Username** : `atabeth` (CONFIGURABLE)
- **Prénom** : `André` (CONFIGURABLE)
- **Nom** : `Tabeth` (CONFIGURABLE)
- **Rôle** : `USER` (CONFIGURABLE)
- **Mot de passe** : Généré automatiquement
- **Email** : `atabeth@meeshy.me`

## 🌐 Configuration des Domaines

### Domaines Principaux
- **Frontend** : `https://meeshy.me`
- **API Gateway** : `https://gate.meeshy.me`
- **Service ML** : `https://ml.meeshy.me`
- **Dashboard Traefik** : `https://traefik.meeshy.me`

### Domaines d'Administration
- **MongoDB UI** : `https://mongo.meeshy.me`
- **Redis UI** : `https://redis.meeshy.me`

## 🛠️ Commandes de Maintenance

### Vérifier la Santé des Services
```bash
./scripts/meeshy-deploy.sh health DROPLET_IP
```

### Voir les Logs
```bash
./scripts/meeshy-deploy.sh logs DROPLET_IP
```

### Redémarrer les Services
```bash
./scripts/meeshy-deploy.sh restart DROPLET_IP
```

### Arrêter les Services
```bash
./scripts/meeshy-deploy.sh stop DROPLET_IP
```

## 📊 Monitoring

### Health Checks
- **MongoDB** : Vérification de la connexion et du replica set
- **Redis** : Test de connectivité et de cache
- **Gateway** : Endpoint `/health`
- **Translator** : Endpoint `/health`
- **Frontend** : Vérification de l'accessibilité

### Métriques
- **Performance** : Temps de réponse, utilisation CPU/Mémoire
- **Trafic** : Nombre de connexions, requêtes par seconde
- **Erreurs** : Logs d'erreurs, taux d'échec

## 🔧 Dépannage

### Problèmes Courants

#### 1. Échec de Connexion SSH
```bash
# Vérifier la connectivité
ssh -o StrictHostKeyChecking=no root@DROPLET_IP "echo 'Test'"
```

#### 2. Problèmes de Base de Données
```bash
# Vérifier le statut MongoDB
./scripts/meeshy-deploy.sh health DROPLET_IP
```

#### 3. Problèmes de Build
```bash
# Forcer la reconstruction
./scripts/deployment/build-and-push-docker-images.sh --force-rebuild
```

#### 4. Problèmes de Déploiement
```bash
# Redéployer avec logs détaillés
./scripts/meeshy-deploy.sh deploy DROPLET_IP --verbose
```

### Logs de Debug
```bash
# Logs détaillés de tous les services
./scripts/meeshy-deploy.sh logs DROPLET_IP

# Logs d'un service spécifique
ssh root@DROPLET_IP "cd /opt/meeshy && docker-compose logs SERVICE_NAME"
```

## 📝 Exemples d'Utilisation

### Déploiement Complet
```bash
# Déploiement complet avec reset de la base de données
./scripts/production/deploy-production.sh 157.230.15.51
```

### Déploiement sans Reset de Base de Données
```bash
# Déploiement sans reset de la base de données
./scripts/production/deploy-production.sh --skip-db-reset 157.230.15.51
```

### Déploiement avec Rebuild Forcé
```bash
# Déploiement avec reconstruction forcée des images
./scripts/production/deploy-production.sh --force-rebuild 157.230.15.51
```

### Déploiement par Étapes
```bash
# 1. Générer les configurations
./scripts/production/generate-production-config.sh

# 2. Build et push des images
./scripts/deployment/build-and-push-docker-images.sh

# 3. Reset de la base de données
./scripts/production/reset-database.sh 157.230.15.51

# 4. Déploiement final
./scripts/meeshy-deploy.sh deploy 157.230.15.51
```

## ⚠️ Avertissements

### Sécurité
- **NE JAMAIS** commiter les fichiers de secrets
- **TOUJOURS** utiliser des mots de passe forts
- **TOUJOURS** créer des backups avant le reset
- **TOUJOURS** vérifier la santé des services après déploiement

### Production
- **TESTER** d'abord en environnement de développement
- **VÉRIFIER** que tous les services fonctionnent
- **MONITORER** les performances après déploiement
- **SAUVEGARDER** les configurations de production

## 📞 Support

En cas de problème :
1. Vérifier les logs avec `./scripts/meeshy-deploy.sh logs DROPLET_IP`
2. Vérifier la santé des services avec `./scripts/meeshy-deploy.sh health DROPLET_IP`
3. Consulter la documentation des scripts individuels
4. Contacter l'équipe de développement

---

**Note** : Ce processus de déploiement est conçu pour être sûr et reproductible. Suivez toujours les étapes dans l'ordre et vérifiez chaque étape avant de passer à la suivante.
