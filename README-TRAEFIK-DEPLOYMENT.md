# Déploiement Traefik - Meeshy

Ce document décrit le déploiement et la maintenance de l'infrastructure Traefik pour Meeshy.

## 🚀 Script de déploiement unifié

### `scripts/meeshy-deploy.sh`
Script principal de déploiement et maintenance de l'infrastructure Meeshy avec support Traefik.

**Usage:**
```bash
./scripts/meeshy-deploy.sh [COMMAND] [DROPLET_IP]
```

**Commandes disponibles:**
- `deploy` - Déploiement complet (Nginx par défaut)
- `traefik` - Déploiement Traefik avec SSL automatique
- `update` - **Déploiement incrémental (fichiers modifiés uniquement)**
- `fix` - Correction rapide (redémarrage)
- `test` - Tests complets post-déploiement
- `verify` - Vérification des connexions
- `health` - Vérification rapide de santé
- `status` - État des services
- `logs` - Logs des services
- `restart` - Redémarrage des services
- `stop` - Arrêt des services
- `ssl` - Gestion SSL (dev/prod)

**Exemples:**
```bash
# Déploiement Traefik complet
./scripts/meeshy-deploy.sh traefik 157.230.15.51

# Déploiement incrémental (fichiers modifiés uniquement)
./scripts/meeshy-deploy.sh update 157.230.15.51

# Tests et vérifications
./scripts/meeshy-deploy.sh test 157.230.15.51
./scripts/meeshy-deploy.sh health 157.230.15.51
```

## 🏗️ Architecture

### Services déployés
- **Traefik** - Reverse proxy avec SSL automatique
- **Frontend** - Application Next.js
- **Gateway** - API et WebSocket
- **Translator** - Service de traduction ML
- **Database** - MongoDB avec replica set
- **Redis** - Cache et sessions
- **MongoDB UI** - Interface d'administration MongoDB
- **Redis UI** - Interface d'administration Redis

### URLs de production
- **Frontend:** https://meeshy.me
- **Traefik Dashboard:** https://traefik.meeshy.me (admin:admin)
- **Gateway API:** https://gate.meeshy.me/health
- **WebSocket:** https://gate.meeshy.me/socket.io/
- **Translator:** https://ml.meeshy.me/translate
- **MongoDB UI:** https://mongo.meeshy.me
- **Redis UI:** https://redis.meeshy.me

## 🔧 Configuration

### Fichiers de configuration
- `docker-compose.traefik.yml` - Configuration Docker Compose
- `env.digitalocean` - Variables d'environnement
- `config/dynamic.yaml` - Configuration dynamique Traefik

### Certificats SSL
- Certificats Let's Encrypt générés automatiquement
- Renouvellement automatique
- Support HTTPS pour tous les services

## 🛠️ Maintenance

### Déploiement incrémental
La commande `update` permet de déployer uniquement les fichiers modifiés :

```bash
# Déploiement incrémental (recommandé pour les mises à jour)
./scripts/meeshy-deploy.sh update 157.230.15.51
```

**Fonctionnalités du déploiement incrémental :**
- ✅ Détection automatique des fichiers modifiés (MD5)
- ✅ Déploiement uniquement des fichiers changés
- ✅ Redémarrage intelligent des services affectés
- ✅ Tests de connectivité post-déploiement
- ✅ Pas de téléchargement d'images inutile

**Fichiers surveillés :**
- `docker-compose.traefik.yml`
- `env.digitalocean`
- `config/` (dossier complet)
- `scripts/meeshy-deploy.sh`

### Commandes utiles
```bash
# Statut des services
./scripts/meeshy-deploy.sh status 157.230.15.51

# Logs en temps réel
./scripts/meeshy-deploy.sh logs 157.230.15.51

# Redémarrage des services
./scripts/meeshy-deploy.sh restart 157.230.15.51

# Tests de santé
./scripts/meeshy-deploy.sh health 157.230.15.51
```

### Surveillance
- Healthchecks automatiques pour tous les services
- Logs centralisés via Docker Compose
- Monitoring des certificats SSL

## 🔒 Sécurité

### Authentification
- Traefik Dashboard protégé par authentification basique
- Certificats SSL Let's Encrypt pour tous les services
- Headers de sécurité configurés

### Réseau
- Isolation des services via Docker networks
- Communication interne sécurisée
- Exposition uniquement des ports nécessaires

## 📊 Monitoring

### Métriques disponibles
- Statut des services via `docker-compose ps`
- Logs en temps réel via `docker-compose logs`
- Utilisation des ressources via `docker stats`

### Alertes
- Healthchecks automatiques
- Détection des pannes de service
- Surveillance des certificats SSL

## 🚨 Dépannage

### Problèmes courants
1. **Service non accessible** - Vérifier le statut avec `./maintain-traefik.sh status`
2. **Certificat SSL invalide** - Redémarrer Traefik pour forcer le renouvellement
3. **Service unhealthy** - Consulter les logs avec `./maintain-traefik.sh logs [SERVICE]`

### Diagnostic complet
```bash
./maintain-traefik.sh diagnose
```

## 📝 Changelog

### Version 1.0.0
- Déploiement initial de l'infrastructure Traefik
- Support SSL automatique avec Let's Encrypt
- Configuration des sous-domaines
- Scripts de déploiement et maintenance
- Interface d'administration pour MongoDB et Redis
