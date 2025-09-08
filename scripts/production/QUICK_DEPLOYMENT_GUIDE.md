# Guide de Déploiement Rapide en Production

Ce guide vous explique comment déployer Meeshy en production sur Digital Ocean avec un reset complet de la base de données et des configurations sécurisées.

## 🚀 Déploiement Complet en Une Commande

Pour un déploiement complet avec reset de la base de données :

```bash
./scripts/production/deploy-production.sh DROPLET_IP
```

**Exemple :**
```bash
./scripts/production/deploy-production.sh 157.230.15.51
```

## 📋 Processus Détaillé

### 1. Génération des Configurations Sécurisées

```bash
./scripts/production/generate-production-config.sh
```

**Ce que fait ce script :**
- Génère de nouvelles clés JWT sécurisées
- Crée des mots de passe forts pour tous les utilisateurs
- Génère des configurations optimisées pour la production
- Crée un fichier de secrets séparé et sécurisé

**Fichiers créés :**
- `secrets/production-secrets.env` - Fichier de secrets (NE PAS COMMITER)
- `config/production.env` - Configuration de production
- `secrets/.gitignore` - Protection des secrets

### 2. Build et Push des Images Docker

```bash
./scripts/deployment/build-and-push-docker-images.sh
```

**Ce que fait ce script :**
- Distribue les schémas Prisma
- Build les images Docker pour toutes les plateformes
- Push les images vers le registry Docker Hub

### 3. Reset de la Base de Données

```bash
./scripts/production/reset-database.sh DROPLET_IP
```

**Ce que fait ce script :**
- Crée un backup de la base de données existante
- Supprime tous les volumes de données MongoDB
- Recrée une base de données vide
- Initialise le replica set MongoDB
- Redémarre tous les services

### 4. Déploiement Final

```bash
./scripts/meeshy-deploy.sh deploy DROPLET_IP
```

**Ce que fait ce script :**
- Transfère les configurations sur le serveur
- Démarre tous les services avec les nouvelles configurations
- Vérifie la santé des services

## 🔐 Informations de Connexion

Après la génération des configurations, vous trouverez dans `secrets/production-secrets.env` :

### Utilisateurs par Défaut
- **Admin** : `admin` / `[MOT_DE_PASSE_GÉNÉRÉ]`
- **Meeshy** : `meeshy` / `[MOT_DE_PASSE_GÉNÉRÉ]`
- **Atabeth** : `atabeth` / `[MOT_DE_PASSE_GÉNÉRÉ]`

### Emails
- **Admin** : `admin@meeshy.me`
- **Meeshy** : `meeshy@meeshy.me`
- **Atabeth** : `atabeth@meeshy.me`
- **Support** : `support@meeshy.me`

## 🌐 Accès à l'Application

Une fois déployé, l'application sera accessible via :

- **Frontend** : `https://meeshy.me`
- **API Gateway** : `https://gate.meeshy.me`
- **Service ML** : `https://ml.meeshy.me`
- **Dashboard Traefik** : `https://traefik.meeshy.me`
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

## ⚠️ Options Avancées

### Déploiement sans Reset de Base de Données
```bash
./scripts/production/deploy-production.sh --skip-db-reset DROPLET_IP
```

### Déploiement avec Rebuild Forcé
```bash
./scripts/production/deploy-production.sh --force-rebuild DROPLET_IP
```

### Déploiement par Étapes
```bash
# 1. Générer les configurations
./scripts/production/generate-production-config.sh

# 2. Build et push des images
./scripts/deployment/build-and-push-docker-images.sh

# 3. Reset de la base de données
./scripts/production/reset-database.sh DROPLET_IP

# 4. Déploiement final
./scripts/meeshy-deploy.sh deploy DROPLET_IP
```

## 🔒 Sécurité

### Fichiers de Secrets
- **NE JAMAIS COMMITER** le fichier `secrets/production-secrets.env`
- Transférer ce fichier sur Digital Ocean dans un dossier sécurisé
- Utiliser des mots de passe forts générés automatiquement

### Utilisateurs par Défaut
Le système crée automatiquement ces utilisateurs avec les configurations définies dans `INIT_SERVICE_IMPROVEMENTS.md` :

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

## 📊 Vérification Post-Déploiement

### 1. Vérifier la Santé des Services
```bash
./scripts/meeshy-deploy.sh health DROPLET_IP
```

### 2. Tester l'Accès à l'Application
- Ouvrir `https://meeshy.me` dans un navigateur
- Vérifier que l'interface se charge correctement
- Tester la connexion avec les utilisateurs par défaut

### 3. Vérifier les Logs
```bash
./scripts/meeshy-deploy.sh logs DROPLET_IP
```

## 🚨 Dépannage

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

## 📝 Exemple Complet

```bash
# 1. Déploiement complet avec reset de la base de données
./scripts/production/deploy-production.sh 157.230.15.51

# 2. Vérifier la santé des services
./scripts/meeshy-deploy.sh health 157.230.15.51

# 3. Voir les logs si nécessaire
./scripts/meeshy-deploy.sh logs 157.230.15.51
```

## 🎯 Résumé

Ce processus de déploiement :

1. **Génère** des configurations sécurisées avec de nouveaux mots de passe
2. **Build** et **push** les images Docker vers le registry
3. **Reset** complètement la base de données sur Digital Ocean
4. **Déploie** l'application avec les nouvelles configurations
5. **Vérifie** que tous les services fonctionnent correctement

Le système crée automatiquement les utilisateurs par défaut selon les spécifications définies dans `INIT_SERVICE_IMPROVEMENTS.md` et configure tous les services pour la production.

---

**Note** : Ce processus est conçu pour être sûr et reproductible. Suivez toujours les étapes dans l'ordre et vérifiez chaque étape avant de passer à la suivante.
