
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser } from '@/context/AppContext';
import { useMessaging } from '@/hooks/use-messaging';
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
import { conversationsService } from '@/services/conversations.service';
import { MessageBubble } from './message-bubble';
import { CreateLinkModal } from './create-link-modal';
import { CreateConversationModal } from './create-conversation-modal';
import { cn } from '@/lib/utils';
import { translationService } from '@/services/translation.service';
import { type TranslationModelType } from '@/lib/unified-model-config';
import { getAllActiveModels, ACTIVE_MODELS, getModelConfig } from '@/lib/unified-model-config';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { detectAll } from 'tinyld'; // Importation de tinyld pour la détection de langue
import { TranslationPerformanceTips } from '@/components/translation/translation-performance-tips';
import { SystemPerformanceMonitor } from '@/components/translation/system-performance-monitor';
import { cleanTranslationOutput } from '@/utils/translation-cleaner';
// Supprimé: import { pipeline, env } from '@xenova/transformers';
// Supprimé: env.allowLocalModels = false; // Skip check for models hosted locally

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
  const [selectedTranslationModel, setSelectedTranslationModel] = useState<TranslationModelType>(ACTIVE_MODELS.highModel);

const c = console;

function progress_callback(x: any) {
    if (x.status === "done") {
        c.log(`Done: ${x.file}`);
    }
    if (x.status === "ready") {
        c.log("Translator ready 🔥");
    }
}

async function initializeTranslator() {
    try {
        // Plus besoin d'initialiser un modèle local, on utilise l'API
        const isHealthy = await translationService.checkHealth();
        if (!isHealthy) {
            throw new Error('Service de traduction indisponible');
        }
        c.log("API de traduction prête 🔥");
        return true; // Juste un indicateur que l'API est prête
    } catch (error) {
        c.error("Failed to initialize translator:", error);
        throw error;
    }
}

async function translateText(text: string, src_lang: string, tgt_lang: string, translator: any) {
    try {
        const result = await translator(text, { src_lang, tgt_lang });
        return result[0].translation_text;
    } catch (error) {
        c.error("Translation error:", error);
        throw error;
    }
}

const main = async () => {
    const translator = await initializeTranslator();
    const text = "Hello, world!";
    const src_lang = "eng_Latn";
    const tgt_lang = "fra_Latn";
    c.log(`Translating "${text}" from ${src_lang} to ${tgt_lang}...`);
    const translatedText = await translateText(text, src_lang, tgt_lang, translator);
    c.log(`Translated text: ${translatedText}`);
};


  // translationCache.set(cacheKey, translation);
// }

// export { initializeTranslator, translateText };

  // Hook de messagerie unifié pour la gestion WebSocket
  const messaging = useMessaging({
    conversationId: selectedConversation?.id,
    currentUser: user || undefined,
    onNewMessage: (message: Message) => {
      // Vérifier que le message appartient à la conversation active
      if (selectedConversation?.id && message.conversationId !== selectedConversation.id) {
        return;
      }

      // Ajouter le nouveau message à la liste
      setMessages(prev => {
        // Vérifier si le message existe déjà
        if (prev.some(m => m.id === message.id)) {
          return prev;
        }
        // Ajouter le message et maintenir l'ordre chronologique
        return [...prev, message].sort((a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      });

      // Mettre à jour la conversation avec le dernier message
      setConversations(prev => prev.map(
        conv => conv.id === message.conversationId
          ? { ...conv, lastMessage: message, updatedAt: new Date() }
          : conv
      ));
    }
  });

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


  // Handlers pour MessageBubble
  const handleTranslate = async (
    messageId: string,
    targetLanguage: string,
    forceRetranslate: boolean = false,
    forcedSourceLanguage?: string
  ) => {
    const message = messages.find(m => m.id === messageId);
    if (!message) return;

    try {
      console.log(`🔄 Traduction avec modèle sélectionné: ${selectedTranslationModel}`);

      // Afficher un indicateur de traduction en cours
      toast.loading('Traduction en cours...', { id: `translate-${messageId}` });

      // Détecter la langue source si non fournie ou 'unknown'
      let sourceLanguage = forcedSourceLanguage || message.originalLanguage;
      if (!sourceLanguage || sourceLanguage === 'unknown') {
        const detections = detectAll(message.content);
        sourceLanguage = detections.length > 0 ? detections[0].lang : 'en'; // Fallback à 'en'
      }

      // Ajouter un délai pour permettre à l'interface de se mettre à jour
      await new Promise(resolve => setTimeout(resolve, 100));

      // Si forceRetranslate est true, afficher un message spécifique
      if (forceRetranslate) {
        console.log('🔄 Forcer la retraduction du message');
        toast.loading('Retraduction forcée en cours...', { id: `retranslate-${messageId}` });
      }

      const translationResult = await translationService.translateText({
        text: message.content,
        sourceLanguage: sourceLanguage,
        targetLanguage: targetLanguage,
        model: 'basic' as const // Utiliser un modèle basique par défaut
      });

      // Créer le message traduit avec toutes les propriétés requises
      const translatedMsg: TranslatedMessage = {
        ...message,
        originalLanguage: sourceLanguage, // Mettre à jour avec la langue détectée si applicable
        originalContent: message.content,
        translatedContent: cleanTranslationOutput(translationResult.translatedText),
        targetLanguage,
        isTranslated: true,
        isTranslating: false,
        showingOriginal: false,
        translationError: undefined,
        translationFailed: false,
        translations: [{
          language: targetLanguage,
          content: cleanTranslationOutput(translationResult.translatedText),
          flag: '', // Drapeau par défaut
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
    main().catch(error => c.error("Error in main function:", error));
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
          // NOTE: La gestion WebSocket sera faite dans un useEffect séparé
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

    // NOTE: La gestion WebSocket se fait dans l'useEffect séparé
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

      // Utiliser le hook unifié pour envoyer le message
      const success = await messaging.sendMessage(newMessage.trim());

      if (success) {
        setNewMessage('');
        toast.success('Message envoyé !');
        console.log('✅ Message envoyé avec succès');
      } else {
        throw new Error('Échec de l\'envoi du message');
      }
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
                    {getAllActiveModels().map((modelType) => {
                      const config = getModelConfig(modelType);
                      return (
                      <SelectItem key={config.name} value={config.name}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: config.color }}
                          />
                          <span className="text-sm">{config.displayName}</span>
                          <Badge variant="outline" className="text-xs px-1 py-0">
                            {config.parameters}
                          </Badge>
                          {/* Supprimé: la vérification de modèle chargé n'est plus nécessaire avec l'API */}
                          <Badge variant="default" className="text-xs px-1 py-0 bg-green-500">
                            API
                          </Badge>
                        </div>
                      </SelectItem>
                      );
                    })}
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


