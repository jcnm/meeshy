// Service de traduction simulée pour le développement
export const mockTranslationService = {
  async translate(text: string, fromLang: string, toLang: string): Promise<string> {
    console.log(`🌍 Traduction simulée: "${text}" (${fromLang} -> ${toLang})`);
    
    // Simuler un délai de traduction
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
    
    // Dictionnaire de traductions simulées
    const translations: Record<string, Record<string, Record<string, string>>> = {
      'fr': {
        'en': {
          'Salut ! Comment ça va ?': 'Hello! How are you?',
          'Très bien ! Et toi ?': 'Very good! And you?',
          'Bonjour': 'Hello',
          'Au revoir': 'Goodbye',
          'Merci': 'Thank you',
          'De rien': 'You\'re welcome',
          'Comment allez-vous ?': 'How are you?',
          'Ça va bien': 'I\'m doing well',
          'Le nouveau mockup est prêt !': 'The new mockup is ready!',
          'Parfait ! Je le regarde tout de suite.': 'Perfect! I\'ll look at it right away.'
        },
        'es': {
          'Salut ! Comment ça va ?': '¡Hola! ¿Cómo estás?',
          'Très bien ! Et toi ?': '¡Muy bien! ¿Y tú?',
          'Bonjour': 'Hola',
          'Au revoir': 'Adiós',
          'Merci': 'Gracias',
          'De rien': 'De nada'
        },
        'de': {
          'Salut ! Comment ça va ?': 'Hallo! Wie geht es dir?',
          'Très bien ! Et toi ?': 'Sehr gut! Und dir?',
          'Bonjour': 'Guten Tag',
          'Au revoir': 'Auf Wiedersehen',
          'Merci': 'Danke'
        }
      },
      'en': {
        'fr': {
          'Hello! How are you?': 'Salut ! Comment ça va ?',
          'Very good! And you?': 'Très bien ! Et toi ?',
          'Hello': 'Bonjour',
          'Goodbye': 'Au revoir',
          'Thank you': 'Merci'
        }
      }
    };
    
    // Chercher une traduction exacte
    const directTranslation = translations[fromLang]?.[toLang]?.[text];
    if (directTranslation) {
      return directTranslation;
    }
    
    // Traduction générique simulée
    if (toLang === 'en') {
      return `[EN] ${text}`;
    } else if (toLang === 'es') {
      return `[ES] ${text}`;
    } else if (toLang === 'de') {
      return `[DE] ${text}`;
    } else if (toLang === 'fr') {
      return `[FR] ${text}`;
    }
    
    return `[${toLang.toUpperCase()}] ${text}`;
  }
};
