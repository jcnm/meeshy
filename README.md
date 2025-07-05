# Meeshy - Messagerie avec Traduction Automatique Côté Client

Meeshy est une application de messagerie innovante qui permet aux utilisateurs de communiquer dans leurs langues natives respectives grâce à un système de traduction automatique côté client.

## 🌟 Fonctionnalités Principales

- **Traduction côté client uniquement** - Aucune dépendance aux API externes
- **Modèles de traduction edge** - MT5 et NLLB via TensorFlow.js
- **Cache intelligent** - Stockage local des traductions pour une performance optimale
- **Messagerie temps réel** - WebSocket pour une communication instantanée
- **Interface moderne** - UI responsive avec shadcn/ui et Tailwind CSS

## 🏗️ Architecture

### Frontend (Next.js 15)
- **Framework** : Next.js 15 avec App Router
- **Styling** : Tailwind CSS + shadcn/ui
- **State Management** : React hooks personnalisés
- **WebSocket Client** : Socket.io-client
- **Traduction** : TensorFlow.js (MT5 + NLLB)

### Backend (NestJS)
- **Framework** : NestJS avec TypeScript
- **WebSocket** : Socket.io pour la messagerie temps réel
- **API REST** : Gestion des utilisateurs et paramètres
- **Base de données** : En mémoire (pour le développement)

## 🚀 Installation et Démarrage

### Prérequis
- Node.js 18+ 
- npm ou yarn

### 1. Cloner le repository
```bash
git clone <repository-url>
cd meeshy
```

### 2. Installer les dépendances du frontend
```bash
npm install
```

### 3. Installer les dépendances du backend
```bash
cd backend
npm install
cd ..
```

### 4. Démarrer le backend
```bash
cd backend
npm run start:dev
```

Le backend sera disponible sur http://localhost:3001

### 5. Démarrer le frontend
```bash
# Dans un nouveau terminal, depuis la racine du projet
npm run dev
```

Le frontend sera disponible sur http://localhost:3000

## 🎯 Utilisation

1. **Sélection d'utilisateur** : Choisissez un utilisateur prédéfini depuis l'écran d'accueil
2. **Interface de chat** : Discutez avec d'autres utilisateurs en temps réel
3. **Traduction automatique** : Les messages sont automatiquement traduits selon vos paramètres
4. **Basculement original/traduit** : Cliquez sur l'icône de traduction pour voir le message original

## 👥 Utilisateurs Prédéfinis

- **Alice** (Français) - Traduction vers la langue système
- **Bob** (Anglais/Russe) - Traduction vers la langue régionale
- **Carlos** (Espagnol) - Traduction personnalisée vers l'anglais
- **Diana** (Allemand) - Traduction désactivée
- **Erik** (Suédois) - Traduction vers la langue système

## 🔧 Configuration de la Traduction

### Paramètres par utilisateur
- **Langue système** : Langue de l'interface
- **Langue régionale** : Langue native de l'utilisateur
- **Langue de destination personnalisée** : Langue spécifique pour certains contacts
- **Mode de traduction automatique** : Activé/Désactivé

### Logique de sélection du modèle
```
Si (longueur_message <= 50 caractères ET complexité_syntaxique == faible)
    Utiliser MT5
Sinon
    Utiliser NLLB
```

## 🗂️ Structure du Projet

```
meeshy/
├── src/
│   ├── app/                 # Pages Next.js (App Router)
│   ├── components/          # Composants React
│   ├── hooks/               # Hooks React personnalisés
│   ├── lib/                 # Utilitaires et services
│   ├── types/               # Types TypeScript
│   └── utils/               # Fonctions utilitaires
├── backend/
│   └── src/
│       ├── gateway/         # WebSocket Gateway
│       ├── modules/         # Modules NestJS
│       └── types/           # Types partagés
└── public/                  # Assets statiques
```

## 📦 Technologies Utilisées

### Frontend
- Next.js 15
- TypeScript
- Tailwind CSS
- shadcn/ui
- Socket.io-client
- TensorFlow.js
- Sonner (notifications)

### Backend
- NestJS
- TypeScript
- Socket.io
- Reflect-metadata
- Class-validator

## 🔄 Flux de Traduction

1. **Envoi** : Message envoyé dans la langue native
2. **Transmission** : Message transmis tel quel au serveur
3. **Réception** : Destinataire reçoit le message original
4. **Traduction** : Traduction côté client selon les paramètres
5. **Affichage** : Possibilité de basculer entre original et traduit

## 🚀 Développement

### Scripts disponibles

#### Frontend
```bash
npm run dev          # Démarrer en mode développement
npm run build        # Construire pour la production
npm run start        # Démarrer en mode production
npm run lint         # Vérifier le code avec ESLint
```

#### Backend
```bash
npm run start:dev    # Démarrer en mode développement avec hot-reload
npm run build        # Construire le projet TypeScript
npm run start        # Démarrer en mode production
```

## 🎨 Personnalisation

### Ajouter de nouvelles langues
Modifiez le fichier `src/types/index.ts` :

```typescript
export const SUPPORTED_LANGUAGES: LanguageCode[] = [
  { code: 'xx', name: 'Nouvelle Langue', flag: '🏳️' },
  // ...
];
```

### Modifier les utilisateurs prédéfinis
Éditez `backend/src/modules/user.service.ts` dans la méthode `initializeUsers()`.

## 🤝 Contribution

1. Fork le projet
2. Créez votre branche feature (`git checkout -b feature/nouvelle-fonctionnalite`)
3. Committez vos changements (`git commit -m 'Ajouter nouvelle fonctionnalité'`)
4. Push vers la branche (`git push origin feature/nouvelle-fonctionnalite`)
5. Ouvrez une Pull Request

## 📝 TODO

- [ ] Implémenter les vrais modèles MT5 et NLLB
- [ ] Ajouter le dialogue des paramètres utilisateur
- [ ] Système de persistance des données
- [ ] Tests unitaires et d'intégration
- [ ] Support des fichiers média
- [ ] Notifications push
- [ ] Mode hors ligne

## 📄 Licence

Ce projet est sous licence MIT. Voir le fichier `LICENSE` pour plus de détails.

## 📞 Support

Pour toute question ou problème, ouvrez une issue sur GitHub ou contactez l'équipe de développement.
