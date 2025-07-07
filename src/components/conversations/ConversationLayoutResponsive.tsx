'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser } from '@/context/AppContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  MessageSquare, 
  Users, 
  Plus, 
  Send,
  ArrowLeft,
  Link2
} from 'lucide-react';
import { toast } from 'sonner';
import { Conversation, Message, TranslatedMessage } from '@/types';
import { conversationsService } from '@/services/conversationsService';
import { MessageBubble } from './message-bubble';
import { useOptimizedMessageTranslation } from '@/hooks/use-optimized-message-translation-simple';
import { CreateLinkModal } from './create-link-modal';
import { CreateConversationModal } from './create-conversation-modal';
import { cn } from '@/lib/utils';
import { HuggingFaceTranslationService } from '@/services/huggingface-translation';
import { UNIFIED_TRANSLATION_MODELS, type TranslationModelType } from '@/lib/simplified-model-config';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { detectLanguage } from '@/utils/translation';
import { TranslationPerformanceTips } from '@/components/translation/translation-performance-tips';
import { SystemPerformanceMonitor } from '@/components/translation/system-performance-monitor';

interface ConversationLayoutResponsiveProps {
  selectedConversationId?: string;
}

export function ConversationLayoutResponsive({ selectedConversationId }: ConversationLayoutResponsiveProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useUser();
  
  // États principaux
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [translatedMessages, setTranslatedMessages] = useState<TranslatedMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  
  // États UI responsive
  const [showConversationList, setShowConversationList] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  
  // États modaux
  const [isCreateLinkModalOpen, setIsCreateLinkModalOpen] = useState(false);
  const [isCreateConversationModalOpen, setIsCreateConversationModalOpen] = useState(false);
  
  // États de traduction
  const [selectedTranslationModel, setSelectedTranslationModel] = useState<TranslationModelType>('NLLB_DISTILLED_600M');
  const [translationService] = useState(() => HuggingFaceTranslationService.getInstance());
  
  // Hook de traduction
  // const { translateMessages, translateMessage } = useOptimizedMessageTranslation(user);

  // Fonction utilitaire pour obtenir le nom d'affichage d'une conversation
  const getConversationDisplayName = useCallback((conversation: Conversation): string => {
    if (conversation.isGroup) {
      return conversation.name || conversation.title || 'Groupe sans nom';
    } else {
      // Pour les conversations privées, afficher le nom de l'autre participant
      const otherParticipant = conversation.participants?.find(p => p.userId !== user?.id);
      if (otherParticipant?.user) {
        return otherParticipant.user.displayName || 
               `${otherParticipant.user.firstName} ${otherParticipant.user.lastName}` ||
               otherParticipant.user.username;
      }
      return conversation.name || conversation.title || 'Conversation privée';
    }
  }, [user]);

  // Fonction utilitaire pour obtenir l'avatar d'une conversation
  const getConversationAvatar = useCallback((conversation: Conversation): string => {
    if (conversation.isGroup) {
      return (conversation.name || conversation.title || 'G').slice(0, 2).toUpperCase();
    } else {
      // Pour les conversations privées, utiliser l'initiale de l'autre participant
      const otherParticipant = conversation.participants?.find(p => p.userId !== user?.id);
      if (otherParticipant?.user) {
        const displayName = otherParticipant.user.displayName || 
                           `${otherParticipant.user.firstName} ${otherParticipant.user.lastName}` ||
                           otherParticipant.user.username;
        return displayName.slice(0, 2).toUpperCase();
      }
      return 'C';
    }
  }, [user]);

  // Détecter si on est sur mobile
  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  // Gérer l'affichage responsive
  useEffect(() => {
    if (isMobile) {
      // Sur mobile, montrer la liste si aucune conversation sélectionnée
      setShowConversationList(!selectedConversation);
    } else {
      // Sur desktop, toujours montrer la liste
      setShowConversationList(true);
    }
  }, [isMobile, selectedConversation]);

  // Charger automatiquement le modèle de traduction AU BESOIN UNIQUEMENT
  useEffect(() => {
    const prepareTranslationService = async () => {
      try {
        // Vérifier si des modèles sont déjà chargés ou persistés
        const persistedModels = translationService.getPersistedLoadedModels();
        if (persistedModels.length > 0) {
          console.log(`✅ Modèles persistés trouvés: ${persistedModels.join(', ')}`);
          return; // Ne pas charger automatiquement si des modèles sont déjà disponibles
        }

        // Sinon, juste préparer le service mais NE PAS charger de modèle automatiquement
        console.log('🤗 Service de traduction prêt - chargement à la demande');
        
      } catch (error) {
        console.warn('⚠️ Avertissement préparation traduction:', error);
        // Ne pas bloquer l'interface pour les erreurs de traduction
      }
    };

    // Préparer sans délai pour ne pas ralentir l'UI
    prepareTranslationService();
  }, [translationService]);

  // Handlers pour MessageBubble
  const handleTranslate = async (messageId: string, targetLanguage: string) => {
    const message = messages.find(m => m.id === messageId);
    if (!message) return;
    
    try {
      console.log(`🔄 Traduction avec modèle sélectionné: ${selectedTranslationModel}`);
      
      // Afficher un indicateur de traduction en cours
      toast.loading('Traduction en cours...', { id: `translate-${messageId}` });
      
      // Utiliser directement le service de traduction avec le modèle sélectionné
      const sourceLanguage = message.originalLanguage || detectLanguage(message.content);
      
      // Ajouter un délai pour permettre à l'interface de se mettre à jour
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const translationResult = await translationService.translateText(
        message.content,
        sourceLanguage,
        targetLanguage,
        selectedTranslationModel,
        (progress) => {
          console.log(`📊 Progression traduction: ${progress.progress}% - ${progress.status}`);
          // Mettre à jour le toast avec la progression
          if (progress.status === 'downloading') {
            toast.loading(`Téléchargement du modèle: ${progress.progress || 0}%`, { id: `translate-${messageId}` });
          } else if (progress.status === 'loading') {
            toast.loading('Chargement du modèle...', { id: `translate-${messageId}` });
          }
        }
      );

      // Créer le message traduit avec toutes les propriétés requises
      const translatedMsg: TranslatedMessage = {
        ...message,
        originalContent: message.content,
        translatedContent: translationResult.translatedText,
        targetLanguage,
        isTranslated: true,
        isTranslating: false,
        showingOriginal: false,
        translationError: undefined,
        translationFailed: false,
        translations: [{
          language: targetLanguage,
          content: translationResult.translatedText,
          flag: '🌍', // Drapeau par défaut
          modelUsed: selectedTranslationModel,
          createdAt: new Date()
        }],
        sender: message.sender || {
          id: message.senderId,
          username: 'unknown',
          firstName: 'Utilisateur',
          lastName: 'Inconnu',
          email: 'unknown@example.com',
          role: 'USER',
          permissions: {
            canAccessAdmin: false,
            canManageUsers: false,
            canManageGroups: false,
            canManageConversations: false,
            canViewAnalytics: false,
            canModerateContent: false,
            canViewAuditLogs: false,
            canManageNotifications: false,
            canManageTranslations: false,
          },
          systemLanguage: 'fr',
          regionalLanguage: 'fr',
          autoTranslateEnabled: false,
          translateToSystemLanguage: false,
          translateToRegionalLanguage: false,
          useCustomDestination: false,
          isOnline: false,
          createdAt: new Date(),
          lastActiveAt: new Date(),
        }
      };
      
      // Mettre à jour le message traduit dans la liste
      setTranslatedMessages(prev => {
        const filtered = prev.filter(m => m.id !== messageId);
        return [...filtered, translatedMsg].sort((a, b) => 
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      });
      
      console.log(`✅ Message traduit avec ${selectedTranslationModel}: ${translationResult.translatedText}`);
      toast.success(`Message traduit avec ${selectedTranslationModel}`, { id: `translate-${messageId}` });
    } catch (error) {
      console.error('❌ Erreur lors de la traduction:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erreur lors de la traduction du message';
      toast.error(errorMessage, { id: `translate-${messageId}` });
    }
  };

  const handleEdit = async (messageId: string, newContent: string) => {
    console.log('Edit message:', messageId, 'New content:', newContent);
    toast.info('Édition de message bientôt disponible');
  };

  // Utilitaires
  const convertToTranslatedMessage = useCallback((message: Message): TranslatedMessage => {
    return {
      ...message,
      translatedContent: message.content,
      targetLanguage: user?.systemLanguage || 'fr',
    };
  }, [user?.systemLanguage]);

  const createMockMessages = useCallback((conversationId: string): Message[] => {
    return [
      {
        id: `mock-${conversationId}-1`,
        content: "Salut ! Comment ça va ?",
        senderId: 'user1',
        conversationId,
        originalLanguage: 'fr',
        isEdited: false,
        createdAt: new Date(Date.now() - 3600000), // 1h ago
        updatedAt: new Date(Date.now() - 3600000),
        sender: {
          id: 'user1',
          username: 'marie',
          displayName: 'Marie Dubois',
          email: 'marie@example.com',
          role: 'USER',
          permissions: { canAccessAdmin: false, canManageUsers: false, canManageGroups: false, canManageConversations: false, canViewAnalytics: false, canModerateContent: false, canViewAuditLogs: false, canManageNotifications: false, canManageTranslations: false },
          systemLanguage: 'fr',
          regionalLanguage: 'fr',
          autoTranslateEnabled: true,
          translateToSystemLanguage: true,
          translateToRegionalLanguage: false,
          useCustomDestination: false,
          isOnline: true,
          createdAt: new Date(),
          lastActiveAt: new Date()
        }
      },
      {
        id: `mock-${conversationId}-2`,
        content: "Très bien ! Et toi ?",
        senderId: user?.id || 'current-user',
        conversationId,
        originalLanguage: 'fr',
        isEdited: false,
        createdAt: new Date(Date.now() - 1800000), // 30min ago
        updatedAt: new Date(Date.now() - 1800000),
        sender: user || {
          id: 'current-user',
          username: 'moi',
          displayName: 'Moi',
          email: 'moi@example.com',
          role: 'USER',
          permissions: { canAccessAdmin: false, canManageUsers: false, canManageGroups: false, canManageConversations: false, canViewAnalytics: false, canModerateContent: false, canViewAuditLogs: false, canManageNotifications: false, canManageTranslations: false },
          systemLanguage: 'fr',
          regionalLanguage: 'fr',
          autoTranslateEnabled: true,
          translateToSystemLanguage: true,
          translateToRegionalLanguage: false,
          useCustomDestination: false,
          isOnline: true,
          createdAt: new Date(),
          lastActiveAt: new Date()
        }
      }
    ];
  }, [user]);

  // Charger les messages d'une conversation
  const loadMessages = useCallback(async (conversationId: string, isNewConversation = false) => {
    if (!user) return;

    // Pour une nouvelle conversation, toujours charger
    // Pour une conversation existante, vérifier si c'est déjà chargé
    if (!isNewConversation && selectedConversation?.id === conversationId && messages.length > 0) {
      console.log('📬 Messages déjà chargés pour cette conversation');
      return;
    }

    try {
      setIsLoadingMessages(true);
      console.log(`📬 Chargement des messages pour la conversation ${conversationId}`);
      
      const messagesData = await conversationsService.getMessages(conversationId);
      
      // Vérifier si la conversation sélectionnée n'a pas changé
      if (selectedConversation?.id !== conversationId) {
        console.log('🚫 Conversation changée pendant le chargement, abandon');
        return;
      }
      
      const rawMessages = messagesData?.messages || [];
      
      // Trier les messages par date de création
      const sortedMessages = rawMessages.sort((a, b) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      
      // Mettre à jour les messages APRÈS avoir vérifié la cohérence
      setMessages(sortedMessages);

      // NE TRADUIRE QUE SI L'UTILISATEUR A ACTIVÉ LA TRADUCTION AUTO
      // Sinon, juste convertir sans traduire pour gagner du temps
      if (user.autoTranslateEnabled && sortedMessages.length > 0) {
        console.log('🔄 Traduction automatique activée, traduction en arrière-plan...');
        // Convertir d'abord sans traduction pour affichage immédiat
        const convertedMessages = sortedMessages.map(msg => convertToTranslatedMessage(msg));
        setTranslatedMessages(convertedMessages);
        
        // Puis traduire en arrière-plan
        setTimeout(async () => {
          try {
            // Vérifier encore une fois si la conversation n'a pas changé
            if (selectedConversation?.id !== conversationId) {
              console.log('🚫 Conversation changée pendant la traduction, abandon');
              return;
            }
            
            // Pas de traduction automatique pour l'instant - TODO: implémenter avec le modèle sélectionné
            // const translated = await translateMessages(sortedMessages, user.systemLanguage);
            // setTranslatedMessages(translated);
            const convertedMessages = sortedMessages.map(msg => convertToTranslatedMessage(msg));
            setTranslatedMessages(convertedMessages);
            console.log('✅ Messages chargés sans traduction automatique');
          } catch (error) {
            console.warn('⚠️ Erreur traduction automatique:', error);
            // Garder les messages non traduits
          }
        }, 500); // Délai pour ne pas bloquer l'UI
      } else {
        // Pas de traduction automatique, affichage direct
        const convertedMessages = sortedMessages.map(msg => convertToTranslatedMessage(msg));
        setTranslatedMessages(convertedMessages);
      }
    } catch (error) {
      console.error('❌ Erreur lors du chargement des messages:', error);
      console.log('🔄 Utilisation des messages mock pour le développement');
      
      // Vérifier si cette conversation est toujours celle demandée
      if (selectedConversation?.id !== conversationId) {
        console.log('🚫 Conversation changée pendant l\'erreur, abandon');
        return;
      }
      
      // Messages mock pour le développement - ne pas afficher d'erreur
      const mockMessages = createMockMessages(conversationId);
      setMessages(mockMessages);
      const convertedMockMessages = mockMessages.map(msg => convertToTranslatedMessage(msg));
      setTranslatedMessages(convertedMockMessages);
    } finally {
      setIsLoadingMessages(false);
    }
  }, [user, convertToTranslatedMessage, createMockMessages, selectedConversation?.id, messages.length]);

  // Charger les données initiales avec optimisations
  const loadData = useCallback(async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      console.log('🔄 Chargement des conversations...');
      
      // Démarrer le chargement des conversations immédiatement
      const conversationsPromise = conversationsService.getConversations();
      
      // Attendre les conversations
      const conversationsData = await conversationsPromise;
      
      setConversations(conversationsData);
      console.log(`✅ ${conversationsData.length} conversations chargées`);

      // Sélectionner une conversation seulement si spécifiée dans l'URL
      const conversationIdFromUrl = searchParams.get('id') || selectedConversationId;
      if (conversationIdFromUrl) {
        const conversation = conversationsData.find(c => c.id === conversationIdFromUrl);
        if (conversation) {
          setSelectedConversation(conversation);
          // Le chargement des messages sera géré par l'effet useEffect
        } else {
          // ID non trouvé, désélectionner
          setSelectedConversation(null);
        }
      } else {
        // Aucun ID dans l'URL, s'assurer qu'aucune conversation n'est sélectionnée
        setSelectedConversation(null);
      }
      
      // Mettre fin au loading principal immédiatement après les conversations
      setIsLoading(false);
      
    } catch (error) {
      console.error('❌ Erreur lors du chargement des conversations:', error);
      
      // Pas de toast d'erreur pour ne pas ralentir l'UI, juste les données mock
      console.log('🔄 Utilisation des données mock pour le développement');
      
      // Conversations mock pour le développement (plus rapide)
      const mockConversations: Conversation[] = [
        {
          id: '1',
          name: 'Conversation de test',
          type: 'PRIVATE',
          isGroup: false,
          isActive: true,
          participants: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          lastMessage: {
            id: 'last-msg-1',
            content: 'Message de test',
            senderId: 'user1',
            conversationId: '1',
            originalLanguage: 'fr',
            isEdited: false,
            createdAt: new Date(),
            updatedAt: new Date(),
            sender: {
              id: 'user1',
              username: 'testuser',
              displayName: 'Utilisateur Test',
              email: 'test@example.com',
              role: 'USER',
              permissions: { canAccessAdmin: false, canManageUsers: false, canManageGroups: false, canManageConversations: false, canViewAnalytics: false, canModerateContent: false, canViewAuditLogs: false, canManageNotifications: false, canManageTranslations: false },
              systemLanguage: 'fr',
              regionalLanguage: 'fr',
              autoTranslateEnabled: false,
              translateToSystemLanguage: false,
              translateToRegionalLanguage: false,
              useCustomDestination: false,
              isOnline: true,
              createdAt: new Date(),
              lastActiveAt: new Date()
            }
          },
          unreadCount: 0
        }
      ];
      
      setConversations(mockConversations);
      setIsLoading(false);
    }
  }, [user, searchParams, selectedConversationId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Sélectionner une conversation
  const handleSelectConversation = (conversation: Conversation) => {
    // Si c'est la même conversation, ne rien faire
    if (selectedConversation?.id === conversation.id) {
      console.log('📬 Conversation déjà sélectionnée');
      return;
    }

    // Simplement sélectionner la conversation, l'effet se chargera du reste
    setSelectedConversation(conversation);
    
    // Sur mobile, masquer la liste pour afficher les messages
    if (isMobile) {
      setShowConversationList(false);
    }
    
    // Mettre à jour l'URL
    router.push(`/conversations?id=${conversation.id}`, { scroll: false });
  };

  // Retour à la liste (mobile uniquement)
  const handleBackToList = () => {
    if (isMobile) {
      setShowConversationList(true);
      setSelectedConversation(null);
      router.push('/conversations', { scroll: false });
    }
  };

  // Envoyer un message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !selectedConversation || !user) {
      return;
    }

    setIsSending(true);

    try {
      console.log('📤 Envoi du message:', newMessage);
      
      const response = await conversationsService.sendMessage(selectedConversation.id, {
        content: newMessage.trim(),
        originalLanguage: user.systemLanguage,
      });

      console.log('✅ Message envoyé:', response);
      
      // Créer un message temporaire pour l'affichage immédiat
      const newMessageObj: Message = {
        id: response.id || `temp-${Date.now()}`,
        content: newMessage.trim(),
        conversationId: selectedConversation.id,
        senderId: user.id,
        sender: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          displayName: user.displayName || `${user.firstName} ${user.lastName}`,
          avatar: user.avatar,
          username: user.username,
          email: user.email,
          systemLanguage: user.systemLanguage,
          regionalLanguage: user.regionalLanguage || user.systemLanguage,
          autoTranslateEnabled: user.autoTranslateEnabled,
          translateToSystemLanguage: user.translateToSystemLanguage,
          translateToRegionalLanguage: user.translateToRegionalLanguage,
          useCustomDestination: user.useCustomDestination,
          customDestinationLanguage: user.customDestinationLanguage,
          isOnline: user.isOnline,
          lastSeen: user.lastSeen,
          role: user.role,
          permissions: user.permissions,
          createdAt: user.createdAt,
          lastActiveAt: user.lastActiveAt
        },
        originalLanguage: user.systemLanguage,
        isEdited: false,
        isDeleted: false,
        editedAt: undefined,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Ajouter le message à la liste locale immédiatement (trié par date)
      setMessages(prev => {
        const filtered = prev.filter(m => m.id !== newMessageObj.id); // Éviter les doublons
        const newList = [...filtered, newMessageObj];
        return newList.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      });
      
      // Ajouter aussi à la liste traduite
      const translatedMsg = convertToTranslatedMessage(newMessageObj);
      setTranslatedMessages(prev => {
        const filtered = prev.filter(m => m.id !== translatedMsg.id); // Éviter les doublons
        const newList = [...filtered, translatedMsg];
        return newList.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      });
      
      setNewMessage('');
      
      // Ne pas recharger automatiquement pour éviter que le message disparaisse
      // setTimeout(() => loadMessages(selectedConversation.id), 1000);
      
      toast.success('Message envoyé !');
    } catch (error) {
      console.error('❌ Erreur lors de l\'envoi du message:', error);
      toast.error('Erreur lors de l\'envoi du message');
    } finally {
      setIsSending(false);
    }
  };

  // Effet pour gérer le changement de conversation
  useEffect(() => {
    // Si on a une conversation sélectionnée, charger ses messages
    if (selectedConversation?.id) {
      // Ne pas vider immédiatement les messages pour éviter le scintillement
      // Les messages seront remplacés une fois les nouveaux chargés
      setIsLoadingMessages(true);
      loadMessages(selectedConversation.id, true);
    } else {
      // Aucune conversation sélectionnée, vider les messages
      setMessages([]);
      setTranslatedMessages([]);
      setIsLoadingMessages(false);
    }
  }, [selectedConversation?.id, loadMessages]);

  if (!user) {
    return null;
  }

  return (
    <DashboardLayout title="Conversations">
      {isLoading ? (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Chargement des conversations...</p>
          </div>
        </div>
      ) : (
        <div className="h-[calc(100vh-6rem)] flex bg-transparent">
          {/* Liste des conversations */}
          <div className={cn(
            "flex flex-col bg-white/80 backdrop-blur-sm rounded-l-2xl border border-border/50 shadow-lg",
            isMobile ? (showConversationList ? "w-full" : "hidden") : "w-96"
          )}>
            {/* Header fixe */}
            <div className="flex-shrink-0 p-4 border-b border-border/30">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-foreground">Conversations</h2>
                </div>
                <div className="relative">
                  <MessageSquare className="h-6 w-6 text-primary" />
                  {conversations.filter(c => (c.unreadCount || 0) > 0).length > 0 && (
                    <div className="absolute -top-2 -right-2 h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                      {conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0)}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Sélecteur de modèle de traduction */}
              <div className="mb-2">
                <label className="text-sm font-medium text-muted-foreground mb-2 block">
                  Modèle de traduction
                </label>
                <Select 
                  value={selectedTranslationModel} 
                  onValueChange={(value) => setSelectedTranslationModel(value as TranslationModelType)}
                >
                  <SelectTrigger className="w-full h-8 text-sm">
                    <SelectValue placeholder="Choisir un modèle" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(UNIFIED_TRANSLATION_MODELS).map((model) => (
                      <SelectItem key={model.name} value={model.name}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-2 h-2 rounded-full" 
                            style={{ backgroundColor: model.color }}
                          />
                          <span className="text-sm">{model.displayName}</span>
                          <Badge variant="outline" className="text-xs px-1 py-0">
                            {model.parameters}
                          </Badge>
                          {translationService.isModelLoaded(model.name) && (
                            <Badge variant="default" className="text-xs px-1 py-0 bg-green-500">
                              ✓
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {/* Moniteur de performance système */}
                <SystemPerformanceMonitor />
                
                {/* Conseils de performance */}
                <div className="mt-2">
                  <TranslationPerformanceTips 
                    currentModel={selectedTranslationModel}
                    textLength={newMessage.length}
                  />
                </div>
              </div>
            </div>
            
            {/* Liste scrollable */}
            <div className="flex-1 overflow-y-auto">
              {conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                  <MessageSquare className="h-16 w-16 text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">Aucune conversation</h3>
                  <p className="text-muted-foreground mb-6">
                    Commencez une nouvelle conversation pour discuter avec vos amis !
                  </p>
                </div>
              ) : (
                <div className="p-2">
                  {conversations.map((conversation) => (
                    <div
                      key={conversation.id}
                      onClick={() => handleSelectConversation(conversation)}
                      className={cn(
                        "flex items-center p-4 rounded-2xl cursor-pointer transition-all mb-2 border-2",
                        selectedConversation?.id === conversation.id
                          ? "bg-primary/20 border-primary/40 shadow-md"
                          : "hover:bg-accent/50 border-transparent hover:border-border/30"
                      )}
                    >
                      <div className="relative">
                        <Avatar className="h-12 w-12 ring-2 ring-primary/20">
                          <AvatarImage />
                          <AvatarFallback className="bg-primary/20 text-primary font-bold">
                            {conversation.isGroup ? (
                              <Users className="h-6 w-6" />
                            ) : (
                              getConversationAvatar(conversation)
                            )}
                          </AvatarFallback>
                        </Avatar>
                        <div className="absolute -bottom-0 -right-0 h-4 w-4 bg-green-500 rounded-full border-2 border-background"></div>
                      </div>
                      
                      <div className="ml-4 flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="font-bold text-foreground truncate">
                            {getConversationDisplayName(conversation)}
                          </h3>
                          {conversation.lastMessage && (
                            <span className="text-xs text-muted-foreground ml-2 flex-shrink-0">
                              {new Date(conversation.lastMessage.createdAt).toLocaleTimeString('fr-FR', { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })}
                            </span>
                          )}
                        </div>
                        {conversation.lastMessage && (
                          <p className="text-sm text-muted-foreground truncate">
                            {conversation.lastMessage.content}
                          </p>
                        )}
                      </div>
                      
                      {(conversation.unreadCount || 0) > 0 && (
                        <div className="ml-3 bg-primary text-primary-foreground text-xs rounded-full h-6 w-6 flex items-center justify-center font-bold shadow-sm">
                          {conversation.unreadCount}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Footer fixe avec boutons */}
            <div className="flex-shrink-0 p-4 border-t border-border/30 bg-background/50">
              <div className="flex gap-3">
                <Button
                  className="flex-1 rounded-2xl h-12 bg-primary/10 hover:bg-primary/20 border-0 text-primary font-semibold"
                  onClick={() => setIsCreateLinkModalOpen(true)}
                >
                  <Link2 className="h-5 w-5 mr-2" />
                  Créer un lien
                </Button>
                <Button
                  className="flex-1 rounded-2xl h-12 bg-primary/10 hover:bg-primary/20 border-0 text-primary font-semibold"
                  onClick={() => setIsCreateConversationModalOpen(true)}
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Nouvelle conversation
                </Button>
              </div>
            </div>
          </div>

          {/* Zone de messages */}
          <div className={cn(
            "flex flex-col",
            isMobile ? (showConversationList ? "hidden" : "w-full") : "flex-1"
          )}>
            {selectedConversation ? (
              <>
                {/* En-tête de la conversation */}
                <div className="flex-shrink-0 p-4 border-b border-border/30 bg-white/90 backdrop-blur-sm rounded-tr-2xl">
                  <div className="flex items-center gap-3">
                    {isMobile && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleBackToList}
                        className="rounded-full h-10 w-10 p-0 hover:bg-accent/50"
                      >
                        <ArrowLeft className="h-5 w-5" />
                      </Button>
                    )}
                    <div className="relative">
                      <Avatar className="h-10 w-10 ring-2 ring-primary/20">
                        <AvatarImage />
                        <AvatarFallback className="bg-primary/20 text-primary font-bold">
                          {selectedConversation.isGroup ? (
                            <Users className="h-5 w-5" />
                          ) : (
                            getConversationAvatar(selectedConversation)
                          )}
                        </AvatarFallback>
                      </Avatar>
                      <div className="absolute -bottom-0 -right-0 h-3 w-3 bg-green-500 rounded-full border-2 border-background"></div>
                    </div>
                    <div className="flex-1">
                      <h2 className="font-bold text-lg text-foreground">
                        {getConversationDisplayName(selectedConversation)}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {selectedConversation.isGroup 
                          ? `${selectedConversation.participants?.length || 0} personnes`
                          : 'En ligne'
                        }
                      </p>
                    </div>
                  </div>
                </div>

                {/* Messages scrollables */}
                <div className="flex-1 overflow-y-auto p-4 bg-white/50 backdrop-blur-sm">
                  {isLoadingMessages ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                        <p className="text-muted-foreground">Chargement des messages...</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {translatedMessages.map((message) => (
                        <MessageBubble
                          key={message.id}
                          message={message}
                          currentUserId={user.id}
                          currentUserLanguage={user.systemLanguage}
                          onTranslate={handleTranslate}
                          onEdit={handleEdit}
                          onToggleOriginal={() => {
                            console.log('Toggle original pour le message:', message.id);
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Zone de saisie fixe en bas */}
                <div className="flex-shrink-0 p-4 border-t border-border/30 bg-white/90 backdrop-blur-sm rounded-br-2xl">
                  <form onSubmit={handleSendMessage} className="flex gap-3">
                    <Input
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Écris ton message..."
                      className="flex-1 rounded-2xl h-12 px-4 border-2 border-border/30 focus:border-primary/50 bg-background/50"
                      disabled={isSending}
                    />
                    <Button 
                      type="submit"
                      size="sm"
                      disabled={!newMessage.trim() || isSending}
                      className="rounded-2xl h-12 w-12 p-0 bg-primary hover:bg-primary/90 shadow-md hover:shadow-lg transition-all"
                    >
                      {isSending ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      ) : (
                        <Send className="h-5 w-5" />
                      )}
                    </Button>
                  </form>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white/50 backdrop-blur-sm rounded-r-2xl">
                <div className="max-w-md">
                  <div className="w-24 h-24 mx-auto mb-6 bg-primary/10 rounded-full flex items-center justify-center">
                    <MessageSquare className="h-12 w-12 text-primary" />
                  </div>
                  
                  {conversations.length > 0 ? (
                    <>
                      <h3 className="text-xl font-bold text-foreground mb-2 text-center">Choisis une conversation !</h3>
                      <p className="text-muted-foreground text-base mb-6 text-center">
                        Clique sur une conversation à gauche pour commencer à discuter
                      </p>
                    </>
                  ) : (
                    <>
                      <h3 className="text-xl font-bold text-foreground mb-2 text-center">Bienvenue ! 🎉</h3>
                      <p className="text-muted-foreground text-base mb-6 text-center">
                        Tu n&apos;as pas encore de conversations. Commence par en créer une !
                      </p>
                    </>
                  )}
                </div>
                
                {/* Boutons d'action dans l'état vide */}
                <div className="flex gap-4 justify-center">
                  <Button
                    onClick={() => setIsCreateConversationModalOpen(true)}
                    className="rounded-2xl px-6 py-3 bg-primary hover:bg-primary/90 text-white font-semibold shadow-md hover:shadow-lg transition-all"
                  >
                    <Plus className="h-5 w-5 mr-2" />
                    Nouvelle conversation
                  </Button>
                  <Button
                    onClick={() => setIsCreateLinkModalOpen(true)}
                    variant="outline"
                    className="rounded-2xl px-6 py-3 border-2 border-primary/20 hover:border-primary/40 font-semibold shadow-md hover:shadow-lg transition-all"
                  >
                    <Link2 className="h-5 w-5 mr-2" />
                    Créer un lien
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modales */}
      <CreateLinkModal
        isOpen={isCreateLinkModalOpen}
        onClose={() => setIsCreateLinkModalOpen(false)}
        onLinkCreated={() => {
          console.log('Lien créé');
          loadData();
        }}
      />
      
      <CreateConversationModal
        isOpen={isCreateConversationModalOpen}
        onClose={() => setIsCreateConversationModalOpen(false)}
        currentUser={user}
        onConversationCreated={() => {
          console.log('Conversation créée');
          loadData();
        }}
      />
    </DashboardLayout>
  );
}
