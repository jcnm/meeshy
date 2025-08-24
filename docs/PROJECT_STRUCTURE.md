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
├── PROJECT_STRUCTURE.md         # This file
├── TRANSLATION_LOADING_FIX.md   # Translation fix documentation
├── WORKER_CONFIGURATION.md      # Worker configuration
├── package.json.bak             # Package.json backup
├── assets/                      # Documentation assets
│   ├── auth_loading.png
│   ├── chat_loading.png
│   ├── login.png
│   ├── login_modal.png
│   ├── session_token_error.png
│   ├── shared_conversation.png
│   ├── user_dashboard.png
│   └── Logo-LinkedIn.svg
└── screenshots/                 # Screenshots
```

### 📁 `/scripts/` - Utility scripts
```
scripts/
├── README.md                    # Scripts documentation
├── build-and-test-applications.sh  # Build and test applications
├── start-all.sh                 # Start all services
├── deployment/                  # Deployment scripts
├── development/                 # Development scripts
│   ├── check-types-consistency.js
│   ├── start-frontend-dev.sh
│   └── update-user-language-preferences.js
├── maintenance/                 # Maintenance scripts
│   ├── debug-maintenance.sh
│   ├── diagnostic.sh
│   ├── diagnostic-separated.sh
│   ├── kill-all-meeshy.sh
│   ├── rebuild-translator-network.sh
│   ├── rebuild-translator.sh
│   ├── restart-translator.sh
│   └── test-maintenance-active.sh
├── tests/                       # Test scripts
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
└── utils/                       # Utilities
```

### 📁 `/docker/` - Docker Configuration
```
docker/
├── scripts/                     # Docker scripts
│   ├── docker-start-unified.sh
│   └── run-unified-with-logs.sh
├── nginx/                       # Nginx configuration
├── supervisor/                  # Supervisor configuration
├── elasticsearch/               # Elasticsearch configuration
└── logstash/                    # Logstash configuration
```

### 📁 `/shared/` - Shared code
```
shared/
├── .version                     # Project version
├── schema.prisma                # Database schema
├── version.txt                  # Shared version
├── prisma/                      # Generated Prisma client
├── proto/                       # Protocol Buffer files
├── types/                       # Shared TypeScript types
└── scripts/                     # Shared scripts
```

## Files removed during cleanup

### 🗑️ Removed directories
- `coverage/` - Test coverage reports
- `logs/` - Log files (automatically regenerated)
- `assets/` - Moved to `docs/assets/`

### 🗑️ Removed files
- `.DS_Store` - macOS system files
- `*.log` - Log files
- `*.tmp` - Temporary files
- `*.pyc` - Compiled Python files
- `__pycache__/` - Python cache
- `.pytest_cache/` - Pytest cache

## Script organization

### 🔧 Development scripts (`/scripts/development/`)
- Scripts for local development
- Type checking tools
- User configuration scripts

### 🧪 Test scripts (`/scripts/tests/`)
- API and integration tests
- Translation tests
- Maintenance tests
- Configuration tests

### 🔧 Maintenance scripts (`/scripts/maintenance/`)
- Diagnostic scripts
- Restart scripts
- Rebuild scripts
- Cleanup scripts

### 🚀 Deployment scripts (`/scripts/deployment/`)
- Deployment scripts
- Environment configuration scripts

## Best practices

### 📝 Documentation
- All new features must be documented in `/docs/`
- Screenshots go in `/docs/assets/`
- Diagrams and schemas in `/docs/screenshots/`

### 🔧 Scripts
- New scripts must be placed in the correct subfolder
- Each script must have a descriptive comment
- Test scripts must be in `/scripts/tests/`

### 🧹 Cleanup
- Regularly remove temporary files
- Don't commit logs or cache files
- Maintain a clear and organized structure

## Maintenance

### 🔄 Regular cleanup
```bash
# Remove temporary files
find . -name "*.log" -delete
find . -name "*.tmp" -delete
find . -name ".DS_Store" -delete
find . -name "*.pyc" -delete
find . -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true
find . -name ".pytest_cache" -type d -exec rm -rf {} + 2>/dev/null || true
```

### 📊 Structure verification
```bash
# Check project structure
tree -I 'node_modules|.git|__pycache__|*.pyc|*.log|*.tmp|.DS_Store'
```

This organization ensures a clear, maintainable and scalable structure for the Meeshy project.
