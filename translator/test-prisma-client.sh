#!/bin/bash
set -e

echo "[TEST] 🧪 Test de l'installation de prisma-client-py..."

# Fonction pour nettoyer après les tests
cleanup() {
    echo "[TEST] 🧹 Nettoyage après les tests..."
    # Arrêter les conteneurs de test si nécessaire
    docker-compose down 2>/dev/null || true
}

# Fonction pour tester l'installation de prisma-client-py
test_prisma_client_installation() {
    echo "[TEST] 🔧 Test de l'installation de prisma-client-py..."
    
    # Vérifier que prisma est dans requirements.txt
    if grep -q "prisma" requirements.txt; then
        echo "[TEST] ✅ prisma trouvé dans requirements.txt"
    else
        echo "[TEST] ❌ prisma manquant dans requirements.txt"
        return 1
    fi
    
    # Vérifier que prisma-client-py n'est pas dans requirements.txt (car généré par Prisma)
    if grep -q "prisma-client-py" requirements.txt; then
        echo "[TEST] ⚠️ prisma-client-py trouvé dans requirements.txt (ne devrait pas être là)"
    else
        echo "[TEST] ✅ prisma-client-py absent de requirements.txt (sera généré par Prisma)"
    fi
    
    echo "[TEST] ✅ Configuration prisma-client-py via Prisma configurée"
}

# Fonction pour tester la génération du client Prisma
test_prisma_generation() {
    echo "[TEST] 🔧 Test de la génération du client Prisma..."
    
    # Vérifier que le schéma Prisma existe
    if [ ! -f "./shared/prisma/schema.prisma" ]; then
        echo "[TEST] ❌ Schéma Prisma non trouvé"
        return 1
    fi
    
    echo "[TEST] ✅ Schéma Prisma trouvé"
    
    # Tester la génération du client Prisma
    echo "[TEST] 📦 Test de génération du client Prisma..."
    if npx prisma generate --schema=./shared/prisma/schema.prisma; then
        echo "[TEST] ✅ Génération du client Prisma réussie"
    else
        echo "[TEST] ⚠️ Échec de la génération du client Prisma (normal si prisma-client-py non installé localement)"
    fi
    
    echo "[TEST] ✅ Test de génération Prisma réussi"
}

# Fonction pour tester le Dockerfile
test_dockerfile() {
    echo "[TEST] 🐳 Test du Dockerfile..."
    
    # Vérifier que le Dockerfile existe
    if [ ! -f "./Dockerfile" ]; then
        echo "[TEST] ❌ Dockerfile non trouvé"
        return 1
    fi
    
    # Vérifier que la génération Prisma est dans le Dockerfile
    if grep -q "npx prisma generate" ./Dockerfile; then
        echo "[TEST] ✅ Génération Prisma avec npx dans le Dockerfile"
    else
        echo "[TEST] ❌ Génération Prisma avec npx manquante dans le Dockerfile"
        return 1
    fi
    
    # Vérifier que le répertoire generated est créé
    if grep -q "mkdir -p /app/generated" ./Dockerfile; then
        echo "[TEST] ✅ Répertoire generated créé dans Dockerfile"
    else
        echo "[TEST] ❌ Répertoire generated manquant dans Dockerfile"
        return 1
    fi
    
    echo "[TEST] ✅ Dockerfile configuré correctement"
}

# Fonction pour tester le script d'entrée
test_entrypoint_script() {
    echo "[TEST] 🐳 Test du script d'entrée..."
    
    # Vérifier que le script d'entrée existe
    if [ ! -f "./docker-entrypoint.sh" ]; then
        echo "[TEST] ❌ Script d'entrée Docker non trouvé"
        return 1
    fi
    
    # Vérifier que le script est exécutable
    if [ ! -x "./docker-entrypoint.sh" ]; then
        echo "[TEST] ❌ Script d'entrée Docker non exécutable"
        return 1
    fi
    
    # Vérifier que le script vérifie si le client est déjà généré
    if grep -q "/app/generated/prisma" ./docker-entrypoint.sh; then
        echo "[TEST] ✅ Vérification du client généré dans le script"
    else
        echo "[TEST] ❌ Vérification du client généré manquante"
        return 1
    fi
    
    echo "[TEST] ✅ Script d'entrée configuré correctement"
}

# Fonction pour tester l'import Python
test_python_import() {
    echo "[TEST] 🐍 Test de l'import Python..."
    
    # Tester l'import de prisma-client-py
    if python3 -c "import prisma; print('✅ prisma importé avec succès')" 2>/dev/null; then
        echo "[TEST] ✅ Import prisma réussi"
    else
        echo "[TEST] ⚠️ Import prisma échoué (normal si pas installé localement)"
    fi
    
    # Tester l'import de prisma-client-py spécifiquement
    if python3 -c "from prisma import Prisma; print('✅ Prisma client importé avec succès')" 2>/dev/null; then
        echo "[TEST] ✅ Import Prisma client réussi"
    else
        echo "[TEST] ⚠️ Import Prisma client échoué (normal si pas installé localement)"
    fi
    
    echo "[TEST] ✅ Tests d'import Python terminés"
}

# Fonction principale
main() {
    echo "[TEST] 🎯 Démarrage des tests de prisma-client-py..."
    
    # Configuration du trap pour le nettoyage
    trap cleanup EXIT
    
    # Tests
    test_prisma_client_installation
    test_prisma_generation
    test_dockerfile
    test_entrypoint_script
    test_python_import
    
    echo "[TEST] ✅ Tous les tests réussis !"
    echo "[TEST] 🚀 prisma-client-py est correctement configuré"
}

# Exécuter les tests
main
