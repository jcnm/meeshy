# Backend Messages Translation to English

## Summary

All backend error and success messages in `gateway/src/routes/users.ts` have been translated from French to English for better consistency and international standards.

## Changes Made

### Validation Messages (Zod Schemas)

| Before (FR) | After (EN) |
|------------|------------|
| `Le mot de passe actuel est requis` | `Current password is required` |
| `Le nouveau mot de passe doit contenir au moins 6 caractères` | `New password must be at least 6 characters` |
| `La confirmation du mot de passe est requise` | `Password confirmation is required` |
| `Les mots de passe ne correspondent pas` | `Passwords do not match` |

### Success Messages

| Route | Before (FR) | After (EN) |
|-------|------------|------------|
| `PATCH /users/me` | `Profil mis à jour avec succès` | `Profile updated successfully` |
| `PATCH /users/me/avatar` | `Avatar mis à jour avec succès` | `Avatar updated successfully` |
| `PATCH /users/me/password` | `Mot de passe mis à jour avec succès` | `Password updated successfully` |

### Error Messages

| Type | Before (FR) | After (EN) |
|------|------------|------------|
| Invalid data | `Données invalides` | `Invalid data` |
| Internal server error | `Erreur interne du serveur` | `Internal server error` |
| Email in use | `Cette adresse email est déjà utilisée` | `This email address is already in use` |
| Phone in use | `Ce numéro de téléphone est déjà utilisé` | `This phone number is already in use` |
| User not found | `Utilisateur non trouvé` | `User not found` |
| Invalid avatar format | `Format d'image invalide. L'URL doit commencer par http://, https:// ou data:image/` | `Invalid image format. URL must start with http://, https:// or data:image/` |
| Wrong password | `Le mot de passe actuel est incorrect` | `Current password is incorrect` |
| Cannot add self | `Vous ne pouvez pas vous ajouter vous-même` | `You cannot add yourself as a friend` |
| Request exists | `Une demande d'amitié existe déjà entre ces utilisateurs` | `A friend request already exists between these users` |
| Request not found | `Demande d'amitié non trouvée ou déjà traitée` | `Friend request not found or already processed` |
| Error retrieving stats | `Erreur lors de la récupération des statistiques` | `Error retrieving statistics` |
| Error searching users | `Impossible de rechercher les utilisateurs` | `Unable to search users` |
| Error retrieving friend requests | `Erreur lors de la récupération des demandes d'amitié` | `Error retrieving friend requests` |
| Error sending friend request | `Erreur lors de l'envoi de la demande d'amitié` | `Error sending friend request` |
| Error updating friend request | `Erreur lors de la mise à jour de la demande d'amitié` | `Error updating friend request` |

### Console Log Messages

| Before (FR) | After (EN) |
|------------|------------|
| `Erreur récupération friend requests` | `Error retrieving friend requests` |
| `Erreur envoi friend request` | `Error sending friend request` |
| `Erreur mise à jour friend request` | `Error updating friend request` |
| `Erreur lors de la recherche d'utilisateurs` | `Error searching users` |

## Impact

### Frontend
If the frontend displays these error messages directly to users, the **frontend should handle internationalization (i18n)** to show French messages to French users.

**Example:**
```typescript
// Frontend should map English error codes to translated messages
const errorMessages = {
  en: {
    'Invalid data': 'Invalid data',
    'User not found': 'User not found',
    // ...
  },
  fr: {
    'Invalid data': 'Données invalides',
    'User not found': 'Utilisateur non trouvé',
    // ...
  }
};
```

### API Consumers
External API consumers will now receive consistent English error messages, which is standard practice for REST APIs.

## Benefits

✅ **International Standard**: English is the lingua franca for APIs
✅ **Consistency**: All backend messages in one language
✅ **Developer Experience**: Easier debugging with standardized messages
✅ **Documentation**: Clearer API documentation
✅ **Integration**: Better integration with third-party tools and monitoring

## Testing

After restarting the gateway, test these endpoints to verify the messages:

```bash
# Test profile update with invalid data
curl -X PATCH https://gate.meeshy.me/api/users/me \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"invalid-email"}'

# Expected: {"success":false,"error":"Invalid data","details":[...]}

# Test password update with wrong password
curl -X PATCH https://gate.meeshy.me/api/users/me/password \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"currentPassword":"wrong","newPassword":"newpass123","confirmPassword":"newpass123"}'

# Expected: {"success":false,"error":"Current password is incorrect"}
```

## Recommendation

Consider implementing a centralized error message system with error codes:

```typescript
// gateway/src/utils/errors.ts
export const ErrorCodes = {
  INVALID_DATA: { code: 'INVALID_DATA', message: 'Invalid data' },
  USER_NOT_FOUND: { code: 'USER_NOT_FOUND', message: 'User not found' },
  EMAIL_IN_USE: { code: 'EMAIL_IN_USE', message: 'This email address is already in use' },
  // ...
};

// Usage
return reply.status(400).send({
  success: false,
  error: ErrorCodes.INVALID_DATA.code,
  message: ErrorCodes.INVALID_DATA.message,
  details: error.errors
});
```

This way, the frontend can map error codes to localized messages while maintaining English as the API standard.

