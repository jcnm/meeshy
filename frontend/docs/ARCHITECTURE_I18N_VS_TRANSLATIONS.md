# Architecture : i18n vs Traductions dans Meeshy

## 🏗️ Vue d'ensemble architecturale

Meeshy utilise **deux systèmes distincts** pour gérer les aspects linguistiques :

### 🌐 Système i18n (Internationalisation)
**Responsabilité** : Messages de l'interface utilisateur
**Scope** : Statique, prévisible, limité

### 💬 Système Traductions 
**Responsabilité** : Messages des utilisateurs dans les conversations
**Scope** : Dynamique, imprévisible, illimité

## 📊 Comparaison détaillée

| Aspect | 🌐 i18n (Interface) | 💬 Traductions (Messages) |
|--------|---------------------|---------------------------|
| **Objectif** | Interface utilisateur | Messages utilisateurs |
| **Contenu** | Boutons, menus, labels | Conversations, chats |
| **Nature** | Statique, prédéfini | Dynamique, généré |
| **Volume** | Limité (~1000 clés) | Illimité |
| **Fréquence** | Chargé une fois | Traduit en temps réel |
| **Cache** | Persistant, long terme | Temporaire, session |
| **Hook** | `useI18n()` | `useTranslation()` |
| **Service** | `i18n-loader.ts` | `translation.service.ts` |
| **Fichiers** | `/locales/{lang}/` | API Gateway/Translator |
| **Paramètres** | `{name}`, `{count}` | Variables contextuelles |

## 🔄 Flux de données

### Flux i18n (Interface)
```
1. Utilisateur visite une page
2. useI18n() détecte la langue d'interface préférée
3. Charge les modules d'interface nécessaires
4. Cache les messages d'interface
5. Affiche l'interface dans la langue choisie
```

### Flux Traductions (Messages)
```
1. Utilisateur tape un message
2. Message envoyé au service de traduction
3. IA traduit vers les langues cibles
4. Messages traduits diffusés aux participants
5. Cache temporaire pour optimisation
```

## 🎯 Exemples d'usage

### Composant avec les deux systèmes
```typescript
import { useI18n } from '@/hooks/useI18n';           // Interface
import { useTranslation } from '@/hooks/use-translation'; // Messages

function ChatWindow({ conversation }: { conversation: Conversation }) {
  // Interface en français/anglais/portugais
  const { t } = useI18n('conversations');
  
  // Traduction des messages utilisateurs
  const { translateText } = useTranslation();
  
  const handleSendMessage = async (message: string) => {
    // 1. Afficher interface de chargement (i18n)
    setStatus(t('sending')); // "Envoi en cours..." / "Sending..." / "Enviando..."
    
    // 2. Envoyer le message original
    await sendMessage(message);
    
    // 3. Traduire pour les autres participants (traductions)
    const translations = await Promise.all(
      conversation.participants.map(p => 
        translateText(message, p.preferredLanguage)
      )
    );
    
    // 4. Afficher succès (i18n)
    toast.success(t('toasts.success.messageSent'));
  };
  
  return (
    <div>
      {/* Interface traduite (i18n) */}
      <header>
        <h1>{t('title')}</h1>
        <button>{t('actions.newMessage')}</button>
      </header>
      
      {/* Messages utilisateurs (traductions) */}
      <div className="messages">
        {conversation.messages.map(msg => (
          <div key={msg.id}>
            <span>{msg.originalText}</span>
            {msg.translations && (
              <span className="translation">{msg.translations[userLanguage]}</span>
            )}
          </div>
        ))}
      </div>
      
      {/* Interface de saisie (i18n) */}
      <input placeholder={t('writeMessage')} />
      <button onClick={() => handleSendMessage(inputValue)}>
        {t('send')}
      </button>
    </div>
  );
}
```

## 🔧 Configuration

### Configuration i18n (Interface)
```typescript
// config/i18n.ts
export const I18N_CONFIG = {
  defaultLanguage: 'fr',
  supportedLanguages: ['en', 'fr', 'pt'],
  modules: ['common', 'auth', 'dashboard', ...],
  cache: true,
  preload: ['common', 'auth', 'components']
};
```

### Configuration Traductions (Messages)
```typescript
// config/translation.ts (existant)
export const TRANSLATION_CONFIG = {
  apiEndpoint: '/api/translate',
  models: ['basic', 'premium'],
  cache: { ttl: 300000 }, // 5 minutes
  supportedLanguages: ['en', 'fr', 'pt', 'es', 'de', ...]
};
```

## 📈 Performance

### Optimisations i18n
- **Chargement modulaire** : Seuls les modules d'interface nécessaires
- **Cache persistant** : Messages d'interface stockés long terme
- **Pré-chargement** : Modules critiques chargés en arrière-plan
- **Bundle splitting** : Code d'interface séparé par module

### Optimisations Traductions
- **Cache temporaire** : Traductions récentes en mémoire
- **Batch processing** : Traductions groupées
- **Streaming** : Traductions en temps réel
- **Fallback intelligent** : Modèles de secours

## 🚦 États et erreurs

### Erreurs i18n (Interface)
```typescript
// Erreurs de chargement d'interface
- MODULE_NOT_FOUND: Module d'interface introuvable
- LANGUAGE_NOT_SUPPORTED: Langue d'interface non supportée
- NETWORK_ERROR: Erreur réseau pour l'interface
- PARSE_ERROR: Erreur de parsing des messages d'interface
```

### Erreurs Traductions (Messages)
```typescript
// Erreurs de traduction (existantes)
- TRANSLATION_FAILED: Échec de traduction
- LANGUAGE_DETECTION_FAILED: Échec de détection de langue
- QUOTA_EXCEEDED: Quota de traduction dépassé
- SERVICE_UNAVAILABLE: Service de traduction indisponible
```

## 🎉 Avantages de cette architecture

### Clarté
- **Responsabilités séparées** : Chaque système a son rôle
- **APIs distinctes** : Pas de confusion entre les usages
- **Types séparés** : Sécurité de type pour chaque contexte

### Performance
- **Optimisation ciblée** : Chaque système optimisé pour son usage
- **Cache adapté** : Stratégies de cache différentes
- **Chargement intelligent** : À la demande vs temps réel

### Maintenabilité
- **Code organisé** : Séparation claire des préoccupations
- **Tests séparés** : Validation indépendante
- **Évolution indépendante** : Chaque système peut évoluer séparément

Cette architecture garantit une **séparation claire** entre l'internationalisation de l'interface et la traduction des messages, tout en optimisant les performances et la maintenabilité.
