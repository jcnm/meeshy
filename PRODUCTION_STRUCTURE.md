# Structure de production Meeshy - Épurée

## Structure finale après cleanup

```
/opt/meeshy/
├── docker-compose.yml          # Configuration principale (anciennement docker-compose.traefik.yml)
├── .env                        # Variables d'environnement
│
├── docker/
│   └── nginx/
│       └── static-files.conf   # Configuration Nginx pour static.meeshy.me
│
├── scripts/
│   ├── check-public-url.sh                # Vérification PUBLIC_URL
│   ├── cleanup-production.sh              # Nettoyage de la production
│   ├── cleanup-user-spaces.js             # Nettoyage utilisateurs
│   ├── configure-database.sh              # Configuration BDD
│   ├── deploy-static-infrastructure.sh    # Déploiement infrastructure static
│   ├── fix-avatar-storage.sh              # Migration avatars
│   ├── manage-ssl.sh                      # Gestion SSL
│   ├── migrate-avatar-urls.js             # Migration URLs avatars
│   ├── migrate-avatars-to-volume.sh       # Migration vers volume
│   ├── normalize-user-data.js             # Normalisation données
│   └── restore-missing-users.js           # Restauration utilisateurs
│
├── docs/
│   ├── STATIC_SUBDOMAIN_DEPLOYMENT.md     # Déploiement static.meeshy.me
│   ├── NGINX_STATIC_FILES.md              # Config Nginx static
│   └── AVATAR_MIGRATION_SUCCESS.md        # Migration avatars
│
└── backups/
    ├── pre-cleanup-20251019_135743.tar.gz  # Backup complet avant cleanup
    └── pre-cleanup-20251019_135719/        # Backup complet
        └── meeshy-full-backup.tar.gz
```

## Fichiers supprimés

### Docker Compose inutiles
- ❌ docker-compose.dev.yml
- ❌ docker-compose.local.yml
- ❌ docker-compose.unified.yml
- ❌ docker-compose.prod.yml

### Configurations Nginx inutilisées
- ❌ docker/nginx/default.conf
- ❌ docker/nginx/dev.conf
- ❌ docker/nginx/digitalocean.conf
- ❌ docker/nginx/letsencrypt.conf
- ❌ docker/nginx/nginx.conf
- ❌ docker/nginx/prod.conf
- ❌ docker/nginx/ssl-optimized.conf
- ❌ docker/nginx/active.conf

### Dossiers inutiles
- ❌ docker/supervisor/
- ❌ docker/scripts/
- ❌ docker/elasticsearch/
- ❌ docker/logstash/
- ❌ shared/
- ❌ config/
- ❌ secrets/
- ❌ traefik/

### Fichiers temporaires
- ❌ .env.backup-*
- ❌ .env.bak
- ❌ *.js (scripts à la racine)
- ❌ *.sh (scripts à la racine)
- ❌ *.md (docs à la racine)

## Fichiers essentiels gardés

### Configuration principale
- ✅ `docker-compose.yml` - Orchestration des services
- ✅ `.env` - Variables d'environnement

### Configuration services
- ✅ `docker/nginx/static-files.conf` - Nginx pour static.meeshy.me

### Scripts utiles
- ✅ `scripts/` - Scripts de maintenance et déploiement

### Documentation
- ✅ `docs/` - Documentation technique essentielle

### Backups
- ✅ `backups/` - 5 backups les plus récents

## Services déployés

Les services sont déployés via Docker images :
- `isopen/meeshy-frontend:latest`
- `isopen/meeshy-gateway:latest`
- `isopen/meeshy-translator:latest`
- `nginx:alpine` (static-files)
- `traefik:v3.3`
- `mongo:8.0`
- `redis:8-alpine`

Les sources ne sont **pas** nécessaires en production.

## Commandes de gestion

### Démarrer les services
```bash
cd /opt/meeshy
docker compose up -d
```

### Voir les logs
```bash
docker compose logs -f [service]
```

### Redémarrer un service
```bash
docker compose restart [service]
```

### Mettre à jour une image
```bash
docker compose pull [service]
docker compose up -d [service]
```

### Backup de la configuration
```bash
tar -czf /opt/meeshy/backups/config-$(date +%Y%m%d).tar.gz \
    docker-compose.yml .env docker/nginx/
```

## Restauration depuis backup

En cas de problème :

```bash
cd /opt/meeshy/backups
tar -xzf pre-cleanup-20251019_135743.tar.gz -C /opt/meeshy-restore/
```

## Checklist de production

- [x] Un seul docker-compose.yml
- [x] Un seul .env
- [x] Configs Nginx essentielles uniquement
- [x] Scripts de maintenance organisés dans scripts/
- [x] Documentation essentielle dans docs/
- [x] Backup complet avant cleanup
- [x] Pas de sources (tout dans les images Docker)
- [x] Pas de fichiers temporaires

---

**Date du cleanup** : 19 octobre 2025  
**Backup de référence** : `/opt/meeshy/backups/pre-cleanup-20251019_135743.tar.gz`  
**Taille** : 9.8 MB

