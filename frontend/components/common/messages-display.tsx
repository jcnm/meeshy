'use client';

import { useCallback } from 'react';
import { toast } from 'sonner';
import { MessageSquare } from 'lucide-react';
import { BubbleMessage } from '@/components/common/bubble-message';
import { messageTranslationService } from '@/services/message-translation.service';
import type { User, Message } from '@shared/types';
import type { BubbleStreamMessage } from '@/types/bubble-stream';

interface MessagesDisplayProps {
  messages: Message[];
  translatedMessages: BubbleStreamMessage[];
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
  conversationId
}: MessagesDisplayProps) {

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

      const result = await messageTranslationService.requestTranslation({
        messageId,
        targetLanguage,
        sourceLanguage,
        model: 'basic'
      });
      
      console.log('Traduction forcée demandée:', result);
      console.log('Traduction en cours...');
      
      // Simuler la réception d'une traduction pour déclencher l'indicateur
      // Attendre un délai pour simuler le temps de traduction
      setTimeout(() => {
        if (onTranslation) {
          const mockTranslation = {
            id: `${messageId}_${targetLanguage}`,
            messageId,
            sourceLanguage,
            targetLanguage,
            translatedContent: `[Traduction en cours...]`, // Contenu temporaire
            translationModel: 'basic',
            cacheKey: `${messageId}_${targetLanguage}`,
            confidenceScore: 0.9,
            createdAt: new Date(),
          };
          
          console.log('🔄 Simulation de réception de traduction:', mockTranslation);
          onTranslation(messageId, [mockTranslation]);
        }
      }, 2000); // Délai de 2 secondes pour simuler la traduction
    } catch (error) {
      console.error('❌ Erreur traduction forcée:', error);
      toast.error('Erreur lors de la demande de traduction');
    }
  }, [messages, onTranslation]);

  // État de chargement
  if (isLoadingMessages) {
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

  // Choisir les messages à afficher et l'ordre
  const messagesToDisplay = translatedMessages.length > 0 ? translatedMessages : messages;
  const orderedMessages = reverseOrder ? [...messagesToDisplay].reverse() : messagesToDisplay;

  return (
    <div className={className}>
      {orderedMessages
        .filter(message => message && message.id) // Filtrer les messages invalides
        .map((message) => (
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
          />
        ))}
    </div>
  );
}
