'use client';

import { useState, useRef, useCallback, memo } from 'react';
import { cn } from '@/lib/utils';
import type { SocketIOUser as User } from '@shared/types';
import { MessageComposer, MessageComposerRef } from '@/components/common/message-composer';
import { getUserLanguageChoices } from '@/utils/user-language-preferences';

interface ConversationComposerProps {
  currentUser: User;
  selectedLanguage: string;
  onLanguageChange: (language: string) => void;
  onSendMessage: (content: string, e?: React.FormEvent) => Promise<void>;
  onStartTyping: () => void;
  onStopTyping: () => void;
  isSending: boolean;
  isMobile: boolean;
  t: (key: string) => string;
}

const ConversationComposerComponent = memo(function ConversationComposer({
  currentUser,
  selectedLanguage,
  onLanguageChange,
  onSendMessage,
  onStartTyping,
  onStopTyping,
  isSending,
  isMobile,
  t
}: ConversationComposerProps) {
  const [newMessage, setNewMessage] = useState('');
  const messageComposerRef = useRef<MessageComposerRef>(null);

  // Fonction pour gérer le changement de message
  const handleMessageChange = useCallback((value: string) => {
    setNewMessage(value);
    
    // Gérer l'indicateur de frappe
    if (value.trim()) {
      onStartTyping();
    } else {
      onStopTyping();
    }
  }, [onStartTyping, onStopTyping]);

  // Fonction pour gérer l'envoi de message
  const handleSend = useCallback(async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }

    if (!newMessage.trim()) {
      return;
    }

    const messageContent = newMessage.trim();
    setNewMessage(''); // Vider immédiatement pour éviter les doubles envois

    // Envoyer le message avec le contenu
    await onSendMessage(messageContent, e);
  }, [newMessage, onSendMessage]);

  // Fonction pour gérer les touches
  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  return (
    <div className={cn(
      "flex-shrink-0 border-t border-gray-200",
      // Tailwind uniquement - simple et efficace
      isMobile 
        ? "fixed bottom-0 left-0 right-0 w-full z-50 bg-white p-4 pb-6 shadow-lg" 
        : "p-4 bg-white/70 backdrop-blur-sm rounded-br-2xl min-h-[100px]"
    )}>
      <MessageComposer
        ref={messageComposerRef}
        value={newMessage}
        onChange={handleMessageChange}
        onSend={handleSend}
        selectedLanguage={selectedLanguage}
        onLanguageChange={onLanguageChange}
        isComposingEnabled={!isSending}
        placeholder={t('writeMessage')}
        choices={currentUser ? getUserLanguageChoices(currentUser) : undefined}
        onKeyPress={handleKeyPress}
        className="w-full min-h-[60px]"
      />
    </div>
  );
}, (prevProps, nextProps) => {
  // Comparaison personnalisée pour éviter les re-renders inutiles
  return (
    prevProps.currentUser?.id === nextProps.currentUser?.id &&
    prevProps.selectedLanguage === nextProps.selectedLanguage &&
    prevProps.isSending === nextProps.isSending &&
    prevProps.isMobile === nextProps.isMobile
  );
});

export { ConversationComposerComponent as ConversationComposer };
