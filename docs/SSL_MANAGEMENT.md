# 🔐 Gestion SSL pour Meeshy

Ce document décrit la gestion SSL intelligente de Meeshy, qui supporte à la fois les certificats auto-signés pour le développement et Let's Encrypt pour la production.

## 🚀 Vue d'ensemble

Meeshy utilise un système SSL hybride qui :
- **Mode développement** : Génère automatiquement des certificats auto-signés
- **Mode production** : Configure automatiquement Let's Encrypt avec Certbot
- **Fallback intelligent** : Bascule automatiquement entre les modes selon la configuration

## 📁 Structure des fichiers

```
meeshy/
├── docker/
│   └── nginx/
│       ├── digitalocean.conf      # Configuration développement (auto-signé)
│       ├── letsencrypt.conf       # Configuration production (Let's Encrypt)
│       └── active.conf            # Configuration active (lien symbolique)
├── ssl/                           # Certificats auto-signés
│   ├── cert.pem
│   └── key.pem
├── scripts/
│   ├── manage-ssl.sh             # Gestionnaire SSL principal
│   ├── generate-ssl-certs.sh     # Génération de certificats
│   └── test-ssl-setup.sh         # Tests de configuration
└── docker-compose-mongodb-production.yml
```

## 🛠️ Commandes principales

### Gestion SSL locale

```bash
# Mode développement (certificats auto-signés)
./scripts/manage-ssl.sh dev localhost

# Mode production (Let's Encrypt)
./scripts/manage-ssl.sh prod meeshy.me admin@meeshy.me

# Vérifier l'état des certificats
./scripts/manage-ssl.sh check

# Renouveler les certificats Let's Encrypt
./scripts/manage-ssl.sh renew

# Générer des certificats auto-signés
./scripts/manage-ssl.sh self-signed example.com
```

### Déploiement avec SSL

```bash
# Déploiement complet (détecte automatiquement le mode SSL)
./scripts/meeshy-deploy.sh deploy YOUR_SERVER_IP

# Gestion SSL sur le serveur distant
./scripts/meeshy-deploy.sh ssl dev localhost
./scripts/meeshy-deploy.sh ssl prod meeshy.me admin@meeshy.me
```

## 🔧 Configuration automatique

### Mode Développement

1. **Détection automatique** : Si `DOMAIN=localhost` ou non défini
2. **Génération des certificats** : Création automatique de certificats auto-signés
3. **Configuration Nginx** : Utilisation de `digitalocean.conf`
4. **Ports** : HTTP (80) → HTTPS (443) avec certificats auto-signés

### Mode Production

1. **Détection automatique** : Si `DOMAIN` pointe vers un vrai domaine
2. **Configuration Let's Encrypt** : Setup automatique avec Certbot
3. **Configuration Nginx** : Utilisation de `letsencrypt.conf`
4. **Ports** : HTTP (80) pour challenges + HTTPS (443) avec Let's Encrypt

## 📋 Variables d'environnement

```bash
# Configuration du domaine
DOMAIN=meeshy.me
CERTBOT_EMAIL=admin@meeshy.me

# Configuration SSL
SSL_CERT_PATH=/etc/nginx/ssl/cert.pem
SSL_KEY_PATH=/etc/nginx/ssl/key.pem
```

## 🔍 Vérification et tests

### Test de la configuration locale

```bash
./scripts/test-ssl-setup.sh
```

### Test sur le serveur distant

```bash
# Vérifier l'état des services
./scripts/meeshy-deploy.sh health YOUR_SERVER_IP

# Vérifier les connexions
./scripts/meeshy-deploy.sh verify YOUR_SERVER_IP

# Vérifier l'état SSL
./scripts/meeshy-deploy.sh ssl check YOUR_SERVER_IP
```

## 🚨 Dépannage

### Problèmes courants

1. **Certificats expirés**
   ```bash
   ./scripts/manage-ssl.sh renew
   ```

2. **Configuration Nginx incorrecte**
   ```bash
   # Recréer la configuration active
   ./scripts/manage-ssl.sh dev localhost
   # ou
./scripts/manage-ssl.sh prod meeshy.me admin@meeshy.me
   ```

3. **Erreurs Let's Encrypt**
   ```bash
   # Vérifier la configuration DNS
dig meeshy.me
   
   # Vérifier les logs Certbot
   docker-compose logs certbot
   ```

### Logs utiles

```bash
# Logs Nginx
docker-compose logs nginx

# Logs Certbot
docker-compose logs certbot

# Logs des services
docker-compose logs gateway translator frontend
```

## 🔄 Renouvellement automatique

### Cron job pour Let's Encrypt

```bash
# Ajouter au crontab
0 12 * * * cd /opt/meeshy && ./scripts/manage-ssl.sh renew
```

### Vérification manuelle

```bash
# Vérifier la validité des certificats
./scripts/manage-ssl.sh check

# Renouveler si nécessaire
./scripts/manage-ssl.sh renew
```

## 🛡️ Sécurité

### Headers de sécurité

- **HSTS** : `max-age=31536000; includeSubDomains`
- **X-Frame-Options** : `DENY`
- **X-Content-Type-Options** : `nosniff`
- **X-XSS-Protection** : `1; mode=block`
- **Content-Security-Policy** : Configuration stricte

### Rate limiting

- **API** : 100 requêtes/minute
- **Translation** : 50 requêtes/minute
- **WebSocket** : 200 requêtes/minute
- **Connexions** : 20 par IP

## 📊 Monitoring

### Endpoints de santé

- **Nginx** : `/nginx-health`
- **Gateway** : `/health`
- **Translator** : `/health`

### Métriques

```bash
# État des services
docker-compose ps

# Utilisation des ressources
docker stats

# Logs en temps réel
docker-compose logs -f
```

## 🚀 Déploiement en production

### Étapes recommandées

1. **Configuration DNS** : Pointer le domaine vers l'IP du serveur
2. **Déploiement initial** : `./scripts/meeshy-deploy.sh deploy YOUR_SERVER_IP`
3. **Configuration SSL** : `./scripts/meeshy-deploy.sh ssl prod example.com admin@example.com`
4. **Vérification** : `./scripts/meeshy-deploy.sh health YOUR_SERVER_IP`
5. **Tests** : `./scripts/meeshy-deploy.sh test YOUR_SERVER_IP`

### Vérifications post-déploiement

- [ ] Certificats SSL valides
- [ ] Redirection HTTP → HTTPS
- [ ] Services accessibles via HTTPS
- [ ] WebSocket sécurisé (WSS)
- [ ] Headers de sécurité présents
- [ ] Rate limiting actif

## 📚 Ressources supplémentaires

- [Documentation Let's Encrypt](https://letsencrypt.org/docs/)
- [Documentation Certbot](https://certbot.eff.org/docs/)
- [Configuration Nginx SSL](https://nginx.org/en/docs/http/configuring_https_servers.html)
- [Meilleures pratiques SSL](https://ssl-config.mozilla.org/)

## 🆘 Support

En cas de problème :

1. Vérifier les logs : `docker-compose logs`
2. Tester la configuration : `./scripts/test-ssl-setup.sh`
3. Vérifier l'état des services : `./scripts/meeshy-deploy.sh health`
4. Consulter la documentation de dépannage

---

**Note** : Ce système SSL est conçu pour être robuste et automatique. Il gère automatiquement les fallbacks et les erreurs pour assurer la disponibilité des services.
