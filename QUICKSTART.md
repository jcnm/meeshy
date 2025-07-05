# 🚀 Meeshy - Guide de Démarrage Rapide

## 📋 Prérequis

- **Node.js** 18+ 
- **npm** ou **yarn**
- **Git** pour le versioning

## ⚡ Installation et Démarrage

### 1. Cloner et installer les dépendances

```bash
# Cloner le projet
git clone <repository-url>
cd meeshy

# Installer les dépendances frontend
npm install

# Installer les dépendances backend
cd backend
npm install
cd ..
```

### 2. Démarrer l'application

#### Option A: Démarrage manuel (recommandé pour développement)

**Terminal 1 - Backend** :
```bash
cd backend
npm run start:dev
```
> Backend démarré sur http://localhost:3100

**Terminal 2 - Frontend** :
```bash
npm run dev
```
> Frontend démarré sur http://localhost:3001

#### Option B: Via les tâches VS Code

1. Ouvrir VS Code dans le dossier du projet
2. `Ctrl+Shift+P` → "Tasks: Run Task"
3. Sélectionner "Start Meeshy Backend" et "Start Meeshy Frontend"

### 3. Ouvrir l'application

Aller sur http://localhost:3001 dans votre navigateur.

## 🎮 Comment Utiliser

### Première Connexion

1. **Sélectionner un utilisateur** dans la liste (Alice, Bob, Carlos, Diana, ou Erik)
2. L'interface de chat s'ouvre automatiquement

### Interface Principale

#### Sidebar Gauche
- **Section Utilisateur** : Votre profil et bouton paramètres
- **Onglet Utilisateurs** : Liste des autres utilisateurs connectés
- **Onglet Traduction** : Statut des modèles TensorFlow.js

#### Zone de Chat
- **Header** : Informations sur l'utilisateur sélectionné
- **Messages** : Conversation avec bulles, actions de traduction
- **Indicateurs de frappe** : "X est en train d'écrire..."
- **Zone de saisie** : Tapez votre message et appuyez sur Entrée

### Fonctionnalités Clés

#### 💬 Messagerie
```
1. Sélectionner un utilisateur dans la sidebar
2. Taper un message dans la zone de saisie
3. Appuyer sur Entrée ou cliquer sur Envoyer
4. Voir les messages s'afficher en temps réel
```

#### 🌍 Traduction
```
1. Cliquer sur l'icône 🌐 sur un message reçu
2. Le message se traduit automatiquement
3. Cliquer à nouveau pour revenir à l'original
4. En cas d'erreur, cliquer sur 🔄 pour réessayer
```

#### ⚙️ Paramètres
```
1. Cliquer sur ⚙️ dans votre profil
2. Configurer vos langues (système, régionale, personnalisée)
3. Activer/désactiver la traduction automatique
4. Voir le statut des modèles de traduction
5. Précharger les modèles pour de meilleures performances
```

#### 👀 Indicateurs de Frappe
```
1. Commencer à taper dans la zone de saisie
2. L'autre utilisateur voit "Vous êtes en train d'écrire..."
3. L'indicateur disparaît automatiquement après 3 secondes
```

## 🛠️ Structure du Projet

```
meeshy/
├── src/                     # Frontend Next.js
│   ├── app/                 # Pages et layout
│   ├── components/          # Composants React
│   │   ├── ui/             # Composants shadcn/ui
│   │   ├── chat-interface.tsx
│   │   ├── user-selector.tsx
│   │   ├── typing-indicator.tsx
│   │   ├── models-status.tsx
│   │   └── user-settings-modal.tsx
│   ├── hooks/              # Hooks React personnalisés
│   │   ├── use-websocket.ts
│   │   ├── use-translation.ts
│   │   ├── use-simple-translation.ts
│   │   └── use-typing-indicator.ts
│   ├── lib/                # Services et utilitaires
│   │   ├── websocket-service.ts
│   │   └── translation-models.ts
│   ├── types/              # Types TypeScript
│   └── utils/              # Utilitaires
├── backend/                # Backend NestJS
│   └── src/
│       ├── gateway/        # WebSocket Gateway
│       ├── modules/        # Services et contrôleurs
│       └── types/          # Types partagés
└── public/                 # Assets statiques
```

## 🐛 Dépannage

### Le frontend ne se connecte pas au backend
- Vérifier que le backend est démarré sur le port 3002
- Vérifier la console du navigateur pour les erreurs WebSocket

### Les modèles de traduction ne se chargent pas
- C'est normal ! Les vrais modèles TensorFlow.js ne sont pas encore intégrés
- Le système utilise actuellement des mocks pour la démonstration

### Les messages ne s'affichent pas
- Vérifier la connexion WebSocket dans l'onglet Réseau du navigateur
- Redémarrer le backend si nécessaire

### Problèmes de compilation TypeScript
```bash
# Nettoyer et réinstaller
rm -rf node_modules package-lock.json
npm install

# Pour le backend
cd backend
rm -rf node_modules package-lock.json
npm install
```

## 📝 Scripts Disponibles

### Frontend
```bash
npm run dev          # Démarrage développement
npm run build        # Build production
npm run start        # Démarrage production
npm run lint         # Vérification ESLint
```

### Backend
```bash
npm run start:dev    # Démarrage développement
npm run build        # Build production
npm run start:prod   # Démarrage production
```

## 🎯 Fonctionnalités à Tester

- [ ] Connexion utilisateur
- [ ] Envoi de messages
- [ ] Indicateurs de frappe
- [ ] Traduction des messages
- [ ] Configuration des paramètres
- [ ] Statut en ligne/hors ligne
- [ ] Préchargement des modèles
- [ ] Interface responsive

---

🎉 **Amusez-vous bien avec Meeshy !**
