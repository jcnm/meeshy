// Version simplifiée du détecteur de traductions pour éviter les cycles infinis

export const createSimpleTranslationDetector = () => {
  return `
  // 🎯 DÉTECTION SIMPLIFIÉE DES NOUVELLES TRADUCTIONS (éviter les cycles infinis)
  useEffect(() => {
    const currentCount = message?.translations?.length || 0;
    
    console.log(\`🔍 [SIMPLE-DETECTOR] Message \${message.id}: \${currentCount} traductions\`, {
      currentCount,
      lastCount: lastTranslationCount,
      isInitialLoad,
      conversationFullyLoaded
    });
    
    // Au premier chargement, marquer tout comme vu sans toast
    if (isInitialLoad && currentCount > 0) {
      console.log(\`🏁 [INITIAL-LOAD] Message \${message.id}: \${currentCount} traductions marquées comme vues\`);
      setLastTranslationCount(currentCount);
      setIsInitialLoad(false);
      return;
    }
    
    // Détecter seulement les nouvelles traductions après stabilisation
    if (!isInitialLoad && conversationFullyLoaded && currentCount > lastTranslationCount) {
      const newCount = currentCount - lastTranslationCount;
      console.log(\`🎉 [NEW-TRANSLATIONS] \${newCount} nouvelles traductions pour message \${message.id}\`);
      
      // Badge increment
      onBadgeIncrement?.(newCount);
      setNewTranslationsCount(prev => prev + newCount);
      
      // Simple toast
      toast.success(\`🌍 \${newCount} nouvelle\${newCount > 1 ? 's' : ''} traduction\${newCount > 1 ? 's' : ''}\`, {
        description: "Traduction terminée",
        duration: 3000,
        id: \`new-translations-\${message.id}-\${Date.now()}\`
      });
      
      // Indicateurs visuels
      setShowNewTranslationsIndicator(true);
      setShowTranslationArrivedIndicator(true);
      setTimeout(() => setShowTranslationArrivedIndicator(false), 3000);
      setTimeout(() => setShowNewTranslationsIndicator(false), 8000);
      
      setLastTranslationCount(currentCount);
    }
  }, [message?.translations?.length, isInitialLoad, conversationFullyLoaded, lastTranslationCount, onBadgeIncrement, message.id]);
  `;
};