# Scripts Meeshy - Documentation

Ce répertoire contient tous les scripts automatisés pour le développement, les tests et le déploiement de Meeshy.

## 📁 Structure des répertoires

```
scripts/
├── README.md                           # Cette documentation
├── build-and-test-applications.sh      # Script principal d'orchestration
├── deployment/
│   └── build-and-push-docker-images.sh # Build et publication Docker
├── tests/
│   ├── run-unit-tests.sh               # Tests unitaires
│   ├── run-integration-tests.sh        # Tests d'intégration
│   └── integration/                    # Tests d'intégration spécifiques
│       ├── test-grpc-communication.sh
│       ├── test-zmq-communication.sh
│       └── test-translation-flow.sh
└── utils/
    └── version-manager.sh              # Gestionnaire de versions
```

## 🚀 Scripts principaux

### `build-and-test-applications.sh`
Script principal qui orchestre tout le pipeline de développement avec gestion automatique des versions.

**Usage :**
```bash
# Pipeline complet avec incrémentation automatique
./scripts/build-and-test-applications.sh

# Ignorer les tests unitaires
./scripts/build-and-test-applications.sh --skip-unit-tests

# Ignorer les tests d'intégration
./scripts/build-and-test-applications.sh --skip-integration-tests

# Ignorer le build Docker
./scripts/build-and-test-applications.sh --skip-build

# Incrémenter la version mineure
./scripts/build-and-test-applications.sh --auto-increment minor

# Utiliser une version spécifique
./scripts/build-and-test-applications.sh --version 1.0.0-alpha
```

**Phases du pipeline :**
1. **Gestion des versions** : Incrémentation automatique ou version spécifique
2. **Tests unitaires** : Tests de chaque service individuellement
3. **Tests d'intégration** : Tests entre services
4. **Build et publication** : Construction et publication des images Docker

### `utils/version-manager.sh`
Gestionnaire automatique des versions avec mise à jour de tous les fichiers de configuration.

**Usage :**
```bash
# Afficher la version actuelle
./scripts/utils/version-manager.sh current

# Incrémenter la version patch
./scripts/utils/version-manager.sh auto-increment patch

# Incrémenter la version mineure
./scripts/utils/version-manager.sh auto-increment minor

# Incrémenter la version majeure
./scripts/utils/version-manager.sh auto-increment major

# Define a specific version
./scripts/utils/version-manager.sh update 1.0.0-alpha
```

**Fichiers mis à jour automatiquement :**
- `frontend/package.json`
- `gateway/package.json`
- `docker-compose.yml`
- `docker-compose.unified.yml`
- `README.md`
- `.version`

## 🧪 Tests

### Tests unitaires (`tests/run-unit-tests.sh`)
Exécute les tests unitaires pour tous les services avec gestion des dépendances :

- **Frontend** : Tests Jest pour Next.js 15 + React 19
- **Gateway** : Tests Jest pour Fastify 5.1 + WebSocket
- **Translator** : Tests pytest pour FastAPI + PyTorch
- **Shared** : Validation du schéma Prisma 6.13

**Fonctionnalités :**
- Installation automatique des dépendances
- Gestion des environnements virtuels Python
- Rapports de couverture de code
- Logs détaillés dans `test-results/`

### Tests d'intégration (`tests/run-integration-tests.sh`)
Exécute les tests d'intégration entre services avec orchestration Docker :

- **Gateway-Translator** : Communication gRPC et ZeroMQ
- **Frontend-Gateway** : Authentification JWT et WebSocket
- **Complet** : Flux de traduction end-to-end

**Fonctionnalités :**
- Démarrage automatique des services Docker
- Attente intelligente des services
- Tests de connectivité et de communication
- Nettoyage automatique des conteneurs

## 🐳 Build et déploiement

### Build Docker (`deployment/build-and-push-docker-images.sh`)
Construit et publie toutes les images Docker avec support multi-plateforme :

- `isopen/meeshy-translator:VERSION`
- `isopen/meeshy-gateway:VERSION`
- `isopen/meeshy-frontend:VERSION`
- `isopen/meeshy:VERSION`

**Fonctionnalités :**
- Support multi-plateforme (linux/amd64, linux/arm64)
- Utilisation de Docker Buildx
- Publication automatique vers le registry
- Gestion automatique des versions

## 🔧 Utilisation quotidienne

### Développement
```bash
# Tests unitaires uniquement
./scripts/tests/run-unit-tests.sh

# Tests d'intégration uniquement
./scripts/tests/run-integration-tests.sh

# Gestion des versions
./scripts/utils/version-manager.sh auto-increment patch
```

### Préparation d'une release
```bash
# Pipeline complet avec incrémentation mineure
./scripts/build-and-test-applications.sh --auto-increment minor

# Pipeline avec version spécifique
./scripts/build-and-test-applications.sh --version 1.0.0-alpha
```

### Debug et maintenance
```bash
# Vérifier la version actuelle
./scripts/utils/version-manager.sh current

# Réinitialiser la version
./scripts/utils/version-manager.sh update 0.5.1-alpha
```

## 📋 Configuration

### Variables d'environnement
Les scripts utilisent les variables d'environnement suivantes :
- `REGISTRY` : Registry Docker (défaut: `isopen`)
- `PLATFORMS` : Plateformes de build (défaut: `linux/amd64,linux/arm64`)
- `VERSION` : Version actuelle (gérée automatiquement)

### Fichiers de configuration
- `.version` : Version actuelle du projet
- `test-results/` : Résultats des tests
- `coverage/` : Rapports de couverture de code

## 🚨 Dépannage

### Problèmes courants

**Docker daemon non démarré :**
```bash
# Démarrer Docker Desktop ou le daemon
sudo systemctl start docker  # Linux
# ou lancer Docker Desktop sur macOS/Windows
```

**Tests qui échouent :**
```bash
# Vérifier les logs
cat test-results/*.log

# Relancer les tests avec plus de verbosité
./scripts/tests/run-unit-tests.sh
```

**Problèmes de version :**
```bash
# Réinitialiser la version
./scripts/utils/version-manager.sh update 0.5.1-alpha

# Vérifier les fichiers mis à jour
git diff
```

**Problèmes de build :**
```bash
# Vérifier que buildx est disponible
docker buildx version

# Créer un nouveau builder si nécessaire
docker buildx create --name meeshy-builder --use
```

## 📈 Améliorations futures

- [ ] Tests de performance automatisés
- [ ] Intégration avec GitHub Actions
- [ ] Tests de sécurité automatisés
- [ ] Déploiement automatique en staging/production
- [ ] Monitoring et alertes
- [ ] Documentation automatique des APIs
- [ ] Tests de charge avec Artillery ou k6
- [ ] Intégration continue avec validation des modèles ML

## 🤝 Contribution

Pour ajouter de nouveaux scripts :
1. Créer le script dans le répertoire approprié
2. Le rendre exécutable : `chmod +x script.sh`
3. Mettre à jour cette documentation
4. Tester le script
5. Commiter et pousser les changements

### Standards de qualité
- Utiliser les couleurs pour les messages (RED, GREEN, YELLOW, BLUE, NC)
- Gérer les erreurs avec `set -e`
- Documenter les paramètres et options
- Tester sur différents environnements
- Suivre les conventions de nommage
