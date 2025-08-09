# Mise à jour : Sélecteur de langue dans la zone de saisie

## Modifications apportées

### 1. **Remplacement de la détection automatique par un sélecteur manuel**

Dans `bubble-stream-page.tsx` :
- ✅ Ajout d'un état `selectedInputLanguage` initialisé avec `user.systemLanguage`
- ✅ Création d'une fonction `getLanguageChoices()` qui retourne les options disponibles :
  - **Langue système** (`user.systemLanguage`) - par défaut
  - **Langue régionale** (`user.regionalLanguage`) - si différente de la langue système
  - **Langue personnalisée** (`user.customDestinationLanguage`) - si différente des autres

### 2. **Interface utilisateur améliorée**

- ✅ Remplacement de l'indicateur statique de langue détectée par un bouton dropdown interactif
- ✅ Popover avec liste des langues disponibles pour l'utilisateur
- ✅ Affichage du drapeau et du code de langue sélectionnée
- ✅ Mise en évidence de la langue actuellement sélectionnée
- ✅ Badge "Par défaut" pour la langue système

### 3. **Logique de sélection**

- ✅ La langue système est sélectionnée par défaut
- ✅ Mise à jour automatique si les préférences utilisateur changent
- ✅ Validation que la langue sélectionnée est toujours dans les choix disponibles

### 4. **Préparation pour l'intégration Gateway**

- ✅ Logging de la langue sélectionnée lors de l'envoi du message
- ✅ Commentaire TODO pour indiquer où intégrer la langue source dans `sendMessageToService`
- ✅ La variable `selectedInputLanguage` contient le code de langue à envoyer à la gateway

## Intégration Gateway requise

### Prochaines étapes :

1. **Modifier l'interface SocketIO** pour inclure la langue source :
   ```typescript
   // Dans meeshy-socketio.service.ts
   'message:send': (data: { 
     conversationId: string; 
     content: string; 
     sourceLanguage?: string; // NOUVEAU
   }, callback?: (response: any) => void) => void;
   ```

2. **Modifier la fonction sendMessage** dans le hook et le service :
   ```typescript
   // Dans use-socketio-messaging.ts
   sendMessage: (content: string, sourceLanguage?: string) => Promise<boolean>;
   
   // Dans bubble-stream-page.tsx
   await sendMessageToService(messageContent, selectedInputLanguage);
   ```

3. **Gateway** : La langue source sera maintenant disponible et pourra être :
   - Vérifiée avec le profil utilisateur
   - Utilisée comme langue source pour les traductions
   - Stockée avec le message

## Comportement utilisateur

1. **Par défaut** : La langue système de l'utilisateur est sélectionnée
2. **Choix manuel** : L'utilisateur peut choisir parmi ses langues configurées
3. **Persistance** : La sélection reste active jusqu'à ce que l'utilisateur la change
4. **Validation** : Seules les langues configurées dans le profil sont disponibles

## Interface visuelle

- 🎯 **Bouton de sélection** : Drapeau + code langue + icône dropdown
- 📋 **Popover** : Liste détaillée avec drapeaux, noms de langues et descriptions
- ✅ **Indication visuelle** : Contour bleu pour la langue sélectionnée
- 🏷️ **Badges** : "Par défaut" pour la langue système

Cette mise à jour améliore l'expérience utilisateur en donnant le contrôle total sur la langue d'écriture et prépare l'infrastructure pour une gestion plus précise des langues dans la gateway.
