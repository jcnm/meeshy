#!/bin/bash

# 🧪 Script de validation des builds
# Ce script teste le build de chaque service et génère un rapport

set +e  # Ne pas arrêter sur erreur, on veut tester tout

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPORT_FILE="$PROJECT_ROOT/RAPPORT_VALIDATION_BUILDS.md"

echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}🧪 VALIDATION DES BUILDS - MEESHY${NC}"
echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}"
echo ""

cd "$PROJECT_ROOT"

# Initialiser les variables de résultat
SHARED_BUILD_SUCCESS=false
GATEWAY_BUILD_SUCCESS=false
FRONTEND_BUILD_SUCCESS=false
TRANSLATOR_CHECK_SUCCESS=false

# Créer le début du rapport
cat > "$REPORT_FILE" << 'HEADER'
# Rapport de Validation des Builds

**Date de génération**: $(date)  
**Projet**: Meeshy  
**Version**: 0.6.30-alpha

---

## 📋 Résumé Exécutif

Ce rapport présente les résultats de la validation des builds pour tous les services Meeshy.

---

HEADER

# Test 1: Shared
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}📦 TEST 1: SHARED - Génération des clients Prisma${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo ""

cat >> "$REPORT_FILE" << 'SHARED_HEADER'
## 📦 Shared - Génération Prisma

SHARED_HEADER

echo -e "${BLUE}Répertoire: $PROJECT_ROOT/shared${NC}"
echo -e "${YELLOW}Commande: pnpm run generate${NC}"
echo ""

cd shared

if pnpm run generate > /tmp/shared-build.log 2>&1; then
    SHARED_BUILD_SUCCESS=true
    echo -e "${GREEN}✅ Génération Prisma réussie !${NC}"
    
    cat >> "$REPORT_FILE" << 'SHARED_SUCCESS'
**Statut**: ✅ SUCCÈS

### Détails
- Prisma client généré avec succès
- Aucune erreur détectée

SHARED_SUCCESS

else
    echo -e "${RED}❌ Échec de la génération Prisma${NC}"
    echo -e "${YELLOW}📋 Voir les logs: /tmp/shared-build.log${NC}"
    
    cat >> "$REPORT_FILE" << 'SHARED_FAIL'
**Statut**: ❌ ÉCHEC

### Erreurs
```
SHARED_FAIL
    tail -50 /tmp/shared-build.log >> "$REPORT_FILE"
    echo '```' >> "$REPORT_FILE"
fi

echo ""
cd "$PROJECT_ROOT"

# Test 2: Gateway
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}🌐 TEST 2: GATEWAY - Build TypeScript${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo ""

cat >> "$REPORT_FILE" << 'GATEWAY_HEADER'

---

## 🌐 Gateway - Build TypeScript

GATEWAY_HEADER

echo -e "${BLUE}Répertoire: $PROJECT_ROOT/gateway${NC}"
echo -e "${YELLOW}Commande: pnpm run build${NC}"
echo ""

cd gateway

# Vérifier que node_modules existe
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}⚠️  node_modules non trouvé, installation des dépendances...${NC}"
    pnpm install > /dev/null 2>&1
fi

if pnpm run build > /tmp/gateway-build.log 2>&1; then
    GATEWAY_BUILD_SUCCESS=true
    echo -e "${GREEN}✅ Build Gateway réussi !${NC}"
    
    # Vérifier que le répertoire dist existe
    if [ -d "dist" ]; then
        FILE_COUNT=$(find dist -type f | wc -l | tr -d ' ')
        echo -e "${BLUE}📊 Fichiers générés: $FILE_COUNT${NC}"
        
        cat >> "$REPORT_FILE" << EOF
**Statut**: ✅ SUCCÈS

### Détails
- Build TypeScript réussi
- Fichiers générés: $FILE_COUNT
- Répertoire: \`dist/\`

EOF
    fi
else
    echo -e "${RED}❌ Échec du build Gateway${NC}"
    echo -e "${YELLOW}📋 Voir les logs: /tmp/gateway-build.log${NC}"
    
    cat >> "$REPORT_FILE" << 'GATEWAY_FAIL'
**Statut**: ❌ ÉCHEC

### Erreurs
```
GATEWAY_FAIL
    tail -50 /tmp/gateway-build.log >> "$REPORT_FILE"
    echo '```' >> "$REPORT_FILE"
fi

echo ""
cd "$PROJECT_ROOT"

# Test 3: Frontend
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}🎨 TEST 3: FRONTEND - Build Next.js${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo ""

cat >> "$REPORT_FILE" << 'FRONTEND_HEADER'

---

## 🎨 Frontend - Build Next.js

FRONTEND_HEADER

echo -e "${BLUE}Répertoire: $PROJECT_ROOT/frontend${NC}"
echo -e "${YELLOW}Commande: pnpm run build${NC}"
echo ""

cd frontend

# Vérifier que node_modules existe
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}⚠️  node_modules non trouvé, installation des dépendances...${NC}"
    pnpm install > /dev/null 2>&1
fi

if pnpm run build > /tmp/frontend-build.log 2>&1; then
    FRONTEND_BUILD_SUCCESS=true
    echo -e "${GREEN}✅ Build Frontend réussi !${NC}"
    
    # Vérifier que le répertoire .next existe
    if [ -d ".next" ]; then
        echo -e "${BLUE}📊 Build Next.js généré dans .next/${NC}"
        
        cat >> "$REPORT_FILE" << 'FRONTEND_SUCCESS'
**Statut**: ✅ SUCCÈS

### Détails
- Build Next.js réussi
- Répertoire: `.next/`
- Production build optimisé

FRONTEND_SUCCESS
    fi
else
    echo -e "${RED}❌ Échec du build Frontend${NC}"
    echo -e "${YELLOW}📋 Voir les logs: /tmp/frontend-build.log${NC}"
    
    cat >> "$REPORT_FILE" << 'FRONTEND_FAIL'
**Statut**: ❌ ÉCHEC

### Erreurs
```
FRONTEND_FAIL
    tail -50 /tmp/frontend-build.log >> "$REPORT_FILE"
    echo '```' >> "$REPORT_FILE"
fi

echo ""
cd "$PROJECT_ROOT"

# Test 4: Translator
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}🔤 TEST 4: TRANSLATOR - Vérification Python${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo ""

cat >> "$REPORT_FILE" << 'TRANSLATOR_HEADER'

---

## 🔤 Translator - Vérification Python

TRANSLATOR_HEADER

echo -e "${BLUE}Répertoire: $PROJECT_ROOT/translator${NC}"
echo -e "${YELLOW}Test: Vérification des dépendances Python${NC}"
echo ""

cd translator

# Vérifier requirements.txt
if [ -f "requirements.txt" ]; then
    echo -e "${GREEN}✅ requirements.txt trouvé${NC}"
    REQ_COUNT=$(wc -l < requirements.txt | tr -d ' ')
    echo -e "${BLUE}📦 Dépendances listées: $REQ_COUNT${NC}"
    
    # Vérifier que les fichiers Python existent
    if [ -f "src/main.py" ]; then
        echo -e "${GREEN}✅ src/main.py trouvé${NC}"
        TRANSLATOR_CHECK_SUCCESS=true
        
        cat >> "$REPORT_FILE" << EOF
**Statut**: ✅ SUCCÈS

### Détails
- requirements.txt trouvé ($REQ_COUNT dépendances)
- src/main.py trouvé
- Structure du projet valide

**Note**: Le build Python n'est pas nécessaire (langage interprété)

EOF
    else
        echo -e "${RED}❌ src/main.py non trouvé${NC}"
        
        cat >> "$REPORT_FILE" << 'TRANSLATOR_FAIL'
**Statut**: ⚠️ ATTENTION

### Problèmes
- src/main.py non trouvé
- Structure du projet à vérifier

TRANSLATOR_FAIL
    fi
else
    echo -e "${RED}❌ requirements.txt non trouvé${NC}"
    
    cat >> "$REPORT_FILE" << 'TRANSLATOR_NO_REQ'
**Statut**: ❌ ÉCHEC

### Erreurs
- requirements.txt non trouvé
- Impossible de valider les dépendances

TRANSLATOR_NO_REQ
fi

echo ""
cd "$PROJECT_ROOT"

# Générer le résumé
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}📊 RÉSUMÉ DE LA VALIDATION${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo ""

cat >> "$REPORT_FILE" << 'SUMMARY_HEADER'

---

## 📊 Résumé Global

### Résultats des Tests

SUMMARY_HEADER

# Compter les succès
SUCCESS_COUNT=0
TOTAL_TESTS=4

if [ "$SHARED_BUILD_SUCCESS" = true ]; then
    echo -e "${GREEN}✅ Shared (Prisma): SUCCÈS${NC}"
    echo "- ✅ **Shared (Prisma)**: SUCCÈS" >> "$REPORT_FILE"
    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
else
    echo -e "${RED}❌ Shared (Prisma): ÉCHEC${NC}"
    echo "- ❌ **Shared (Prisma)**: ÉCHEC" >> "$REPORT_FILE"
fi

if [ "$GATEWAY_BUILD_SUCCESS" = true ]; then
    echo -e "${GREEN}✅ Gateway (TypeScript): SUCCÈS${NC}"
    echo "- ✅ **Gateway (TypeScript)**: SUCCÈS" >> "$REPORT_FILE"
    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
else
    echo -e "${RED}❌ Gateway (TypeScript): ÉCHEC${NC}"
    echo "- ❌ **Gateway (TypeScript)**: ÉCHEC" >> "$REPORT_FILE"
fi

if [ "$FRONTEND_BUILD_SUCCESS" = true ]; then
    echo -e "${GREEN}✅ Frontend (Next.js): SUCCÈS${NC}"
    echo "- ✅ **Frontend (Next.js)**: SUCCÈS" >> "$REPORT_FILE"
    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
else
    echo -e "${RED}❌ Frontend (Next.js): ÉCHEC${NC}"
    echo "- ❌ **Frontend (Next.js)**: ÉCHEC" >> "$REPORT_FILE"
fi

if [ "$TRANSLATOR_CHECK_SUCCESS" = true ]; then
    echo -e "${GREEN}✅ Translator (Python): SUCCÈS${NC}"
    echo "- ✅ **Translator (Python)**: SUCCÈS" >> "$REPORT_FILE"
    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
else
    echo -e "${RED}❌ Translator (Python): ÉCHEC${NC}"
    echo "- ❌ **Translator (Python)**: ÉCHEC" >> "$REPORT_FILE"
fi

echo ""
echo -e "${BLUE}Score: $SUCCESS_COUNT/$TOTAL_TESTS tests réussis${NC}"
echo ""

cat >> "$REPORT_FILE" << EOF

### Score Final

**$SUCCESS_COUNT/$TOTAL_TESTS tests réussis** ($(( SUCCESS_COUNT * 100 / TOTAL_TESTS ))%)

EOF

# Recommandations
cat >> "$REPORT_FILE" << 'RECOMMENDATIONS'

---

## 📌 Recommandations

RECOMMENDATIONS

if [ $SUCCESS_COUNT -eq $TOTAL_TESTS ]; then
    cat >> "$REPORT_FILE" << 'ALL_SUCCESS'
### 🎉 Tous les tests ont réussi !

Vous pouvez procéder au démarrage de l'environnement de développement:

```bash
./scripts/meeshy.sh dev start
```

ALL_SUCCESS
    echo -e "${GREEN}🎉 Tous les tests ont réussi !${NC}"
else
    cat >> "$REPORT_FILE" << 'SOME_FAIL'
### ⚠️ Certains tests ont échoué

#### Actions recommandées:

1. **Vérifier les logs d'erreur** dans `/tmp/`
2. **Corriger les problèmes identifiés**
3. **Re-exécuter ce script** pour valider les corrections

#### Commandes utiles:

```bash
# Voir les logs d'erreur
cat /tmp/shared-build.log
cat /tmp/gateway-build.log
cat /tmp/frontend-build.log

# Corriger les versions Prisma si nécessaire
./scripts/fix-prisma-versions.sh

# Réinstaller les dépendances
pnpm install

# Re-tester
./scripts/validate-builds.sh
```

SOME_FAIL
    echo -e "${YELLOW}⚠️  Certains tests ont échoué. Consultez le rapport pour plus de détails.${NC}"
fi

cat >> "$REPORT_FILE" << 'FOOTER'

---

## 🔍 Fichiers de Logs

Les logs détaillés sont disponibles dans:
- `/tmp/shared-build.log`
- `/tmp/gateway-build.log`
- `/tmp/frontend-build.log`

---

**Rapport généré par**: `scripts/validate-builds.sh`  
**Date**: $(date)

FOOTER

echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}📄 Rapport généré: $REPORT_FILE${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
echo ""

# Code de sortie basé sur le succès
if [ $SUCCESS_COUNT -eq $TOTAL_TESTS ]; then
    exit 0
else
    exit 1
fi

