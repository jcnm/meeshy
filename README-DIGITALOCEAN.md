# 🚀 Meeshy - Déploiement DigitalOcean

Déploiement automatisé de la plateforme Meeshy sur DigitalOcean avec MongoDB et orchestration Docker Compose.

## ⚡ Déploiement Rapide

### 1. Validation Pré-déploiement

```bash
# Vérifier que tout est prêt pour le déploiement
./scripts/validate-deployment.sh
```

### 2. Configuration

```bash
# Copier et modifier la configuration
cp env.digitalocean .env

# Modifier les variables importantes :
# - Remplacer "your-domain.com" par votre domaine
# - Changer tous les mots de passe par défaut
# - Configurer l'URI MongoDB si vous utilisez Atlas
```

### 3. Déploiement

```bash
# Déploiement complet avec MongoDB auto-hébergé
./scripts/deploy-digitalocean.sh \
  --ssh-key-name "your-ssh-key" \
  --domain "your-domain.com"

# Ou avec MongoDB Atlas
./scripts/deploy-digitalocean.sh \
  --ssh-key-name "your-ssh-key" \
  --domain "your-domain.com" \
  --mongodb-atlas-uri "mongodb+srv://..."
```

## 📊 Architecture Déployée

```
🌐 DigitalOcean Droplet (s-4vcpu-8gb)
├── 🔒 Nginx (80/443) - Reverse Proxy + SSL
├── 🎨 Frontend (3100) - Next.js 15 + React 19
├── ⚡ Gateway (3000) - Fastify + WebSocket
├── 🤖 Translator (8000) - FastAPI + ML Models
├── 🗄️ MongoDB (27017) - Base de données
└── 🔄 Redis (6379) - Cache et sessions
```

## 🛠️ Gestion Post-déploiement

### Commandes Essentielles

```bash
# Voir le statut des services
./scripts/manage-digitalocean.sh --ip YOUR_IP --action status

# Voir les logs en temps réel
./scripts/manage-digitalocean.sh --ip YOUR_IP --action logs

# Redémarrer un service
./scripts/manage-digitalocean.sh --ip YOUR_IP --action restart --service gateway

# Créer une sauvegarde
./scripts/manage-digitalocean.sh --ip YOUR_IP --action backup

# Monitoring en temps réel
./scripts/manage-digitalocean.sh --ip YOUR_IP --action monitor
```

### Accès Direct au Serveur

```bash
# Se connecter au serveur
ssh root@YOUR_DROPLET_IP

# Naviguer vers l'application
cd /opt/meeshy

# Voir les services
docker-compose ps

# Voir les logs
docker-compose logs -f
```

## 🔧 Configuration Avancée

### Variables d'Environnement Critiques

| Variable | Description | Défaut | Action Requise |
|----------|-------------|--------|----------------|
| `FRONTEND_URL` | URL publique de votre app | `https://your-domain.com` | ✅ Modifier |
| `DATABASE_URL` | URI MongoDB | Auto-configuré | ⚠️ Atlas optionnel |
| `JWT_SECRET` | Clé secrète JWT | Générique | ✅ Changer |
| `REDIS_PASSWORD` | Mot de passe Redis | Générique | ✅ Changer |
| `ADMIN_PASSWORD` | Mot de passe admin | `admin123` | ✅ Changer |

### Options de Base de Données

#### Option 1: MongoDB Auto-hébergé (Inclus)
```bash
DATABASE_URL=mongodb://meeshy:password@mongodb:27017/meeshy?authSource=admin&replicaSet=rs0
```
- ✅ Inclus dans le déploiement
- ✅ Pas de coûts supplémentaires
- ⚠️ Vous gérez les sauvegardes

#### Option 2: MongoDB Atlas (Recommandé)
```bash
DATABASE_URL=mongodb+srv://username:password@cluster.mongodb.net/meeshy?retryWrites=true&w=majority
```
- ✅ Géré par MongoDB
- ✅ Sauvegardes automatiques
- ✅ Haute disponibilité
- 💰 Coût supplémentaire

## 🔍 Tests et Validation

### Tests de Connectivité

```bash
# Frontend
curl https://your-domain.com

# API Gateway
curl https://your-domain.com/api/health

# Service de traduction
curl https://your-domain.com/translate/health

# Test de traduction
curl -X POST https://your-domain.com/translate/ \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello world","source_lang":"en","target_lang":"fr"}'
```

### Monitoring des Performances

```bash
# Utilisation des ressources
ssh root@YOUR_IP "htop"

# Logs d'erreur
ssh root@YOUR_IP "cd /opt/meeshy && docker-compose logs | grep -i error"

# Statistiques Docker
ssh root@YOUR_IP "docker stats"
```

## 🔒 Sécurité

### Mesures Implémentées

- ✅ Firewall UFW configuré
- ✅ Fail2Ban pour la protection SSH
- ✅ SSL/TLS avec Let's Encrypt
- ✅ Headers de sécurité Nginx
- ✅ Rate limiting sur les API
- ✅ Conteneurs non-root
- ✅ Secrets randomisés

### Actions Post-déploiement Recommandées

```bash
# 1. Changer les mots de passe par défaut
# 2. Configurer la surveillance
# 3. Mettre en place des sauvegardes automatiques
# 4. Configurer les alertes
# 5. Tester la récupération
```

## 📈 Scaling et Performance

### Ressources Recommandées par Charge

| Utilisateurs | Droplet | RAM | CPU | Coût/mois |
|--------------|---------|-----|-----|-----------|
| < 100 | s-2vcpu-4gb | 4GB | 2 CPU | ~$24 |
| 100-500 | s-4vcpu-8gb | 8GB | 4 CPU | ~$48 |
| 500-2000 | s-8vcpu-16gb | 16GB | 8 CPU | ~$96 |
| 2000+ | Load Balancer + Multiple | - | - | Variable |

### Optimisations Incluses

- 🔄 Cache Redis pour les traductions
- 🗜️ Compression Gzip
- 📦 Images Docker optimisées
- ⚡ Nginx avec mise en cache
- 🧠 Modèles ML quantifiés
- 🔧 Pool de connexions optimisé

## 🆘 Dépannage

### Problèmes Courants

#### Services ne démarrent pas
```bash
# Vérifier les logs
ssh root@YOUR_IP "cd /opt/meeshy && docker-compose logs"

# Redémarrer les services
ssh root@YOUR_IP "cd /opt/meeshy && docker-compose restart"
```

#### Problème de connectivité
```bash
# Vérifier les ports
ssh root@YOUR_IP "netstat -tlnp | grep -E ':(80|443|3000|3100|8000)'"

# Vérifier le firewall
ssh root@YOUR_IP "ufw status"
```

#### Base de données inaccessible
```bash
# Vérifier MongoDB
ssh root@YOUR_IP "docker exec -it meeshy-mongodb mongosh --eval 'db.adminCommand(\"ping\")'"

# Vérifier Redis
ssh root@YOUR_IP "docker exec -it meeshy-redis redis-cli ping"
```

#### SSL ne fonctionne pas
```bash
# Vérifier les certificats
ssh root@YOUR_IP "certbot certificates"

# Renouveler manuellement
ssh root@YOUR_IP "certbot renew --force-renewal"
```

### Commandes d'Urgence

```bash
# Arrêt d'urgence
ssh root@YOUR_IP "cd /opt/meeshy && docker-compose down"

# Redémarrage complet
ssh root@YOUR_IP "cd /opt/meeshy && docker-compose down && docker-compose up -d"

# Restauration depuis sauvegarde
./scripts/manage-digitalocean.sh --ip YOUR_IP --action restore
```

## 📞 Support

### Ressources

- 📖 [Documentation Complète](docs/DEPLOYMENT_DIGITALOCEAN.md)
- 🐛 [Issues GitHub](https://github.com/your-org/meeshy/issues)
- 💬 [Community Discord](https://discord.gg/meeshy)

### Logs Importants

```bash
# Logs de l'application
ssh root@YOUR_IP "cd /opt/meeshy && docker-compose logs -f"

# Logs système
ssh root@YOUR_IP "tail -f /var/log/syslog"

# Logs Nginx
ssh root@YOUR_IP "tail -f /var/log/nginx/error.log"
```

## 🎯 Checklist de Déploiement

### Pré-déploiement
- [ ] doctl installé et configuré
- [ ] Clé SSH ajoutée à DigitalOcean
- [ ] Variables d'environnement configurées
- [ ] Validation réussie (`./scripts/validate-deployment.sh`)

### Déploiement
- [ ] Script de déploiement exécuté sans erreur
- [ ] Tous les services démarrés
- [ ] Tests de connectivité réussis
- [ ] SSL configuré (si domaine)

### Post-déploiement
- [ ] Première sauvegarde créée
- [ ] Mots de passe par défaut changés
- [ ] Monitoring configuré
- [ ] Documentation équipe mise à jour

---

## 🎉 Félicitations !

Votre instance Meeshy est maintenant déployée et prête à l'emploi sur DigitalOcean !

**Accès :**
- 🌐 **Frontend :** https://your-domain.com
- 🔧 **Admin :** https://your-domain.com/admin
- 📊 **API :** https://your-domain.com/api
- 🤖 **Traduction :** https://your-domain.com/translate

**Identifiants par défaut :**
- **Admin :** admin@meeshy.com / admin123 (à changer !)
- **BigBoss :** bigboss@meeshy.com / bigboss123 (à changer !)

---

*Made with ❤️ by the Meeshy Team*
