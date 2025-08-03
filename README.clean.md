# Meeshy - Platform de Messagerie Multilingue 🌍

Plateforme de messagerie en temps réel avec traduction automatique intégrée.

## 🚀 Démarrage Rapide

### Prérequis
- Docker et Docker Compose
- Git

### Installation
```bash
git clone <repo-url>
cd meeshy
cp .env.example .env  # Ajustez la configuration si nécessaire
```

### Démarrage avec Docker
```bash
# Démarrer tous les services
./meeshy-docker.sh up

# Voir les logs
./meeshy-docker.sh logs

# Arrêter les services
./meeshy-docker.sh down
```

### Accès aux Services
- **Frontend**: http://localhost:3000
- **API Backend**: http://localhost:3001
- **Service de Traduction**: http://localhost:8000

## 📋 Architecture

### Services
- **Frontend**: Next.js 15 avec React 19
- **Backend**: Fastify avec WebSocket et gRPC
- **Service de Traduction**: Python avec T5/NLLB models
- **Base de données**: PostgreSQL
- **Cache**: Redis

### Technologies Principales
- **Frontend**: Next.js, React, TailwindCSS, Socket.io
- **Backend**: Node.js, Fastify, Prisma, gRPC
- **Traduction**: Python, Transformers, gRPC
- **Containerisation**: Docker, Docker Compose

## 🛠️ Développement

### Scripts Disponibles
```bash
./meeshy-docker.sh help      # Aide
./meeshy-docker.sh build     # Builder les images
./meeshy-docker.sh rebuild   # Rebuild complet
./meeshy-docker.sh status    # Statut des services
./meeshy-docker.sh clean     # Nettoyer les containers
```

### Tests
```bash
# Frontend
npm test
npm run test:watch

# Backend
cd backend/fastify-service
npm test

# Validation configuration
npm run validate:config
```

## 📁 Structure du Projet

```
meeshy/
├── src/                    # Code frontend Next.js
├── backend/
│   ├── fastify-service/    # API backend
│   ├── translation-service/ # Service de traduction
│   └── shared/             # Code partagé
├── public/
│   └── models/             # Modèles de traduction
├── scripts/                # Scripts utilitaires
└── docker-compose.yml      # Configuration Docker
```

## 🔧 Configuration

### Variables d'Environnement
Le fichier `.env` contient toute la configuration nécessaire :
- Ports des services
- URLs d'accès
- Configuration des bases de données
- Paramètres de traduction

### Modèles de Traduction
Les modèles sont téléchargés automatiquement au premier démarrage :
- T5-small (modèle de base)
- NLLB-200-distilled-600M (modèle medium)
- NLLB-200-distilled-1.3B (modèle premium)

## 📚 API Documentation

### Endpoints Principaux
- `GET /health` - Santé du service
- `POST /api/translate` - Traduction de texte
- `WS /ws` - WebSocket pour messages temps réel
- `POST /api/conversations` - Gestion des conversations

### gRPC Services
- TranslationService - Service de traduction
- MessageService - Gestion des messages

## 🐳 Production

Pour un déploiement en production, utilisez les images Docker séparément :

```bash
# Builder les images
docker compose build

# Déployer avec des orchestrateurs
docker run -d meeshy-frontend:latest
docker run -d meeshy-backend:latest
docker run -d meeshy-translation:latest
```

## 🤝 Contribution

1. Fork le projet
2. Créer une branche feature (`git checkout -b feature/AmazingFeature`)
3. Commit les changements (`git commit -m 'Add some AmazingFeature'`)
4. Push vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrir une Pull Request

## 📄 License

Distribué sous la licence MIT. Voir `LICENSE` pour plus d'informations.

## 🆘 Support

Pour toute question ou problème :
1. Vérifiez les logs avec `./meeshy-docker.sh logs`
2. Consultez la documentation dans `/docs`
3. Ouvrez une issue sur GitHub
