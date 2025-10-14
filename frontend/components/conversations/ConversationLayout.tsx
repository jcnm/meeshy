'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser, useIsAuthChecking } from '@/stores';
import { useI18n } from '@/hooks/useI18n';
import { useConversationMessages } from '@/hooks/use-conversation-messages';
import { useMessaging } from '@/hooks/use-messaging';
import { useConversationsPagination } from '@/hooks/use-conversations-pagination';
import { conversationsService } from '@/services/conversations.service';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Footer } from '@/components/layout/Footer';
import { ConversationList } from './ConversationList';
import { ConversationHeader } from './ConversationHeader';
import { ConversationMessages } from './ConversationMessages';
import { ConversationEmptyState } from './ConversationEmptyState';
import { MessageComposer } from '@/components/common/message-composer';
import { getUserLanguageChoices } from '@/utils/user-language-preferences';
import { CreateConversationModal } from './create-conversation-modal';
import { ConversationDetailsSidebar } from './conversation-details-sidebar';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ArrowLeft, MessageSquare } from 'lucide-react';
import type { Conversation, ThreadMember, UserRoleEnum } from '@shared/types';
import { useReplyStore } from '@/stores/reply-store';
import { toast } from 'sonner';

interface ConversationLayoutProps {
  selectedConversationId?: string;
}

export function ConversationLayout({ selectedConversationId }: ConversationLayoutProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useUser(); const isAuthChecking = useIsAuthChecking();
  const { t } = useI18n('conversations');
  
  // ID unique pour cette instance du composant
  const instanceId = useMemo(() => `layout-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, []);

  // Hook de pagination pour les conversations
  const {
    conversations: paginatedConversations,
    isLoading: isLoadingConversations,
    isLoadingMore: isLoadingMoreConversations,
    hasMore: hasMoreConversations,
    loadMore: loadMoreConversations,
    refresh: refreshConversations,
    setConversations
  } = useConversationsPagination({
    limit: 20,
    enabled: !!user
  });
  
  // Utiliser les conversations paginées
  const conversations = paginatedConversations;
  
  // État local pour la sélection dynamique (sans changement d'URL)
  const [localSelectedConversationId, setLocalSelectedConversationId] = useState<string | null>(null);
  
  // Utiliser l'ID depuis l'URL ou l'état local
  const effectiveSelectedId = selectedConversationId || localSelectedConversationId;
  
  const selectedConversation = useMemo(() => {
    if (!effectiveSelectedId || !conversations.length) return null;
    const found = conversations.find(c => c.id === effectiveSelectedId);
    console.log(`[ConversationLayout-${instanceId}] Conversation sélectionnée:`, {
      fromUrl: !!selectedConversationId,
      fromLocal: !!localSelectedConversationId,
      effectiveId: effectiveSelectedId,
      found: !!found,
      foundId: found?.id,
      foundTitle: found?.title
    });
    return found || null;
  }, [effectiveSelectedId, conversations, instanceId, selectedConversationId, localSelectedConversationId]);
  const [participants, setParticipants] = useState<ThreadMember[]>([]);
  // Utiliser l'état de chargement du hook de pagination
  const isLoading = isLoadingConversations;
  const [selectedLanguage, setSelectedLanguage] = useState('fr');

  // États modaux et UI
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showConversationList, setShowConversationList] = useState(true);
  const [newMessage, setNewMessage] = useState('');

  // Référence pour le textarea du MessageComposer
  const messageComposerRef = useRef<{ focus: () => void; blur: () => void }>(null);

  // État pour les traductions
  const [translatingMessages, setTranslatingMessages] = useState<Map<string, Set<string>>>(new Map());
  const [usedLanguages, setUsedLanguages] = useState<string[]>([]);

  // Fonctions pour gérer l'état des traductions en cours
  const addTranslatingState = useCallback((messageId: string, targetLanguage: string) => {
    setTranslatingMessages(prev => {
      const newMap = new Map(prev);
      const currentLanguages = newMap.get(messageId) || new Set();
      currentLanguages.add(targetLanguage);
      newMap.set(messageId, currentLanguages);
      return newMap;
    });
  }, []);

  const removeTranslatingState = useCallback((messageId: string, targetLanguage: string) => {
    setTranslatingMessages(prev => {
      const newMap = new Map(prev);
      const currentLanguages = newMap.get(messageId);
      if (currentLanguages) {
        currentLanguages.delete(targetLanguage);
        if (currentLanguages.size === 0) {
          newMap.delete(messageId);
        } else {
          newMap.set(messageId, currentLanguages);
        }
      }
      return newMap;
    });
  }, []);

  const isTranslating = useCallback((messageId: string, targetLanguage: string): boolean => {
    const currentLanguages = translatingMessages.get(messageId);
    return currentLanguages ? currentLanguages.has(targetLanguage) : false;
  }, [translatingMessages]);

  // Hook pour les messages (doit être déclaré avant useMessaging)
  const {
    messages,
    isLoading: isLoadingMessages,
    isLoadingMore,
    hasMore,
    loadMore,
    refresh: refreshMessages,
    clearMessages,
    addMessage,
    updateMessage,
    removeMessage
  } = useConversationMessages(selectedConversation?.id || null, user!, {
    limit: 20,
    enabled: !!selectedConversation?.id
  });

  // Hook messaging pour l'envoi de messages et indicateurs de frappe
  const messaging = useMessaging({
    conversationId: selectedConversation?.id,
    currentUser: user || undefined,
    onMessageSent: useCallback((content: string, language: string) => {
      console.log('[ConversationLayout] Message envoyé avec succès:', { content: content.substring(0, 50), language });
    }, []),
    onMessageFailed: useCallback((content: string, error: Error) => {
      console.error('[ConversationLayout] Échec envoi message:', { content: content.substring(0, 50), error });
    }, []),
    onUserTyping: useCallback((userId: string, username: string, isTyping: boolean) => {
      console.log('[ConversationLayout] 👤 Événement de frappe:', { userId, username, isTyping });
    }, []),
    onNewMessage: useCallback((message: any) => {
      console.log(`[ConversationLayout-${instanceId}] 🔥 NOUVEAU MESSAGE VIA WEBSOCKET:`, {
        messageId: message.id,
        content: message.content?.substring(0, 50),
        senderId: message.senderId,
        conversationId: message.conversationId,
        selectedConversationId: selectedConversation?.id,
        shouldAdd: message.conversationId === selectedConversation?.id
      });
      
      // Ajouter seulement si c'est pour la conversation actuelle
      if (message.conversationId === selectedConversation?.id) {
        const wasAdded = addMessage(message);
        console.log(`[ConversationLayout-${instanceId}] Message ajouté:`, wasAdded);
      } else {
        console.log(`[ConversationLayout-${instanceId}] Message ignoré (autre conversation)`);
      }
    }, [addMessage, selectedConversation?.id, instanceId]),
    onTranslation: useCallback((messageId: string, translations: any[]) => {
      console.log('🌐 [ConversationLayoutV2] Traductions reçues pour message:', messageId, translations);
      
      // Mettre à jour le message avec les nouvelles traductions en utilisant une fonction de transformation
      updateMessage(messageId, (prevMessage) => {
        console.log('🔄 [ConversationLayoutV2] Mise à jour des traductions pour message:', messageId, {
          currentTranslations: prevMessage.translations?.length || 0,
          newTranslations: translations.length,
          translationsReceived: translations.map(t => ({ 
            lang: t.targetLanguage || t.language, 
            content: (t.translatedContent || t.content)?.substring(0, 30) + '...' 
          }))
        });

        // Fusionner les nouvelles traductions avec les existantes
        const existingTranslations = prevMessage.translations || [];
        const updatedTranslations = [...existingTranslations];

        translations.forEach(newTranslation => {
          const targetLang = newTranslation.targetLanguage || newTranslation.language;
          const content = newTranslation.translatedContent || newTranslation.content;
          
          if (!targetLang || !content) {
            console.warn('🚫 [ConversationLayoutV2] Traduction invalide ignorée:', newTranslation);
            return;
          }

          // Chercher si une traduction existe déjà pour cette langue
          const existingIndex = updatedTranslations.findIndex(
            t => t.targetLanguage === targetLang
          );

          const translationObject = {
            id: newTranslation.id || `${messageId}_${targetLang}`,
            messageId: messageId,
            sourceLanguage: newTranslation.sourceLanguage || prevMessage.originalLanguage || 'fr',
            targetLanguage: targetLang,
            translatedContent: content,
            translationModel: newTranslation.translationModel || newTranslation.model || 'basic',
            cacheKey: newTranslation.cacheKey || `${messageId}_${targetLang}`,
            cached: newTranslation.cached || newTranslation.fromCache || false,
            confidenceScore: newTranslation.confidenceScore || newTranslation.confidence || 0.9,
            createdAt: newTranslation.createdAt ? new Date(newTranslation.createdAt) : new Date(),
          };

          if (existingIndex >= 0) {
            // Remplacer la traduction existante
            console.log('🔄 [ConversationLayoutV2] Remplacement traduction existante:', targetLang);
            updatedTranslations[existingIndex] = translationObject;
          } else {
            // Ajouter la nouvelle traduction
            console.log('➕ [ConversationLayoutV2] Ajout nouvelle traduction:', targetLang);
            updatedTranslations.push(translationObject);
          }
        });

        console.log('✅ [ConversationLayoutV2] Traductions mises à jour:', {
          messageId,
          before: existingTranslations.length,
          after: updatedTranslations.length,
          languages: updatedTranslations.map(t => t.targetLanguage)
        });

        return {
          ...prevMessage,
          translations: updatedTranslations
        };
      });
      
      // Ajouter les nouvelles langues à la liste des langues utilisées
      const newLanguages = translations
        .map(t => t.targetLanguage || t.language)
        .filter((lang): lang is string => Boolean(lang) && !usedLanguages.includes(lang));
      
      if (newLanguages.length > 0) {
        console.log('📝 [ConversationLayoutV2] Ajout nouvelles langues utilisées:', newLanguages);
        setUsedLanguages(prev => [...prev, ...newLanguages]);
      }
      
      // Supprimer l'état de traduction en cours pour toutes les langues reçues
      translations.forEach(translation => {
        const targetLang = translation.targetLanguage || translation.language;
        if (targetLang) {
          removeTranslatingState(messageId, targetLang);
        }
      });
    }, [updateMessage, removeTranslatingState, usedLanguages])
  });

  // Détection du mobile
  useEffect(() => {
    const checkMobile = () => {
      const isMobileView = window.innerWidth < 768;
      setIsMobile(isMobileView);
      
      console.log(`[ConversationLayout-${instanceId}] Détection mobile:`, {
        isMobileView,
        hasSelectedConversation: !!selectedConversation,
        selectedConversationId: selectedConversation?.id,
        urlId: selectedConversationId
      });
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []); // Supprimer selectedConversation des dépendances

  // Gestion de l'affichage mobile selon la conversation sélectionnée
  useEffect(() => {
    if (isMobile) {
      if (selectedConversation) {
        // Il y a une conversation sélectionnée → masquer la liste
        console.log(`[ConversationLayout-${instanceId}] Mobile: conversation sélectionnée, masquer liste`);
        setShowConversationList(false);
      } else {
        // Pas de conversation sélectionnée → afficher la liste
        console.log(`[ConversationLayout-${instanceId}] Mobile: pas de conversation, afficher liste`);
        setShowConversationList(true);
      }
    } else {
      // Desktop → toujours afficher la liste
      setShowConversationList(true);
    }
  }, [isMobile, selectedConversation, instanceId]);
  
  // Si on arrive avec une URL /conversations/:id, initialiser la sélection locale
  useEffect(() => {
    if (selectedConversationId && !localSelectedConversationId) {
      console.log(`[ConversationLayout-${instanceId}] URL avec ID détecté, initialisation sélection locale:`, selectedConversationId);
      setLocalSelectedConversationId(selectedConversationId);
    }
  }, [selectedConversationId, instanceId]);
  

  // Le chargement des conversations est maintenant géré par le hook useConversationsPagination
  // Cette fonction n'est plus nécessaire mais gardée pour compatibilité
  const loadConversations = useCallback(async () => {
    if (!user) return;
    console.log('[ConversationLayout] Rafraîchissement des conversations via hook de pagination');
    refreshConversations();
  }, [user, refreshConversations]);

  // Chargement des participants
  const loadParticipants = useCallback(async (conversationId: string) => {
    try {
      const participantsData = await conversationsService.getAllParticipants(conversationId);
      
      const allParticipants: ThreadMember[] = [
        ...participantsData.authenticatedParticipants.map(user => ({
          id: user.id,
          conversationId,
          userId: user.id,
          user: user,
          role: user.role as UserRoleEnum,
          joinedAt: new Date(),
          isActive: true,
          isAnonymous: false
        })),
        ...participantsData.anonymousParticipants.map(participant => ({
          id: participant.id,
          conversationId,
          userId: participant.id,
          user: {
            ...participant,
            displayName: participant.username,
            email: '',
            phoneNumber: '',
            isOnline: false,
            lastSeen: new Date(),
            lastActiveAt: new Date(),
            systemLanguage: 'fr',
            regionalLanguage: 'fr',
            role: 'USER' as const,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            autoTranslateEnabled: true,
            translateToSystemLanguage: true,
            translateToRegionalLanguage: false,
            useCustomDestination: false,
            keepOriginalMessages: true,
            translationQuality: 'medium'
          },
          role: 'MEMBER' as UserRoleEnum,
          joinedAt: new Date(),
          isActive: true,
          isAnonymous: true
        }))
      ];
      
      setParticipants(allParticipants);
    } catch (error) {
      console.error('Erreur lors du chargement des participants:', error);
      setParticipants([]);
    }
  }, []);

  // Fonction pour charger une conversation directement
  const loadDirectConversation = useCallback(async (conversationId: string) => {
    try {
      console.log(`[ConversationLayout-${instanceId}] Chargement direct de la conversation:`, conversationId);
      const directConversation = await conversationsService.getConversation(conversationId);
      console.log(`[ConversationLayout-${instanceId}] Conversation chargée directement:`, directConversation);
      
      // Ajouter à la liste - useMemo se chargera de la sélectionner automatiquement
      setConversations(prev => {
        const exists = prev.find(c => c.id === directConversation.id);
        if (exists) {
          console.log(`[ConversationLayout-${instanceId}] Conversation déjà dans la liste`);
          return prev;
        }
        console.log(`[ConversationLayout-${instanceId}] Ajout conversation à la liste`);
        return [directConversation, ...prev];
      });
    } catch (error) {
      console.error(`[ConversationLayout-${instanceId}] Erreur chargement direct:`, error);
    }
  }, [instanceId]);

  // Charger la conversation directement si elle n'est pas dans la liste
  useEffect(() => {
    if (effectiveSelectedId && !isLoading && conversations.length > 0) {
      const found = conversations.find(c => c.id === effectiveSelectedId);
      if (!found) {
        console.log(`[ConversationLayout-${instanceId}] Conversation ${effectiveSelectedId} non trouvée, chargement direct`);
        loadDirectConversation(effectiveSelectedId);
      }
    }
  }, [effectiveSelectedId, conversations, isLoading, loadDirectConversation, instanceId]);

  // Sélection d'une conversation (dynamique ou par URL)
  const handleSelectConversation = useCallback((conversation: Conversation) => {
    console.log(`[ConversationLayout-${instanceId}] Sélection conversation:`, {
      id: conversation.id,
      title: conversation.title,
      type: conversation.type,
      currentEffectiveId: effectiveSelectedId,
      mode: selectedConversationId ? 'url' : 'dynamic'
    });
    
    if (effectiveSelectedId === conversation.id) {
      console.log(`[ConversationLayout-${instanceId}] Conversation déjà sélectionnée, ignore`);
      return;
    }

    // Mode dynamique : mise à jour de l'état local SANS changer l'URL
    if (!selectedConversationId) {
      console.log(`[ConversationLayout-${instanceId}] Mode dynamique: sélection locale sans changement URL`);
      setLocalSelectedConversationId(conversation.id);
      
      // Mise à jour de l'URL dans l'historique sans recharger
      window.history.replaceState(null, '', '/conversations');
    } else {
      // Mode URL : navigation classique (pour compatibilité)
      console.log(`[ConversationLayout-${instanceId}] Mode URL: navigation vers:`, `/conversations/${conversation.id}`);
      router.push(`/conversations/${conversation.id}`);
    }
    
    // Note: L'affichage mobile est maintenant géré automatiquement par l'effet useEffect
  }, [effectiveSelectedId, selectedConversationId, router, instanceId]);

  // Retour à la liste (mobile et desktop)
  const handleBackToList = useCallback(() => {
    // Si on est en mode dynamique, juste effacer la sélection locale
    if (!selectedConversationId && localSelectedConversationId) {
      console.log(`[ConversationLayout-${instanceId}] Mode dynamique: effacer sélection locale`);
      setLocalSelectedConversationId(null);
      if (isMobile) {
        setShowConversationList(true);
      }
    } else if (selectedConversationId) {
      // Mode URL : navigation vers la liste sans ID
      console.log(`[ConversationLayout-${instanceId}] Mode URL: retour à /conversations`);
      router.push('/conversations');
    } else if (isMobile) {
      // Mobile sans sélection : afficher la liste
      setShowConversationList(true);
    }
  }, [isMobile, selectedConversationId, localSelectedConversationId, router, instanceId]);

  // Gérer la réponse à un message
  const handleReplyMessage = useCallback((message: any) => {
    const { setReplyingTo } = useReplyStore.getState();
    setReplyingTo({
      id: message.id,
      content: message.content,
      originalLanguage: message.originalLanguage,
      sender: message.sender,
      createdAt: message.createdAt,
      translations: message.translations
    });

    // Focus sur MessageComposer
    if (messageComposerRef.current) {
      messageComposerRef.current.focus();
    }

    toast.success('Répondre à ce message');
  }, []);

  // Naviguer vers un message spécifique
  const handleNavigateToMessage = useCallback((messageId: string) => {
    console.log('🔍 Navigation vers le message:', messageId);

    const messageElement = document.getElementById(`message-${messageId}`);

    if (messageElement) {
      messageElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });

      messageElement.classList.add('ring-2', 'ring-blue-500', 'ring-offset-2');
      setTimeout(() => {
        messageElement.classList.remove('ring-2', 'ring-blue-500', 'ring-offset-2');
      }, 2000);

      toast.success('Message trouvé !');
    } else {
      toast.info('Message non visible. Chargement...');
    }
  }, []);

  // Envoi de message - attendre le retour serveur
  const handleSendMessage = useCallback(async () => {
    if (!newMessage.trim() || !selectedConversation || !user) {
      return;
    }

    const content = newMessage.trim();
    const replyToId = useReplyStore.getState().replyingTo?.id;
    
    console.log('[ConversationLayout] handleSendMessage appelé:', {
      content,
      selectedConversationId: selectedConversation?.id,
      hasMessaging: !!messaging,
      hasUser: !!user,
      selectedLanguage,
      replyToId
    });
    
    if (!selectedConversation?.id || !user) {
      console.error('[ConversationLayout] Pas de conversation sélectionnée ou pas d\'utilisateur');
      return;
    }
    
    try {
      await messaging.sendMessage(content, selectedLanguage, replyToId);
      console.log('[ConversationLayout] Message envoyé avec succès - en attente du retour serveur');
      setNewMessage('');
      
      // Effacer l'état de réponse
      if (replyToId) {
        useReplyStore.getState().clearReply();
      }
    } catch (error) {
      console.error('[ConversationLayout] Erreur envoi message:', error);
    }
  }, [newMessage, selectedConversation?.id, messaging, selectedLanguage, user]);

  // Gestion de la saisie avec auto-resize du textarea
  const handleTyping = useCallback((value: string) => {
    setNewMessage(value);
    
    // Auto-resize textarea - similaire à BubbleStreamPage
    // Note: Le MessageComposer gère son propre textarea, donc on ne peut pas directement accéder à sa ref
    // L'auto-resize est géré par la classe CSS 'expandable-textarea' dans le MessageComposer
  }, []);

  // Gestion des touches clavier pour l'envoi de message
  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  // Effets
  useEffect(() => {
    if (user) {
      loadConversations();
      setSelectedLanguage(user.systemLanguage || 'fr');
    }
  }, [user, loadConversations]);


  // Charger une conversation directement si elle n'est pas dans la liste
  useEffect(() => {
    if (selectedConversationId && user && conversations.length > 0 && !selectedConversation) {
      console.log(`[ConversationLayout-${instanceId}] Conversation non trouvée dans la liste, chargement direct:`, selectedConversationId);
      loadDirectConversation(selectedConversationId);
    }
  }, [selectedConversationId, user, conversations.length, selectedConversation, loadDirectConversation, instanceId]);

  // Charger les participants quand la conversation change via URL
  useEffect(() => {
    if (selectedConversation?.id) {
      console.log(`[ConversationLayout-${instanceId}] Chargement participants pour conversation:`, selectedConversation.id);
      loadParticipants(selectedConversation.id);
      // Vider les anciens messages quand on change de conversation
      clearMessages();
    }
  }, [selectedConversation?.id, loadParticipants, clearMessages, instanceId]);


  // Loader d'authentification
  if (isAuthChecking) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">{t('conversationLayout.authChecking')}</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <>
      {/* Mode mobile avec conversation ouverte - Layout plein écran */}
      {isMobile && selectedConversation ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-gray-950">
          {/* Header de conversation */}
          <header className="flex-shrink-0 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 shadow-md border-b-2 border-gray-200 dark:border-gray-700">
            <ConversationHeader
              conversation={selectedConversation}
              currentUser={user}
              conversationParticipants={participants}
              typingUsers={messaging.typingUsers}
              isMobile={isMobile}
              onBackToList={handleBackToList}
              onOpenDetails={() => setIsDetailsOpen(true)}
              onParticipantRemoved={() => {}}
              onParticipantAdded={() => {}}
              onLinkCreated={() => {}}
              t={t}
              showBackButton={!!selectedConversationId}
            />
          </header>

          {/* Zone des messages scrollable */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden bg-transparent pb-36">
            <ConversationMessages
              messages={messages}
              translatedMessages={messages as any}
              currentUser={user}
              userLanguage={user.systemLanguage}
              usedLanguages={usedLanguages}
              isLoadingMessages={isLoadingMessages}
              isLoadingMore={isLoadingMore}
              hasMore={hasMore}
              isMobile={isMobile}
              conversationType={selectedConversation.type === 'anonymous' ? 'direct' : selectedConversation.type === 'broadcast' ? 'public' : selectedConversation.type as any}
              userRole={user.role as UserRoleEnum}
              conversationId={selectedConversation.id}
              addTranslatingState={addTranslatingState}
              isTranslating={isTranslating}
              onEditMessage={async () => {}}
              onDeleteMessage={async () => {}}
              onReplyMessage={handleReplyMessage}
              onNavigateToMessage={handleNavigateToMessage}
              onLoadMore={loadMore}
              t={t}
            />
          </div>

          {/* Zone de saisie fixe */}
          <div 
            className="fixed bottom-0 left-0 right-0 bg-white/98 dark:bg-gray-950/98 backdrop-blur-xl border-t-2 border-gray-200 dark:border-gray-700 shadow-2xl p-4 z-[100]"
            style={{
              paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
            }}
          >
            <MessageComposer
              ref={messageComposerRef}
              value={newMessage}
              onChange={handleTyping}
              onSend={handleSendMessage}
              selectedLanguage={selectedLanguage}
              onLanguageChange={setSelectedLanguage}
              placeholder={t('conversationLayout.writeMessage')}
              onKeyPress={handleKeyPress}
              choices={getUserLanguageChoices(user)}
            />
          </div>

          {/* Sidebar des détails - Mobile en modal */}
          {isDetailsOpen && (
            <ConversationDetailsSidebar
              conversation={selectedConversation}
              currentUser={user}
              messages={messages}
              isOpen={isDetailsOpen}
              onClose={() => setIsDetailsOpen(false)}
            />
          )}
        </div>
      ) : (
        /* Mode desktop ou mobile sans conversation */
        <div className={cn(
          "flex flex-col bg-gradient-to-br from-blue-50 to-indigo-100",
          isMobile ? "min-h-screen" : "h-screen overflow-hidden"
        )}>
          <div className={cn(
            isMobile ? "flex-shrink-0" : "flex-1 overflow-hidden"
          )}>
            <DashboardLayout 
              title={t('conversationLayout.conversations.title')} 
              hideHeaderOnMobile={false}
              className={cn(
                "!bg-none !bg-transparent !h-full",
                selectedConversationId ? "!min-h-0 !max-w-none !px-0" : ""
              )}
            >
            <div 
              className={cn(
                "flex bg-transparent conversation-layout relative z-10",
                !selectedConversationId && "max-w-7xl mx-auto",
                isMobile ? 'h-[calc(100vh-4rem)]' : 'h-full'
              )}
              role="application"
              aria-label={t('conversationLayout.conversations.title')}
            >
        {/* Liste des conversations - Sidebar gauche - Masquée si conversation sélectionnée via URL */}
        {!selectedConversationId && (
          <aside 
            className={cn(
              "flex-shrink-0 bg-white dark:bg-gray-950 border-r-2 border-gray-200 dark:border-gray-800 transition-all duration-300 shadow-lg",
              isMobile ? (
                showConversationList 
                  ? "fixed top-16 left-0 right-0 bottom-0 z-40 w-full" 
                  : "hidden"
              ) : "relative w-80 lg:w-96 h-full"
            )}
            role="complementary"
            aria-label={t('conversationLayout.conversationsList')}
          >
          <ConversationList
            conversations={conversations}
            selectedConversation={selectedConversation}
            currentUser={user}
            isLoading={isLoading}
            isMobile={isMobile}
            showConversationList={showConversationList}
            onSelectConversation={handleSelectConversation}
            onCreateConversation={() => setIsCreateModalOpen(true)}
            onLinkCreated={loadConversations}
            t={t}
            hasMore={hasMoreConversations}
            isLoadingMore={isLoadingMoreConversations}
            onLoadMore={loadMoreConversations}
            tSearch={(key: string) => t(`search.${key}`)}
          />
          </aside>
        )}

        {/* Zone de conversation principale - Desktop uniquement */}
        <main 
          className={cn(
            "flex flex-col min-w-0",
            selectedConversationId ? "w-full h-full" : "flex-1 h-full"
          )}
          role="main"
          aria-label={selectedConversation ? t('conversationLayout.conversationWith', { name: selectedConversation.title }) : t('conversationLayout.selectConversation')}
        >
          
          {selectedConversation ? (
            <div className="flex flex-col w-full h-full bg-white dark:bg-gray-950 shadow-xl">
              {/* Header de conversation */}
              <header className="flex-shrink-0 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 shadow-md border-b-2 border-gray-200 dark:border-gray-700 relative z-10" role="banner">
                <ConversationHeader
                  conversation={selectedConversation}
                  currentUser={user}
                  conversationParticipants={participants}
                  typingUsers={messaging.typingUsers}
                  isMobile={false}
                  onBackToList={handleBackToList}
                  onOpenDetails={() => setIsDetailsOpen(true)}
                  onParticipantRemoved={() => {}}
                  onParticipantAdded={() => {}}
                  onLinkCreated={() => {}}
                  t={t}
                  showBackButton={!!selectedConversationId}
                />
              </header>

              {/* Zone des messages */}
              <div 
                className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 bg-gradient-to-b from-gray-50/50 to-white dark:from-gray-900/50 dark:to-gray-950 pb-4"
                role="region"
                aria-live="polite"
                aria-label={t('conversationLayout.messagesList')}
              >
                <ConversationMessages
                  messages={messages}
                  translatedMessages={messages as any}
                  currentUser={user}
                  userLanguage={user.systemLanguage}
                  usedLanguages={usedLanguages}
                  isLoadingMessages={isLoadingMessages}
                  isLoadingMore={isLoadingMore}
                  hasMore={hasMore}
                  isMobile={false}
                  conversationType={selectedConversation.type === 'anonymous' ? 'direct' : selectedConversation.type === 'broadcast' ? 'public' : selectedConversation.type as any}
                  userRole={user.role as UserRoleEnum}
                  conversationId={selectedConversation.id}
                  addTranslatingState={addTranslatingState}
                  isTranslating={isTranslating}
                  onEditMessage={async () => {}}
                  onDeleteMessage={async () => {}}
                  onReplyMessage={handleReplyMessage}
                  onNavigateToMessage={handleNavigateToMessage}
                  onLoadMore={loadMore}
                  t={t}
                />
              </div>

              {/* Zone de composition - Desktop */}
              <div className="bg-white/98 dark:bg-gray-950/98 backdrop-blur-xl border-t-2 border-gray-200 dark:border-gray-700 shadow-2xl sticky bottom-0 p-6 z-20">
                <div className="max-w-5xl mx-auto">
                  <MessageComposer
                    ref={messageComposerRef}
                    value={newMessage}
                    onChange={handleTyping}
                    onSend={handleSendMessage}
                    selectedLanguage={selectedLanguage}
                    onLanguageChange={setSelectedLanguage}
                    placeholder={t('conversationLayout.writeMessage')}
                    onKeyPress={handleKeyPress}
                    choices={getUserLanguageChoices(user)}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center p-4 h-full bg-white dark:bg-gray-950">
              <ConversationEmptyState
                conversationsCount={conversations.length}
                onCreateConversation={() => setIsCreateModalOpen(true)}
                onLinkCreated={loadConversations}
                t={t}
              />
            </div>
          )}
        </main>

        {/* Sidebar des détails - Desktop seulement */}
        {selectedConversation && isDetailsOpen && (
          <ConversationDetailsSidebar
            conversation={selectedConversation}
            currentUser={user}
            messages={messages}
            isOpen={isDetailsOpen}
            onClose={() => setIsDetailsOpen(false)}
          />
        )}
      </div>

            {/* Modales */}
            <CreateConversationModal
              isOpen={isCreateModalOpen}
              onClose={() => setIsCreateModalOpen(false)}
              currentUser={user}
              onConversationCreated={(id, conv) => {
                setIsCreateModalOpen(false);
                if (conv) {
                  setConversations(prev => [conv, ...prev]);
                  handleSelectConversation(conv);
                }
              }}
            />
            </DashboardLayout>
          </div>

          {/* Footer - En bas de la page, dans le gradient bleu - Desktop seulement */}
          {!isMobile && (
            <div className="relative z-20 flex-shrink-0">
              <Footer />
            </div>
          )}
        </div>
      )}
    </>
  );
}
