# Guide de Migration - Système i18n vs Traductions

Ce guide explique la distinction entre le système d'**internationalisation (i18n)** pour l'interface et le système de **traduction** des messages utilisateurs.

## 🔍 Distinction Fondamentale

### 🌐 Système i18n (Interface)
**Objectif** : Internationaliser l'interface utilisateur
- Messages statiques de l'application
- Boutons, menus, labels, erreurs système
- Navigation et formulaires
- **Hook** : `useI18n()`
- **Fichiers** : `/locales/{lang}/common.json`, `/locales/{lang}/auth.json`

### 💬 Système Traductions (Messages)
**Objectif** : Traduire les messages des utilisateurs
- Contenu dynamique des conversations
- Messages en temps réel entre utilisateurs
- Communication multilingue
- **Hook** : `useTranslation()` (existant, inchangé)
- **Service** : `translation.service.ts`

## 📋 Exemples Concrets

### Messages d'interface (i18n)
```typescript
import { useI18n } from '@/hooks/useI18n';

function LoginForm() {
  const { t } = useI18n('auth');
  
  return (
    <form>
      <h1>{t('login.title')}</h1>           {/* "Connexion" / "Login" / "Entrar" */}
      <input placeholder={t('login.email')} /> {/* "E-mail" / "Email" / "E-mail" */}
      <button>{t('login.loginButton')}</button> {/* "Se connecter" / "Login" / "Entrar" */}
    </form>
  );
}
```

### Messages utilisateurs (traductions)
```typescript
import { useTranslation } from '@/hooks/use-translation';

function ChatMessage({ message }: { message: string }) {
  const { translateText } = useTranslation();
  
  // Traduire le message de l'utilisateur
  const translatedMessage = await translateText(
    "Bonjour tout le monde",  // Message utilisateur
    "en"                      // Langue cible
  );
  // Résultat: "Hello everyone"
  
  return <div>{translatedMessage}</div>;
}
```

## 🚀 Migration du système i18n

### 1. Installation du nouveau système

**Ajouter le provider d'interface :**
```typescript
// app/layout.tsx
import { I18nProvider } from '@/context/I18nContext';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <I18nProvider>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
```

### 2. Migration des composants d'interface

**Ancien (messages d'interface) :**
```typescript
import { useTranslations } from '@/hooks/useTranslations';

function Header() {
  const { t } = useTranslations('common');
  return <button>{t('save')}</button>;
}
```

**Nouveau (messages d'interface) :**
```typescript
import { useI18n } from '@/hooks/useI18n';

function Header() {
  const { t } = useI18n('common');
  return <button>{t('save')}</button>;
}
```

### 3. Optimisations par page

**Chargement optimisé :**
```typescript
import { usePageI18n } from '@/hooks/useI18n';

function DashboardPage() {
  // Charge automatiquement : common + components + dashboard
  const { t } = usePageI18n('dashboard');
  
  return (
    <div>
      <h1>{t('title')}</h1>
      <p>{t('welcome')}</p>
    </div>
  );
}
```

**Chargement essentiel :**
```typescript
import { useEssentialI18n } from '@/hooks/useI18n';

function Layout() {
  // Charge seulement : common + auth + components
  const { t } = useEssentialI18n('components');
  
  return (
    <nav>
      <a href="/dashboard">{t('navigation.dashboard')}</a>
      <a href="/settings">{t('navigation.settings')}</a>
    </nav>
  );
}
```

## 🔧 Utilisation Avancée

### Messages d'interface avec paramètres
```typescript
function Dashboard({ user }: { user: User }) {
  const { t } = useI18n('dashboard');
  
  return (
    <div>
      {/* Paramètre {name} pour l'interface */}
      <h1>{t('greeting', { name: user.name })}</h1>
      
      {/* Paramètre {count} pour l'interface */}
      <p>{t('stats.membersCount', { count: 42 })}</p>
      
      {/* Paramètre {message} pour l'interface */}
      <div>{t('errorLoading', { message: 'Connexion échouée' })}</div>
    </div>
  );
}
```

### Changement de langue d'interface
```typescript
function InterfaceLanguageSwitcher() {
  const { currentLanguage, switchLanguage } = useI18nContext();
  
  const handleLanguageChange = async (newLang: SupportedLanguage) => {
    await switchLanguage(newLang); // Change la langue de l'interface
    // Les messages utilisateurs gardent leur système de traduction séparé
  };
  
  return (
    <select value={currentLanguage} onChange={(e) => handleLanguageChange(e.target.value)}>
      <option value="fr">Français (Interface)</option>
      <option value="en">English (Interface)</option>
      <option value="pt">Português (Interface)</option>
    </select>
  );
}
```

## 🔄 Coexistence des deux systèmes

### Dans un même composant
```typescript
import { useI18n } from '@/hooks/useI18n';           // Interface
import { useTranslation } from '@/hooks/use-translation'; // Messages

function ChatComponent({ userMessage }: { userMessage: string }) {
  // Interface en français/anglais/portugais
  const { t } = useI18n('conversations');
  
  // Traduction des messages utilisateurs
  const { translateText } = useTranslation();
  
  const handleTranslateMessage = async () => {
    // Traduire le message de l'utilisateur
    const translated = await translateText(userMessage, 'en');
    
    // Afficher notification d'interface
    toast.success(t('toasts.success.translationSuccess'));
  };
  
  return (
    <div>
      {/* Interface traduite */}
      <button onClick={handleTranslateMessage}>
        {t('messageActions.translate')}
      </button>
      
      {/* Message utilisateur (peut être dans n'importe quelle langue) */}
      <div>{userMessage}</div>
    </div>
  );
}
```

## 📊 Monitoring

### Statistiques d'interface
```typescript
function I18nStats() {
  const { stats } = useI18nContext();
  
  return (
    <div>
      <p>Langues d'interface chargées: {stats.loadedLanguages.join(', ')}</p>
      <p>Modules d'interface chargés: {Object.keys(stats.loadedModules).length}</p>
      <p>Performance i18n: {stats.totalLoadTime}ms</p>
    </div>
  );
}
```

## ✅ Checklist de migration

### Système i18n (Interface)
- [ ] Ajouter `I18nProvider` dans `layout.tsx`
- [ ] Migrer les imports vers `useI18n`
- [ ] Tester tous les composants d'interface
- [ ] Optimiser avec les modules spécifiques
- [ ] Vérifier les paramètres d'interface (`{name}`, `{count}`, etc.)

### Système Traductions (Messages) - INCHANGÉ
- [ ] Garder `useTranslation()` pour les messages utilisateurs
- [ ] Maintenir `translation.service.ts`
- [ ] Conserver les hooks de traduction existants
- [ ] Préserver les APIs de traduction en temps réel

## 🎯 Résultat

Après migration, vous aurez :
- **Interface multilingue** avec `useI18n()` - pour les boutons, menus, etc.
- **Messages traduits** avec `useTranslation()` - pour les conversations
- **Systèmes séparés** et optimisés pour leurs usages respectifs
- **Performance améliorée** pour les deux systèmes
- **Clarté architecturale** et maintenabilité accrue

## ⚠️ Points d'attention

1. **Ne pas confondre** les deux systèmes
2. **Utiliser `useI18n()`** pour l'interface uniquement
3. **Garder `useTranslation()`** pour les messages utilisateurs
4. **Tester** les paramètres dans les deux systèmes
5. **Documenter** clairement l'usage de chaque système
