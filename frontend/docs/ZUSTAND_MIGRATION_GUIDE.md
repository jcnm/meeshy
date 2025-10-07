# Zustand + Context Migration Guide

## Overview

This guide explains the migration from the old Context API-based state management to the new efficient Zustand + Context pattern.

## Architecture Changes

### Before (Old Pattern)
- Multiple separate Context providers using `useReducer`
- Complex state management with overlapping concerns
- Performance issues due to unnecessary re-renders
- Difficult to debug and maintain

### After (New Pattern)
- Zustand stores with Context API integration
- Clean separation of concerns
- Optimized performance with selective subscriptions
- Better developer experience with DevTools

## New Store Structure

```
frontend/stores/
├── index.ts                 # Main exports
├── types.ts                 # TypeScript types
├── app-store.ts            # Global app state
├── auth-store.ts           # Authentication state
├── language-store.ts       # Language preferences
├── i18n-store.ts          # Internationalization
├── conversation-store.ts   # Chat/messaging state
└── combined-provider.tsx   # Provider composition
```

## Migration Steps

### 1. Import Changes

**Old:**
```typescript
import { useUser } from '@/context/AppContext';
import { useLanguage } from '@/context/LanguageContext';
import { useTranslations } from '@/hooks/useTranslations';
```

**New:**
```typescript
import { useAuthUser, useLanguageStore, useTranslations } from '@/stores';
// OR use compatibility hooks during migration:
import { useUser, useLanguage, useTranslations } from '@/hooks/use-legacy-compatibility';
```

### 2. Hook Usage Changes

**Old:**
```typescript
const { user, setUser, logout } = useUser();
const { currentInterfaceLanguage, setInterfaceLanguage } = useLanguage();
```

**New (Direct Store Access):**
```typescript
const user = useAuthUser();
const { setUser, logout } = useAuthStore();
const { currentInterfaceLanguage, setInterfaceLanguage } = useLanguageStore();
```

**New (Compatibility Hooks):**
```typescript
// Same as old - no changes needed during migration
const { user, setUser, logout } = useUser();
const { currentInterfaceLanguage, setInterfaceLanguage } = useLanguage();
```

### 3. Performance Optimizations

**Selective Subscriptions:**
```typescript
// Instead of subscribing to entire store
const store = useAuthStore();

// Subscribe only to what you need
const user = useAuthUser();
const isAuthenticated = useAuthStore(state => state.isAuthenticated);
```

**Computed Values:**
```typescript
// Use selectors for computed values
const userDisplayName = useAuthStore(state => 
  state.user ? `${state.user.firstName} ${state.user.lastName}` : 'Anonymous'
);
```

## Store Features

### 1. App Store
- Online/offline status
- Theme management
- Global notifications
- Application initialization

### 2. Auth Store
- User authentication state
- Token management
- Session handling
- Auto-refresh logic

### 3. Language Store
- Interface language preferences
- Message language settings
- User language configuration
- Browser language detection

### 4. I18n Store
- Translation loading and caching
- Module-based translations
- Fallback handling
- Performance optimization

### 5. Conversation Store
- Chat conversations
- Message management
- Real-time updates
- Translation requests

## Best Practices

### 1. Use Selective Subscriptions
```typescript
// Good - only re-renders when user changes
const user = useAuthUser();

// Bad - re-renders on any auth state change
const { user } = useAuthStore();
```

### 2. Combine Related Actions
```typescript
// Use combined actions for related operations
const { setInterfaceLanguage } = useAppActions(); // Also updates i18n
```

### 3. Handle Loading States
```typescript
const isLoading = useI18nLoading();
const error = useI18nError();

if (isLoading) return <LoadingSpinner />;
if (error) return <ErrorMessage error={error} />;
```

### 4. Use DevTools
- All stores are configured with Redux DevTools
- Use the browser extension to debug state changes
- Action names follow the pattern: `storeName/actionName`

## Migration Timeline

### Phase 1: Setup (Completed)
- ✅ Create new Zustand stores
- ✅ Set up combined provider
- ✅ Create compatibility hooks
- ✅ Update main layout

### Phase 2: Gradual Migration
- 🔄 Update components one by one
- 🔄 Replace old context usage
- 🔄 Test functionality

### Phase 3: Cleanup
- ⏳ Remove old context files
- ⏳ Remove compatibility hooks
- ⏳ Update documentation

## Troubleshooting

### Common Issues

1. **"Hook must be used within provider" errors**
   - Ensure `CombinedStoreProvider` wraps your app
   - Check import paths are correct

2. **State not updating**
   - Verify you're using the correct store hook
   - Check if you need to subscribe to specific state slices

3. **Performance issues**
   - Use selective subscriptions instead of full store access
   - Consider memoizing computed values

4. **TypeScript errors**
   - Update import statements
   - Check type definitions in `stores/types.ts`

## Testing

### Unit Tests
```typescript
import { renderHook } from '@testing-library/react';
import { useAuthStore } from '@/stores';

test('should authenticate user', () => {
  const { result } = renderHook(() => useAuthStore());
  
  act(() => {
    result.current.setUser(mockUser);
  });
  
  expect(result.current.user).toEqual(mockUser);
  expect(result.current.isAuthenticated).toBe(true);
});
```

### Integration Tests
```typescript
import { render } from '@testing-library/react';
import { CombinedStoreProvider } from '@/stores';

function TestWrapper({ children }) {
  return (
    <CombinedStoreProvider>
      {children}
    </CombinedStoreProvider>
  );
}

// Use TestWrapper in your tests
```

## Resources

- [Zustand Documentation](https://github.com/pmndrs/zustand)
- [React Context Best Practices](https://react.dev/learn/passing-data-deeply-with-context)
- [Performance Optimization Guide](./PERFORMANCE_OPTIMIZATION.md)
