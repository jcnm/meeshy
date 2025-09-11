# Meeshy - Scripts de Mise à Jour Production

Ce dossier contient les scripts spécialisés pour mettre à jour uniquement la gateway et le frontend en production, sans toucher à la base de données ni à l'infrastructure.

## 🚀 Scripts Disponibles

### 1. `zero-downtime-update.sh` - Mise à Jour Sans Interruption ⭐
**Script pour mettre à jour sans interruption de service (RECOMMANDÉ)**

```bash
./scripts/zero-downtime-update.sh [DROPLET_IP] [OPTIONS]
```

**Options:**
- `--force-refresh`: Forcer le téléchargement des nouvelles images
- `--no-rollback`: Désactiver le rollback automatique en cas d'erreur
- `--health-timeout=SEC`: Timeout pour les health checks (défaut: 60s)
- `--dry-run`: Simulation sans modification
- `--verbose`: Mode verbeux

**Exemples:**
```bash
# Mise à jour sans interruption (recommandée)
./scripts/zero-downtime-update.sh 157.230.15.51

# Mise à jour avec téléchargement forcé
./scripts/zero-downtime-update.sh 157.230.15.51 --force-refresh

# Simulation de la mise à jour
./scripts/zero-downtime-update.sh 157.230.15.51 --dry-run --verbose
```

**Stratégie:** Blue-Green Deployment avec Traefik
- Déploiement des nouvelles versions en parallèle
- Basculement progressif du trafic
- Rollback automatique en cas de problème
- **Aucune interruption de service**

### 2. `update-production.sh` - Script Principal
**Script orchestrateur principal pour la mise à jour complète**

```bash
./scripts/update-production.sh [DROPLET_IP] [OPTIONS]
```

**Options:**
- `--force-refresh`: Forcer le téléchargement des nouvelles images
- `--skip-decommission`: Ignorer l'étape de décommissionnement
- `--skip-health-check`: Ignorer la vérification de santé
- `--dry-run`: Simulation sans modification
- `--verbose`: Mode verbeux

**Exemples:**
```bash
# Mise à jour complète
./scripts/update-production.sh 157.230.15.51

# Mise à jour avec téléchargement forcé
./scripts/update-production.sh 157.230.15.51 --force-refresh

# Simulation de la mise à jour
./scripts/update-production.sh 157.230.15.51 --dry-run --verbose
```

### 2. `update-gateway-frontend.sh` - Mise à Jour Sélective
**Script pour mettre à jour uniquement gateway et frontend**

```bash
./scripts/update-gateway-frontend.sh [DROPLET_IP] [OPTIONS]
```

**Options:**
- `--force-refresh`: Forcer le téléchargement des nouvelles images
- `--skip-health-check`: Ignorer la vérification de santé
- `--verbose`: Mode verbeux

**Exemples:**
```bash
# Mise à jour sélective
./scripts/update-gateway-frontend.sh 157.230.15.51

# Mise à jour avec téléchargement forcé
./scripts/update-gateway-frontend.sh 157.230.15.51 --force-refresh
```

### 3. `decommission-services.sh` - Décommissionnement
**Script pour décommissionner proprement les services**

```bash
./scripts/decommission-services.sh [DROPLET_IP] [OPTIONS]
```

**Options:**
- `--services=SERVICES`: Services à décommissionner (défaut: gateway frontend)
- `--force`: Forcer sans confirmation
- `--verbose`: Mode verbeux

**Exemples:**
```bash
# Décommissionnement standard
./scripts/decommission-services.sh 157.230.15.51

# Décommissionnement forcé
./scripts/decommission-services.sh 157.230.15.51 --force

# Décommissionnement d'un service spécifique
./scripts/decommission-services.sh 157.230.15.51 --services=gateway
```

### 4. `quick-rollback.sh` - Rollback Rapide
**Script pour effectuer un rollback rapide en cas de problème**

```bash
./scripts/quick-rollback.sh [DROPLET_IP] [OPTIONS]
```

**Options:**
- `--force`: Forcer le rollback sans confirmation
- `--verbose`: Mode verbeux

**Exemples:**
```bash
# Rollback standard
./scripts/quick-rollback.sh 157.230.15.51

# Rollback forcé
./scripts/quick-rollback.sh 157.230.15.51 --force
```

### 5. `deploy-update.sh` - Déploiement Rapide
**Script de déploiement rapide utilisant la mise à jour sélective**

```bash
./scripts/deploy-update.sh [DROPLET_IP] [OPTIONS]
```

**Options:**
- `--force-refresh`: Forcer le téléchargement des nouvelles images
- `--verbose`: Mode verbeux

**Exemples:**
```bash
# Déploiement rapide
./scripts/deploy-update.sh 157.230.15.51

# Déploiement rapide avec téléchargement forcé
./scripts/deploy-update.sh 157.230.15.51 --force-refresh
```

## 📋 Processus de Mise à Jour

### 🚀 Mise à Jour Sans Interruption (Recommandée)

#### Étape 1: Vérification Préliminaire
- Test de connexion SSH
- Vérification de l'environnement Docker
- État actuel des services

#### Étape 2: Configuration Blue-Green
- Création de la configuration blue-green
- Préparation des nouvelles versions (GREEN)
- Préservation des versions actuelles (BLUE)

#### Étape 3: Déploiement Parallèle
- Téléchargement des nouvelles images
- Démarrage des nouvelles versions en parallèle
- Health checks des nouvelles versions

#### Étape 4: Basculement du Trafic
- Activation des nouvelles versions dans Traefik
- Désactivation des anciennes versions
- Basculement progressif du trafic

#### Étape 5: Nettoyage
- Suppression des anciennes versions
- Nettoyage des images inutilisées
- Restauration de la configuration principale

### 🔄 Mise à Jour Standard (Avec Interruption)

#### Étape 1: Vérification Préliminaire
- Test de connexion SSH
- Vérification de l'environnement Docker
- État actuel des services

#### Étape 2: Décommissionnement (Optionnel)
- Arrêt des services gateway et frontend
- Suppression des conteneurs
- Préservation des volumes et données

#### Étape 3: Mise à Jour
- Téléchargement des nouvelles images
- Redémarrage séquentiel des services
- Vérification de la connectivité

#### Étape 4: Vérification Post-Déploiement
- Tests de santé des services
- Vérification de la connectivité
- Validation des endpoints

#### Étape 5: Nettoyage
- Suppression des anciennes images
- Libération de l'espace disque

## ⚠️ Important

### Ce qui est Modifié
- ✅ **Gateway**: Conteneur mis à jour avec la nouvelle version
- ✅ **Frontend**: Conteneur mis à jour avec la nouvelle version

### Ce qui est Préservé
- ✅ **Base de données**: Aucune modification, données intactes
- ✅ **Infrastructure**: Traefik, Redis, MongoDB non modifiés
- ✅ **Volumes**: Toutes les données persistantes préservées
- ✅ **Configuration**: Fichiers de configuration préservés

## 🔧 Commandes Utiles

### Vérification de l'État
```bash
# État des services
ssh root@DROPLET_IP 'cd /opt/meeshy && docker-compose ps'

# Logs des services
ssh root@DROPLET_IP 'cd /opt/meeshy && docker-compose logs gateway frontend'

# Versions des images
ssh root@DROPLET_IP 'docker images | grep -E "(gateway|frontend)"'
```

### Maintenance
```bash
# Redémarrage des services
ssh root@DROPLET_IP 'cd /opt/meeshy && docker-compose restart gateway frontend'

# Redémarrage complet
ssh root@DROPLET_IP 'cd /opt/meeshy && docker-compose up -d'

# Arrêt des services
ssh root@DROPLET_IP 'cd /opt/meeshy && docker-compose stop gateway frontend'
```

### Tests de Connectivité
```bash
# Test Gateway
curl -f http://DROPLET_IP:3000/health

# Test Frontend
curl -f http://DROPLET_IP:3100

# Test via Traefik
curl -f -H "Host: gate.meeshy.me" http://DROPLET_IP/health
curl -f -H "Host: meeshy.me" http://DROPLET_IP
```

## 🚨 Dépannage

### Problèmes Courants

#### 1. Service ne démarre pas
```bash
# Vérifier les logs
ssh root@DROPLET_IP 'cd /opt/meeshy && docker-compose logs SERVICE_NAME'

# Redémarrer le service
ssh root@DROPLET_IP 'cd /opt/meeshy && docker-compose restart SERVICE_NAME'
```

#### 2. Problème de connectivité
```bash
# Vérifier l'état des conteneurs
ssh root@DROPLET_IP 'cd /opt/meeshy && docker-compose ps'

# Vérifier les ports
ssh root@DROPLET_IP 'netstat -tuln | grep -E "(3000|3100)"'
```

#### 3. Problème d'images
```bash
# Forcer le téléchargement
./scripts/update-production.sh DROPLET_IP --force-refresh

# Vérifier les images
ssh root@DROPLET_IP 'docker images | grep -E "(gateway|frontend)"'
```

### Rollback
En cas de problème, vous pouvez revenir à la version précédente :

#### Rollback Rapide (Recommandé)
```bash
# Rollback automatique
./scripts/quick-rollback.sh DROPLET_IP

# Rollback forcé
./scripts/quick-rollback.sh DROPLET_IP --force
```

#### Rollback Manuel
```bash
# Arrêter les services
ssh root@DROPLET_IP 'cd /opt/meeshy && docker-compose stop gateway frontend'

# Redémarrer avec les images précédentes
ssh root@DROPLET_IP 'cd /opt/meeshy && docker-compose up -d gateway frontend'
```

## 📞 Support

En cas de problème, vérifiez :
1. La connectivité SSH vers le serveur
2. L'état des services Docker
3. Les logs des conteneurs
4. L'espace disque disponible

Pour plus d'aide, consultez les logs détaillés avec l'option `--verbose`.
