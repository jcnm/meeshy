# Copilot Instructions pour Meeshy

<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

## Contexte du Projet

Ce projet est une application de messagerie avec traduction automatique côté client appelée "Meeshy".

### Architecture
- **Frontend**: Next.js 15 avec TypeScript, Tailwind CSS, et shadcn/ui
- **Backend**: NestJS avec WebSockets pour la messagerie temps réel
- **Traduction**: Modèles MT5 et NLLB via TensorFlow.js (côté client uniquement)
- **Cache**: localStorage du navigateur pour les traductions
- **Base de données**: En mémoire pour le développement

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
- API REST pour la gestion des utilisateurs et paramètres
- WebSocket Gateway pour la messagerie
- Utilisateurs prédéfinis en mémoire (4-7 utilisateurs)
- Pas de base de données externe, usage de sqlite pour le développement

#### Flux de Données
1. Message envoyé dans la langue native de l'utilisateur
2. Transmission directe au serveur sans modification
3. Réception par le destinataire dans la langue originale
4. Traduction côté client selon les paramètres du destinataire
5. Affichage avec option de basculement original/traduit

### Bonnes Pratiques
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

backend/                 # Application NestJS séparée
├── src/
│   ├── modules/         # Modules NestJS
│   ├── gateway/         # WebSocket Gateway
│   └── types/           # Types partagés
└── package.json
```

### Conventions de Code
- Utiliser des noms de composants en PascalCase
- Utiliser des noms de fichiers en kebab-case
- Préfixer les hooks personnalisés avec "use"
- Utiliser des interfaces TypeScript pour tous les objets de données
- Commenter les fonctions complexes en français
