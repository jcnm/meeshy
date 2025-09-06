#!/bin/bash

# 🛑 Script d'arrêt pour l'environnement de PRODUCTION (DigitalOcean)
# Ce script arrête tous les services Meeshy en production
set -e

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}🛑 Arrêt de l'environnement Meeshy PRODUCTION${NC}"
echo ""

# Charger la configuration de production si disponible
if [ -f ".env.production" ]; then
    echo -e "${BLUE}📋 Chargement de la configuration production${NC}"
    set -a
    source .env.production
    set +a
fi

# Fonction pour afficher les logs avant arrêt
show_service_status() {
    echo -e "${BLUE}📊 Statut actuel des services:${NC}"
    docker-compose -f docker-compose.prod.yml ps 2>/dev/null || echo "Aucun service en cours"
}

# Fonction pour sauvegarder les logs
backup_logs() {
    local timestamp=$(date +"%Y%m%d_%H%M%S")
    local backup_dir="./logs/backup_$timestamp"
    
    echo -e "${YELLOW}📝 Sauvegarde des logs avant arrêt...${NC}"
    
    mkdir -p "$backup_dir"
    
    # Sauvegarder les logs de chaque service
    services=("traefik" "frontend" "gateway" "translator" "database" "redis")
    
    for service in "${services[@]}"; do
        echo -e "${BLUE}💾 Sauvegarde des logs $service...${NC}"
        docker-compose -f docker-compose.prod.yml logs "$service" > "$backup_dir/${service}.log" 2>/dev/null || true
    done
    
    echo -e "${GREEN}✅ Logs sauvegardés dans: $backup_dir${NC}"
}

# Afficher le statut actuel
show_service_status

# Option pour sauvegarder les logs
read -p "Voulez-vous sauvegarder les logs avant l'arrêt ? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    backup_logs
fi

# Arrêt gracieux des services
echo -e "${BLUE}🛑 Arrêt gracieux des services de production...${NC}"

# Arrêter les services dans l'ordre optimal
services_order=("frontend" "gateway" "translator" "traefik" "redis" "database")

for service in "${services_order[@]}"; do
    echo -e "${YELLOW}🛑 Arrêt de $service...${NC}"
    docker-compose -f docker-compose.prod.yml stop "$service" 2>/dev/null || echo "Service $service déjà arrêté"
    sleep 2
done

# Arrêt complet
echo -e "${BLUE}🛑 Arrêt complet de tous les services...${NC}"
docker-compose -f docker-compose.prod.yml down --remove-orphans

# Option pour nettoyer les volumes (ATTENTION: perte de données)
echo ""
echo -e "${YELLOW}⚠️  Options de nettoyage:${NC}"
echo -e "${RED}ATTENTION: Les options suivantes peuvent supprimer des données !${NC}"
echo ""

read -p "Voulez-vous supprimer les conteneurs arrêtés ? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}🗑️  Suppression des conteneurs arrêtés...${NC}"
    docker-compose -f docker-compose.prod.yml rm -f
fi

read -p "Voulez-vous supprimer les volumes de données ? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}🗑️  Suppression des volumes de données...${NC}"
    echo -e "${RED}ATTENTION: Ceci supprimera TOUTES les données (base de données, cache, certificats SSL) !${NC}"
    read -p "Êtes-vous VRAIMENT sûr ? Tapez 'DELETE' pour confirmer: " confirm
    if [ "$confirm" = "DELETE" ]; then
        docker-compose -f docker-compose.prod.yml down -v
        echo -e "${RED}✅ Volumes supprimés${NC}"
    else
        echo -e "${GREEN}✅ Volumes conservés${NC}"
    fi
fi

read -p "Voulez-vous supprimer les images Docker ? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}🗑️  Suppression des images Docker...${NC}"
    
    # Supprimer les images Meeshy
    images=("$TRANSLATOR_IMAGE" "$GATEWAY_IMAGE" "$FRONTEND_IMAGE")
    for image in "${images[@]}"; do
        if [ -n "$image" ]; then
            echo -e "${BLUE}🗑️  Suppression de l'image: $image${NC}"
            docker rmi "$image" 2>/dev/null || echo "Image $image déjà supprimée"
        fi
    done
    
    # Nettoyer les images orphelines
    echo -e "${BLUE}🧹 Nettoyage des images orphelines...${NC}"
    docker image prune -f
fi

# Nettoyage général du système Docker (optionnel)
read -p "Voulez-vous faire un nettoyage complet de Docker ? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}🧹 Nettoyage complet de Docker...${NC}"
    docker system prune -f
fi

# Vérification finale
echo -e "${BLUE}📊 Statut final:${NC}"
docker-compose -f docker-compose.prod.yml ps 2>/dev/null || echo "Aucun service Meeshy en cours"

# Vérifier les processus Docker restants
running_containers=$(docker ps --filter "name=meeshy" --format "table {{.Names}}\t{{.Status}}" 2>/dev/null | grep -v NAMES || true)
if [ -n "$running_containers" ]; then
    echo -e "${YELLOW}⚠️  Conteneurs Meeshy encore en cours:${NC}"
    echo "$running_containers"
else
    echo -e "${GREEN}✅ Aucun conteneur Meeshy en cours${NC}"
fi

echo ""
echo -e "${GREEN}✅ Environnement Meeshy PRODUCTION arrêté avec succès !${NC}"
echo ""
echo -e "${CYAN}📋 Résumé:${NC}"
echo -e "  ${GREEN}Services Docker:${NC} Arrêtés"
echo -e "  ${GREEN}Conteneurs:${NC} Supprimés (si demandé)"
echo -e "  ${GREEN}Volumes:${NC} Conservés (sauf si suppression demandée)"
echo -e "  ${GREEN}Logs:${NC} Sauvegardés (si demandé)"
echo ""
echo -e "${PURPLE}🚀 Pour redémarrer l'environnement de production:${NC}"
echo -e "  ${YELLOW}./scripts/production/start-production.sh${NC}"
echo ""
echo -e "${CYAN}💡 Conseils:${NC}"
echo -e "  ${GREEN}Surveillance:${NC} Vérifiez que le domaine n'est plus accessible"
echo -e "  ${GREEN}DNS:${NC} Les enregistrements DNS pointent toujours vers ce serveur"
echo -e "  ${GREEN}SSL:${NC} Les certificats Let's Encrypt sont conservés (sauf si volumes supprimés)"
echo ""
