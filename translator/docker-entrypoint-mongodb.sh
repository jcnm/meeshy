#!/bin/bash
set -e

echo "[TRANSLATOR] 🚀 Démarrage du service Translator (MongoDB)..."

# Fonction pour attendre que la base de données soit prête
wait_for_database() {
    if [ "$DATABASE_TYPE" = "MONGODB" ]; then
        echo "[TRANSLATOR] 🔄 Attente de la base de données MongoDB..."
        # Pour MongoDB, la santé est gérée par docker-compose healthcheck
        # et le service démarre même si la DB n'est pas encore totalement prête.
        # On peut ajouter un simple sleep ou une vérification plus robuste si nécessaire.
        sleep 10 # Donner un peu de temps à MongoDB pour démarrer
        echo "[TRANSLATOR] ✅ Base de données MongoDB (supposée) prête"
    else
        echo "[TRANSLATOR] ⚠️ Type de base de données non spécifié ou inconnu. Pas d'attente."
    fi
}

# Fonction principale
main() {
    echo "[TRANSLATOR] 🎯 Démarrage du processus d'initialisation..."
    
    # Attendre que la base de données soit prête
    wait_for_database
    
    echo "[TRANSLATOR] 🚀 Démarrage de l'application Translator..."
    
    # Démarrer l'application Python
    exec python3 -u src/main.py
}

# Exécuter la fonction principale
main