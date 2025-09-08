#!/bin/bash

# Script de déploiement optimisé en production pour Meeshy
# Ce script orchestre le processus de déploiement optimisé :
# 1. Génération des configurations sécurisées
# 2. Build et push des images Docker (si nécessaire)
# 3. Reset de la base de données (si nécessaire)
# 4. Déploiement optimisé (infrastructure et configuration uniquement)
# 
# OPTIMISATION: Ne transmet que les fichiers essentiels pour l'infrastructure
# et la configuration, pas les sources qui sont déjà buildées dans les images

set -e

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
SECRETS_DIR="$PROJECT_ROOT/secrets"
CONFIG_DIR="$PROJECT_ROOT/config"

# Variables par défaut
DROPLET_IP=""
SKIP_CONFIG_GENERATION=false
SKIP_BUILD=false
SKIP_DB_RESET=false
SKIP_DEPLOYMENT=false
FORCE_REBUILD=false
FORCE_DB_RESET=false
VERBOSE=false

# Fonctions utilitaires
log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }
log_step() { echo -e "${CYAN}🔄 $1${NC}"; }

# Chargement des variables d'environnement DigitalOcean
if [ -f "$PROJECT_ROOT/env.digitalocean" ]; then
    log_info "Chargement des variables d'environnement DigitalOcean..."
    set -a  # Automatically export all variables
    source "$PROJECT_ROOT/env.digitalocean"
    set +a  # Stop automatically exporting
    log_success "Variables d'environnement DigitalOcean chargées"
else
    log_warning "Fichier env.digitalocean non trouvé, utilisation des variables par défaut"
fi

# Fonction pour afficher l'aide
show_help() {
    echo -e "${BLUE}Script de Déploiement Complet en Production Meeshy${NC}"
    echo ""
    echo "Usage: $0 [OPTIONS] DROPLET_IP"
    echo ""
    echo "Arguments:"
    echo "  DROPLET_IP              IP du droplet Digital Ocean"
    echo ""
    echo "Options:"
    echo "  --skip-config           Ignorer la génération des configurations"
    echo "  --skip-build            Ignorer le build et push des images"
    echo "  --skip-db-reset         Ignorer le reset de la base de données"
    echo "  --skip-deployment       Ignorer le déploiement final"
    echo "  --force-rebuild         Forcer la reconstruction des images"
    echo "  --force-db-reset        Forcer le reset de la base de données"
    echo "  --verbose               Mode verbeux"
    echo "  --help                  Afficher cette aide"
    echo ""
    echo "Description:"
    echo "  Ce script orchestre le déploiement optimisé en production :"
    echo "  1. Génération des configurations sécurisées"
    echo "  2. Build et push des images Docker (si nécessaire)"
    echo "  3. Reset de la base de données (si nécessaire)"
    echo "  4. Déploiement optimisé (infrastructure et configuration uniquement)"
    echo ""
    echo "  OPTIMISATION: Ne transmet que les fichiers essentiels :"
    echo "  - Configuration Docker Compose et environnement"
    echo "  - Configuration Nginx et Supervisor"
    echo "  - Schémas de base de données et scripts d'init"
    echo "  - Fichiers Proto pour la communication inter-services"
    echo "  - Les sources sont déjà buildées dans les images Docker"
    echo ""
    echo "Exemples:"
    echo "  $0 157.230.15.51                    # Déploiement complet"
    echo "  $0 --skip-build 157.230.15.51       # Déploiement sans rebuild"
    echo "  $0 --force-rebuild 157.230.15.51    # Déploiement avec rebuild forcé"
    echo "  $0 --skip-db-reset 157.230.15.51    # Déploiement sans reset DB"
    echo ""
}

# Fonction pour vérifier les prérequis
check_prerequisites() {
    log_step "Vérification des prérequis..."
    
    # Vérifier que nous sommes dans le bon répertoire
    if [ ! -f "$PROJECT_ROOT/package.json" ]; then
        log_error "Ce script doit être exécuté depuis la racine du projet Meeshy"
        exit 1
    fi
    
    # Vérifier que Docker est disponible
    if ! command -v docker >/dev/null 2>&1; then
        log_error "Docker n'est pas installé ou n'est pas dans le PATH"
        exit 1
    fi
    
    # Vérifier que Docker est en cours d'exécution
    if ! docker info >/dev/null 2>&1; then
        log_error "Docker n'est pas en cours d'exécution"
        exit 1
    fi
    
    # Vérifier que SSH est disponible
    if ! command -v ssh >/dev/null 2>&1; then
        log_error "SSH n'est pas installé ou n'est pas dans le PATH"
        exit 1
    fi
    
    # Vérifier que les scripts nécessaires existent
    local required_scripts=(
        "$SCRIPT_DIR/generate-production-config.sh"
        "$SCRIPT_DIR/reset-database.sh"
        "$PROJECT_ROOT/scripts/deployment/build-and-push-docker-images.sh"
        "$PROJECT_ROOT/scripts/meeshy-deploy.sh"
    )
    
    for script in "${required_scripts[@]}"; do
        if [ ! -f "$script" ]; then
            log_error "Script requis non trouvé: $script"
            exit 1
        fi
        
        if [ ! -x "$script" ]; then
            log_warning "Script non exécutable, correction des permissions: $script"
            chmod +x "$script"
        fi
    done
    
    log_success "Prérequis vérifiés"
}

# Fonction pour corriger les permissions des volumes du translator
fix_translator_volume_permissions() {
    log_step "Correction des permissions des volumes pour le translator..."
    
    # Utilisation de l'utilisateur OVHcloud AI Deploy (42420:42420)
    local user_id="42420:42420"
    local permissions="755"
    
    # Fonction utilitaire pour corriger les permissions d'un volume
    fix_volume_permissions() {
        local volume_name="$1"
        local mount_path="$2"
        local description="$3"
        
        log_info "  • Correction des permissions du volume $description ($volume_name)..."
        
        # Vérifier que le volume existe
        if ! docker volume inspect "$volume_name" >/dev/null 2>&1; then
            log_warning "    Volume $volume_name n'existe pas, création..."
            docker volume create "$volume_name"
        fi
        
        # Corriger les permissions
        if docker run --rm -v "${volume_name}:${mount_path}" alpine chown -R "$user_id" "$mount_path" 2>/dev/null; then
            docker run --rm -v "${volume_name}:${mount_path}" alpine chmod -R "$permissions" "$mount_path" 2>/dev/null
            log_success "    ✅ Permissions corrigées pour $description"
        else
            log_warning "    ⚠️  Impossible de corriger les permissions pour $description (volume peut être vide)"
        fi
    }
    
    # Corriger les permissions des volumes du translator
    fix_volume_permissions "meeshy_translator_models" "/workspace/models" "translator_models"
    fix_volume_permissions "meeshy_translator_cache" "/workspace/cache" "translator_cache"
    fix_volume_permissions "meeshy_translator_generated" "/workspace/generated" "translator_generated"
    
    log_success "Permissions des volumes du translator corrigées"
}

# Fonction pour générer les configurations de production
generate_production_config() {
    if [ "$SKIP_CONFIG_GENERATION" = true ]; then
        log_info "Génération des configurations ignorée (--skip-config)"
        return 0
    fi
    
    log_step "Génération des configurations de production..."
    
    # Vérifier si les configurations existent déjà
    if [ -f "$SECRETS_DIR/production-secrets.env" ] && [ "$FORCE_REBUILD" = false ]; then
        log_warning "Les configurations de production existent déjà"
        echo -e "${YELLOW}Utilisez --force-rebuild pour forcer la régénération${NC}"
        return 0
    fi
    
    # Générer les configurations
    if [ "$VERBOSE" = true ]; then
        bash "$SCRIPT_DIR/generate-production-config.sh" --force
    else
        bash "$SCRIPT_DIR/generate-production-config.sh" --force >/dev/null 2>&1
    fi
    
    if [ $? -eq 0 ]; then
        log_success "Configurations de production générées"
    else
        log_error "Échec de la génération des configurations"
        exit 1
    fi
}

# Fonction pour build et push les images Docker
build_and_push_images() {
    if [ "$SKIP_BUILD" = true ]; then
        log_info "Build et push des images ignorés (--skip-build)"
        return 0
    fi
    
    log_step "Build et push des images Docker..."
    
    # Options pour le build
    local build_options=""
    if [ "$FORCE_REBUILD" = true ]; then
        build_options="--force-rebuild"
    fi
    
    # Exécuter le build
    if [ "$VERBOSE" = true ]; then
        bash "$PROJECT_ROOT/scripts/deployment/build-and-push-docker-images.sh" $build_options
    else
        bash "$PROJECT_ROOT/scripts/deployment/build-and-push-docker-images.sh" $build_options >/dev/null 2>&1
    fi
    
    if [ $? -eq 0 ]; then
        log_success "Images Docker buildées et poussées"
    else
        log_error "Échec du build et push des images"
        exit 1
    fi
}

# Fonction pour reset la base de données
reset_database() {
    if [ "$SKIP_DB_RESET" = true ]; then
        log_info "Reset de la base de données ignoré (--skip-db-reset)"
        return 0
    fi
    
    log_step "Reset de la base de données..."
    
    # Options pour le reset
    local reset_options=""
    if [ "$FORCE_DB_RESET" = true ]; then
        reset_options="--force"
    fi
    
    # Exécuter le reset
    if [ "$VERBOSE" = true ]; then
        bash "$SCRIPT_DIR/reset-database.sh" $reset_options "$DROPLET_IP"
    else
        bash "$SCRIPT_DIR/reset-database.sh" $reset_options "$DROPLET_IP" >/dev/null 2>&1
    fi
    
    if [ $? -eq 0 ]; then
        log_success "Base de données resetée"
    else
        log_error "Échec du reset de la base de données"
        exit 1
    fi
}

# Fonction pour déployer l'application (optimisée - seulement infrastructure et config)
deploy_application() {
    if [ "$SKIP_DEPLOYMENT" = true ]; then
        log_info "Déploiement ignoré (--skip-deployment)"
        return 0
    fi
    
    log_step "Déploiement optimisé de l'application (infrastructure et configuration uniquement)..."
    
    # Vérifier que les configurations existent
    if [ ! -f "$PROJECT_ROOT/env.digitalocean" ]; then
        log_error "Fichier de configuration non trouvé: $PROJECT_ROOT/env.digitalocean"
        exit 1
    fi
    
    if [ ! -f "$SECRETS_DIR/production-secrets.env" ]; then
        log_error "Fichier de secrets non trouvé: $SECRETS_DIR/production-secrets.env"
        log_info "Exécutez d'abord la génération des configurations"
        exit 1
    fi
    
    # Créer répertoire temporaire pour les fichiers essentiels uniquement
    local deploy_dir="/tmp/meeshy-deploy-optimized-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$deploy_dir"
    
    log_info "Préparation des fichiers essentiels pour le déploiement..."
    
    # 1. Fichiers Docker Compose et configuration
    cp "$PROJECT_ROOT/docker-compose.traefik.yml" "$deploy_dir/docker-compose.yml"
    
    # 2. Fichier d'environnement de production (base env.digitalocean + secrets de production)
    local env_file="$deploy_dir/.env"
    cp "$PROJECT_ROOT/env.digitalocean" "$env_file"
    
    # Supprimer les placeholders avant d'ajouter les vrais secrets
    log_info "Suppression des placeholders de secrets..."
    sed -i.bak '/^JWT_SECRET=CHANGE_ME_/d' "$env_file"
    sed -i.bak '/^ADMIN_PASSWORD=CHANGE_ME_/d' "$env_file"
    sed -i.bak '/^MEESHY_BIGBOSS_PASSWORD=CHANGE_ME_/d' "$env_file"
    sed -i.bak '/^MONGODB_PASSWORD=CHANGE_ME_/d' "$env_file"
    sed -i.bak '/^REDIS_PASSWORD=CHANGE_ME_/d' "$env_file"
    sed -i.bak '/^TRAEFIK_USERS=admin:CHANGE_ME_/d' "$env_file"
    sed -i.bak '/^API_USERS=admin:CHANGE_ME_/d' "$env_file"
    sed -i.bak '/^MONGO_USERS=admin:CHANGE_ME_/d' "$env_file"
    sed -i.bak '/^REDIS_USERS=admin:CHANGE_ME_/d' "$env_file"
    rm -f "$env_file.bak"
    
    echo "" >> "$env_file"
    echo "# ===== SECRETS DE PRODUCTION ======" >> "$env_file"
    echo "# Générés automatiquement le $(date)" >> "$env_file"
    cat "$SECRETS_DIR/production-secrets.env" >> "$env_file"
    log_info "Configuration env.digitalocean + secrets de production ajoutés (placeholders supprimés)"
    
    # 3. Configuration Docker essentielle uniquement
    mkdir -p "$deploy_dir/docker"
    cp -r "$PROJECT_ROOT/docker/nginx" "$deploy_dir/docker/"
    cp -r "$PROJECT_ROOT/docker/supervisor" "$deploy_dir/docker/"
    
    # 4. Fichiers shared essentiels pour la configuration (pas les sources)
    mkdir -p "$deploy_dir/shared"
    
    # Schémas de base de données
    cp "$PROJECT_ROOT/shared/schema.prisma" "$deploy_dir/shared/"
    cp "$PROJECT_ROOT/shared/schema.postgresql.prisma" "$deploy_dir/shared/"
    
    # Scripts d'initialisation de base de données
    cp "$PROJECT_ROOT/shared/init-postgresql.sql" "$deploy_dir/shared/"
    cp "$PROJECT_ROOT/shared/init-database.sh" "$deploy_dir/shared/"
    cp "$PROJECT_ROOT/shared/init-mongodb-replica.sh" "$deploy_dir/shared/"
    cp "$PROJECT_ROOT/shared/mongodb-keyfile" "$deploy_dir/shared/"
    
    # Fichiers Proto pour la communication inter-services
    mkdir -p "$deploy_dir/shared/proto"
    cp "$PROJECT_ROOT/shared/proto/messaging.proto" "$deploy_dir/shared/proto/"
    
    # Version pour le suivi
    cp "$PROJECT_ROOT/shared/version.txt" "$deploy_dir/shared/" 2>/dev/null || echo "1.0.0" > "$deploy_dir/shared/version.txt"
    
    log_success "Fichiers essentiels préparés (infrastructure et configuration uniquement)"
    
    # Envoyer sur serveur
    log_info "📤 Envoi des fichiers optimisés..."
    ssh -o StrictHostKeyChecking=no root@$DROPLET_IP "mkdir -p /opt/meeshy"
    scp -o StrictHostKeyChecking=no "$deploy_dir/docker-compose.yml" root@$DROPLET_IP:/opt/meeshy/
    scp -o StrictHostKeyChecking=no "$deploy_dir/.env" root@$DROPLET_IP:/opt/meeshy/
    scp -r -o StrictHostKeyChecking=no "$deploy_dir/docker" root@$DROPLET_IP:/opt/meeshy/
    scp -r -o StrictHostKeyChecking=no "$deploy_dir/shared" root@$DROPLET_IP:/opt/meeshy/
    
    # Nettoyer le répertoire temporaire
    rm -rf "$deploy_dir"
    
    # Exécuter le script de déploiement sur le serveur
    log_info "🚀 Lancement du déploiement sur le serveur..."
    
    # Script de déploiement optimisé
    cat << 'EOF' > /tmp/deploy-optimized.sh
#!/bin/bash
set -e
cd /opt/meeshy

echo "🐳 Vérification de Docker..."
if ! command -v docker &> /dev/null; then
    echo "Installation de Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    usermod -aG docker $USER
    systemctl enable docker
    systemctl start docker
    rm get-docker.sh
fi

echo "📦 Vérification de Docker Compose..."
if ! command -v docker-compose &> /dev/null; then
    echo "Installation de Docker Compose..."
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose
fi

echo "🛑 Arrêt des services existants..."
docker-compose down --remove-orphans || true

echo "🧹 Nettoyage des images inutilisées..."
docker system prune -f || true

echo "📥 Pull des images Docker pré-buildées..."
docker-compose pull

echo "🚀 Démarrage des services..."
docker-compose up -d

echo "⏳ Attente du démarrage des services..."
sleep 30

echo "🔧 Configuration MongoDB replica set..."
# Attendre que MongoDB soit prêt
echo "⏳ Attente que MongoDB soit prêt..."
until docker exec meeshy-database mongosh --eval "db.adminCommand('ping')" >/dev/null 2>&1; do
    echo "MongoDB pas encore prêt, attente..."
    sleep 2
done

echo "✅ MongoDB est prêt, configuration du replica set..."
# Utiliser le script d'initialisation automatique
echo "🔄 Exécution du script d'initialisation MongoDB..."
docker exec meeshy-database bash /shared/init-mongodb-replica.sh

echo "🔄 Redémarrage de la gateway pour appliquer la configuration MongoDB..."
docker-compose restart gateway

echo "⏳ Attente du redémarrage de la gateway..."
sleep 15

# Fonction pour corriger les permissions des volumes du translator
fix_translator_volume_permissions() {
    echo "🔧 Correction des permissions des volumes pour le translator..."
    
    # Utilisation de l'utilisateur OVHcloud AI Deploy (42420:42420)
    local user_id="42420:42420"
    local permissions="755"
    
    # Fonction utilitaire pour corriger les permissions d'un volume
    fix_volume_permissions() {
        local volume_name="$1"
        local mount_path="$2"
        local description="$3"
        
        echo "  • Correction des permissions du volume $description ($volume_name)..."
        
        # Vérifier que le volume existe
        if ! docker volume inspect "$volume_name" >/dev/null 2>&1; then
            echo "    Volume $volume_name n'existe pas, création..."
            docker volume create "$volume_name"
        fi
        
        # Corriger les permissions
        if docker run --rm -v "${volume_name}:${mount_path}" alpine chown -R "$user_id" "$mount_path" 2>/dev/null; then
            docker run --rm -v "${volume_name}:${mount_path}" alpine chmod -R "$permissions" "$mount_path" 2>/dev/null
            echo "    ✅ Permissions corrigées pour $description"
        else
            echo "    ⚠️  Impossible de corriger les permissions pour $description (volume peut être vide)"
        fi
    }
    
    # Corriger les permissions des volumes du translator
    fix_volume_permissions "meeshy_translator_models" "/workspace/models" "translator_models"
    fix_volume_permissions "meeshy_translator_cache" "/workspace/cache" "translator_cache"
    fix_volume_permissions "meeshy_translator_generated" "/workspace/generated" "translator_generated"
    
    echo "✅ Permissions des volumes du translator corrigées"
}

# Correction des permissions des volumes du translator
fix_translator_volume_permissions

echo "🔄 Redémarrage du translator avec les bonnes permissions..."
docker-compose restart translator

echo "⏳ Attente du redémarrage du translator..."
sleep 20

echo "🔍 Vérification de la santé des services..."
docker-compose ps

echo "✅ Déploiement optimisé terminé!"
EOF

    scp -o StrictHostKeyChecking=no /tmp/deploy-optimized.sh root@$DROPLET_IP:/tmp/
    ssh -o StrictHostKeyChecking=no root@$DROPLET_IP "chmod +x /tmp/deploy-optimized.sh && /tmp/deploy-optimized.sh"
    rm -f /tmp/deploy-optimized.sh
    
    if [ $? -eq 0 ]; then
        log_success "Application déployée avec succès (déploiement optimisé)"
    else
        log_error "Échec du déploiement de l'application"
        exit 1
    fi
}

# Fonction pour vérifier le déploiement
verify_deployment() {
    log_step "Vérification du déploiement..."
    
    # Vérifier la santé des services
    if [ "$VERBOSE" = true ]; then
        bash "$PROJECT_ROOT/scripts/meeshy-deploy.sh" health "$DROPLET_IP"
    else
        bash "$PROJECT_ROOT/scripts/meeshy-deploy.sh" health "$DROPLET_IP" >/dev/null 2>&1
    fi
    
    if [ $? -eq 0 ]; then
        log_success "Déploiement vérifié avec succès"
    else
        log_warning "Problèmes détectés lors de la vérification"
        log_info "Exécutez manuellement: $PROJECT_ROOT/scripts/meeshy-deploy.sh health $DROPLET_IP"
    fi
}

# Fonction pour afficher le résumé final
show_final_summary() {
    echo ""
    log_success "🎉 Déploiement optimisé en production terminé avec succès !"
    echo ""
    echo -e "${BLUE}📋 Résumé du déploiement optimisé:${NC}"
    echo -e "  • ✅ Prérequis vérifiés"
    
    if [ "$SKIP_CONFIG_GENERATION" = false ]; then
        echo -e "  • ✅ Configurations de production générées"
    fi
    
    if [ "$SKIP_BUILD" = false ]; then
        echo -e "  • ✅ Images Docker buildées et poussées"
    fi
    
    if [ "$SKIP_DB_RESET" = false ]; then
        echo -e "  • ✅ Base de données resetée"
    fi
    
    if [ "$SKIP_DEPLOYMENT" = false ]; then
        echo -e "  • ✅ Application déployée"
    fi
    
    echo -e "  • ✅ Déploiement vérifié"
    echo ""
    echo -e "${GREEN}⚡ Optimisations appliquées:${NC}"
    echo -e "  • ✅ Transmission uniquement des fichiers essentiels"
    echo -e "  • ✅ Pas de transfert des sources (déjà dans les images)"
    echo -e "  • ✅ Configuration infrastructure et environnement uniquement"
    echo -e "  • ✅ Utilisation des images Docker pré-buildées"
    echo ""
    echo -e "${YELLOW}🔐 Informations de connexion:${NC}"
    echo -e "  • Consultez le fichier: ${CYAN}$SECRETS_DIR/production-secrets.env${NC}"
    echo -e "  • Transférez ces informations sur Digital Ocean"
    echo ""
    echo -e "${YELLOW}🌐 Accès à l'application:${NC}"
    echo -e "  • Frontend: ${CYAN}https://meeshy.me${NC}"
    echo -e "  • API Gateway: ${CYAN}https://gate.meeshy.me${NC}"
    echo -e "  • Service ML: ${CYAN}https://ml.meeshy.me${NC}"
    echo -e "  • Dashboard Traefik: ${CYAN}https://traefik.meeshy.me${NC}"
    echo ""
    echo -e "${YELLOW}🛠️  Commandes utiles:${NC}"
    echo -e "  • Vérifier la santé: ${CYAN}./scripts/meeshy-deploy.sh health $DROPLET_IP${NC}"
    echo -e "  • Voir les logs: ${CYAN}./scripts/meeshy-deploy.sh logs $DROPLET_IP${NC}"
    echo -e "  • Redémarrer: ${CYAN}./scripts/meeshy-deploy.sh restart $DROPLET_IP${NC}"
    echo ""
    echo -e "${GREEN}🚀 L'application est maintenant en production !${NC}"
}

# Fonction principale
main() {
    # Parser les arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --help)
                show_help
                exit 0
                ;;
            --skip-config)
                SKIP_CONFIG_GENERATION=true
                shift
                ;;
            --skip-build)
                SKIP_BUILD=true
                shift
                ;;
            --skip-db-reset)
                SKIP_DB_RESET=true
                shift
                ;;
            --skip-deployment)
                SKIP_DEPLOYMENT=true
                shift
                ;;
            --force-rebuild)
                FORCE_REBUILD=true
                shift
                ;;
            --force-db-reset)
                FORCE_DB_RESET=true
                shift
                ;;
            --verbose)
                VERBOSE=true
                shift
                ;;
            *)
                if [ -z "$DROPLET_IP" ]; then
                    DROPLET_IP="$1"
                else
                    log_error "Argument inconnu: $1"
                    show_help
                    exit 1
                fi
                shift
                ;;
        esac
    done
    
    # Vérifier que l'IP du droplet est fournie
    if [ -z "$DROPLET_IP" ]; then
        log_error "IP du droplet manquante"
        show_help
        exit 1
    fi
    
    echo -e "${BLUE}🚀 Script de Déploiement Optimisé en Production Meeshy${NC}"
    echo -e "${BLUE}================================================${NC}"
    echo ""
    echo -e "${YELLOW}🎯 Cible: ${CYAN}$DROPLET_IP${NC}"
    echo -e "${YELLOW}📋 Étapes:${NC}"
    echo -e "  • Génération des configurations: ${CYAN}$([ "$SKIP_CONFIG_GENERATION" = true ] && echo "IGNORÉ" || echo "ACTIF")${NC}"
    echo -e "  • Build et push des images: ${CYAN}$([ "$SKIP_BUILD" = true ] && echo "IGNORÉ" || echo "ACTIF")${NC}"
    echo -e "  • Reset de la base de données: ${CYAN}$([ "$SKIP_DB_RESET" = true ] && echo "IGNORÉ" || echo "ACTIF")${NC}"
    echo -e "  • Déploiement final: ${CYAN}$([ "$SKIP_DEPLOYMENT" = true ] && echo "IGNORÉ" || echo "ACTIF")${NC}"
    echo ""
    
    # Vérifier les prérequis
    check_prerequisites
    
    # Générer les configurations de production
    generate_production_config
    
    # Build et push les images Docker
    build_and_push_images
    
    # Reset la base de données
    reset_database
    
    # Déployer l'application
    deploy_application
    
    # Vérifier le déploiement
    verify_deployment
    
    # Afficher le résumé final
    show_final_summary
}

# Exécuter le script principal
main "$@"
