# Meeshy 🚀

**Plateforme de messagerie haute performance avec traduction multilingue en temps réel**

Meeshy est une application de messagerie moderne conçue pour gérer 100 000 messages par seconde avec traduction automatique en temps réel vers plusieurs langues simultanément.

![Architecture](https://img.shields.io/badge/Architecture-Microservices-blue)
![Performance](https://img.shields.io/badge/Performance-100k_msg/sec-green)
![Languages](https://img.shields.io/badge/Languages-8_supported-orange)

## 🎯 Fonctionnalités

### 🔐 Authentification Robuste
- **Gestion centralisée** de l'état d'authentification
- **Sessions anonymes** pour conversations partagées
- **Protection des routes** automatique et configurable
- **Nettoyage sécurisé** des données d'authentification

### 💬 Messagerie Temps Réel
- **WebSocket haute performance** avec Fastify
- **Gestion de 100k connexions simultanées**
- **Messages temps réel** avec indicateurs de frappe
- **Conversations de groupe** avec gestion des rôles

### 🌐 Traduction Automatique Multilingue
- **Traduction instantanée** vers 8 langues (FR, EN, ES, DE, PT, ZH, JA, AR)
- **Modèles ML avancés**: MT5 (basic), NLLB-200 600M (medium), NLLB-200 1.3B (premium)
- **Cache intelligent** avec Redis + base de données persistante
- **Détection automatique de langue** source

### 🏗️ Architecture Distribuée
- **Frontend**: Next.js 15 + TypeScript + Tailwind CSS
- **Gateway**: Fastify + WebSocket (gestion utilisateurs, routage messages)
- **Translator**: FastAPI + Transformers (traduction ML)
- **Base de données**: PostgreSQL + Prisma ORM
- **Cache**: Redis pour performances optimales

### 🚀 Performance & Scalabilité
- **Communication gRPC** entre services avec Protocol Buffers
- **Queue asynchrone** ZMQ/RabbitMQ pour opérations batch
- **Base de données optimisée** avec indexation intelligente
- **Déploiement Docker** avec orchestration Kubernetes

## 🏛️ Architecture Système

```
┌─────────────────┐    WebSocket/HTTP    ┌──────────────────┐
│   Frontend      │◄───────────────────►│    Gateway       │
│   (Next.js)     │                     │   (Fastify)      │
└─────────────────┘                     └──────────────────┘
                                                  │
                                         gRPC + Protobuf
                                                  ▼
┌─────────────────┐                     ┌──────────────────┐
│   PostgreSQL    │◄────────────────────┤   Translator     │
│   + Prisma      │    Shared Database  │   (FastAPI)      │
└─────────────────┘                     └──────────────────┘
                                                  │
┌─────────────────┐                              │
│     Redis       │◄─────────────────────────────┘
│    (Cache)      │         Translation Cache
└─────────────────┘
```

### Responsabilités des Services

#### 🎨 Frontend (Next.js)
- Interface utilisateur moderne et responsive
- Gestion des WebSockets pour temps réel
- Réception des messages dans la langue configurée de l'utilisateur
- Gestion d'état avec React hooks + SWR

#### ⚡ Gateway (Fastify)
- **CRUD complet**: Utilisateurs, conversations, groupes, préférences
- **Messages en lecture seule**: Affichage et routage uniquement
- **WebSocket**: Connexions temps réel et routage intelligent
- **Filtrage linguistique**: Distribution selon les préférences utilisateur

#### 🤖 Translator (FastAPI)
- **CRUD Messages**: Création, modification, suppression des messages
- **Traduction ML**: Modèles MT5 et NLLB-200 via Transformers
- **Cache intelligent**: Système de cache robuste par paire de langues
- **Traduction simultanée**: Vers toutes les langues requises en une fois

## 🌐 Flux de Traduction Multilingue

### Configuration Linguistique Utilisateur
```typescript
interface UserLanguageConfig {
  systemLanguage: string;              // Défaut: "fr"
  regionalLanguage: string;            // Défaut: "fr"
  customDestinationLanguage?: string;  // Optionnel
  autoTranslateEnabled: boolean;       // Défaut: true
  translateToSystemLanguage: boolean;  // Défaut: true
  translateToRegionalLanguage: boolean; // Défaut: false
  useCustomDestination: boolean;       // Défaut: false
}
```

### Exemple de Flux de Traduction
```
1. Utilisateur A envoie "Bonjour" (français) → Gateway (WebSocket)
2. Gateway détermine les langues requises des participants
3. Gateway → Translator (gRPC): Demande de traduction vers toutes les langues
4. Translator traite:
   • Vérifie le cache (MessageTranslation + Redis)
   • Traduit les langues manquantes avec ML
   • Stocke les traductions avec clé de cache
5. Translator → Gateway: Toutes les traductions
6. Gateway diffuse selon les préférences:
   • Utilisateur B (systemLanguage: "en") → reçoit "Hello"
   • Utilisateur C (regionalLanguage: "es") → reçoit "Hola"
   • Utilisateur D (systemLanguage: "fr") → reçoit "Bonjour"
```

## � Démarrage Rapide

### Prérequis
- Node.js 18+ et pnpm
- Python 3.9+ 
- PostgreSQL et Redis (ou Docker)

### Option 1: Développement Local
```bash
# Cloner le projet
git clone https://github.com/sylorion/meeshy.git
cd meeshy

# Lancer en mode développement local
./dev-local.sh
```

### Option 2: Docker (Recommandé)
```bash
# Cloner le projet
git clone https://github.com/sylorion/meeshy.git
cd meeshy

# Lancer avec Docker
./dev-docker.sh start
```

🌐 **Accès à l'application**: http://localhost (via Nginx) ou http://localhost:3100 (direct)

## 📊 Langues Supportées

| Langue | Code | Modèle | Performance |
|--------|------|--------|-------------|
| Français | `fr` | NLLB-200 | Natif |
| Anglais | `en` | NLLB-200 | Excellent |
| Espagnol | `es` | NLLB-200 | Excellent |
| Allemand | `de` | NLLB-200 | Très bon |
| Portugais | `pt` | NLLB-200 | Très bon |
| Chinois | `zh` | NLLB-200 | Bon |
| Japonais | `ja` | NLLB-200 | Bon |
| Arabe | `ar` | NLLB-200 | Bon |

## �️ Développement

### Structure du Projet
```
meeshy/
├── frontend/          # Next.js 15 + TypeScript
├── gateway/           # Fastify + WebSocket
├── translator/        # FastAPI + ML Models
├── shared/            # Prisma Schema + Proto
├── docker/            # Configuration Nginx
├── dev-local.sh       # Script développement local
└── dev-docker.sh      # Script Docker
```

### Scripts Disponibles
```bash
# Développement local
./dev-local.sh

# Docker
./dev-docker.sh start          # Démarrage
./dev-docker.sh start --clean  # Reconstruction complète
./dev-docker.sh logs          # Voir les logs
./dev-docker.sh stop          # Arrêt
./dev-docker.sh health        # Vérification santé
```

## 🔧 Configuration

### Variables d'Environnement
```env
# Base de données
DATABASE_URL=postgresql://user:pass@localhost:5432/meeshy

# Services
TRANSLATOR_HTTP_PORT=8000
TRANSLATOR_GRPC_PORT=50051
GATEWAY_PORT=3000
FRONTEND_PORT=3100

# Langues
SUPPORTED_LANGUAGES=fr,en,es,de,pt,zh,ja,ar
DEFAULT_LANGUAGE=fr
```

## 📈 Performance & Métriques

### Objectifs de Performance
- **Débit messages**: 100 000 messages/seconde
- **Latence traduction**: <50ms bout en bout
- **Cache hit ratio**: >80% sur les traductions
- **Requêtes DB**: <10ms temps moyen
- **Connexions WebSocket**: 100k simultanées

### Monitoring
- Logs structurés avec niveau de détail configurable
- Métriques de performance en temps réel
- Health checks pour tous les services
- Alertes sur seuils de performance

## 🚀 Déploiement Production

### Docker Compose (Simple)
```bash
./dev-docker.sh start
```

### Kubernetes (Scalable)
```bash
# À venir - Configuration Kubernetes pour production
kubectl apply -f k8s/
```

## 🤝 Contribution

1. Fork du projet
2. Créer une branche feature (`git checkout -b feature/AmazingFeature`)
3. Commit des changements (`git commit -m 'Add AmazingFeature'`)
4. Push vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrir une Pull Request

## 📄 Licence

Ce projet est sous licence MIT. Voir le fichier [LICENSE](LICENSE) pour plus de détails.

## 🙏 Remerciements

- [Fastify](https://www.fastify.io/) pour les performances WebSocket
- [Next.js](https://nextjs.org/) pour l'interface utilisateur
- [Prisma](https://www.prisma.io/) pour l'ORM moderne
- [Transformers](https://huggingface.co/transformers/) pour les modèles ML
- [NLLB-200](https://ai.facebook.com/research/no-language-left-behind/) pour la traduction multilingue

---

**Meeshy** - Connecter le monde, une traduction à la fois 🌍✨
