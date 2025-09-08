# 🚀 Exécution du Déploiement en Production

## 📋 Informations de Connexion Générées

### 👥 Utilisateurs par Défaut
- **Admin** : `admin` / `LsNDNiZ2eSgm2k3fURj1`
- **Meeshy** : `meeshy` / `PFtYJRbb9bPZZ6zeIl6R`
- **Atabeth** : `atabeth` / `E12kGWtvBMTtM3jKRl2j`

### 📧 Emails Configurés
- **Admin** : `admin@meeshy.me`
- **Meeshy** : `meeshy@meeshy.me`
- **Atabeth** : `atabeth@meeshy.me`

### 🌐 Domaine Configuré
- **Domaine** : `meeshy.me`

## 🎯 Étapes de Déploiement

### 1. **Test de Connexion SSH**
```bash
# Remplacez DROPLET_IP par l'IP de votre droplet Digital Ocean
ssh -o StrictHostKeyChecking=no root@DROPLET_IP 'echo "Connexion OK"'
```

### 2. **Transférer le Fichier de Secrets**
```bash
# Créer le répertoire secrets sur le serveur
ssh root@DROPLET_IP "mkdir -p /opt/meeshy/secrets"

# Transférer le fichier de secrets
scp secrets/production-secrets.env root@DROPLET_IP:/opt/meeshy/secrets/
```

### 3. **Déploiement Complet en Une Commande**
```bash
# Déploiement complet avec reset de la base de données
./scripts/production/deploy-production.sh DROPLET_IP
```

### 4. **Ou Déploiement par Étapes**

#### Étape 3a: Build et Push des Images
```bash
./scripts/deployment/build-and-push-docker-images.sh
```

#### Étape 3b: Reset de la Base de Données
```bash
./scripts/production/reset-database.sh DROPLET_IP
```

#### Étape 3c: Déploiement Final
```bash
./scripts/meeshy-deploy.sh deploy DROPLET_IP
```

## 🔍 Vérification Post-Déploiement

### 1. **Vérifier la Santé des Services**
```bash
./scripts/meeshy-deploy.sh health DROPLET_IP
```

### 2. **Voir les Logs**
```bash
./scripts/meeshy-deploy.sh logs DROPLET_IP
```

### 3. **Tester l'Accès à l'Application**
- Ouvrir `https://meeshy.me` dans un navigateur
- Vérifier que l'interface se charge correctement
- Tester la connexion avec les utilisateurs par défaut

## 🌐 Accès à l'Application

Une fois déployé, l'application sera accessible via :

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

## ⚠️ Avertissements de Sécurité

### Fichiers de Secrets
- **NE JAMAIS COMMITER** le fichier `secrets/production-secrets.env`
- Transférer ce fichier sur Digital Ocean dans un dossier sécurisé
- Utiliser des mots de passe forts générés automatiquement

### Base de Données
- **TOUJOURS** créer des backups avant le reset
- **TOUJOURS** vérifier la santé des services après déploiement
- **TOUJOURS** tester l'application après déploiement

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

## 📞 Support

En cas de problème :
1. Vérifier les logs avec `./scripts/meeshy-deploy.sh logs DROPLET_IP`
2. Vérifier la santé des services avec `./scripts/meeshy-deploy.sh health DROPLET_IP`
3. Consulter la documentation dans `scripts/production/README.md`
4. Consulter le guide rapide dans `scripts/production/QUICK_DEPLOYMENT_GUIDE.md`

## 🎉 Résultat Attendu

Après le déploiement réussi :
- ✅ Tous les services sont opérationnels
- ✅ La base de données est resetée et initialisée
- ✅ Les utilisateurs par défaut sont créés
- ✅ L'application est accessible via les domaines configurés
- ✅ Les configurations de sécurité sont appliquées

---

**Note** : Ce processus de déploiement est conçu pour être sûr et reproductible. Suivez toujours les étapes dans l'ordre et vérifiez chaque étape avant de passer à la suivante.
