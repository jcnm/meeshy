# Critical Fix: Zustand Store Infinite Loop

## Problem
The application was experiencing critical infinite render loops with these errors:
```
- "The result of getSnapshot should be cached to avoid an infinite loop"
- "Maximum update depth exceeded"
- Runtime Error: Maximum update depth exceeded
```

## Root Cause
All action selector hooks in Zustand stores were creating new object references on every render:

```typescript
// ❌ PROBLEMATIC CODE
export const useAuthActions = () => useAuthStore((state) => ({
  setUser: state.setUser,
  logout: state.logout,
  // Creates NEW object every render → infinite loop
}));
```

This caused components using these hooks to re-render infinitely because the selector returned a new object reference each time.

## Solution
Added `useShallow` from `zustand/react/shallow` to all action selectors:

```typescript
// ✅ FIXED CODE
import { useShallow } from 'zustand/react/shallow';

export const useAuthActions = () => useAuthStore(
  useShallow((state) => ({
    setUser: state.setUser,
    logout: state.logout,
    // useShallow prevents re-renders when values haven't changed
  }))
);
```

## Files Fixed

### 1. `auth-store.ts`
- Added `useShallow` import
- Wrapped `useAuthActions` selector with `useShallow`

### 2. `language-store.ts`
- Added `useShallow` import
- Wrapped `useLanguageActions` selector with `useShallow`

### 3. `conversation-store.ts`
- Added `useShallow` import
- Wrapped `useConversationActions` selector with `useShallow`

### 4. `app-store.ts`
- Added `useShallow` import
- Wrapped `useAppActions` selector with `useShallow`

### 5. `i18n-store.ts`
- Added `useShallow` import
- Wrapped `useI18nActions` selector with `useShallow`

## How useShallow Works

`useShallow` performs shallow equality checking on the selector result:
- Compares object properties by reference
- Only triggers re-render if values actually changed
- Prevents unnecessary re-renders from new object creation

## Testing
1. Start dev server: `cd frontend && pnpm dev`
2. Navigate to landing page `/`
3. Verify no console errors
4. Verify no infinite loading states
5. Test authentication flow
6. Test language switching

## Prevention
To prevent this issue in the future:

### ✅ DO:
```typescript
// Single value selectors (no useShallow needed)
export const useUser = () => useAuthStore((state) => state.user);

// Multiple values/actions with useShallow
export const useAuthActions = () => useAuthStore(
  useShallow((state) => ({
    setUser: state.setUser,
    logout: state.logout,
  }))
);
```

### ❌ DON'T:
```typescript
// Multiple values without useShallow
export const useAuthActions = () => useAuthStore((state) => ({
  setUser: state.setUser, // Creates new object every time
  logout: state.logout,
}));
```

## Related Resources
- [Zustand Documentation - Selecting Multiple State Slices](https://docs.pmnd.rs/zustand/guides/prevent-rerenders-with-use-shallow)
- [React: Maximum Update Depth Exceeded](https://react.dev/learn/render-and-commit#avoiding-infinite-loops)

## Impact
- **Before**: Application crashed with infinite render loops
- **After**: Smooth operation with proper render optimization
- **Performance**: Reduced unnecessary re-renders across all components using action selectors

---

**Fixed by**: AI Assistant  
**Date**: October 7, 2025  
**Commit**: 08b29eb6 - "fix: prevent infinite loops in Zustand store selectors"

