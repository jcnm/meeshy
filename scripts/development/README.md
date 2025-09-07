# 🚀 Scripts de Développement Local

## Scripts Disponibles

### start-local.sh ⭐
**Script principal pour démarrer l'environnement de développement complet**

```bash
./start-local.sh
```

**Fonctionnalités :**
- ✅ Configuration automatique des variables d'environnement pour localhost
- 🐳 Démarrage de MongoDB et Redis via Docker
- 🚀 Lancement de Translator, Gateway, Frontend en mode natif
- 📊 Monitoring des services en temps réel
- 🛑 Arrêt propre avec Ctrl+C (nettoie tout automatiquement)

**Variables configurées automatiquement :**
```bash
DATABASE_URL=mongodb://meeshy:MeeshyPassword123@localhost:27017/meeshy?authSource=admin
REDIS_URL=redis://localhost:6379
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_WS_URL=ws://localhost:3000/api/ws
# ... et toutes les autres variables pour localhost
```

### stop-local.sh 🛑
**Script de sauvegarde pour arrêter l'environnement (généralement pas nécessaire)**

```bash
./stop-local.sh
```

Normalement, utilisez Ctrl+C dans le terminal de `start-local.sh` pour un arrêt propre.

### test-local.sh 🧪
**Script de test pour vérifier que tous les services fonctionnent**

```bash
./test-local.sh
```

Teste la connectivité de tous les services :
- Ports ouverts (3000, 3100, 8000, 27017, 6379)
- Endpoints HTTP (/health)
- Accessibilité des services

## 🎯 Utilisation Recommandée

### Démarrage Normal
```bash
# Démarrer tout l'environnement
./scripts/development/start-local.sh

# Dans un autre terminal, tester que tout fonctionne
./scripts/development/test-local.sh

# Développer normalement avec hot-reload
# - Modifications Frontend : rechargées automatiquement
# - Modifications Gateway : redémarrage auto avec nodemon  
# - Modifications Translator : redémarrage auto avec uvicorn --reload

# Arrêter avec Ctrl+C dans le terminal start-local.sh
```

### Développement avec Logs
```bash
# Démarrer l'environnement
./scripts/development/start-local.sh

# Dans d'autres terminaux, suivre les logs
tail -f translator/translator.log
tail -f gateway/gateway.log
tail -f frontend/frontend.log
```

## 🔧 Configuration Automatique

Le script `start-local.sh` crée automatiquement tous les fichiers `.env.local` nécessaires :

- `/meeshy/.env.local` (global)
- `/frontend/.env.local` (Next.js)
- `/gateway/.env.local` (Fastify)
- `/translator/.env.local` (FastAPI)

**Tous configurés pour localhost**, pas besoin de configuration manuelle !

## 🐳 Services Docker

Le script utilise `docker-compose.dev.yml` qui démarre uniquement :
- **MongoDB** (port 27017)
- **Redis** (port 6379)

Les services applicatifs sont démarrés nativement pour permettre le hot-reload.

## 🛑 Arrêt Propre avec Ctrl+C

Le script `start-local.sh` gère automatiquement l'arrêt propre :

1. **Ctrl+C détecté** → Signal de nettoyage déclenché
2. **Arrêt des services Node.js/Python** → SIGTERM puis SIGKILL si nécessaire
3. **Arrêt des containers Docker** → `docker-compose down`
4. **Nettoyage des logs** → Suppression des fichiers temporaires
5. **Vérification finale** → Ports libérés

## 📊 Monitoring Intégré

Le script surveille en permanence que tous les services restent actifs :
- Si un service s'arrête → Message d'alerte
- Si tous les services s'arrêtent → Arrêt automatique du script
- Vérification toutes les 5 secondes

## 🔍 Dépannage

### Erreur "Port déjà occupé"
```bash
# Le script vérifie automatiquement et affiche les ports occupés
# Pour forcer l'arrêt des processus existants :
pkill -f "node.*server"
pkill -f "python.*main" 
```

### Services qui ne démarrent pas
```bash
# Vérifier les logs des services
cat translator/translator.log
cat gateway/gateway.log
cat frontend/frontend.log

# Redémarrer seulement l'infrastructure Docker
docker-compose -f docker-compose.dev.yml restart
```

### Variables d'environnement incorrectes
Les fichiers `.env.local` sont recréés à chaque démarrage du script, donc toujours à jour avec la configuration localhost.

## ✨ Avantages

- 🎯 **Un seul script** pour tout démarrer
- 🔧 **Configuration automatique** - pas de setup manuel
- 🛑 **Arrêt propre** avec Ctrl+C - pas de processus orphelins
- 🔄 **Hot reload** sur tous les services
- 📊 **Monitoring intégré** - détection des pannes
- 🧹 **Nettoyage automatique** - pas de pollution du système
