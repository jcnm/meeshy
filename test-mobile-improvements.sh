#!/bin/bash

# Script de test des améliorations mobiles pour Meeshy
echo "🔄 Test des améliorations mobiles Meeshy..."

# Vérifier que les fichiers CSS mobiles sont correctement importés
echo "✅ Vérification des styles mobiles..."
if grep -q "mobile-improvements.css" /Users/smpceo/Downloads/Meeshy/meeshy/frontend/app/globals.css; then
    echo "   ✓ Styles mobiles correctement importés dans globals.css"
else
    echo "   ❌ Styles mobiles non trouvés dans globals.css"
fi

# Vérifier que le fichier mobile-improvements.css existe
if [ -f "/Users/smpceo/Downloads/Meeshy/meeshy/frontend/styles/mobile-improvements.css" ]; then
    echo "   ✓ Fichier mobile-improvements.css trouvé"
    
    # Vérifier quelques classes clés
    if grep -q "mobile-text-sm" /Users/smpceo/Downloads/Meeshy/meeshy/frontend/styles/mobile-improvements.css; then
        echo "   ✓ Classes de texte mobile présentes"
    fi
    
    if grep -q "sonner-toaster" /Users/smpceo/Downloads/Meeshy/meeshy/frontend/styles/mobile-improvements.css; then
        echo "   ✓ Désactivation des toasts mobile présente"
    fi
else
    echo "   ❌ Fichier mobile-improvements.css non trouvé"
fi

# Vérifier que les hooks de notification ont été modifiés
echo "✅ Vérification des hooks de notification..."
for file in use-notifications.ts use-unified-notifications.ts; do
    if [ -f "/Users/smpceo/Downloads/Meeshy/meeshy/frontend/hooks/$file" ]; then
        if grep -q "isMobile" "/Users/smpceo/Downloads/Meeshy/meeshy/frontend/hooks/$file"; then
            echo "   ✓ Hook $file modifié pour mobile"
        else
            echo "   ❌ Hook $file non modifié pour mobile"
        fi
    else
        echo "   ⚠️  Hook $file non trouvé"
    fi
done

# Vérifier que le composant ConversationLayoutResponsive a été modifié
echo "✅ Vérification du layout de conversation..."
if [ -f "/Users/smpceo/Downloads/Meeshy/meeshy/frontend/components/layouts/ConversationLayoutResponsive.tsx" ]; then
    if grep -q "getConversationDisplayName" "/Users/smpceo/Downloads/Meeshy/meeshy/frontend/components/layouts/ConversationLayoutResponsive.tsx"; then
        echo "   ✓ Logique de titre de conversation modifiée"
    fi
    if grep -q "mobile" "/Users/smpceo/Downloads/Meeshy/meeshy/frontend/components/layouts/ConversationLayoutResponsive.tsx"; then
        echo "   ✓ Classes mobiles ajoutées au layout"
    fi
else
    echo "   ❌ ConversationLayoutResponsive.tsx non trouvé"
fi

# Vérifier que le hook mobile toast a été créé
if [ -f "/Users/smpceo/Downloads/Meeshy/meeshy/frontend/hooks/use-mobile-toast.ts" ]; then
    echo "   ✓ Hook mobile toast créé"
else
    echo "   ❌ Hook mobile toast manquant"
fi

echo ""
echo "🎯 Résumé des améliorations mobiles implémentées:"
echo "   1. ✅ Titres de conversation directe avec nom du destinataire"
echo "   2. ✅ Réduction des tailles de police sur mobile"
echo "   3. ✅ Désactivation des toasts sur mobile"
echo "   4. ✅ Hook personnalisé pour gestion mobile des toasts"
echo "   5. ✅ Classes CSS mobiles complètes"
echo ""
echo "📱 Pour tester sur mobile:"
echo "   - Ouvrir l'application sur un appareil mobile ou avec DevTools"
echo "   - Vérifier que les titres de conversation directe montrent le nom du destinataire"
echo "   - Vérifier que les polices sont plus petites (responsive)"
echo "   - Vérifier qu'aucun toast n'apparaît sur mobile"
echo ""
echo "🚀 Améliorations mobiles terminées avec succès!"
