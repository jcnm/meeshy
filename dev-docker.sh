#!/bin/bash

# Meeshy - Script de déploiement Docker
# Exécute tous les services via Docker Compose

set -e

echo "🐳 Démarrage de Meeshy avec Docker..."

# Vérification des prérequis Docker
check_docker() {
    echo "🔍 Vérification de Docker..."
    
    if ! command -v docker &> /dev/null; then
        echo "❌ Docker n'est pas installé. Veuillez installer Docker depuis docker.com"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null && ! command -v docker compose &> /dev/null; then
        echo "❌ Docker Compose n'est pas installé. Veuillez installer Docker Compose"
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        echo "❌ Docker n'est pas démarré. Veuillez démarrer Docker Desktop"
        exit 1
    fi
    
    echo "✅ Docker est prêt"
}

# Configuration des variables d'environnement
setup_env() {
    echo "⚙️  Configuration des variables d'environnement..."
    
    # Créer le fichier .env s'il n'existe pas
    if [ ! -f .env ]; then
        echo "📝 Création du fichier .env..."
        cat > .env << EOF
# Base de données PostgreSQL
POSTGRES_DB=meeshy
POSTGRES_USER=meeshy
POSTGRES_PASSWORD=MeeshyP@ssword
POSTGRES_PORT=5432

# Redis Cache
REDIS_PORT=6379

# Services
TRANSLATOR_HTTP_PORT=8000
TRANSLATOR_GRPC_PORT=50051
GATEWAY_PORT=3000
FRONTEND_PORT=3100

# Nginx
NGINX_HTTP_PORT=80
NGINX_HTTPS_PORT=443

# Sécurité
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# Langues supportées
SUPPORTED_LANGUAGES=fr,en,es,de,pt,zh,ja,ar
DEFAULT_LANGUAGE=fr
EOF
        echo "✅ Fichier .env créé"
    else
        echo "✅ Fichier .env existe déjà"
    fi
}

# Construction des images Docker
build_images() {
    echo "🔨 Construction des images Docker..."
    
    # Nettoyage des images existantes (optionnel)
    if [ "$1" = "--clean" ]; then
        echo "🧹 Nettoyage des images existantes..."
        docker-compose down -v --remove-orphans
        docker system prune -f
    fi
    
    # Construction des images
    echo "   📦 Construction des images (cela peut prendre plusieurs minutes)..."
    docker-compose build --no-cache --parallel
    
    echo "✅ Images construites avec succès"
}

# Démarrage des services
start_services() {
    echo "🚀 Démarrage des services Docker..."
    
    # Démarrage en arrière-plan
    docker-compose up -d
    
    echo "✅ Services démarrés!"
    echo ""
    echo "🔍 Vérification de l'état des services..."
    docker-compose ps
    echo ""
    echo "🌐 Accès aux services:"
    echo "   • Application complète: http://localhost (via Nginx)"
    echo "   • Frontend direct: http://localhost:3100"
    echo "   • API Gateway: http://localhost:3000"
    echo "   • Translator API: http://localhost:8000"
    echo "   • Translator gRPC: localhost:50051"
    echo "   • Base de données: localhost:5432"
    echo "   • Redis: localhost:6379"
    echo ""
    echo "📋 Commandes utiles:"
    echo "   • Voir les logs: docker-compose logs -f"
    echo "   • Arrêter: docker-compose down"
    echo "   • Redémarrer un service: docker-compose restart <service>"
}

# Vérification de la santé des services
health_check() {
    echo "🏥 Vérification de la santé des services..."
    
    max_attempts=30
    attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        attempt=$((attempt + 1))
        echo "   Tentative $attempt/$max_attempts..."
        
        # Vérifier chaque service
        services_healthy=true
        
        # PostgreSQL
        if ! docker-compose exec -T postgres pg_isready -U meeshy -d meeshy &>/dev/null; then
            services_healthy=false
        fi
        
        # Redis
        if ! docker-compose exec -T redis redis-cli ping &>/dev/null; then
            services_healthy=false
        fi
        
        # Translator
        if ! curl -s http://localhost:8000/health &>/dev/null; then
            services_healthy=false
        fi
        
        # Gateway (si disponible)
        if ! curl -s http://localhost:3000/health &>/dev/null; then
            services_healthy=false
        fi
        
        # Frontend
        if ! curl -s http://localhost:3100 &>/dev/null; then
            services_healthy=false
        fi
        
        if [ "$services_healthy" = true ]; then
            echo "✅ Tous les services sont opérationnels!"
            return 0
        fi
        
        sleep 5
    done
    
    echo "⚠️  Certains services ne répondent pas encore. Vérifiez les logs:"
    echo "   docker-compose logs"
}

# Affichage des logs en temps réel
show_logs() {
    echo "📝 Affichage des logs en temps réel (Ctrl+C pour arrêter)..."
    docker-compose logs -f
}

# Arrêt propre des services
stop_services() {
    echo "🛑 Arrêt des services Docker..."
    docker-compose down
    echo "✅ Services arrêtés"
}

# Menu d'aide
show_help() {
    echo "Usage: $0 [OPTION]"
    echo ""
    echo "Options:"
    echo "  start          Démarrer tous les services (défaut)"
    echo "  start --clean  Démarrer avec reconstruction complète des images"
    echo "  stop           Arrêter tous les services"
    echo "  restart        Redémarrer tous les services"
    echo "  logs           Afficher les logs en temps réel"
    echo "  status         Afficher l'état des services"
    echo "  health         Vérifier la santé des services"
    echo "  help           Afficher cette aide"
    echo ""
    echo "Exemples:"
    echo "  $0 start           # Démarrage normal"
    echo "  $0 start --clean   # Démarrage avec reconstruction"
    echo "  $0 logs            # Voir les logs"
}

# Fonction principale
main() {
    case "${1:-start}" in
        "start")
            check_docker
            setup_env
            build_images "$2"
            start_services
            health_check
            echo ""
            echo "🎉 Meeshy est prêt! Utilisez '$0 logs' pour voir les logs en temps réel."
            ;;
        "stop")
            stop_services
            ;;
        "restart")
            stop_services
            main start
            ;;
        "logs")
            show_logs
            ;;
        "status")
            docker-compose ps
            ;;
        "health")
            health_check
            ;;
        "help"|"--help"|"-h")
            show_help
            ;;
        *)
            echo "❌ Option inconnue: $1"
            show_help
            exit 1
            ;;
    esac
}

# Point d'entrée
main "$@"
