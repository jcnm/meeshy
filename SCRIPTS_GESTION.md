# 🛠️ Scripts de Gestion Meeshy

Ce dossier contient des scripts améliorés pour gérer les processus Meeshy de manière plus robuste.

## 📝 Scripts Disponibles

### 🚀 Démarrage des Services

#### `./start-all.sh` 
Lance tous les services Meeshy (Translator + Gateway + Frontend)
- **Ports utilisés** : 8000 (Translator), 3000 (Gateway), 3100 (Frontend)
- **Arrêt** : `Ctrl+C` pour arrêter tous les services proprement
- **Fonctionnalités** :
  - Démarrage séquentiel avec vérifications
  - Nettoyage automatique des processus à l'arrêt
  - Monitoring des services en cours

#### `./start_meeshy_services.sh`
Lance uniquement les services backend (Translator + Gateway)
- **Ports utilisés** : 8000 (Translator), 3000 (Gateway)
- **Arrêt** : `Ctrl+C` pour arrêter les services proprement

### 🔍 Monitoring et Diagnostic

#### `./check-meeshy.sh`
Vérifie l'état de tous les processus et ports Meeshy
- Affiche les processus en cours avec leurs PIDs
- Vérifie l'occupation des ports
- Résumé de l'état global des services
- Suggestions de commandes utiles

```bash
# Exemple d'utilisation
./check-meeshy.sh
```

### 🛑 Nettoyage des Processus

#### `./kill-all-meeshy.sh`
Arrête tous les processus Meeshy de manière agressive
- Tue tous les processus Node.js/TSX du Gateway
- Tue tous les processus Python du Translator  
- Tue tous les processus Next.js du Frontend
- Libère tous les ports utilisés par Meeshy
- Vérification finale de l'état

```bash
# Exemple d'utilisation
./kill-all-meeshy.sh
```

## ⚡ Améliorations Apportées

### 🔧 Gestion des Processus Améliorée

Les scripts ont été améliorés pour :

1. **Nettoyage Complet** : Élimination de tous les processus enfants et sous-processus
2. **Patterns Spécifiques** : Ciblage précis des processus Meeshy pour éviter de tuer d'autres applications
3. **Gestion des Ports** : Libération forcée des ports utilisés
4. **Signaux Appropriés** : Utilisation de SIGTERM puis SIGKILL si nécessaire

### 🎯 Processus Ciblés

Les scripts nettoient spécifiquement :

#### Frontend (Next.js)
- `next dev.*turbopack`
- `next-server`
- `meeshy-frontend`
- `frontend.sh`

#### Gateway (Fastify/Node.js)
- `tsx.*watch.*src/server.ts`
- `node.*tsx.*gateway`
- `fastify.*gateway`
- `gateway.sh`
- `pnpm run dev.*gateway`

#### Translator (Python/FastAPI)
- `start_service.py`
- `uvicorn.*translator`
- `python.*translator`
- `translator.sh`

#### Scripts de Démarrage
- `start-all.sh`
- `start_meeshy_services.sh`
- Tous les scripts `.sh` de services

### 🌐 Ports Surveillés
- **3000** : Gateway (Fastify)
- **3100** : Frontend (Next.js)
- **8000** : Translator (FastAPI)
- **5555** : ZMQ PUB (Gateway → Translator)
- **5558** : ZMQ PULL (Translator → Gateway)

## 🚦 Workflow Recommandé

### Démarrage Normal
```bash
# Vérifier l'état initial
./check-meeshy.sh

# Démarrer tous les services
./start-all.sh

# En cas de problème, nettoyer et redémarrer
./kill-all-meeshy.sh
./start-all.sh
```

### Développement Backend Seul
```bash
# Démarrer uniquement Translator + Gateway
./start_meeshy_services.sh

# Frontend séparément si nécessaire
cd frontend && ./frontend.sh
```

### Nettoyage Forcé
```bash
# Si des processus traînent après Ctrl+C
./kill-all-meeshy.sh

# Vérification finale
./check-meeshy.sh
```

## 🔧 Dépannage

### Processus qui ne s'arrêtent pas
```bash
# Identifier les processus récalcitrants
ps aux | grep -E "(tsx|start_service|next)" | grep -v grep

# Forcer l'arrêt
./kill-all-meeshy.sh

# Vérification
./check-meeshy.sh
```

### Ports déjà utilisés
```bash
# Voir qui utilise un port spécifique
lsof -i:3000  # Remplacer 3000 par le port voulu

# Libérer un port spécifique
lsof -ti:3000 | xargs kill -9
```

### Problèmes de permissions
```bash
# S'assurer que les scripts sont exécutables
chmod +x *.sh
```

## 📊 Logs et Monitoring

Les scripts affichent :
- ✅ **Succès** en vert
- ❌ **Erreurs** en rouge  
- ⚠️ **Avertissements** en jaune
- 💡 **Informations** en bleu/cyan

Utilisez `./check-meeshy.sh` régulièrement pour surveiller l'état des services.
