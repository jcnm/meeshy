# Optimisations Docker - Meeshy

## Modifications apportées

### 1. Frontend (`frontend/`)

**Nouveau fichier :** `.dockerignore`
- Exclut `node_modules/` et `.next/` du contexte Docker
- Évite la copie de fichiers temporaires et de développement

**Dockerfile mis à jour :**
- Multi-stage build optimisé
- Dependencies stage séparé pour mise en cache
- Commentaires explicatifs sur les exclusions

### 2. Gateway (`gateway/`)

**Nouvelle structure créée :**
```
gateway/
├── src/index.ts          # Service Fastify de base
├── Dockerfile            # Multi-stage build optimisé
├── .dockerignore         # Exclusions spécifiques
├── package.json          # Dépendances Fastify
├── tsconfig.json         # Configuration TypeScript
└── README.md             # Documentation
```

**Optimisations Docker :**
- Exclusion de `node_modules/` et `dist/`
- Build multi-stage pour image production minimale
- Utilisateur non-root pour sécurité
- Health check intégré

### 3. Global (`.dockerignore`)

**Améliorations :**
- Commentaires explicatifs sur pourquoi les fichiers sont exclus
- `node_modules/` et `.next/` marqués comme "générés durant le build"

## Avantages

1. **Performance** : Réduction drastique de la taille du contexte Docker
2. **Sécurité** : Pas de copie de dépendances potentiellement vulnérables
3. **Consistance** : Toujours les mêmes versions installées lors du build
4. **Cache** : Meilleure utilisation du cache Docker avec layers séparés

## Vérification

Pour vérifier que les exclusions fonctionnent :

```bash
# Vérifier le contexte Docker
docker build --no-cache -t test-frontend ./frontend
docker build --no-cache -t test-gateway ./gateway

# Les logs ne devraient pas montrer de copie de node_modules/ ou .next/
```
