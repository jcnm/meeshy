
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser } from '@/context/AppContext';
import { useSocketIOMessaging } from '@/hooks/use-socketio-messaging';
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
import type { 
  Conversation, 
  SocketIOMessage as Message, 
  TranslationData,
  User,
  SocketIOUser 
} from '@/types';
import { conversationsService } from '@/services/conversations.service';
import { BubbleMessage } from '@/components/common/bubble-message';
import { CreateLinkModal } from './create-link-modal';
import { CreateConversationModal } from './create-conversation-modal';
import { cn } from '@/lib/utils';
import { translationService } from '@/services/translation.service';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { detectAll } from 'tinyld'; // Importation de tinyld pour la détection de langue
import { cleanTranslationOutput } from '@/utils/translation-cleaner';
import { socketIOUserToUser, createDefaultUser } from '@/utils/user-adapter';
import { 
  translationDataToBubbleTranslation, 
  getUserTranslation,
  type BubbleTranslation 
} from '@/utils/translation-adapter';

// Alias pour la compatibilité avec le code existant
type TranslatedMessage = Message & {
  translation?: BubbleTranslation;
  originalContent?: string;
  translatedContent?: string;
  targetLanguage?: string;
  isTranslated?: boolean;
  isTranslating?: boolean;
  showingOriginal?: boolean;
  translationError?: string;
  translationFailed?: boolean;
  translations?: TranslationData[];
};
// Supprimé: import { pipeline, env } from '@xenova/transformers';
// Supprimé: env.allowLocalModels = false; // Skip check for models hosted locally

interface ConversationLayoutResponsiveProps {
  selectedConversationId?: string;
}

export function ConversationLayoutResponsive({ selectedConversationId }: ConversationLayoutResponsiveProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthChecking } = useUser();

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
  const [selectedTranslationModel, setSelectedTranslationModel] = useState<string>('api-service');

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
        return translationService; // Retourner le service de traduction, pas un booléen
    } catch (error) {
        c.error("Failed to initialize translator:", error);
        throw error;
    }
}

// Supprimer cette fonction qui utilise un service Python inexistant
// async function translateText(text: string, src_lang: string, tgt_lang: string, translationService: any) {
//     try {
//         // Utiliser le service de traduction au lieu d'une fonction
//         const result = await translationService.translate(text, tgt_lang, src_lang);
//         return result.translatedText;
//     } catch (error) {
//         c.error("Translation error:", error);
//         throw error;
//     }
// }

// Supprimer cette fonction main qui utilise des services Python
// const main = async () => {
//     const translationService = await initializeTranslator();
//     const text = "Hello, world!";
//     const src_lang = "en";
//     const tgt_lang = "fr";
//     c.log(`Translating "${text}" from ${src_lang} to ${tgt_lang}...`);
//     const translatedText = await translateText(text, src_lang, tgt_lang, translationService);
//     c.log(`Translated text: ${translatedText}`);
// };


  // translationCache.set(cacheKey, translation);
// }

// export { initializeTranslator, translateText };

  // Hook de messagerie Socket.IO pour la gestion des connexions temps réel
  const messaging = useSocketIOMessaging({
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
    },
    onTranslation: (messageId: string, translations: any[]) => {
      console.log('🌐 Traductions reçues pour message:', messageId, translations);
      // Gérer les traductions reçues via Socket.IO
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
          messageId: messageId,
          sourceLanguage: message.originalLanguage || 'fr',
          targetLanguage: targetLanguage,
          translatedContent: cleanTranslationOutput(translationResult.translatedText),
          translationModel: selectedTranslationModel,
          cacheKey: `${messageId}-${targetLanguage}`,
          cached: false
        }],
        sender: message.sender ? socketIOUserToUser(message.sender) : createDefaultUser(message.senderId)
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

  // Charger les messages d'une conversation
  const loadMessages = useCallback(async (conversationId: string, isNewConversation = false) => {
    if (!user) return;
    // Supprimé l'appel à main() qui utilisait un service Python inexistant
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
      
      // Ne plus utiliser de messages mock, juste afficher l'erreur et laisser vide
      toast.error('Impossible de charger les messages');
      
      // Vérifier si cette conversation est toujours celle demandée
      if (selectedConversation?.id !== conversationId) {
        console.log('🚫 Conversation changée pendant l\'erreur, abandon');
        return;
      }

      // Laisser la liste de messages vide
      setMessages([]);
      setTranslatedMessages([]);
    } finally {
      setIsLoadingMessages(false);
    }
  }, [user, convertToTranslatedMessage, selectedConversation?.id, messages.length]);

  // Charger les données initiales avec optimisations
  const loadData = useCallback(async () => {
    // Si on est encore en train de vérifier l'auth, attendre
    if (isAuthChecking) {
      return;
    }
    
    // Si pas d'utilisateur mais token présent, essayer de charger quand même
    const token = localStorage.getItem('auth_token');
    if (!user && !token) {
      return;
    }

    try {
      setIsLoading(true);

      // Démarrer le chargement des conversations immédiatement
      const conversationsData = await conversationsService.getConversations();

      setConversations(conversationsData);

      // Sélectionner une conversation seulement si spécifiée dans l'URL
      const conversationIdFromUrl = searchParams.get('id') || selectedConversationId;
      if (conversationIdFromUrl) {
        let conversation = conversationsData.find(c => c.id === conversationIdFromUrl);
        
        // Si c'est la conversation globale "any" et qu'elle n'est pas dans la liste, la créer
        if (!conversation && conversationIdFromUrl === 'any') {
          conversation = {
            id: 'any',
            name: 'Meeshy',
            title: 'Meeshy',
            type: 'global',
            isGroup: true,
            isActive: true,
            participants: [],
            createdAt: new Date(),
            updatedAt: new Date(),
            unreadCount: 0
          };
        }
        
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

      // Mettre fin au loading principal immédiatement après les conversations
      setIsLoading(false);

    } catch (error) {
      console.error('❌ Erreur lors du chargement des conversations:', error);
      
      // Si c'est une erreur d'authentification, on peut essayer de rediriger
      if (error instanceof Error && (error.message.includes('401') || error.message.includes('Token invalide'))) {
        console.log('🔄 Erreur d\'authentification, redirection vers login...');
        router.push('/login');
        return;
      }

      // Afficher l'erreur à l'utilisateur
      toast.error('Impossible de charger les conversations');
      
      // Laisser la liste de conversations vide pour utiliser les seeds de la DB
      setConversations([]);
      setIsLoading(false);
    }
  }, [user, searchParams, selectedConversationId, isAuthChecking, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Redirection si pas d'utilisateur et vérification terminée
  useEffect(() => {
    if (!isAuthChecking) {
      const token = localStorage.getItem('auth_token');
      if (!user && !token) {
        router.push('/login');
      }
    }
  }, [user, isAuthChecking, router]);

  // Si en cours de vérification d'authentification, afficher un loader
  if (isAuthChecking) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Vérification de l'authentification...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Si pas d'utilisateur, ne rien afficher (la redirection va s'effectuer)
  if (!user) {
    return null;
  }

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
                  onValueChange={(value) => setSelectedTranslationModel(value)}
                >
                  <SelectTrigger className="w-full h-8 text-sm">
                    <SelectValue placeholder="Choisir un modèle" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="api-service">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full bg-green-500"
                        />
                        <span className="text-sm">Service API</span>
                        <Badge variant="default" className="text-xs px-1 py-0 bg-green-500">
                          Actif
                        </Badge>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Liste scrollable */}
            <div className="flex-1 overflow-y-auto">
              {/* Debug info */}
              {process.env.NODE_ENV === 'development' && (
                <div className="p-2 bg-yellow-100 text-yellow-800 text-xs">
                  Debug: {conversations.length} conversations | Loading: {isLoading ? 'oui' : 'non'} | User: {user ? 'connecté' : 'non connecté'}
                </div>
              )}
              
              {conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                  <MessageSquare className="h-16 w-16 text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    {isLoading ? 'Chargement...' : 'Aucune conversation'}
                  </h3>
                  <p className="text-muted-foreground mb-6">
                    {isLoading 
                      ? 'Récupération de vos conversations...' 
                      : 'Commencez une nouvelle conversation pour discuter avec vos amis !'
                    }
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
                      {translatedMessages.map((message) => {
                        // Transformer le message pour BubbleMessage
                        const bubbleMessage = {
                          ...message,
                          originalLanguage: message.originalLanguage || 'fr',
                          originalContent: message.originalContent || message.content,
                          isTranslated: message.isTranslated || false,
                          translatedFrom: message.isTranslated ? message.originalLanguage : undefined,
                          location: undefined, // Pas de localisation dans les conversations
                          translations: message.translations?.map(t => ({
                            language: t.targetLanguage,
                            content: t.translatedContent,
                            status: 'completed' as const,
                            timestamp: new Date(),
                            confidence: 0.9
                          })) || []
                        };

                        // Langues utilisées (similaire à bubble-stream-page)
                        const usedLanguages: string[] = [
                          user.regionalLanguage,
                          user.customDestinationLanguage
                        ].filter((lang): lang is string => Boolean(lang)).filter(lang => lang !== user.systemLanguage);
                        
                        return (
                          <BubbleMessage
                            key={message.id}
                            message={bubbleMessage}
                            currentUser={user}
                            userLanguage={user.systemLanguage}
                            usedLanguages={usedLanguages}
                          />
                        );
                      })}
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


