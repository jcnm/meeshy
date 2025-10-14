# Quick Start Guide - Meeshy Local Development

## 🎯 Démarrage en 3 Étapes

### 1️⃣ Télécharger les dernières images

```bash
./start-dev.sh pull
```

### 2️⃣ Démarrer tous les services

```bash
./start-dev.sh
```

### 3️⃣ Ouvrir l'application

Ouvrez votre navigateur sur **http://localhost:3100**

---

## ✨ Toutes les Commandes

```bash
./start-dev.sh          # Démarrer
./start-dev.sh stop     # Arrêter
./start-dev.sh restart  # Redémarrer
./start-dev.sh logs     # Voir les logs
./start-dev.sh status   # Voir le statut
./start-dev.sh pull     # Mettre à jour les images
./start-dev.sh clean    # Tout supprimer
./start-dev.sh reset    # Reset DB
./start-dev.sh help     # Aide complète
```

## 🔐 Connexion

| Email | Mot de passe | Langue |
|-------|--------------|--------|
| admin@meeshy.local | admin123 | 🇫🇷 Français |
| meeshy@meeshy.local | meeshy123 | 🇬🇧 Anglais |
| atabeth@meeshy.local | atabeth123 | 🇪🇸 Espagnol |

## 🌐 Services Disponibles

- 🎨 **Frontend**: http://localhost:3100
- 🚪 **Gateway**: http://localhost:3000
- 🤖 **Translator**: http://localhost:8000
- 🗄️ **MongoDB UI**: http://localhost:3001
- 💾 **Redis UI**: http://localhost:7843

---

Pour plus de détails, consultez [DEPLOYMENT_LOCAL_DOCKER.md](./DEPLOYMENT_LOCAL_DOCKER.md)
