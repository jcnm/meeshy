# Instructions de déploiement sur le serveur DigitalOcean

## 🚀 Déploiement des corrections nginx et frontend

### 1. Se connecter au serveur DigitalOcean
```bash
ssh root@meeshy.me
# ou avec votre clé SSH configurée
```

### 2. Aller dans le répertoire du projet
```bash
cd /root/meeshy
# ou le chemin où se trouve le projet sur votre serveur
```

### 3. Pull des dernières modifications
```bash
git pull origin main
```

### 4. Configurer l'environnement
```bash
cp env.digitalocean .env
```

### 5. Attendre que l'image translator soit disponible (15 minutes après le build)
```bash
# Vérifier que l'image est disponible
docker pull isopen/meeshy-translator:latest
```

### 6. Pull de toutes les images
```bash
docker-compose -f docker-compose.prod.yml pull
```

### 7. Redémarrer les services
```bash
# Arrêter les services existants
docker-compose -f docker-compose.prod.yml down

# Démarrer avec la nouvelle configuration
docker-compose -f docker-compose.prod.yml up -d
```

### 8. Vérifier le statut
```bash
# Vérifier que tous les services sont en cours d'exécution
docker-compose -f docker-compose.prod.yml ps

# Vérifier les logs nginx
docker logs meeshy-nginx

# Vérifier les logs frontend
docker logs meeshy-frontend
```

### 9. Tester l'application
```bash
# Test du frontend via nginx
curl -I http://localhost

# Test de l'API
curl -I http://localhost/api/health
```

## 🔧 Corrections appliquées

### Configuration nginx (docker/nginx/prod.conf)
- ✅ Suppression de la redirection HTTPS forcée
- ✅ Configuration HTTP fonctionnelle pour servir le frontend
- ✅ Routage correct vers tous les services (frontend, API, WebSocket, traduction)

### Variables d'environnement frontend
- ✅ `NEXT_PUBLIC_API_URL`: `http://meeshy.me/api` (au lieu de localhost:3000)
- ✅ `NEXT_PUBLIC_WS_URL`: `ws://meeshy.me/ws` (au lieu de localhost:3000)
- ✅ `NEXT_PUBLIC_TRANSLATION_URL`: `http://meeshy.me/translate` (au lieu de localhost:8000)
- ✅ Toutes les URLs pointent maintenant vers le domaine meeshy.me

## 🌐 Résultat attendu

Après le déploiement :
- ✅ Accès au frontend via `http://meeshy.me` (sans port)
- ✅ Plus d'erreur `ERR_CONNECTION_REFUSED` sur localhost
- ✅ Les appels API fonctionnent correctement
- ✅ Les WebSockets se connectent au bon serveur

## 🚨 En cas de problème

### Vérifier les logs
```bash
docker-compose -f docker-compose.prod.yml logs -f
```

### Redémarrer un service spécifique
```bash
docker-compose -f docker-compose.prod.yml restart nginx
docker-compose -f docker-compose.prod.yml restart frontend
```

### Vérifier la configuration nginx
```bash
docker exec meeshy-nginx nginx -t
```

### Recharger la configuration nginx
```bash
docker exec meeshy-nginx nginx -s reload
```
