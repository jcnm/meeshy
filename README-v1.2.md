# 🌍 Meeshy - Version 1.2.0 

## Système de Traduction Intelligent

Meeshy dispose maintenant d'un système de traduction avancé qui respecte la logique métier attendue :

### 🎯 Comportement de Traduction

- **📤 Messages envoyés** : Toujours dans votre langue (pas de traduction automatique)
- **📥 Messages reçus** : Traduits automatiquement vers votre langue configurée  
- **🖱️ Survol original** : Tooltip avec message original + drapeau langue
- **⚠️ Gestion d'échec** : Affichage original si traduction impossible

### 🤖 Modèles de Traduction

#### mT5 (Messages simples ≤100 caractères)
- **Small** (580MB) : Machines 8GB RAM
- **Base** (1.2GB) : Machines 16GB RAM  
- **Large** (2.4GB) : Machines 32GB+ RAM

#### NLLB (Messages complexes)
- **600M** (600MB) : Machines 8-16GB RAM
- **1.3B** (1.3GB) : Machines 16-32GB RAM
- **3.3B** (3.3GB) : Machines 32GB+ RAM

### 🚀 Démarrage Rapide

```bash
# 1. Installer les dépendances
npm install

# 2. Démarrer l'application  
npm run dev

# 3. Aller dans l'onglet "Traduction"
# 4. Télécharger les modèles recommandés
```

### 💡 Détection Automatique

L'application détecte automatiquement :
- RAM disponible
- Type d'appareil (mobile/laptop/desktop/workstation)
- Vitesse de connexion
- Recommande les meilleurs modèles

### 📦 Cache Intelligent

- **Modèles** : Stockés localement dans IndexedDB
- **Traductions** : Cache mémoire pour accès rapide
- **Nettoyage** : Suppression automatique après 30 jours

### 🔧 Configuration

1. **Langue système** : Votre langue native
2. **Traduction auto** : Activer/désactiver
3. **Langue cible** : Langue de réception des messages
4. **Modèles** : Télécharger selon vos capacités

### 🎨 Interface

- Interface de gestion des modèles
- Statistiques de cache
- Barre de progression de téléchargement
- Tooltip informatif sur chaque message

---

*Meeshy v1.2.0 - Traduction multilingue intelligente* 🌟
