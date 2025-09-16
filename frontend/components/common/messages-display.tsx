'use client';

import { useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { MessageSquare } from 'lucide-react';
import { BubbleMessage } from './bubble-message';
import { messageTranslationService } from '@/services/message-translation.service';
import type { User, Message, MessageWithTranslations } from '@shared/types';

interface MessagesDisplayProps {
  messages: Message[];
  translatedMessages: MessageWithTranslations[];
  isLoadingMessages: boolean;
  currentUser: User;
  userLanguage: string;
  usedLanguages: string[];
  emptyStateMessage?: string;
  emptyStateDescription?: string;
  reverseOrder?: boolean; // Pour stream mode (nouveaux messages en haut)
  className?: string;
  onTranslation?: (messageId: string, translations: any[]) => void;
  onEditMessage?: (messageId: string, newContent: string) => Promise<void>;
  onDeleteMessage?: (messageId: string) => Promise<void>;
  conversationType?: 'direct' | 'group' | 'public' | 'global';
  userRole?: 'USER' | 'MEMBER' | 'MODERATOR' | 'ADMIN' | 'CREATOR' | 'AUDIT' | 'ANALYST' | 'BIGBOSS';
  conversationId?: string;
  // Nouvelles props pour gérer l'état des traductions en cours
  addTranslatingState?: (messageId: string, targetLanguage: string) => void;
  isTranslating?: (messageId: string, targetLanguage: string) => boolean;
}

/**
 * Composant factorized pour afficher une liste de messages avec traductions
 * Utilisable dans BubbleStreamPage, ConversationLayoutResponsive et autres
 */
export function MessagesDisplay({
  messages,
  translatedMessages,
  isLoadingMessages,
  currentUser,
  userLanguage,
  usedLanguages,
  emptyStateMessage = "Aucun message pour le moment",
  emptyStateDescription = "Soyez le premier à publier !",
  reverseOrder = false,
  className = "space-y-4",
  onTranslation,
  onEditMessage,
  onDeleteMessage,
  conversationType = 'direct',
  userRole = 'USER',
  conversationId,
  addTranslatingState,
  isTranslating
}: MessagesDisplayProps) {

  // TOUS LES HOOKS DOIVENT ÊTRE EN HAUT (avant tout return conditionnel)
  
  // 🔍 DEBUG: Logs pour comprendre le problème d'affichage
  console.log('[MESSAGES_DISPLAY] 🔍 Props reçues:', {
    messagesLength: messages.length,
    translatedMessagesLength: translatedMessages.length,
    isLoadingMessages,
    currentUser: {
      id: currentUser?.id,
      username: currentUser?.username,
      fullObject: currentUser
    },
    userLanguage,
    reverseOrder,
    conversationId
  });
  console.log('[MESSAGES_DISPLAY] 🔍 Messages bruts:', messages.map(m => ({ id: m.id, content: m.content?.substring(0, 30) + '...' })));
  console.log('[MESSAGES_DISPLAY] 🔍 Messages traduits:', translatedMessages.map(m => ({ id: m.id, content: m.content?.substring(0, 30) + '...' })));
  
  // Fonction pour forcer la traduction d'un message
  const handleForceTranslation = useCallback(async (messageId: string, targetLanguage: string) => {
    try {
      console.log('Forcer la traduction:', { messageId, targetLanguage });
      
      // Récupérer la langue source du message
      const message = messages.find(m => m.id === messageId);
      const sourceLanguage = message?.originalLanguage || 'fr';
      
      console.log('Détails de la traduction forcée:', {
        messageId,
        targetLanguage,
        sourceLanguage,
        messageFound: !!message,
        messageContent: message?.content?.substring(0, 50) + '...'
      });

      // CORRECTION: Utiliser la logique de progression des modèles
      // Trouver la traduction existante pour déterminer le modèle actuel
      const existingTranslation = (message as any)?.translations?.find((t: any) => 
        t.language === targetLanguage && t.status === 'completed'
      );
      
      const currentModel = existingTranslation?.model || 'basic';
      const tiers = ['basic', 'medium', 'premium'];
      const currentIndex = tiers.indexOf(currentModel);
      const nextModel = currentIndex < tiers.length - 1 ? tiers[currentIndex + 1] : 'premium';
      
      console.log(`🔄 Progression modèle: ${currentModel} → ${nextModel}`);
      
      const result = await messageTranslationService.requestTranslation({
        messageId,
        targetLanguage,
        sourceLanguage,
        model: nextModel as 'basic' | 'medium' | 'premium'
      });
      
      console.log('✅ Traduction forcée demandée:', result);
      console.log(`🔄 Retraduction en cours avec modèle ${nextModel}...`);
      
      // CORRECTION: Utiliser l'état persistant pour les traductions en cours
      if (addTranslatingState) {
        addTranslatingState(messageId, targetLanguage);
        console.log(`🔄 État de traduction ajouté pour ${messageId} → ${targetLanguage}`);
      }
      
      // Créer une traduction avec le statut 'translating' pour déclencher l'icône qui scintille
      if (onTranslation) {
        const translatingState = {
          language: targetLanguage,
          content: '', // Contenu vide pendant la traduction
          status: 'translating' as const,
          timestamp: new Date(),
          confidence: 0.0, // Pas de confiance car pas encore traduit
          model: nextModel as 'basic' | 'medium' | 'premium'
        };
        
        console.log('🔄 Création état de traduction en cours:', translatingState);
        onTranslation(messageId, [translatingState]);
      }
    } catch (error) {
      console.error('❌ Erreur traduction forcée:', error);
      toast.error('Erreur lors de la demande de traduction');
    }
  }, [messages, onTranslation]);

  // Normaliser les messages pour s'assurer qu'ils ont tous une originalLanguage
  const normalizedMessages = useMemo(() => {
    return messages.map(message => ({
      ...message,
      originalLanguage: message.originalLanguage || 'fr'
    }));
  }, [messages]);

  const normalizedTranslatedMessages = useMemo(() => {
    return translatedMessages.map(message => ({
      ...message,
      originalLanguage: message.originalLanguage || 'fr'
    }));
  }, [translatedMessages]);

  // Choisir les messages à afficher et l'ordre (mémorisé)
  const messagesToDisplay = useMemo(() => {
    return normalizedTranslatedMessages.length > 0 ? normalizedTranslatedMessages : normalizedMessages;
  }, [normalizedTranslatedMessages, normalizedMessages]);

  const orderedMessages = useMemo(() => {
    return reverseOrder ? [...messagesToDisplay].reverse() : messagesToDisplay;
  }, [messagesToDisplay, reverseOrder]);

  // MAINTENANT on peut faire les returns conditionnels
  
  // État de chargement - seulement si on n'a pas encore de messages
  if (isLoadingMessages && messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Chargement des messages...</p>
        </div>
      </div>
    );
  }

  // État vide
  if (translatedMessages.length === 0 && messages.length === 0) {
    return (
      <div className="text-center py-12">
        <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          {emptyStateMessage}
        </h3>
        <p className="text-gray-500">
          {emptyStateDescription}
        </p>
      </div>
    );
  }

  // Debug: Vérifier les traductions dans les messages à afficher (conditionné)
  if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_DEBUG_MESSAGES === 'true') {
    console.log('🔍 [MessagesDisplay] Messages à afficher:', {
      totalMessages: messagesToDisplay.length,
      usingTranslatedMessages: translatedMessages.length > 0,
      firstMessageTranslations: (messagesToDisplay[0] as any)?.translations?.length || 0
    });

    if (messagesToDisplay.length > 0 && (messagesToDisplay[0] as any)?.translations) {
      console.log('🌐 [MessagesDisplay] Premier message - traductions:', (messagesToDisplay[0] as any).translations);
    }
  }

  // 🔍 DEBUG: Vérifier le processus de rendu
  console.log('🎯 [MessagesDisplay] Processus de rendu:', {
    messagesToDisplay: messagesToDisplay.length,
    orderedMessages: orderedMessages.length,
    filteredMessages: orderedMessages.filter(message => message && message.id).length,
    currentUserId: currentUser.id,
    className
  });

  const filteredMessages = orderedMessages.filter(message => message && message.id);
  console.log('🔍 [MessagesDisplay] Messages après filtrage:', filteredMessages.map(m => ({ id: m.id, senderId: m.senderId, content: m.content?.substring(0, 30) })));

  return (
    <div className={className}>
      {filteredMessages.map((message) => {
          const isOwnMessage = message.senderId === currentUser.id;
          console.log('🎯 [MessagesDisplay] Rendu message dans map:', {
            messageId: message.id,
            senderId: message.senderId,
            currentUserId: currentUser.id,
            isOwnMessage,
            content: message.content?.substring(0, 30)
          });
          
          return (
            <div 
              key={`message-container-${message.id}`}
              className={`w-full flex ${isOwnMessage ? 'justify-end' : 'justify-start'} mb-4`}
            >
              <div className={`${isOwnMessage ? 'ml-[8%]' : 'mr-[8%]'} w-[92%] max-w-[92%]`}>
                <BubbleMessage
                  key={`message-${message.id}`}
                  message={message as any}
                  currentUser={currentUser}
                  userLanguage={userLanguage}
                  usedLanguages={usedLanguages}
                  onForceTranslation={handleForceTranslation}
                  onEditMessage={onEditMessage}
                  onDeleteMessage={onDeleteMessage}
                  conversationType={conversationType}
                  userRole={userRole}
                  isTranslating={isTranslating}
                />
              </div>
            </div>
          );
        })}
      
      {/* Espace supplémentaire pour éviter que le dernier message soit caché par la zone de saisie */}
      <div className="h-12" />
    </div>
  );
}
