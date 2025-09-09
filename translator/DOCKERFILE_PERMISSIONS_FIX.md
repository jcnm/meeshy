# Correction des Permissions Dockerfile Translator

## Problème Identifié

L'image Docker du service translator avait des problèmes de permissions lors du téléchargement des modèles ML. Les erreurs indiquaient :

```
PermissionError at /workspace/models/models--t5-small when downloading t5-small
PermissionError at /workspace/models/models--facebook--nllb-200-distilled-600M when downloading facebook/nllb-200-distilled-600M
```

## Cause du Problème

Le Dockerfile utilisait l'utilisateur `ovhcloud` (UID 42420) qui était spécifique à OVHcloud AI Deploy, mais dans un environnement root standard, cet utilisateur n'avait pas les bonnes permissions pour créer et télécharger des modèles dans le répertoire `/workspace/models`.

## Solution Appliquée

### 1. Remplacement de l'utilisateur

**Avant :**
```dockerfile
&& groupadd -g 42420 ovhcloud \
&& useradd -u 42420 -g ovhcloud -m ovhcloud \
```

**Après :**
```dockerfile
&& groupadd translator \
&& useradd -g translator -m translator \
```

### 2. Mise à jour des permissions

Toutes les références à l'utilisateur ovhcloud ont été remplacées par translator :

- `COPY --chown=42420:42420` → `COPY --chown=translator:translator`
- `chown -R 42420:42420` → `chown -R translator:translator`
- `USER 42420:42420` → `USER translator:translator`

### 3. Configuration spécifique des permissions ML

Ajout d'une section dédiée pour configurer les permissions des répertoires de modèles :

```dockerfile
# OPTIMISATION: Configuration finale des permissions pour les modèles ML
RUN echo "🔧 Configuration des permissions pour les modèles ML..." \
    && mkdir -p /workspace/models/models--t5-small \
    && mkdir -p /workspace/models/models--facebook--nllb-200-distilled-600M \
    && chown -R translator:translator /workspace/models \
    && chmod -R 755 /workspace/models \
    && echo "✅ Permissions configurées pour les modèles ML"
```

### 4. Permissions explicites sur les répertoires critiques

```dockerfile
&& chmod -R 755 /workspace/models \
&& chmod -R 755 /workspace/cache \
&& chmod -R 755 /workspace/logs \
```

## Avantages de la Solution

1. **Compatibilité universelle** : L'utilisateur `translator` est créé avec les UID/GID par défaut du système
2. **Permissions explicites** : Les répertoires de modèles ont des permissions 755, permettant la lecture/écriture pour l'utilisateur et la lecture pour les autres
3. **Pré-création des répertoires** : Les répertoires de modèles sont créés à l'avance avec les bonnes permissions
4. **Sécurité maintenue** : L'utilisateur reste non-root pour la sécurité

## Test de Validation

Un script de test a été créé : `test-dockerfile-permissions.sh`

Ce script :
- Construit l'image Docker
- Vérifie les permissions des répertoires critiques
- Teste la création de fichiers dans les répertoires de modèles
- Valide que l'utilisateur `translator` a les bonnes permissions

## Utilisation

Pour tester les modifications :

```bash
cd translator
./test-dockerfile-permissions.sh
```

## Résultat Attendu

Après ces modifications, le service translator devrait pouvoir :
- Télécharger les modèles ML sans erreurs de permissions
- Créer et modifier des fichiers dans `/workspace/models`
- Fonctionner correctement dans un environnement root standard
- Maintenir la sécurité avec un utilisateur non-root (`translator`)

## Variables d'Environnement ML

Les variables d'environnement suivantes sont configurées pour pointer vers `/workspace/models` :

- `HF_HOME=/workspace/models`
- `TORCH_HOME=/workspace/models`
- `MODEL_DIR=/workspace/models`
- `MODEL_CACHE_DIR=/workspace/models`
- `MODELS_PATH=/workspace/models`

Ces variables garantissent que tous les outils ML (Hugging Face, PyTorch) utilisent le bon répertoire avec les bonnes permissions.
