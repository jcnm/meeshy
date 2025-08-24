# Structure du Projet Meeshy

## Vue d'ensemble

Ce document décrit l'organisation et la structure du projet Meeshy après le nettoyage et la réorganisation.

## Structure des dossiers

### 📁 Racine du projet
```
meeshy/
├── README.md                    # Documentation principale
├── PROJECT_OVERVIEW.md          # Vue d'ensemble du projet
├── CHANGELOG.md                 # Historique des changements
├── CONTRIBUTORS.md              # Liste des contributeurs
├── CODE_OF_CONDUCT.md           # Code de conduite
├── CONTRIBUTING.md              # Guide de contribution
├── SECURITY.md                  # Politique de sécurité
├── SUPPORT.md                   # Guide de support
├── LICENSE                      # Licence du projet
├── .cursorrules                 # Configuration Cursor IDE
├── .gitignore                   # Fichiers ignorés par Git
├── .dockerignore                # Fichiers ignorés par Docker
├── .eslintrc.json               # Configuration ESLint
├── eslint.config.mjs            # Configuration ESLint moderne
├── components.json              # Configuration des composants
├── next.config.ts               # Configuration Next.js
├── next-env.d.ts                # Types Next.js
├── postcss.config.mjs           # Configuration PostCSS
├── tsconfig.json                # Configuration TypeScript
├── package.json                 # Dépendances Node.js
├── pnpm-lock.yaml               # Lock file pnpm
├── env.example                  # Variables d'environnement d'exemple
├── Dockerfile                   # Image Docker principale
├── Dockerfile.unified           # Image Docker unifiée
├── docker-compose.yml           # Configuration Docker Compose
├── docker-compose.unified.yml   # Configuration Docker Compose unifiée
├── .github/                     # Configuration GitHub
├── .vscode/                     # Configuration VS Code
├── node_modules/                # Dépendances Node.js
├── frontend/                    # Application Next.js
├── gateway/                     # Service Fastify
├── translator/                  # Service Python FastAPI
├── shared/                      # Code partagé
├── docker/                      # Configuration Docker
├── docs/                        # Documentation
└── scripts/                     # Scripts utilitaires
```

### 📁 `/docs/` - Documentation
```
docs/
├── PROJECT_STRUCTURE.md         # Ce fichier
├── TRANSLATION_LOADING_FIX.md   # Documentation du fix de traduction
├── WORKER_CONFIGURATION.md      # Configuration des workers
├── package.json.bak             # Sauvegarde package.json
├── assets/                      # Assets de documentation
│   ├── auth_loading.png
│   ├── chat_loading.png
│   ├── login.png
│   ├── login_modal.png
│   ├── session_token_error.png
│   ├── shared_conversation.png
│   ├── user_dashboard.png
│   └── Logo-LinkedIn.svg
└── screenshots/                 # Captures d'écran
```

### 📁 `/scripts/` - Scripts utilitaires
```
scripts/
├── README.md                    # Documentation des scripts
├── build-and-test-applications.sh  # Build et test des applications
├── start-all.sh                 # Démarrage de tous les services
├── deployment/                  # Scripts de déploiement
├── development/                 # Scripts de développement
│   ├── check-types-consistency.js
│   ├── start-frontend-dev.sh
│   └── update-user-language-preferences.js
├── maintenance/                 # Scripts de maintenance
│   ├── debug-maintenance.sh
│   ├── diagnostic.sh
│   ├── diagnostic-separated.sh
│   ├── kill-all-meeshy.sh
│   ├── rebuild-translator-network.sh
│   ├── rebuild-translator.sh
│   ├── restart-translator.sh
│   └── test-maintenance-active.sh
├── tests/                       # Scripts de test
│   ├── test-admin-access.js
│   ├── test-anonymous-participants.js
│   ├── test-api-translations.js
│   ├── test-final-translations.js
│   ├── test-frontend-translations.js
│   ├── test-offline-status.sh
│   ├── test-separated-containers.sh
│   ├── test-translation-issue.js
│   ├── test-translation-loading.js
│   ├── test-translation-optimization.js
│   ├── test-translation-request.js
│   ├── test-translation-service.sh
│   └── test-worker-config.sh
└── utils/                       # Utilitaires
```

### 📁 `/docker/` - Configuration Docker
```
docker/
├── scripts/                     # Scripts Docker
│   ├── docker-start-unified.sh
│   └── run-unified-with-logs.sh
├── nginx/                       # Configuration Nginx
├── supervisor/                  # Configuration Supervisor
├── elasticsearch/               # Configuration Elasticsearch
└── logstash/                    # Configuration Logstash
```

### 📁 `/shared/` - Code partagé
```
shared/
├── .version                     # Version du projet
├── schema.prisma                # Schéma de base de données
├── version.txt                  # Version partagée
├── prisma/                      # Client Prisma généré
├── proto/                       # Fichiers Protocol Buffers
├── types/                       # Types TypeScript partagés
└── scripts/                     # Scripts partagés
```

## Fichiers supprimés lors du nettoyage

### 🗑️ Dossiers supprimés
- `coverage/` - Rapports de couverture de tests
- `logs/` - Fichiers de logs (régénérés automatiquement)
- `assets/` - Déplacé vers `docs/assets/`

### 🗑️ Fichiers supprimés
- `.DS_Store` - Fichiers système macOS
- `*.log` - Fichiers de logs
- `*.tmp` - Fichiers temporaires
- `*.pyc` - Fichiers Python compilés
- `__pycache__/` - Cache Python
- `.pytest_cache/` - Cache pytest

## Organisation des scripts

### 🔧 Scripts de développement (`/scripts/development/`)
- Scripts pour le développement local
- Outils de vérification de types
- Scripts de configuration utilisateur

### 🧪 Scripts de test (`/scripts/tests/`)
- Tests d'API et d'intégration
- Tests de traduction
- Tests de maintenance
- Tests de configuration

### 🔧 Scripts de maintenance (`/scripts/maintenance/`)
- Scripts de diagnostic
- Scripts de redémarrage
- Scripts de reconstruction
- Scripts de nettoyage

### 🚀 Scripts de déploiement (`/scripts/deployment/`)
- Scripts de déploiement
- Scripts de configuration d'environnement

## Bonnes pratiques

### 📝 Documentation
- Toute nouvelle fonctionnalité doit être documentée dans `/docs/`
- Les captures d'écran vont dans `/docs/assets/`
- Les diagrammes et schémas dans `/docs/screenshots/`

### 🔧 Scripts
- Les nouveaux scripts doivent être placés dans le bon sous-dossier
- Chaque script doit avoir un commentaire descriptif
- Les scripts de test doivent être dans `/scripts/tests/`

### 🧹 Nettoyage
- Supprimer régulièrement les fichiers temporaires
- Ne pas commiter les logs ou fichiers de cache
- Maintenir une structure claire et organisée

## Maintenance

### 🔄 Nettoyage régulier
```bash
# Supprimer les fichiers temporaires
find . -name "*.log" -delete
find . -name "*.tmp" -delete
find . -name ".DS_Store" -delete
find . -name "*.pyc" -delete
find . -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true
find . -name ".pytest_cache" -type d -exec rm -rf {} + 2>/dev/null || true
```

### 📊 Vérification de la structure
```bash
# Vérifier la structure du projet
tree -I 'node_modules|.git|__pycache__|*.pyc|*.log|*.tmp|.DS_Store'
```

Cette organisation garantit une structure claire, maintenable et évolutive pour le projet Meeshy.
