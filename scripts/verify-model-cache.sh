#!/bin/bash

# Script de vérification du cache des modèles TensorFlow.js dans Meeshy

echo "🔍 === VÉRIFICATION DU CACHE DES MODÈLES MEESHY ==="
echo ""

# Fonction pour vérifier si l'application est en cours d'exécution
check_app_running() {
    if curl -s http://localhost:3000 > /dev/null; then
        echo "✅ Application Meeshy détectée sur http://localhost:3000"
        return 0
    else
        echo "❌ Application Meeshy non accessible sur http://localhost:3000"
        echo "💡 Lancez l'application avec: npm run dev"
        return 1
    fi
}

# Fonction pour ouvrir les outils de développement
open_dev_tools() {
    echo ""
    echo "🛠️ VÉRIFICATION MANUELLE RECOMMANDÉE:"
    echo ""
    echo "1. Ouvrez http://localhost:3000 dans votre navigateur"
    echo "2. Appuyez sur F12 pour ouvrir les outils de développement"
    echo "3. Allez dans l'onglet 'Console'"
    echo "4. Tapez ces commandes pour diagnostiquer:"
    echo ""
    echo "   // Vérifier localStorage"
    echo "   console.log('localStorage models:', JSON.parse(localStorage.getItem('meeshy-loaded-models') || '{}'));"
    echo ""
    echo "   // Vérifier IndexedDB"
    echo "   await new Promise(resolve => {"
    echo "     const request = indexedDB.open('meeshy-models-cache');"
    echo "     request.onsuccess = () => {"
    echo "       const db = request.result;"
    echo "       const transaction = db.transaction(['models'], 'readonly');"
    echo "       const store = transaction.objectStore('models');"
    echo "       const getAll = store.getAll();"
    echo "       getAll.onsuccess = () => {"
    echo "         console.log('IndexedDB models:', getAll.result);"
    echo "         resolve();"
    echo "       };"
    echo "     };"
    echo "   });"
    echo ""
    echo "   // Vérifier modèles TensorFlow.js en mémoire"
    echo "   console.log('TensorFlow models:', window.translationModels?.getLoadedModels());"
    echo ""
    echo "5. Allez dans l'onglet 'Application' > 'Storage'"
    echo "6. Vérifiez 'Local Storage' et 'IndexedDB' pour voir les données des modèles"
    echo ""
}

# Fonction pour créer un script de diagnostic côté client
create_diagnostic_script() {
    cat > /tmp/meeshy-model-diagnostic.js << 'EOF'
// Script de diagnostic des modèles Meeshy
(async function diagnoseModels() {
    console.log('🔍 === DIAGNOSTIC DES MODÈLES MEESHY ===');
    
    // 1. Vérifier localStorage
    try {
        const localStorageModels = JSON.parse(localStorage.getItem('meeshy-loaded-models') || '{}');
        console.log('📱 localStorage models:', localStorageModels);
        
        const downloadedCount = Object.values(localStorageModels).filter(Boolean).length;
        console.log(`📊 ${downloadedCount} modèles marqués téléchargés dans localStorage`);
    } catch (error) {
        console.error('❌ Erreur lecture localStorage:', error);
    }
    
    // 2. Vérifier IndexedDB
    try {
        const dbRequest = indexedDB.open('meeshy-models-cache');
        dbRequest.onsuccess = () => {
            const db = dbRequest.result;
            const transaction = db.transaction(['models'], 'readonly');
            const store = transaction.objectStore('models');
            const getAllRequest = store.getAll();
            
            getAllRequest.onsuccess = () => {
                const cachedModels = getAllRequest.result;
                console.log('💾 IndexedDB cached models:', cachedModels);
                console.log(`📊 ${cachedModels.length} modèles en cache IndexedDB`);
                
                const totalSize = cachedModels.reduce((sum, model) => sum + (model.info?.fileSize || 0), 0);
                console.log(`💽 Taille totale du cache: ${Math.round(totalSize / 1024 / 1024)}MB`);
            };
            
            getAllRequest.onerror = () => {
                console.error('❌ Erreur lecture IndexedDB');
            };
        };
        
        dbRequest.onerror = () => {
            console.error('❌ Impossible d\'ouvrir IndexedDB');
        };
    } catch (error) {
        console.error('❌ Erreur IndexedDB:', error);
    }
    
    // 3. Vérifier TensorFlow.js en mémoire
    try {
        if (window.translationModels) {
            const loadedModels = window.translationModels.getLoadedModels();
            console.log('🧠 TensorFlow.js models en mémoire:', loadedModels);
            console.log(`📊 ${loadedModels.length} modèles chargés en mémoire`);
        } else {
            console.warn('⚠️ translationModels non disponible sur window');
        }
    } catch (error) {
        console.error('❌ Erreur TensorFlow.js:', error);
    }
    
    // 4. Recommandations
    console.log('');
    console.log('💡 RECOMMANDATIONS:');
    console.log('- Si localStorage a des modèles mais TensorFlow.js est vide → problème de synchronisation');
    console.log('- Si IndexedDB est vide → les modèles ne sont pas vraiment téléchargés');
    console.log('- Utilisez le bouton "Synchroniser" dans les tests avancés');
    
    console.log('🔍 === FIN DU DIAGNOSTIC ===');
})();
EOF

    echo "📝 Script de diagnostic créé: /tmp/meeshy-model-diagnostic.js"
    echo "💡 Copiez-collez ce script dans la console du navigateur :"
    echo ""
    cat /tmp/meeshy-model-diagnostic.js
}

# Fonction principale
main() {
    echo "Date: $(date)"
    echo ""
    
    if check_app_running; then
        echo ""
        echo "🌐 Ouverture de l'application..."
        open "http://localhost:3000/settings" 2>/dev/null || echo "💡 Ouvrez manuellement: http://localhost:3000/settings"
        
        sleep 2
        open_dev_tools
        echo ""
        create_diagnostic_script
    else
        echo ""
        echo "🚀 Pour démarrer l'application :"
        echo "   cd $(pwd)"
        echo "   npm run dev"
        echo ""
        echo "Puis relancez ce script."
    fi
    
    echo ""
    echo "📚 ÉTAPES DE VÉRIFICATION:"
    echo "1. Allez dans Paramètres > Modèles"
    echo "2. Téléchargez un modèle (ex: mT5 Small)"
    echo "3. Allez dans Paramètres > Test Avancé"
    echo "4. Vérifiez si le modèle apparaît dans la liste"
    echo "5. Si non, cliquez sur 'Synchroniser'"
    echo ""
    echo "🔍 === VÉRIFICATION TERMINÉE ==="
}

# Exécution
main
