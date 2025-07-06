# Copilot Instructions pour Meeshy

<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization #_use-a-githubcopilotinstructionsmd-file -->

## Contexte du Projet

Ce projet est une application de messagerie avec traduction automatique côté client appelée "Meeshy".

### Architecture Générale
- **Frontend**: Next.js 15 avec TypeScript, Tailwind CSS, et shadcn/ui
- **Backend**: NestJS avec WebSockets pour la messagerie temps réel
- **Traduction**: Modèles MT5 et NLLB via TensorFlow.js (côté client uniquement)
- **Cache**: localStorage du navigateur pour les traductions
- **Base de données**: SQLite avec Prisma ORM pour le développement
- **Authentification**: JWT avec NestJS Guards et stratégies Passport
- **Sécurité**: Validation stricte, chiffrement des données sensibles, CORS configuré
- **Routes API**: RESTful nomination pluriel pour les entités avec validation des DTOs via class-validator
### Spécificités Techniques

#### Traduction
- Utiliser MT5 pour les messages courts (≤50 caractères, faible complexité)
- Utiliser NLLB pour les messages longs et complexes
- Cache obligatoire avec clé: `hash(message_original + langue_source + langue_destination)`
- Traduction côté client uniquement, aucune API externe

#### Frontend (Next.js)
- App Router avec structure src/
- TypeScript strict
- Tailwind CSS pour le styling
- shadcn/ui pour les composants
- Gestion d'état avec React hooks
- WebSocket client pour la messagerie temps réel

#### Backend (NestJS)
- **Structure modulaire**: Modules organisés par domaine métier (auth, users, conversations, groups)
- **API REST**: Endpoints sécurisés avec validation class-validator
- **WebSocket Gateway**: Messagerie temps réel avec gestion des rooms
- **Base de données**: Prisma avec SQLite, migrations gérées
- **Authentification**: JWT avec refresh tokens, rate limiting
- **Validation**: DTOs strictement typés avec class-validator/class-transformer
- **Sécurité**: Chiffrement bcrypt, secrets sécurisés, CORS configuré
- **Utilisateurs prédéfinis**: 5 utilisateurs de test avec données seed
- **Gestion des erreurs**: Middleware global pour les erreurs, logging structuré
- **Documentation**: Swagger pour l'API REST
- **Tests**: Tests unitaires et d'intégration avec Jest
- **Notifications**: Système de notifications temps réel avec Sonner
- **Système de présence**: Indicateurs en ligne/hors ligne, indicateurs de frappe, et notifications de lecture

#### Flux de Données
1. Message envoyé dans la langue native de l'utilisateur
2. Transmission directe au serveur sans modification
3. Réception par le destinataire dans la langue originale
4. Traduction côté client selon les paramètres du destinataire
5. Affichage avec option de basculement original/traduit

### Bonnes Pratiques

#### Cohérence de Conception
- **Reflexion avant modification**: Toujours réfléchir aux implications avant de modifier le code
- **Vérification des interfaces**: Toujours vérifier les interfaces et correspondances de types avant de proposer des modifications
- **Cohérence des types**: Toujours vérifier la cohérence des types et données entre  le frontend et le backend
- **Types partagés**: Source unique de vérité pour les interfaces entre frontend/backend
- **Validation complète**: Validation stricte côté client ET serveur
- **Gestion d'erreurs**: Middleware global avec messages utilisateur cohérents
- **UX cohérente**: Interface intuitive, navigation fluide, accessible, simple avec feedback immédiat
- **Performance**: Cache intelligent, lazy loading, optimisation des requêtes

#### Standards Techniques
- **TypeScript strict**: Configuration stricte avec validation complète
- **Architecture modulaire**: Séparation claire des responsabilités
- **Sécurité**: Chiffrement, validation, protection CSRF/XSS
- **Tests**: Validation continue avec tests unitaires et d'intégration
- **Documentation**: Code auto-documenté avec commentaires en français
- **Versioning**: Utilisation de Git avec des commits clairs et descriptifs

#### Développement
- Toujours vérifier les interfaces et correspondances de types avant de proposer des modifications
- Toujours vérifier la cohérence des types et données entre le frontend et le backend
- Toujours valider les inputs côté client et serveur
- Utiliser des types TypeScript stricts
- Implémenter le lazy loading pour les modèles de traduction
- Gérer les erreurs de traduction avec fallback
- Optimiser les performances avec le cache localStorage
- Interface responsive pour mobile et desktop
- Utilise les hooks React pour la logique métier
- Fortement utiliser l'approche SWR (state fetching with revalidation) pour les données dynamiques
- Utiliser des notifications pour les erreurs et succès (Sonner)
- Utiliser des WebSockets pour la messagerie en temps réel
- Commit lorsqu'un travail est terminé ou qu'une fonctionnalité est implémentée
- Commit lorsqu'un long travail va être effectué

### Structure des Dossiers
```
src/
├── app/                 # Pages Next.js (App Router)
├── components/          # Composants React réutilisables
├── lib/                 # Utilitaires et configuration
├── hooks/               # Hooks React personnalisés
├── types/               # Types TypeScript
└── utils/               # Fonctions utilitaires

backend/                 # Application NestJS production-ready
├── src/
│   ├── shared/         # Types unifiés, DTOs validés, constantes
│   ├── common/         # Services transversaux (cache, notifications, health, sécurité)
│   ├── auth/           # Authentification JWT sécurisée avec bcrypt
│   ├── modules/        # Modules métier optimisés (users, conversations, groups, messages)
│   ├── gateway/        # WebSocket Gateway temps réel
│   ├── prisma/         # Service Prisma avec requêtes optimisées
│   └── main.ts         # Bootstrap avec sécurité enterprise (CORS, Helmet, Rate limiting)
├── prisma/             # Schéma et migrations
├── dist/               # Build de production
└── package.json        # Dépendances de sécurité et performance
```

### Règles de Cohérence UX

#### Navigation et Interface
- **Consistance visuelle**: Composants shadcn/ui uniformes, palette couleurs cohérente
- **Navigation intuitive**: Breadcrumbs clairs, état actuel visible, retour facile
- **Feedback utilisateur**: Loading states, confirmations, messages d'erreur explicites
- **Responsivité**: Interface adaptée mobile/desktop avec même logique

#### Gestion des Données
- **État synchronisé**: Cohérence temps réel entre tous les clients connectés
- **Cache intelligent**: Mise à jour optimiste avec rollback en cas d'erreur
- **Offline graceful**: Gestion des états de connexion avec retry automatique

#### Sécurité Utilisateur
- **Données au repos**: Chiffrement transparent avec bcrypt pour les mots de passe
- **Validation stricte**: Input sanitization côté client ET serveur
- **Sessions sécurisées**: JWT avec expiration, refresh tokens, rate limiting

### Conventions de Code
- Utiliser des noms de composants en PascalCase
- Utiliser des noms de fichiers en kebab-case
- Préfixer les hooks personnalisés avec "use"
- Utiliser des interfaces TypeScript pour tous les objets de données
- Commenter les fonctions complexes en français

### Backend Architecture Production-Ready

#### Services Transversaux Optimisés
- **CacheService**: Cache intelligent en mémoire avec TTL, cleanup automatique, statistiques temps réel
- **ConversationServiceOptimized**: Requêtes groupées, cache conversations, réduction 70-90% des DB queries
- **MessageServiceOptimized**: Pagination efficace, cache messages, invalidation intelligente
- **NotificationService**: Système complet avec queue, préférences utilisateur, 9 types de notifications
- **HealthController**: Monitoring production avec 5 endpoints (basic, detailed, ready, live, metrics)
- **CacheCleanupService**: Maintenance automatique programmée toutes les heures

#### Sécurité Enterprise
- **JWT sécurisé**: Tokens avec expiration 1h, secrets configurables via ENV
- **Bcrypt renforcé**: 12 rounds par défaut (configurable), gestion sécurisée des mots de passe
- **Rate limiting**: 100 req/min par défaut (configurable), protection anti-spam
- **CORS strict**: Domaines autorisés configurés pour production et développement
- **Validation globale**: class-validator sur tous les DTOs, pipe de validation strict
- **Exception filter**: Gestion d'erreurs avec logging, protection contre les fuites d'information
- **Helmet**: Headers sécurisés pour protection contre XSS, clickjacking, etc.

#### Performance & Observabilité
- **Cache intelligent**: Réduction drastique des requêtes DB, invalidation automatique
- **Requêtes optimisées**: Remplacement des N+1 queries par des requêtes groupées
- **Monitoring temps réel**: Métriques memory, uptime, cache, database response times
- **Health checks**: Endpoints pour load balancers, Kubernetes probes, monitoring externe
- **Notifications avancées**: Queue avec TTL, limite par utilisateur, nettoyage automatique

#### Endpoints API Production
**Health & Monitoring:**
- `GET /health` - Check basique pour load balancers
- `GET /health/detailed` - Status complet de tous les services
- `GET /health/ready` - Kubernetes readiness probe
- `GET /health/live` - Kubernetes liveness probe
- `GET /health/metrics` - Métriques système (memory, cache, uptime)

**Notifications (authentifiées):**
- `GET /notifications` - Liste des notifications utilisateur
- `DELETE /notifications/:id` - Suppression notification spécifique
- `DELETE /notifications` - Nettoyage complet utilisateur
- `GET/POST /notifications/preferences` - Gestion des préférences
- `POST /notifications/test` - Test notification pour debugging
- `GET /notifications/stats` - Statistiques d'usage notifications

#### Variables d'Environnement Sécurisées
```env
# Sécurité JWT
JWT_SECRET=secret-key-meeshy-production
JWT_EXPIRES_IN=1h
BCRYPT_ROUNDS=12

# Rate Limiting
RATE_LIMIT_TTL=60
RATE_LIMIT_LIMIT=100

# Cache Performance
CACHE_TTL=3600
CACHE_MAX_SIZE=1000
```
