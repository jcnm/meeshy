#!/bin/bash

echo "🔄 Nettoyage complet du cache Next.js et rechargement"
echo "====================================================="
echo ""

# Aller dans le répertoire frontend
cd "$(dirname "$0")"

echo "1️⃣ Arrêt du serveur Next.js (si en cours)..."
pkill -f "next dev" 2>/dev/null || echo "   Aucun serveur en cours"

echo ""
echo "2️⃣ Suppression du cache Next.js..."
rm -rf .next
echo "   ✅ Cache .next supprimé"

echo ""
echo "3️⃣ Suppression du cache de build..."
rm -rf node_modules/.cache
echo "   ✅ Cache node_modules supprimé"

echo ""
echo "4️⃣ Vérification des fichiers de traduction..."
for lang in fr en es pt zh; do
  if [ -f "locales/$lang/conversations.json" ] && [ -f "locales/$lang/common.json" ]; then
    echo "   ✅ [$lang] conversations.json et common.json présents"
  else
    echo "   ❌ [$lang] Fichiers manquants !"
  fi
done

echo ""
echo "✨ Nettoyage terminé !"
echo ""
echo "💡 Pour redémarrer le serveur :"
echo "   cd frontend && yarn dev"
echo ""
echo "💡 Ou utilisez frontend.sh :"
echo "   cd frontend && ./frontend.sh"
