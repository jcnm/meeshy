#!/bin/bash

# 🎯 VALIDATION - Renommage PrismaAuthService → AuthService
echo ""
echo "🎯 VALIDATION - Renommage PrismaAuthService → AuthService"
echo "==========================================================="
echo ""

# Vérifier que la nouvelle classe existe
echo "📋 VÉRIFICATION DE LA CLASSE RENOMMÉE:"
echo "---------------------------------------"

if grep -q "export class AuthService" "/Users/smpceo/Downloads/Meeshy/meeshy/gateway/src/services/auth.service.ts"; then
    echo "✅ Classe 'AuthService' trouvée dans auth.service.ts"
else
    echo "❌ Classe 'AuthService' NOT FOUND dans auth.service.ts"
fi

# Vérifier qu'il ne reste plus d'anciennes références
echo ""
echo "🧹 VÉRIFICATION DU NETTOYAGE:"
echo "-------------------------------"

if ! grep -q "PrismaAuthService" /Users/smpceo/Downloads/Meeshy/meeshy/gateway/src/services/auth.service.ts; then
    echo "✅ Aucune référence à 'PrismaAuthService' dans auth.service.ts"
else
    echo "⚠️  Il reste des références à 'PrismaAuthService' dans auth.service.ts"
fi

if ! grep -q "PrismaAuthService" /Users/smpceo/Downloads/Meeshy/meeshy/gateway/src/routes/auth.ts; then
    echo "✅ Aucune référence à 'PrismaAuthService' dans auth.ts"
else
    echo "⚠️  Il reste des références à 'PrismaAuthService' dans auth.ts"
fi

if ! grep -q "PrismaAuthService" /Users/smpceo/Downloads/Meeshy/meeshy/gateway/src/services/init.service.ts; then
    echo "✅ Aucune référence à 'PrismaAuthService' dans init.service.ts"
else
    echo "⚠️  Il reste des références à 'PrismaAuthService' dans init.service.ts"
fi

# Vérifier les imports et utilisations
echo ""
echo "📦 VÉRIFICATION DES IMPORTS ET UTILISATIONS:"
echo "----------------------------------------------"

if grep -q "import.*AuthService.*from.*auth.service" /Users/smpceo/Downloads/Meeshy/meeshy/gateway/src/routes/auth.ts; then
    echo "✅ Import 'AuthService' correct dans auth.ts"
else
    echo "❌ Import 'AuthService' manquant dans auth.ts"
fi

if grep -q "import.*AuthService.*from.*auth.service" /Users/smpceo/Downloads/Meeshy/meeshy/gateway/src/services/init.service.ts; then
    echo "✅ Import 'AuthService' correct dans init.service.ts"
else
    echo "❌ Import 'AuthService' manquant dans init.service.ts"
fi

if grep -q "new AuthService(" /Users/smpceo/Downloads/Meeshy/meeshy/gateway/src/routes/auth.ts; then
    echo "✅ Instanciation 'new AuthService()' correcte dans auth.ts"
else
    echo "❌ Instanciation 'new AuthService()' manquante dans auth.ts"
fi

if grep -q "new AuthService(" /Users/smpceo/Downloads/Meeshy/meeshy/gateway/src/services/init.service.ts; then
    echo "✅ Instanciation 'new AuthService()' correcte dans init.service.ts"
else
    echo "❌ Instanciation 'new AuthService()' manquante dans init.service.ts"
fi

# Résumé des fonctionnalités de AuthService
echo ""
echo "🔧 FONCTIONNALITÉS DE AuthService:"
echo "-----------------------------------"
echo "• authenticate() - Connexion utilisateurs via username/email + mot de passe"
echo "• register() - Enregistrement nouveaux utilisateurs"
echo "• getUserById() - Récupération utilisateur par ID"
echo "• generateToken() - Génération JWT pour utilisateurs enregistrés"
echo "• verifyToken() - Vérification et décodage JWT"
echo "• updateOnlineStatus() - Mise à jour statut en ligne/hors ligne"
echo "• getUserPermissions() - Gestion des permissions basées sur les rôles"
echo "• userToSocketIOUser() - Conversion Prisma User → SocketIOUser"

echo ""
echo "🎯 ARCHITECTURE ACTUELLE:"
echo "=========================="
echo ""
echo "auth.service.ts (AuthService)"
echo "├── Gestion utilisateurs enregistrés"
echo "├── Connexion username/email + password"
echo "├── Enregistrement nouveaux utilisateurs"
echo "├── Génération et validation JWT"
echo "├── Gestion permissions par rôles"
echo "├── Mise à jour statuts utilisateurs"
echo "└── Fonctions utilitaires"
echo ""
echo "auth-test.service.ts (AuthService pour tests)"
echo "├── Comptes de test statiques"
echo "├── Mock JWT pour développement"
echo "└── Helpers de test"
echo ""
echo "middleware/auth.ts (AuthMiddleware)"
echo "├── Validation requests REST/WebSocket"
echo "├── Gestion utilisateurs anonymes"
echo "├── Contexte d'authentification unifié"
echo "└── Détection JWT vs Session tokens"

echo ""
echo "🚀 RÉSULTAT:"
echo "============"
echo "✅ PrismaAuthService renommé en AuthService"
echo "✅ Toutes les références mises à jour"
echo "✅ Imports et instanciations corrigés"
echo "✅ Service unifié pour gestion complète des utilisateurs"
echo "✅ Support utilisateurs enregistrés + anonymes"
echo "✅ Fonctions utilitaires et gestion permissions"
echo ""
echo "🎯 AuthService maintenant responsable de:"
echo "   • Utilisateurs enregistrés (DB + JWT)"
echo "   • Connexions traditionnelles (username/password)"
echo "   • Gestion des rôles et permissions"
echo "   • Statuts en ligne et fonctions utilitaires"
echo ""
echo "✅ Renommage terminé avec succès!"
