# Déploiement Traefik - Meeshy

Ce document décrit le déploiement et la maintenance de l'infrastructure Traefik pour Meeshy.

## 🚀 Scripts de déploiement

### `deploy-traefik-production.sh`
Script principal de déploiement complet de l'infrastructure Traefik.

**Usage:**
```bash
./deploy-traefik-production.sh
```

**Fonctionnalités:**
- Copie des fichiers de configuration
- Arrêt des services existants
- Téléchargement des images Docker
- Démarrage des services
- Tests de connectivité automatiques
- Vérification des certificats SSL

### `maintain-traefik.sh`
Script de maintenance et diagnostic de l'infrastructure.

**Usage:**
```bash
./maintain-traefik.sh [COMMAND] [SERVICE]
```

**Commandes disponibles:**
- `status` - Afficher le statut des services
- `logs [SERVICE]` - Afficher les logs (optionnel: service spécifique)
- `restart [SERVICE]` - Redémarrer les services
- `diagnose` - Diagnostic complet de l'infrastructure
- `cleanup` - Nettoyage du système Docker
- `help` - Afficher l'aide

**Exemples:**
```bash
./maintain-traefik.sh status
./maintain-traefik.sh logs traefik
./maintain-traefik.sh restart gateway
./maintain-traefik.sh diagnose
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

### Commandes utiles
```bash
# Statut des services
ssh root@157.230.15.51 "cd /opt/meeshy && docker-compose ps"

# Logs en temps réel
ssh root@157.230.15.51 "cd /opt/meeshy && docker-compose logs -f"

# Redémarrage d'un service
ssh root@157.230.15.51 "cd /opt/meeshy && docker-compose restart [SERVICE]"

# Redémarrage complet
ssh root@157.230.15.51 "cd /opt/meeshy && docker-compose restart"
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
