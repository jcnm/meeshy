#!/bin/bash

echo "🧪 Test de la configuration des workers..."

# Afficher la configuration actuelle
echo "📋 Configuration actuelle des workers:"
echo "  NORMAL_WORKERS_DEFAULT: ${NORMAL_WORKERS_DEFAULT:-20}"
echo "  ANY_WORKERS_DEFAULT: ${ANY_WORKERS_DEFAULT:-10}"
echo "  NORMAL_WORKERS_MIN: ${NORMAL_WORKERS_MIN:-2}"
echo "  ANY_WORKERS_MIN: ${ANY_WORKERS_MIN:-2}"
echo "  NORMAL_WORKERS_MAX: ${NORMAL_WORKERS_MAX:-40}"
echo "  ANY_WORKERS_MAX: ${ANY_WORKERS_MAX:-20}"
echo "  NORMAL_WORKERS_SCALING_MAX: ${NORMAL_WORKERS_SCALING_MAX:-40}"
echo "  ANY_WORKERS_SCALING_MAX: ${ANY_WORKERS_SCALING_MAX:-20}"

# Test avec des valeurs personnalisées
echo ""
echo "🔧 Test avec configuration personnalisée..."

# Sauvegarder les valeurs actuelles
export OLD_NORMAL_WORKERS_DEFAULT=$NORMAL_WORKERS_DEFAULT
export OLD_ANY_WORKERS_DEFAULT=$ANY_WORKERS_DEFAULT
export OLD_NORMAL_WORKERS_MIN=$NORMAL_WORKERS_MIN
export OLD_ANY_WORKERS_MIN=$ANY_WORKERS_MIN

# Définir des valeurs de test
export NORMAL_WORKERS_DEFAULT=5
export ANY_WORKERS_DEFAULT=3
export NORMAL_WORKERS_MIN=1
export ANY_WORKERS_MIN=1
export NORMAL_WORKERS_MAX=10
export ANY_WORKERS_MAX=8

echo "✅ Configuration de test appliquée:"
echo "  Normal workers: 5 (min: 1, max: 10)"
echo "  Any workers: 3 (min: 1, max: 8)"

# Redémarrer le service translator pour appliquer la nouvelle configuration
echo ""
echo "🔄 Redémarrage du service translator..."
docker-compose restart translator

# Attendre que le service soit prêt
echo "⏳ Attente du démarrage..."
sleep 15

# Vérifier les logs pour voir la nouvelle configuration
echo ""
echo "📋 Vérification des logs de configuration..."
docker-compose logs --tail=10 translator | grep -E "(Configuration workers|Normal:|Any:)"

# Restaurer les valeurs originales
echo ""
echo "🔄 Restauration de la configuration originale..."
export NORMAL_WORKERS_DEFAULT=$OLD_NORMAL_WORKERS_DEFAULT
export ANY_WORKERS_DEFAULT=$OLD_ANY_WORKERS_DEFAULT
export NORMAL_WORKERS_MIN=$OLD_NORMAL_WORKERS_MIN
export ANY_WORKERS_MIN=$OLD_ANY_WORKERS_MIN

echo "✅ Test terminé. Configuration restaurée."
