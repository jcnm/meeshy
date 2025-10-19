'use client';

import { useState, useRef, useCallback, memo, useEffect } from 'react';
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
  const [isTyping, setIsTyping] = useState(false);
  const messageComposerRef = useRef<MessageComposerRef>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  // Gestion du changement de message
  const handleMessageChange = useCallback((value: string) => {
    setNewMessage(value);
    
    // Gestion de l'indicateur de frappe
    if (value.trim() && !isTyping) {
      setIsTyping(true);
      onStartTyping();
    } else if (!value.trim() && isTyping) {
      setIsTyping(false);
      onStopTyping();
    }

    // Reset du timeout de frappe
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    if (value.trim()) {
      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
        onStopTyping();
      }, 3000); // Arrêter l'indicateur après 3 secondes d'inactivité
    }
  }, [isTyping, onStartTyping, onStopTyping]);

  // Envoi du message
  const handleSend = useCallback(async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }

    const messageContent = newMessage.trim();
    if (!messageContent || isSending) {
      return;
    }

    // Réinitialiser l'état immédiatement
    setNewMessage('');
    setIsTyping(false);
    onStopTyping();

    // Clear typing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Envoyer le message
    await onSendMessage(messageContent, e);

    // Focus sur le champ après l'envoi
    messageComposerRef.current?.focus();
  }, [newMessage, isSending, onSendMessage, onStopTyping]);

  // Gestion des touches
  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    // Sur mobile, permettre les sauts de ligne avec Enter
    // L'utilisateur doit utiliser le bouton d'envoi pour envoyer
    if (isMobile) {
      // Ne rien faire, laisser le comportement par défaut (nouvelle ligne)
      return;
    }
    
    // Sur desktop, Enter envoie le message (sauf avec Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend, isMobile]);

  // Cleanup du timeout au démontage
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className={cn(
      "p-4 bg-card border-t",
      isMobile && "safe-area-bottom" // Pour les encoches iOS
    )}>
      <div className="max-w-4xl mx-auto">
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
          className={cn(
            "w-full",
            isMobile ? "min-h-[48px]" : "min-h-[56px]"
          )}
          userRole={currentUser?.role}
        />
      </div>
    </div>
  );
});

export { ConversationComposerComponent as ConversationComposer };
