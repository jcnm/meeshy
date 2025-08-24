# Configuration des Workers de Traduction

## Vue d'ensemble

Le service de traduction Meeshy utilise un système de workers avec scaling dynamique pour gérer les traductions. Les workers sont divisés en deux catégories :

- **Normal Workers** : Gèrent les traductions des conversations normales
- **Any Workers** : Gèrent les traductions des conversations "any" (anonymes)

## Variables de Configuration

### Valeurs par Défaut
- `NORMAL_WORKERS_DEFAULT` : Nombre de workers normaux par défaut (défaut: 20)
- `ANY_WORKERS_DEFAULT` : Nombre de workers "any" par défaut (défaut: 10)

### Limites Minimales (Scaling Down)
- `NORMAL_WORKERS_MIN` : Nombre minimum de workers normaux (défaut: 2)
- `ANY_WORKERS_MIN` : Nombre minimum de workers "any" (défaut: 2)

### Limites Maximales (Scaling Up)
- `NORMAL_WORKERS_MAX` : Nombre maximum de workers normaux (défaut: 40)
- `ANY_WORKERS_MAX` : Nombre maximum de workers "any" (défaut: 20)

### Limites de Scaling Dynamique
- `NORMAL_WORKERS_SCALING_MAX` : Limite max pour le scaling dynamique des workers normaux (défaut: 40)
- `ANY_WORKERS_SCALING_MAX` : Limite max pour le scaling dynamique des workers "any" (défaut: 20)

## Exemples de Configuration

### Configuration Minimaliste (pour développement)
```bash
NORMAL_WORKERS_DEFAULT=5
ANY_WORKERS_DEFAULT=3
NORMAL_WORKERS_MIN=1
ANY_WORKERS_MIN=1
NORMAL_WORKERS_MAX=10
ANY_WORKERS_MAX=8
```

### Configuration Haute Performance (pour production)
```bash
NORMAL_WORKERS_DEFAULT=50
ANY_WORKERS_DEFAULT=25
NORMAL_WORKERS_MIN=5
ANY_WORKERS_MIN=3
NORMAL_WORKERS_MAX=100
ANY_WORKERS_MAX=50
```

### Configuration Économique (pour économiser les ressources)
```bash
NORMAL_WORKERS_DEFAULT=10
ANY_WORKERS_DEFAULT=5
NORMAL_WORKERS_MIN=2
ANY_WORKERS_MIN=2
NORMAL_WORKERS_MAX=20
ANY_WORKERS_MAX=10
```

## Scaling Dynamique

Le système ajuste automatiquement le nombre de workers en fonction de la charge :

### Scaling Up (augmentation)
- **Normal Workers** : Si la queue > 100 et utilisation > 80%
- **Any Workers** : Si la queue > 50 et utilisation > 80%

### Scaling Down (diminution)
- **Normal Workers** : Si la queue < 10 et utilisation < 30%
- **Any Workers** : Si la queue < 5 et utilisation < 30%

## Application de la Configuration

### Via Variables d'Environnement
```bash
export NORMAL_WORKERS_DEFAULT=15
export ANY_WORKERS_DEFAULT=8
export NORMAL_WORKERS_MIN=2
export ANY_WORKERS_MIN=2
docker-compose restart translator
```

### Via Fichier .env
```bash
# Ajouter dans translator/.env
NORMAL_WORKERS_DEFAULT=15
ANY_WORKERS_DEFAULT=8
NORMAL_WORKERS_MIN=2
ANY_WORKERS_MIN=2
NORMAL_WORKERS_MAX=30
ANY_WORKERS_MAX=15
```

### Via Docker Compose
```yaml
environment:
  NORMAL_WORKERS_DEFAULT: 15
  ANY_WORKERS_DEFAULT: 8
  NORMAL_WORKERS_MIN: 2
  ANY_WORKERS_MIN: 2
```

## Monitoring

Les logs affichent la configuration au démarrage :
```
[TRANSLATOR] 🔧 Configuration workers:
  Normal: 20 (min: 2, max: 40, scaling_max: 40)
  Any: 10 (min: 2, max: 20, scaling_max: 20)
```

## Recommandations

### Pour le Développement
- Utilisez des valeurs minimales pour économiser les ressources
- Gardez au moins 2 workers de chaque type pour la disponibilité

### Pour la Production
- Ajustez selon la charge attendue
- Surveillez les métriques de performance
- Augmentez les limites max si nécessaire

### Pour les Tests
- Utilisez le script `scripts/test-worker-config.sh` pour tester différentes configurations

## Dépannage

### Problème : Workers ne descendent pas en dessous de 20/10
**Solution** : Vérifiez que `NORMAL_WORKERS_MIN` et `ANY_WORKERS_MIN` sont bien configurés

### Problème : Scaling dynamique ne fonctionne pas
**Solution** : Vérifiez que `enable_dynamic_scaling` est activé

### Problem : Too many workers created
**Solution** : Reduce `NORMAL_WORKERS_MAX` and `ANY_WORKERS_MAX`
