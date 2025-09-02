# 🚀 Meeshy DigitalOcean Deployment Guide

Guide complet pour déployer Meeshy sur DigitalOcean avec MongoDB et orchestration Docker Compose.

## 📋 Table des Matières

1. [Prérequis](#prérequis)
2. [Architecture de Déploiement](#architecture-de-déploiement)
3. [Configuration](#configuration)
4. [Déploiement Automatique](#déploiement-automatique)
5. [Déploiement Manuel](#déploiement-manuel)
6. [Gestion Post-Déploiement](#gestion-post-déploiement)
7. [Monitoring et Maintenance](#monitoring-et-maintenance)
8. [Dépannage](#dépannage)
9. [Sécurité](#sécurité)
10. [Optimisations](#optimisations)

## 🔧 Prérequis

### Outils Requis

- **DigitalOcean CLI (doctl)** - [Installation](https://github.com/digitalocean/doctl)
- **Docker** - Version 20.10+
- **Docker Compose** - Version 2.0+
- **OpenSSL** - Pour la génération de certificats

### Comptes et Accès

- Compte DigitalOcean avec API token configuré
- Clé SSH ajoutée à votre compte DigitalOcean
- Nom de domaine (optionnel mais recommandé)

### Installation des Outils

```bash
# Installation de doctl (macOS)
brew install doctl

# Installation de doctl (Linux)
wget https://github.com/digitalocean/doctl/releases/download/v1.94.0/doctl-1.94.0-linux-amd64.tar.gz
tar xf doctl-1.94.0-linux-amd64.tar.gz
sudo mv doctl /usr/local/bin

# Configuration de doctl
doctl auth init

# Vérification
doctl account get
```

## 🏗️ Architecture de Déploiement

### Services Déployés

```
┌─────────────────────────────────────────────────┐
│                 DigitalOcean Droplet            │
├─────────────────────────────────────────────────┤
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐│
│  │   Nginx     │ │  Frontend   │ │   Gateway   ││
│  │   (80/443)  │ │   (3100)    │ │   (3000)    ││
│  └─────────────┘ └─────────────┘ └─────────────┘│
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐│
│  │ Translator  │ │   MongoDB   │ │    Redis    ││
│  │   (8000)    │ │   (27017)   │ │   (6379)    ││
│  └─────────────┘ └─────────────┘ └─────────────┘│
└─────────────────────────────────────────────────┘
```

### Flux de Données

1. **Nginx** → Reverse proxy et SSL termination
2. **Frontend** → Interface utilisateur Next.js
3. **Gateway** → API Fastify + WebSocket
4. **Translator** → Service de traduction FastAPI + ML
5. **MongoDB** → Base de données principale
6. **Redis** → Cache et sessions

## ⚙️ Configuration

### 1. Configuration des Variables d'Environnement

Copiez et modifiez le fichier de configuration :

```bash
cp env.digitalocean .env
```

**Variables Critiques à Modifier :**

```bash
# Domaine (remplacez par votre domaine)
FRONTEND_URL=https://your-domain.com
CORS_ORIGINS=https://your-domain.com,https://www.your-domain.com
NEXT_PUBLIC_API_URL=https://your-domain.com/api

# Sécurité (générez des valeurs aléatoires)
JWT_SECRET=your-super-secret-jwt-key-change-in-production
REDIS_PASSWORD=your-redis-password
MONGO_ROOT_PASSWORD=your-mongo-password

# Mots de passe par défaut
MEESHY_BIGBOSS_PASSWORD=your-bigboss-password
ADMIN_PASSWORD=your-admin-password
```

### 2. Configuration MongoDB

**Option A: MongoDB Auto-hébergé (Inclus)**
```bash
# Utilise le conteneur MongoDB inclus
DATABASE_URL=mongodb://meeshy:password@mongodb:27017/meeshy?authSource=admin&replicaSet=rs0
```

**Option B: MongoDB Atlas (Recommandé pour Production)**
```bash
# Utilisez votre URI MongoDB Atlas
DATABASE_URL=mongodb+srv://username:password@cluster.mongodb.net/meeshy?retryWrites=true&w=majority
```

## 🚀 Déploiement Automatique

### Script de Déploiement Complet

```bash
# Déploiement avec MongoDB auto-hébergé
./scripts/deploy-digitalocean.sh \
  --ssh-key-name "your-ssh-key" \
  --domain "your-domain.com"

# Déploiement avec MongoDB Atlas
./scripts/deploy-digitalocean.sh \
  --ssh-key-name "your-ssh-key" \
  --domain "your-domain.com" \
  --mongodb-atlas-uri "mongodb+srv://..."

# Déploiement sur droplet existant
./scripts/deploy-digitalocean.sh \
  --ssh-key-name "your-ssh-key" \
  --domain "your-domain.com" \
  --skip-droplet \
  --droplet-ip "192.168.1.100"
```

### Options du Script

| Option | Description | Requis |
|--------|-------------|--------|
| `--ssh-key-name` | Nom de votre clé SSH dans DigitalOcean | ✅ |
| `--domain` | Votre nom de domaine | ⚠️ Recommandé |
| `--droplet-name` | Nom du droplet (défaut: meeshy-production) | ❌ |
| `--droplet-size` | Taille du droplet (défaut: s-4vcpu-8gb) | ❌ |
| `--droplet-region` | Région (défaut: nyc3) | ❌ |
| `--mongodb-atlas-uri` | URI MongoDB Atlas | ❌ |
| `--skip-droplet` | Utiliser un droplet existant | ❌ |
| `--droplet-ip` | IP du droplet existant | ❌ |
| `--no-build` | Skip construction des images | ❌ |
| `--deploy-only` | Déploiement uniquement | ❌ |

## 🔧 Déploiement Manuel

### 1. Créer le Droplet

```bash
# Créer le droplet
doctl compute droplet create meeshy-production \
  --size s-4vcpu-8gb \
  --image docker-20-04 \
  --region nyc3 \
  --ssh-keys your-ssh-key-id \
  --wait

# Récupérer l'IP
DROPLET_IP=$(doctl compute droplet list --format Name,PublicIPv4 --no-header | grep meeshy-production | awk '{print $2}')
echo "Droplet IP: $DROPLET_IP"
```

### 2. Configurer le Serveur

```bash
# Se connecter au droplet
ssh root@$DROPLET_IP

# Mise à jour du système
apt update && apt upgrade -y

# Installation des dépendances
apt install -y nginx certbot python3-certbot-nginx ufw fail2ban

# Configuration du firewall
ufw allow ssh
ufw allow http
ufw allow https
ufw --force enable

# Installation de Docker Compose
curl -L "https://github.com/docker/compose/releases/download/v2.23.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose
```

### 3. Déployer l'Application

```bash
# Créer le répertoire de l'application
mkdir -p /opt/meeshy
cd /opt/meeshy

# Copier les fichiers (depuis votre machine locale)
scp docker-compose-mongodb.yml root@$DROPLET_IP:/opt/meeshy/docker-compose.yml
scp .env root@$DROPLET_IP:/opt/meeshy/
scp -r docker/ shared/ root@$DROPLET_IP:/opt/meeshy/

# Sur le droplet, démarrer les services
cd /opt/meeshy
docker-compose up -d
```

### 4. Configurer SSL

```bash
# Arrêter Nginx temporairement
systemctl stop nginx

# Obtenir le certificat SSL
certbot certonly --standalone -d your-domain.com --non-interactive --agree-tos --email admin@your-domain.com

# Configurer le renouvellement automatique
echo "0 12 * * * /usr/bin/certbot renew --quiet" | crontab -

# Redémarrer Nginx
systemctl start nginx
systemctl enable nginx
```

## 🛠️ Gestion Post-Déploiement

### Script de Gestion

```bash
# Voir le statut des services
./scripts/manage-digitalocean.sh --ip $DROPLET_IP --action status

# Voir les logs
./scripts/manage-digitalocean.sh --ip $DROPLET_IP --action logs --service gateway

# Redémarrer un service
./scripts/manage-digitalocean.sh --ip $DROPLET_IP --action restart --service translator

# Créer une sauvegarde
./scripts/manage-digitalocean.sh --ip $DROPLET_IP --action backup

# Monitoring en temps réel
./scripts/manage-digitalocean.sh --ip $DROPLET_IP --action monitor
```

### Commandes Docker Compose Directes

```bash
# Se connecter au droplet
ssh root@$DROPLET_IP
cd /opt/meeshy

# Voir le statut
docker-compose ps

# Voir les logs
docker-compose logs -f

# Redémarrer tous les services
docker-compose restart

# Mettre à jour les images
docker-compose pull
docker-compose up -d --force-recreate

# Arrêter tous les services
docker-compose down

# Démarrer tous les services
docker-compose up -d
```

## 📊 Monitoring et Maintenance

### Monitoring des Services

```bash
# Vérifier la santé des conteneurs
docker-compose ps

# Monitorer les ressources
docker stats

# Vérifier les logs d'erreur
docker-compose logs --tail=50 | grep -i error

# Tester les endpoints
curl http://localhost/health
curl http://localhost:3000/health
curl http://localhost:8000/health
```

### Maintenance Régulière

```bash
# Nettoyage Docker (hebdomadaire)
docker system prune -f
docker volume prune -f

# Sauvegarde (quotidienne)
./scripts/manage-digitalocean.sh --ip $DROPLET_IP --action backup

# Mise à jour des certificats SSL (automatique)
certbot renew --quiet

# Mise à jour du système (mensuelle)
apt update && apt upgrade -y
```

### Métriques à Surveiller

- **CPU Usage** : < 80%
- **Memory Usage** : < 85%
- **Disk Usage** : < 90%
- **Response Time** : < 2s
- **Error Rate** : < 1%

## 🔍 Dépannage

### Problèmes Courants

#### Service ne démarre pas

```bash
# Vérifier les logs
docker-compose logs service-name

# Vérifier la configuration
docker-compose config

# Redémarrer le service
docker-compose restart service-name
```

#### Problèmes de Connectivité

```bash
# Vérifier les ports
netstat -tlnp | grep -E ':(80|443|3000|3100|8000|27017|6379)'

# Vérifier le firewall
ufw status

# Tester la connectivité interne
docker exec container-name curl http://other-service:port/health
```

#### Problèmes de Base de Données

```bash
# MongoDB
docker exec -it meeshy-mongodb mongosh
> db.adminCommand('ping')

# Redis
docker exec -it meeshy-redis redis-cli ping
```

#### Problèmes de SSL

```bash
# Vérifier les certificats
certbot certificates

# Tester SSL
openssl s_client -connect your-domain.com:443

# Renouveler manuellement
certbot renew --force-renewal
```

### Logs Importants

```bash
# Logs système
tail -f /var/log/syslog

# Logs Nginx
tail -f /var/log/nginx/error.log
tail -f /var/log/nginx/access.log

# Logs de l'application
cd /opt/meeshy
docker-compose logs -f --tail=100
```

## 🔒 Sécurité

### Configuration du Firewall

```bash
# Règles UFW recommandées
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow http
ufw allow https
ufw --force enable
```

### Fail2Ban Configuration

```bash
# Configuration pour SSH et Nginx
cat > /etc/fail2ban/jail.local << EOF
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 3

[sshd]
enabled = true
port = ssh
logpath = /var/log/auth.log

[nginx-http-auth]
enabled = true
port = http,https
logpath = /var/log/nginx/error.log

[nginx-limit-req]
enabled = true
port = http,https
logpath = /var/log/nginx/error.log
EOF

systemctl restart fail2ban
```

### Sécurisation des Conteneurs

```bash
# Scan de sécurité des images
docker scan image-name

# Mise à jour régulière des images de base
docker-compose pull
docker-compose up -d --force-recreate
```

### Mots de Passe et Secrets

- Utilisez des mots de passe forts (32+ caractères)
- Changez tous les mots de passe par défaut
- Utilisez des secrets différents pour chaque environnement
- Activez l'authentification 2FA sur DigitalOcean

## ⚡ Optimisations

### Performance

```bash
# Optimisation Docker
echo '{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "storage-driver": "overlay2"
}' > /etc/docker/daemon.json

systemctl restart docker
```

### Mise en Cache

```bash
# Configuration Redis pour production
docker exec -it meeshy-redis redis-cli CONFIG SET maxmemory-policy allkeys-lru
docker exec -it meeshy-redis redis-cli CONFIG SET maxmemory 1gb
```

### Base de Données

```bash
# Index MongoDB pour performance
docker exec -it meeshy-mongodb mongosh meeshy --eval "
  db.User.createIndex({username: 1});
  db.Message.createIndex({conversationId: 1, createdAt: -1});
  db.MessageTranslation.createIndex({cacheKey: 1});
"
```

## 📈 Scaling

### Scaling Vertical

```bash
# Redimensionner le droplet
doctl compute droplet-action resize droplet-id --size s-8vcpu-16gb --wait
```

### Scaling Horizontal

Pour un scaling horizontal, considérez :

- Load Balancer DigitalOcean
- Plusieurs droplets
- Base de données externe (MongoDB Atlas)
- Cache externe (Redis Cloud)

## 🆘 Support

### Ressources

- [Documentation DigitalOcean](https://docs.digitalocean.com/)
- [Docker Documentation](https://docs.docker.com/)
- [MongoDB Documentation](https://docs.mongodb.com/)

### Commandes d'Urgence

```bash
# Arrêt d'urgence
ssh root@$DROPLET_IP "cd /opt/meeshy && docker-compose down"

# Restauration rapide
./scripts/manage-digitalocean.sh --ip $DROPLET_IP --action restore

# Accès shell d'urgence
./scripts/manage-digitalocean.sh --ip $DROPLET_IP --action shell
```

---

## 📝 Checklist de Déploiement

- [ ] Prérequis installés et configurés
- [ ] Variables d'environnement configurées
- [ ] Clé SSH ajoutée à DigitalOcean
- [ ] Domaine configuré (optionnel)
- [ ] Script de déploiement exécuté
- [ ] Services démarrés et fonctionnels
- [ ] SSL configuré (si domaine)
- [ ] Firewall configuré
- [ ] Fail2Ban configuré
- [ ] Première sauvegarde créée
- [ ] Monitoring configuré
- [ ] Tests de connectivité réussis

---

**🎉 Félicitations ! Votre instance Meeshy est maintenant déployée sur DigitalOcean !**
