# 🌐 Meeshy Internationalization (i18n) Implementation

## Overview

Meeshy now supports internationalization with three languages: **English (EN)**, **French (FR)**, and **Portuguese (PT)**. The system provides automatic language detection, user language configuration, and a dynamic interface language switcher.

## Features

### ✅ Implemented Features

1. **UserLanguageConfig Interface**
   - System language detection
   - Regional language detection
   - Custom destination language
   - Auto-translate settings
   - Translation preferences

2. **Language Detection & Configuration**
   - Automatic browser language detection
   - Region-based language detection
   - Persistent language preferences
   - Fallback to English if detection fails

3. **Interface Language Switching**
   - Dynamic language switcher in header
   - Real-time interface language changes
   - Persistent language selection
   - Visual language indicators

4. **Translation System**
   - next-intl integration
   - JSON-based translation files
   - Type-safe translation keys
   - Fallback translations

## Architecture

### File Structure

```
frontend/
├── context/
│   └── LanguageContext.tsx          # Language management context
├── components/
│   └── common/
│       ├── language-switcher.tsx    # Language switcher component
│       └── translation-provider.tsx # Translation provider
├── locales/
│   ├── en.json                      # English translations
│   ├── fr.json                      # French translations
│   └── pt.json                      # Portuguese translations
├── lib/
│   └── i18n.ts                      # i18n configuration
├── middleware.ts                    # Locale routing middleware
└── types/
    └── index.ts                     # UserLanguageConfig interface
```

### Key Components

#### 1. LanguageContext
- Manages `UserLanguageConfig` state
- Handles language detection and persistence
- Provides language switching functions
- Supports system, regional, and custom languages

#### 2. TranslationProvider
- Dynamic translation loading
- Real-time language switching
- Fallback to English on errors
- Client-side translation management

#### 3. LanguageSwitcher
- Dropdown language selector
- Visual language indicators
- Native language names
- Persistent selection

## UserLanguageConfig Interface

```typescript
interface UserLanguageConfig {
  systemLanguage: string;              // Default: "fr"
  regionalLanguage: string;            // Default: "fr"
  customDestinationLanguage?: string;  // Optional
  autoTranslateEnabled: boolean;       // Default: true
  translateToSystemLanguage: boolean;  // Default: true
  translateToRegionalLanguage: boolean; // Default: false
  useCustomDestination: boolean;       // Default: false
}
```

## Language Detection Flow

1. **First Visit**
   - Detect browser language
   - Detect regional language
   - Set `customDestinationLanguage` to system language
   - Use system language as interface language

2. **Subsequent Visits**
   - Load saved `UserLanguageConfig` from localStorage
   - Use `customDestinationLanguage` as interface language
   - Maintain user preferences

3. **Language Switching**
   - Update `customDestinationLanguage`
   - Update interface language
   - Persist changes to localStorage

## Translation Keys Structure

```json
{
  "common": { ... },
  "navigation": { ... },
  "landing": {
    "hero": { ... },
    "features": { ... },
    "cta": { ... },
    "footer": { ... }
  },
  "auth": {
    "login": { ... },
    "register": { ... },
    "joinConversation": { ... }
  },
  "header": { ... },
  "language": { ... },
  "errors": { ... },
  "success": { ... }
}
```

## Usage Examples

### Using Translations in Components

```tsx
import { useTranslations } from 'next-intl';

export function MyComponent() {
  const t = useTranslations('landing.hero');
  
  return (
    <h1>{t('title')}</h1>
  );
}
```

### Language Context Usage

```tsx
import { useLanguage } from '@/context/LanguageContext';

export function LanguageSettings() {
  const { 
    userLanguageConfig, 
    currentInterfaceLanguage,
    setInterfaceLanguage 
  } = useLanguage();
  
  return (
    <button onClick={() => setInterfaceLanguage('en')}>
      Switch to English
    </button>
  );
}
```

## Testing

### Development Testing

```bash
# Start frontend development server
./start-frontend-dev.sh

# Access at http://localhost:3100
```

### Production Testing

```bash
# Start all services with Docker
./start-all.sh

# Access at http://localhost:3100
```

### Testing Steps

1. **Language Detection**
   - Change browser language settings
   - Refresh page
   - Verify automatic language detection

2. **Language Switching**
   - Click language switcher in header
   - Select different languages
   - Verify interface language changes

3. **Persistence**
   - Switch language
   - Refresh page
   - Verify language preference is maintained

4. **Fallback**
   - Test with unsupported languages
   - Verify fallback to English

## Configuration

### Adding New Languages

1. **Add language to supported list**
   ```typescript
   // lib/i18n.ts
   export const locales = ['en', 'fr', 'pt', 'es'] as const;
   ```

2. **Create translation file**
   ```bash
   # Create locales/es.json
   ```

3. **Update language configuration**
   ```typescript
   // context/LanguageContext.tsx
   const SUPPORTED_LANGUAGES = [
     // ... existing languages
     { code: 'es', name: 'Spanish', nativeName: 'Español' },
   ];
   ```

### Environment Variables

```bash
# Optional: Override default locale
NEXT_PUBLIC_DEFAULT_LOCALE=en
```

## Performance Considerations

- **Lazy Loading**: Translation files are loaded dynamically
- **Caching**: Language preferences cached in localStorage
- **Bundle Size**: Only loaded language files included in bundle
- **Fallbacks**: Graceful degradation to English

## Browser Support

- **Modern Browsers**: Full support
- **Language Detection**: Uses `navigator.language`
- **LocalStorage**: Required for persistence
- **JavaScript**: Required for dynamic switching

## Future Enhancements

- [ ] Server-side language detection
- [ ] RTL language support
- [ ] Pluralization rules
- [ ] Date/time formatting
- [ ] Number formatting
- [ ] Currency formatting
- [ ] Accessibility improvements

## Troubleshooting

### Common Issues

1. **Language not switching**
   - Check browser console for errors
   - Verify translation files exist
   - Clear localStorage and refresh

2. **Translation keys missing**
   - Add missing keys to all language files
   - Check key structure matches

3. **Performance issues**
   - Verify lazy loading is working
   - Check bundle size
   - Monitor network requests

### Debug Mode

Enable debug logging in LanguageContext:

```typescript
// Add to LanguageContext.tsx
const DEBUG = process.env.NODE_ENV === 'development';
```

## Contributing

When adding new translations:

1. Add keys to all language files (en.json, fr.json, pt.json)
2. Use consistent key naming
3. Test with all supported languages
4. Update documentation if needed

## License

This internationalization system is part of the Meeshy project and follows the same license terms.
