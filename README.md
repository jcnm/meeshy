# Meeshy - Messagerie avec Traduction Automatique Côté Client

Meeshy est une application de messagerie innovante qui permet aux utilisateurs de communiquer dans leurs langues natives respectives grâce à un système de traduction automatique côté client.

## ✅ Statut du Développement

### Fonctionnalités Implémentées
- ✅ **Authentification complète** - Registration, login, JWT auth
- ✅ **Base de données** - Prisma + SQLite avec modèles complets
- ✅ **Conversations et groupes** - Création, gestion, participation
- ✅ **Liens de conversation** - Génération, partage, jointure avec validation
- ✅ **Interface utilisateur** - Landing, dashboard, chat, auth forms
- ✅ **WebSocket intégration** - Chat temps réel, typing indicators, online presence
- ✅ **Système de traduction** - Hooks et services prêts (MT5/NLLB)
- ✅ **Notifications** - Système de notifications temps réel intégré
- ✅ **Interface responsive** - Optimisée mobile et desktop
- ✅ **Modals de création** - Conversation et liens avec sélection participants
- ✅ **Navigation mobile** - Pages séparées avec bouton retour
- ✅ **Actions rapides dashboard** - Boutons d'accès direct aux fonctionnalités

### En Cours de Développement
- 🔄 **Traduction active** - Intégration finale des modèles MT5/NLLB
- 🔄 **Tests** - Ajout de tests unitaires et d'intégration
- 🔄 **Optimisations** - Performance et UX améliorées

## 🌟 Fonctionnalités Principales

- **Traduction côté client uniquement** - Aucune dépendance aux API externes
- **Modèles de traduction edge** - MT5 et NLLB via TensorFlow.js
- **Cache intelligent** - Stockage local des traductions pour une performance optimale
- **Messagerie temps réel** - WebSocket pour une communication instantanée
- **Liens d'invitation** - Partage facile de conversations avec validation
- **Présence en ligne** - Statut temps réel des utilisateurs connectés
- **Interface moderne** - UI responsive avec shadcn/ui et Tailwind CSS

## 🏗️ Architecture

### Frontend (Next.js 15)
- **Framework** : Next.js 15 avec App Router et TypeScript
- **Styling** : Tailwind CSS + shadcn/ui components
- **State Management** : React hooks personnalisés
- **WebSocket Client** : Socket.io-client pour temps réel
- **Traduction** : TensorFlow.js (MT5 + NLLB) côté client
- **Notifications** : Sonner pour les toasts et notifications

### Backend (NestJS)
- **Framework** : NestJS avec TypeScript
- **Base de données** : Prisma + SQLite
- **WebSocket** : Socket.io pour la messagerie temps réel
- **API REST** : Gestion complète des utilisateurs, conversations, groupes
- **Authentification** : JWT avec bcryptjs

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

### 4. Initialiser la base de données
```bash
cd backend
npx prisma migrate reset --force  # Recrée la DB avec les données de test
cd ..
```

### 5. Démarrer le backend
```bash
cd backend
npm run start:dev
```

Le backend sera disponible sur http://localhost:3000

### 6. Démarrer le frontend
```bash
# Dans un nouveau terminal, depuis la racine du projet
npm run dev
```

Le frontend sera disponible sur http://localhost:3100

## 🎯 Utilisation

1. **Inscription/Connexion** : Créez un compte ou connectez-vous avec un utilisateur existant
2. **Dashboard** : Accédez à vos conversations et créez-en de nouvelles
3. **Création de conversation** : Sélectionnez des participants et créez une conversation
4. **Liens d'invitation** : Générez des liens pour inviter d'autres utilisateurs
5. **Chat temps réel** : Discutez avec notifications et indicateurs de frappe
6. **Traduction automatique** : Les messages sont traduits selon vos paramètres (à finaliser)

## 📱 Navigation Responsive

### Mode Desktop (≥1024px)
- **Vue en colonnes** : Liste des conversations à gauche, chat à droite
- **Navigation directe** : Clic sur conversation → affichage immédiat
- **Actions groupées** : Boutons "Nouvelle conversation" et "Créer un lien" dans l'en-tête

### Mode Mobile (<1024px)  
- **Navigation par pages** :
  - `/conversations` → Liste des conversations en plein écran
  - `/conversations/[id]` → Chat individuel en plein écran
- **Bouton retour** : Flèche dans l'en-tête du chat pour revenir à la liste
- **Interface tactile** : Boutons optimisés pour les écrans tactiles

### Fonctionnalités Cross-Platform
- **Modals unifiées** : Création de conversation et liens disponibles partout
- **Actions rapides** : Dashboard avec boutons d'accès direct
- **État synchronisé** : Navigation cohérente entre desktop et mobile

## 👥 Utilisateurs de Test

Comptes prêts à utiliser (mot de passe: `password123`) :
- **alice.martin@email.com** (Alice Martin) - Français
- **bob.johnson@email.com** (Bob Johnson) - Anglais/Russe  
- **carlos.rodriguez@email.com** (Carlos Rodriguez) - Espagnol
- **diana.chen@email.com** (Diana Chen) - Chinois
- **emma.schmidt@email.com** (Emma Schmidt) - Allemand

## 🔗 Test des Liens de Conversation

1. Connectez-vous en tant qu'Alice et créez une conversation
2. Générez un lien d'invitation depuis le dashboard
3. Copiez le lien généré (format: `/join/[linkId]`)
4. Ouvrez le lien dans un nouvel onglet ou partagez-le
5. Connectez-vous avec un autre utilisateur pour rejoindre la conversation
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
