/**
 * Exemple de migration d'un composant utilisant l'ancien useNativeMessaging
 * vers le nouveau useSocketIOMessaging
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useSocketIOMessaging } from '@/hooks/use-socketio-messaging';
import { useUser } from '@/context/AppContext';
import type { Message } from '@/types';

interface ConversationViewProps {
  conversationId: string;
}

export const ConversationView: React.FC<ConversationViewProps> = ({ conversationId }) => {
  const { user } = useUser();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessageContent, setNewMessageContent] = useState('');
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  // Utilisation du nouveau hook Socket.IO
  const {
    sendMessage,
    editMessage,
    deleteMessage,
    startTyping,
    stopTyping,
    connectionStatus
  } = useSocketIOMessaging({
    conversationId,
    currentUser: user || undefined,
    onNewMessage: (message) => {
      console.log('📨 Nouveau message reçu:', message);
      setMessages(prev => [...prev, message]);
    },
    onMessageEdited: (message) => {
      console.log('✏️ Message édité:', message);
      setMessages(prev => prev.map(m => m.id === message.id ? message : m));
    },
    onMessageDeleted: (messageId) => {
      console.log('🗑️ Message supprimé:', messageId);
      setMessages(prev => prev.filter(m => m.id !== messageId));
    },
    onUserTyping: (userId, username, isTyping) => {
      console.log('⌨️ Frappe utilisateur:', { userId, username, isTyping });
      if (isTyping) {
        setTypingUsers(prev => [...prev.filter(u => u !== username), username]);
      } else {
        setTypingUsers(prev => prev.filter(u => u !== username));
      }
    },
    onTranslation: (messageId, translations) => {
      console.log('🌐 Traductions reçues:', { messageId, translations });
      // Mettre à jour le message avec ses traductions
      setMessages(prev => prev.map(m => {
        if (m.id === messageId) {
          return {
            ...m,
            translations: translations.map(t => ({
              language: t.targetLanguage,
              content: t.translatedContent,
              flag: getLanguageFlag(t.targetLanguage),
              createdAt: new Date()
            }))
          };
        }
        return m;
      }));
    }
  });

  // Gestionnaire d'envoi de message
  const handleSendMessage = async () => {
    if (!newMessageContent.trim()) return;

    const success = await sendMessage(newMessageContent);
    if (success) {
      setNewMessageContent('');
      stopTyping();
    }
  };

  // Gestionnaire de frappe
  const handleInputChange = (value: string) => {
    setNewMessageContent(value);
    
    if (value.trim()) {
      startTyping();
    } else {
      stopTyping();
    }
  };

  // Simuler la gestion du débounce pour arrêter la frappe
  useEffect(() => {
    const timer = setTimeout(() => {
      if (newMessageContent.trim()) {
        stopTyping();
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [newMessageContent, stopTyping]);

  const getLanguageFlag = (languageCode: string): string => {
    const flags: Record<string, string> = {
      'fr': '🇫🇷',
      'en': '🇺🇸',
      'es': '🇪🇸',
      'de': '🇩🇪',
      'it': '🇮🇹',
      'pt': '🇵🇹',
      'ja': '🇯🇵',
      'ko': '🇰🇷',
      'zh': '🇨🇳',
      'ar': '🇸🇦',
      'ru': '🇷🇺'
    };
    return flags[languageCode] || '🌍';
  };

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto bg-white rounded-lg shadow-lg">
      {/* Header avec statut de connexion */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-800">
          Conversation
        </h2>
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${
            connectionStatus.isConnected ? 'bg-green-500' : 'bg-red-500'
          }`} />
          <span className="text-sm text-gray-600">
            {connectionStatus.isConnected ? 'Connecté' : 'Déconnecté'}
          </span>
        </div>
      </div>

      {/* Zone des messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div key={message.id} className="flex flex-col">
            {/* Message principal */}
            <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
              message.senderId === user?.id
                ? 'bg-blue-500 text-white ml-auto'
                : 'bg-gray-200 text-gray-800'
            }`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs opacity-75">
                  {message.sender?.displayName || message.sender?.username}
                </span>
                <span className="text-xs opacity-75">
                  {new Date(message.createdAt).toLocaleTimeString()}
                </span>
              </div>
              <p>{message.content}</p>
              {message.isEdited && (
                <span className="text-xs opacity-75 italic">
                  (modifié)
                </span>
              )}
            </div>

            {/* Traductions */}
                        {/* TODO: Ajouter les traductions quand disponibles */}

            {/* Actions du message (pour les messages de l'utilisateur) */}
            {message.senderId === user?.id && (
              <div className="flex space-x-2 mt-1 ml-auto">
                <button
                  onClick={() => {
                    const newContent = prompt('Nouveau contenu:', message.content);
                    if (newContent && newContent !== message.content) {
                      editMessage(message.id, newContent);
                    }
                  }}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  Modifier
                </button>
                <button
                  onClick={() => {
                    if (confirm('Êtes-vous sûr de vouloir supprimer ce message ?')) {
                      deleteMessage(message.id);
                    }
                  }}
                  className="text-xs text-red-600 hover:text-red-800"
                >
                  Supprimer
                </button>
              </div>
            )}
          </div>
        ))}

        {/* Indicateur de frappe */}
        {typingUsers.length > 0 && (
          <div className="text-sm text-gray-500 italic">
            {typingUsers.join(', ')} {typingUsers.length === 1 ? 'écrit' : 'écrivent'}...
          </div>
        )}
      </div>

      {/* Zone de saisie */}
      <div className="border-t border-gray-200 p-4">
        <div className="flex space-x-3">
          <input
            type="text"
            value={newMessageContent}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="Tapez votre message..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={!connectionStatus.isConnected}
          />
          <button
            onClick={handleSendMessage}
            disabled={!newMessageContent.trim() || !connectionStatus.isConnected}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Envoyer
          </button>
        </div>
        
        {!connectionStatus.isConnected && (
          <p className="text-sm text-red-600 mt-2">
            Connexion perdue. Reconnexion en cours...
          </p>
        )}
      </div>
    </div>
  );
};
