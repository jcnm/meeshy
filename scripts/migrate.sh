#!/bin/bash

# Script de migration pour Meeshy - Système de traduction amélioré
# Ce script met à jour l'application pour utiliser le nouveau système de traduction
# avec modèles mT5/NLLB et cache IndexedDB

echo "🚀 Migration Meeshy - Système de traduction amélioré"
echo "=================================================="

# Vérifier que nous sommes dans le bon répertoire
if [ ! -f "package.json" ]; then
  echo "❌ Erreur: Ce script doit être exécuté dans le répertoire racine du projet"
  exit 1
fi

# Supprimer les anciens fichiers obsolètes si ils existent
echo "🧹 Nettoyage des anciens fichiers..."

# Sauvegarder puis supprimer l'ancien système de modèles
if [ -f "src/lib/translation-models.ts" ]; then
  mv src/lib/translation-models.ts src/lib/translation-models.old.ts
  echo "   ✓ Ancien système de modèles sauvegardé"
fi

# Supprimer les anciens hooks de traduction si ils existent
if [ -f "src/hooks/use-old-translation.ts" ]; then
  rm src/hooks/use-old-translation.ts
  echo "   ✓ Ancien hook de traduction supprimé"
fi

echo ""
echo "📦 Installation des dépendances supplémentaires..."

# Vérifier si TensorFlow.js est installé
if ! npm list @tensorflow/tfjs >/dev/null 2>&1; then
  echo "   📥 Installation de @tensorflow/tfjs..."
  npm install @tensorflow/tfjs
fi

# Vérifier si les composants UI sont à jour
if ! npm list @radix-ui/react-progress >/dev/null 2>&1; then
  echo "   📥 Installation de @radix-ui/react-progress..."
  npm install @radix-ui/react-progress
fi

echo ""
echo "🔧 Configuration des modèles..."

# Créer le dossier pour les modèles s'il n'existe pas
mkdir -p public/models/mt5
mkdir -p public/models/nllb

echo "   ✓ Dossiers de modèles créés"

echo ""
echo "✅ Migration terminée avec succès !"
echo ""
echo "📋 Résumé des changements :"
echo "   • Nouveau système de traduction avec mT5 et NLLB"
echo "   • Cache IndexedDB pour les modèles téléchargés"
echo "   • Détection automatique des capacités système"
echo "   • Interface de gestion des modèles"
echo "   • Traduction côté client uniquement"
echo ""
echo "🚀 Prochaines étapes :"
echo "   1. Démarrer l'application : npm run dev"
echo "   2. Aller dans l'onglet 'Traduction' pour configurer les modèles"
echo "   3. Télécharger les modèles recommandés selon votre machine"
echo ""
echo "📖 Documentation :"
echo "   • README.md - Guide d'utilisation"
echo "   • CHANGELOG.md - Liste des modifications"
echo "   • FEATURES.md - Fonctionnalités détaillées"
