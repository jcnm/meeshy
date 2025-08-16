'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { 
  MessageSquare, 
  Bell, 
  Search,
  LogOut,
  Settings,
  User as UserIcon,
  Home,
  Users,
  UserPlus,
  Link as LinkIcon,
  ChevronDown,
  Shield,
  Brain,
  Globe2,
  Globe,
  Send,
  Languages,
  MapPin, 
  TrendingUp, 
  ChevronUp,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

// Import des composants modulaires
import {
  LanguageSelector
} from '@/components/translation';

// Import des constantes centralisées
import {
  SUPPORTED_LANGUAGES,
  MAX_MESSAGE_LENGTH,
  TOAST_SHORT_DURATION,
  TOAST_LONG_DURATION,
  TOAST_ERROR_DURATION,
  TYPING_CANCELATION_DELAY,
  getLanguageInfo,
  getLanguageName,
  getLanguageFlag,
  type LanguageStats
} from '@/lib/constants/languages';

// Import des modules réutilisables extraits
import {
  FoldableSection,
  LanguageIndicators,
  SidebarLanguageHeader,
  getUserLanguageChoices,
  resolveUserPreferredLanguage as resolveUserLanguage,
  getUserLanguagePreferences as getUserLanguages,
  type BubbleStreamMessage,
  type BubbleStreamPageProps,
  type LanguageChoice
} from '@/lib/bubble-stream-modules';

import { BubbleMessage } from '@/components/common/bubble-message';
import { TrendingSection } from '@/components/common/trending-section';
import { LoadingState } from '@/components/common/LoadingStates';

import { useSocketIOMessaging } from '@/hooks/use-socketio-messaging';
import { useNotifications } from '@/hooks/use-notifications';
import { useMessageTranslations } from '@/hooks/use-message-translations';
import { useTranslationStats } from '@/hooks/use-translation-stats';
import { useFixRadixZIndex } from '@/hooks/use-fix-z-index';
import { detectLanguage } from '@/utils/language-detection';
import type { User, Message, BubbleTranslation } from '@/shared/types';
import { buildApiUrl, API_ENDPOINTS } from '@/lib/config';
import { messageTranslationService } from '@/services/message-translation.service';
import { conversationsService } from '@/services';
import { TypingIndicator } from '@/components/conversations/typing-indicator';
import { useMessageLoader } from '@/hooks/use-message-loader';
import { useConversationMessages } from '@/hooks/use-conversation-messages';
import { MessagesDisplay } from '@/components/common/messages-display';

export function BubbleStreamPage({ user, conversationId = 'any', isAnonymousMode = false, linkId }: BubbleStreamPageProps) {
  const router = useRouter();
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Hook pour fixer les z-index des composants Radix UI
  useFixRadixZIndex();

  // Hook pour la gestion des traductions
  const {
    processMessageWithTranslations,
    getPreferredLanguageContent,
    getUserLanguagePreferences,
    resolveUserPreferredLanguage,
    shouldRequestTranslation,
    getRequiredTranslations
  } = useMessageTranslations({ currentUser: user });

  // Hook pour le chargement des messages avec le nouveau hook factorized
  const {
    messages,
    translatedMessages,
    isLoadingMessages,
    loadMessages,
    clearMessages,
    addMessage,
    updateMessageTranslations
  } = useConversationMessages({
    currentUser: user,
    conversationId: conversationId,
    isAnonymousMode: isAnonymousMode,
    linkId: linkId
  });

  // États de base
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [detectedLanguage, setDetectedLanguage] = useState<string>('fr');
  const [userLanguage, setUserLanguage] = useState<string>(resolveUserLanguage(user));
  const [selectedInputLanguage, setSelectedInputLanguage] = useState<string>(user.systemLanguage || 'fr');
  const [messageLanguageStats, setMessageLanguageStats] = useState<LanguageStats[]>([]);
  const [activeLanguageStats, setActiveLanguageStats] = useState<LanguageStats[]>([]);
  const [isComposingEnabled, setIsComposingEnabled] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [location, setLocation] = useState<string>('');
  const [trendingHashtags, setTrendingHashtags] = useState<string[]>([]);
  const [activeUsers, setActiveUsers] = useState<User[]>([]);

  // Fonction pour charger les utilisateurs en ligne
  const loadActiveUsers = useCallback(async () => {
    try {
      const onlineUsers = await conversationsService.getParticipants('any', { onlineOnly: true });
      setActiveUsers(onlineUsers);
    } catch (error) {
      console.error('Erreur lors du chargement des utilisateurs actifs:', error);
      // En cas d'erreur, on garde les données WebSocket si disponibles
    }
  }, []);

  // Fonction pour charger tous les participants (pour les statistiques)
  const loadAllParticipants = useCallback(async () => {
    try {
      const allParticipants = await conversationsService.getParticipants('any');
      return allParticipants;
    } catch (error) {
      console.error('Erreur lors du chargement des participants:', error);
      return [];
    }
  }, []);

  // États de chargement
  const [isInitializing, setIsInitializing] = useState(true);
  const [hasLoadedMessages, setHasLoadedMessages] = useState(false);
  const [hasEstablishedConnection, setHasEstablishedConnection] = useState(false);

  // Langues utilisées par l'utilisateur (basées sur ses préférences)
  const usedLanguages: string[] = getUserLanguages(user);

  // Obtenir les choix de langues pour l'utilisateur via la fonction centralisée
  const languageChoices = getUserLanguageChoices(user);

  // État pour les utilisateurs en train de taper avec leurs noms
  const [typingUsers, setTypingUsers] = useState<{id: string, displayName: string}[]>([]);

  // Fonctions de gestion des événements utilisateur
  const handleUserTyping = useCallback((userId: string, username: string, isTyping: boolean) => {
    if (userId === user.id) return; // Ignorer nos propres événements de frappe
    
    setTypingUsers(prev => {
      if (isTyping) {
        // Ajouter l'utilisateur s'il n'est pas déjà dans la liste
        if (prev.some(u => u.id === userId)) return prev;
        
        // Rechercher l'utilisateur dans la liste des utilisateurs connectés pour obtenir son vrai nom
        const connectedUser = activeUsers.find(u => u.id === userId);
        let displayName: string;
        
        if (connectedUser) {
          // Utiliser le nom complet de l'utilisateur connecté
          if (connectedUser.displayName) {
            displayName = connectedUser.displayName;
          } else if (connectedUser.firstName || connectedUser.lastName) {
            displayName = `${connectedUser.firstName || ''} ${connectedUser.lastName || ''}`.trim();
          } else {
            displayName = connectedUser.username;
          }
        } else if (username && username !== userId) {
          // Fallback sur le username fourni par l'événement
          displayName = username;
        } else {
          // Fallback final avec un ID formaté
          displayName = `Utilisateur ${userId.slice(-6)}`;
        }
        
        // Utilisateur en train de taper
        
        return [...prev, { id: userId, displayName }];
      } else {
        // Retirer l'utilisateur de la liste
        return prev.filter(u => u.id !== userId);
      }
    });
  }, [user.id, activeUsers]); // Ajouter activeUsers aux dépendances

  const handleUserStatus = useCallback((userId: string, username: string, isOnline: boolean) => {
    // Statut utilisateur changé - géré par les événements socket
  }, []);

  const handleTranslation = useCallback((messageId: string, translations: any[]) => {
    // Traductions reçues pour message
    
    // Mettre à jour le message avec les nouvelles traductions
    updateMessageTranslations(messageId, translations);
    
    // Vérifier si on a des nouvelles traductions pour cet utilisateur
    const userLanguages = [
      user.systemLanguage,
      user.regionalLanguage,
      user.customDestinationLanguage
    ].filter(Boolean); // Enlever les valeurs undefined/null

    const relevantTranslation = translations.find(t => 
      userLanguages.includes(t.targetLanguage)
    );
    
    if (relevantTranslation) {
      const langInfo = getLanguageInfo(relevantTranslation.targetLanguage);
      
      // Toast pour traduction pertinente
      
      // Incrémenter les statistiques de traduction
      incrementTranslationCount(relevantTranslation.targetLanguage);
      
      // Toast de traduction réduit pour éviter le spam
    }
  }, [updateMessageTranslations, user.systemLanguage, user.regionalLanguage, user.customDestinationLanguage]);

  // Handler pour les nouveaux messages reçus via WebSocket avec traductions optimisées
  const handleNewMessage = useCallback((message: Message) => {
    // Message reçu via WebSocket
    
    // Utiliser addMessage de useMessageLoader pour gérer l'ajout du message
    addMessage(message);
    
    // Notification UNIQUEMENT pour les nouveaux messages d'autres utilisateurs
    if (message.senderId !== user.id) {
      toast.info(`📨 Nouveau message de ${message.sender?.firstName || 'Utilisateur'}`, {
        duration: TOAST_LONG_DURATION
      });
    } else {
      // Pour nos propres messages, juste un toast discret de confirmation
      // Mon message publié avec succès
    }
    
    // Auto-scroll vers le nouveau message
    setTimeout(() => {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }, 100);
  }, [addMessage, user.id]);

  // Hooks
  const { stats: translationStats, incrementTranslationCount } = useTranslationStats();
  
  const { 
    sendMessage: sendMessageToService,
    connectionStatus,
    startTyping,
    stopTyping,
    reconnect,
    getDiagnostics
  } = useSocketIOMessaging({
    conversationId: 'any', // Conversation globale pour le stream
    currentUser: user,
    onNewMessage: handleNewMessage,
    onUserTyping: handleUserTyping,
    onUserStatus: handleUserStatus,
    onTranslation: handleTranslation,
    onConversationStats: (data) => {
      if (!data || data.conversationId !== 'any') return;
      const stats: any = data.stats || {};
      if (stats.messagesPerLanguage) {
        const mapped = Object.entries(stats.messagesPerLanguage).map(([code, count]) => ({
          language: code as string,
          flag: getLanguageFlag(code as string),
          count: count as number,
          color: undefined as any
        })).filter((s: any) => s.count > 0);
        setMessageLanguageStats(mapped as any);
      }
      if (stats.participantsPerLanguage) {
        const mapped = Object.entries(stats.participantsPerLanguage).map(([code, count]) => ({
          language: code as string,
          flag: getLanguageFlag(code as string),
          count: count as number,
          color: undefined as any
        })).filter((s: any) => s.count > 0);
        setActiveLanguageStats(mapped as any);
      }
      if (typeof stats.participantCount === 'number') {
        // Optional: could be displayed somewhere in UI later
        // setParticipantsCount(stats.participantCount);
      }
      if (Array.isArray(stats.onlineUsers)) {
        setActiveUsers(stats.onlineUsers.map((u: any) => ({
          id: u.id,
          username: u.username,
          firstName: u.firstName,
          lastName: u.lastName,
          email: '',
          avatar: '',
          role: 'USER' as const,
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
          autoTranslateEnabled: true,
          translateToSystemLanguage: true,
          translateToRegionalLanguage: false,
          useCustomDestination: false,
          isOnline: true,
          isActive: true,
          lastSeen: new Date(),
          createdAt: new Date(),
          lastActiveAt: new Date(),
          updatedAt: new Date()
        })));
      }
    },
    onConversationOnlineStats: (data) => {
      if (!data || data.conversationId !== 'any') return;
      if (Array.isArray(data.onlineUsers)) {
        setActiveUsers(data.onlineUsers.map((u: any) => ({
          id: u.id,
          username: u.username,
          firstName: u.firstName,
          lastName: u.lastName,
          email: '',
          avatar: '',
          role: 'USER' as const,
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
          autoTranslateEnabled: true,
          translateToSystemLanguage: true,
          translateToRegionalLanguage: false,
          useCustomDestination: false,
          isOnline: true,
          isActive: true,
          lastSeen: new Date(),
          createdAt: new Date(),
          lastActiveAt: new Date(),
          updatedAt: new Date()
        })));
      }
    },
  });

  const { notifications, markAsRead } = useNotifications();

  // Protection contre les toasts multiples
  const [hasShownConnectionToast, setHasShownConnectionToast] = useState(false);

  // Initialisation de la connexion WebSocket en temps réel
  useEffect(() => {
    console.log('🚀 Initialisation de la connexion WebSocket...');
    
    // Diagnostic initial
    const diagnostics = getDiagnostics();
    console.log('🔍 Diagnostic initial:', diagnostics);
    
    // Délai pour vérifier la connexion établie
    const initTimeout = setTimeout(() => {
      const newDiagnostics = getDiagnostics();
      console.log('🔍 Diagnostic après délai:', newDiagnostics);
      
      if (connectionStatus.isConnected && connectionStatus.hasSocket && !hasShownConnectionToast) {
        console.log('✅ WebSocket connecté - Messages en temps réel');
        toast.success('🎉 Connexion établie ! Messages en temps réel activés');
        setHasShownConnectionToast(true);
      } else if (!connectionStatus.isConnected || !connectionStatus.hasSocket) {
        console.log('⚠️ WebSocket non connecté après délai');
        console.log('🔍 Diagnostic de connexion:', {
          hasSocket: connectionStatus.hasSocket,
          isConnected: connectionStatus.isConnected,
          hasToken: !!localStorage.getItem('auth_token'),
          wsUrl: (typeof window !== 'undefined' ? (process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3000') : 'ws://gateway:3000') + '/ws'
        });
        toast.warning('� Connexion WebSocket en cours...');
      }
    }, 3000);

    return () => clearTimeout(initTimeout);
  }, [connectionStatus.isConnected, connectionStatus.hasSocket, hasShownConnectionToast]);

  // Surveillance du statut de connexion WebSocket
  useEffect(() => {
    const checkConnection = () => {
      const isReallyConnected = connectionStatus.isConnected && connectionStatus.hasSocket;
      
      if (isReallyConnected) {
        console.log('🌐 Connexion WebSocket active');
      } else {
        console.log('📡 WebSocket déconnecté');
      }
      
      console.log('🔌 Statut connexion vérifié:', { 
        isConnected: connectionStatus.isConnected,
        hasSocket: connectionStatus.hasSocket,
        connectionStatus 
      });
    };

    checkConnection();
    
    // Vérifier périodiquement le statut
    const interval = setInterval(checkConnection, 5000);
    return () => clearInterval(interval);
  }, [connectionStatus]);

  // Géolocalisation
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            // Optionnel : Convertir les coordonnées en ville/région
            // Pour cet exemple, on utilise une ville par défaut
            setLocation('Paris');
          } catch (error) {
            console.error('Erreur géolocalisation:', error);
          }
        },
        (error) => {
          console.log('Géolocalisation non disponible');
        }
      );
    }
  }, []);

  // Détection automatique de langue pour affichage informatif uniquement (pas de mise à jour automatique)
  useEffect(() => {
    if (newMessage.trim().length > 15) { // Seuil plus élevé pour une meilleure détection
      const detectedLang = detectLanguage(newMessage);
      setDetectedLanguage(detectedLang);
      console.log('🔍 Langue détectée:', detectedLang, '(affichage informatif uniquement)');
    }
  }, [newMessage]);

  // Mise à jour de la langue sélectionnée basée sur les préférences utilisateur uniquement
  useEffect(() => {
    const newUserLanguage = resolveUserLanguage(user);
    setUserLanguage(newUserLanguage);
    
    // Vérifier si la langue actuellement sélectionnée est encore valide dans les choix disponibles
    const availableLanguageCodes = languageChoices.map(choice => choice.code);
    if (!availableLanguageCodes.includes(selectedInputLanguage)) {
      // Si la langue sélectionnée n'est plus dans les choix, revenir à la langue système
      console.log('🔄 Langue sélectionnée non disponible, retour à la langue système:', user.systemLanguage);
      setSelectedInputLanguage(user.systemLanguage || 'fr');
    }
  }, [user.systemLanguage, user.regionalLanguage, user.customDestinationLanguage, languageChoices, selectedInputLanguage]);

  // Suppression de la simulation des statistiques de langues (désormais alimentées en temps réel)

  // Pas d'initialisation de messages démo - les messages seront chargés depuis le serveur
  useEffect(() => {
    // Messages chargés depuis le serveur uniquement
  }, [userLanguage]);

  // Cleanup timeout de frappe au démontage et initialisation de la hauteur du textarea
  useEffect(() => {
    // Initialiser la hauteur du textarea au montage
    if (textareaRef.current) {
      textareaRef.current.style.height = '80px'; // Hauteur minimale
    }
    
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  // Chargement des données trending sans simulation de messages
  useEffect(() => {
    // Simulation des hashtags tendances - Plus de 7 pour tester le scroll
    setTrendingHashtags([
      '#meeshy', '#multilingual', '#chat', '#translation', '#connect', 
      '#realtime', '#languages', '#global', '#community', '#innovation',
      '#communication', '#technology', '#ai', '#international', '#diversity'
    ]);
    
    // Pas de simulation d'utilisateurs actifs: alimentés par WebSocket
  }, []);

  // Charger les messages existants dès que possible, sans attendre la connexion WebSocket
  useEffect(() => {
    console.log('🚀 Chargement initial des messages depuis la base de données...');
    // Charger immédiatement les messages existants via HTTP API
    loadMessages('any', true);
    setHasLoadedMessages(true);
  }, [loadMessages]);

  // Separately handle WebSocket connection for real-time updates
  useEffect(() => {
    if (connectionStatus.isConnected) {
      setHasEstablishedConnection(true);
      console.log('🌐 Connexion WebSocket établie - Messages en temps réel activés');
      
      if (!hasShownConnectionToast) {
        toast.success('🎉 Connexion établie ! Messages en temps réel activés');
        setHasShownConnectionToast(true);
      }
    } else {
      console.log('⏳ WebSocket en attente de connexion...');
    }
  }, [connectionStatus.isConnected, hasShownConnectionToast]);

  // Gérer l'état d'initialisation global
  useEffect(() => {
    if (hasLoadedMessages && !isLoadingMessages) {
      setIsInitializing(false);
      console.log('✅ Initialisation terminée : messages chargés');
    }
  }, [hasLoadedMessages, isLoadingMessages]);

  // Charger les utilisateurs actifs au démarrage
  useEffect(() => {
    loadActiveUsers();
  }, [loadActiveUsers]);

  // Calculer les statistiques de langues à partir des messages chargés
  useEffect(() => {
    if (translatedMessages.length > 0) {
      console.log('📊 Calcul des statistiques de langues à partir des messages chargés...');
      
      // Calculer les statistiques des langues des messages
      const languageCounts: { [key: string]: number } = {};
      const userLanguages: { [key: string]: Set<string> } = {}; // Pour les langues des utilisateurs
      
      translatedMessages.forEach(message => {
        // Compter les langues originales des messages
        const originalLang = message.originalLanguage || 'fr';
        languageCounts[originalLang] = (languageCounts[originalLang] || 0) + 1;
        
        // Simuler les langues des utilisateurs (en réalité, on devrait avoir les préférences des utilisateurs)
        if (message.sender?.id) {
          if (!userLanguages[originalLang]) {
            userLanguages[originalLang] = new Set();
          }
          userLanguages[originalLang].add(message.sender.id);
        }
      });
      
      // Convertir en format LanguageStats pour les messages
      const messageStats: LanguageStats[] = Object.entries(languageCounts)
        .map(([code, count], index) => ({
          language: code,
          flag: getLanguageFlag(code),
          count: count,
          color: `hsl(${(index * 137.5) % 360}, 60%, 60%)` // Couleurs automatiques
        }))
        .filter(stat => stat.count > 0)
        .sort((a, b) => b.count - a.count);
      
      // Convertir en format LanguageStats pour les utilisateurs actifs
      const userStats: LanguageStats[] = Object.entries(userLanguages)
        .map(([code, users], index) => ({
          language: code,
          flag: getLanguageFlag(code),
          count: users.size,
          color: `hsl(${(index * 137.5) % 360}, 50%, 50%)` // Couleurs automatiques
        }))
        .filter(stat => stat.count > 0)
        .sort((a, b) => b.count - a.count);
      
      console.log('📊 Statistiques calculées:', {
        messageStats: messageStats.length,
        userStats: userStats.length,
        totalMessages: translatedMessages.length
      });
      
      setMessageLanguageStats(messageStats);
      setActiveLanguageStats(userStats);
      
      // Charger les utilisateurs actifs depuis l'API au lieu de simuler
      if (activeUsers.length === 0) {
        loadActiveUsers();
      }
      
      // Charger tous les participants pour calculer les statistiques des utilisateurs
      loadAllParticipants().then(allParticipants => {
        if (allParticipants.length > 0) {
          // Recalculer les statistiques des utilisateurs avec les vraies données
          const realUserLanguages: { [key: string]: Set<string> } = {};
          
          allParticipants.forEach(participant => {
            const lang = participant.systemLanguage || 'fr';
            if (!realUserLanguages[lang]) {
              realUserLanguages[lang] = new Set();
            }
            realUserLanguages[lang].add(participant.id);
          });
          
          const realUserStats: LanguageStats[] = Object.entries(realUserLanguages)
            .map(([code, users], index) => ({
              language: code,
              flag: getLanguageFlag(code),
              count: users.size,
              color: `hsl(${(index * 137.5) % 360}, 50%, 50%)`
            }))
            .filter(stat => stat.count > 0)
            .sort((a, b) => b.count - a.count);
          
          setActiveLanguageStats(realUserStats);
          console.log('👥 Statistiques utilisateurs réelles calculées:', realUserStats);
        }
      });
    }
  }, [translatedMessages, activeUsers, loadActiveUsers, loadAllParticipants]);

  // Afficher l'écran de chargement pendant l'initialisation
  if (isInitializing) {
    return (
      <LoadingState 
        message={
          !hasLoadedMessages 
            ? "Chargement des messages..." 
            : !hasEstablishedConnection
            ? "Connexion au serveur en cours..."
            : "Initialisation..."
        }
        fullScreen={true}
      />
    );
  }

  const handleSendMessage = async () => {
    if (!newMessage.trim() || newMessage.length > MAX_MESSAGE_LENGTH) {
      return;
    }

    const messageContent = newMessage.trim();
    console.log('📤 Envoi du message avec langue sélectionnée:', {
      content: messageContent.substring(0, 50) + '...',
      sourceLanguage: selectedInputLanguage,
      languageChoice: languageChoices.find(choice => choice.code === selectedInputLanguage)
    });
    
    setNewMessage(''); // Réinitialiser immédiatement pour éviter les doubles envois
    setIsTyping(false);
    
    // Réinitialiser la hauteur du textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    try {
      // Vérifier l'état de la connexion avant l'envoi
      if (!connectionStatus.isConnected) {
        console.log('⚠️ WebSocket non connecté - Impossible d\'envoyer le message');
        toast.warning('Connexion en cours - Veuillez patienter...');
        // Restaurer le message pour permettre un nouvel essai
        setNewMessage(messageContent);
        return;
      }

      // Essayer d'envoyer via le service WebSocket
      try {
        // Préparer le message avec métadonnées de langue pour transmission
        const messageWithLanguage = {
          content: messageContent,
          sourceLanguage: selectedInputLanguage,
          detectedLanguage: detectedLanguage,
          userLanguageChoices: languageChoices.map(c => c.code)
        };
        
        console.log('📤 Envoi du message avec métadonnées de langue:', messageWithLanguage);
        
        // Envoyer le message avec la langue source sélectionnée
        const sendResult = await sendMessageToService(messageContent, selectedInputLanguage);
        
        if (sendResult) {
          console.log('✅ Message envoyé via WebSocket avec succès');
          toast.success('Message envoyé !');
          
          // Log pour le debug - La langue source sera utilisée côté serveur
          console.log(`🔤 Langue source du message: ${selectedInputLanguage} (détectée: ${detectedLanguage})`);
        } else {
          throw new Error('L\'envoi du message a échoué');
        }
        
      } catch (wsError) {
        console.error('❌ Erreur envoi WebSocket:', wsError);
        toast.error('Erreur lors de l\'envoi du message');
        // Restaurer le message en cas d'erreur
        setNewMessage(messageContent);
        return;
      }

    } catch (error) {
      console.error('❌ Erreur lors de l\'envoi du message:', error);
      toast.error('Erreur lors de l\'envoi du message');
      // Restaurer le message en cas d'erreur
      setNewMessage(messageContent);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleTyping = (value: string) => {
    setNewMessage(value);
    
    // Gérer l'indicateur de frappe avec timeout
    if (value.trim()) {
      // Si l'utilisateur tape et qu'il n'était pas déjà en train de taper
      if (!isTyping) {
        setIsTyping(true);
        startTyping();
      }
      
      // Réinitialiser le timeout à chaque caractère tapé
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Arrêter la frappe après 3 secondes d'inactivité
      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
        stopTyping();
      }, TYPING_CANCELATION_DELAY);
      
    } else {
      // Si le champ est vide, arrêter immédiatement la frappe
      if (isTyping) {
        setIsTyping(false);
        stopTyping();
      }
      
      // Nettoyer le timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    }

    // Auto-resize textarea avec gestion améliorée des retours à la ligne
    if (textareaRef.current) {
      // Réinitialiser la hauteur pour obtenir la hauteur naturelle du contenu
      textareaRef.current.style.height = 'auto';
      
      // Calculer la hauteur nécessaire avec une hauteur minimale
      const minHeight = 80; // Correspond à min-h-[80px]
      const maxHeight = 160; // Correspond à max-h-40 (40 * 4px = 160px)
      const scrollHeight = textareaRef.current.scrollHeight;
      
      // Utiliser la hauteur calculée en respectant les limites
      const newHeight = Math.max(minHeight, Math.min(scrollHeight, maxHeight));
      textareaRef.current.style.height = `${newHeight}px`;
      
      // Si le contenu dépasse la hauteur maximale, permettre le scroll
      if (scrollHeight > maxHeight) {
        textareaRef.current.style.overflowY = 'auto';
      } else {
        textareaRef.current.style.overflowY = 'hidden';
      }
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  const remainingChars = MAX_MESSAGE_LENGTH - newMessage.length;

  return (
    <>
      <style jsx global>{`
        /* Cache toutes les barres de défilement */
        .scrollbar-hidden {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .scrollbar-hidden::-webkit-scrollbar {
          display: none;
        }
        
        /* Style pour les conteneurs avec scroll caché */
        .scroll-hidden {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .scroll-hidden::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      {/* Layout principal */}
      <div className="min-h-screen relative">
        {/* Feed principal - Container avec gestion propre du scroll */}
        <div className="w-full xl:pr-80 relative">{/* Indicateur dynamique - Frappe prioritaire sur connexion */}
          <div className="fixed top-16 left-0 right-0 xl:right-80 z-[45] px-4 sm:px-6 lg:px-8 pt-4 pb-2 bg-gradient-to-b from-blue-50 to-transparent pointer-events-none realtime-indicator">
            <div className="pointer-events-auto">
              {/* Priorité à l'indicateur de frappe quand actif */}
              {typingUsers.length > 0 && connectionStatus.isConnected ? (
                <div className="inline-flex items-center space-x-2 px-4 py-2 rounded-full text-sm backdrop-blur-sm bg-blue-100/90 text-blue-800 border border-blue-200/80 transition-all">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>
                    {typingUsers.length === 1 
                      ? `${typingUsers[0].displayName} est en train d'écrire...`
                      : typingUsers.length === 2
                      ? `${typingUsers[0].displayName} et ${typingUsers[1].displayName} sont en train d'écrire...`
                      : `${typingUsers[0].displayName} et ${typingUsers.length - 1} autres sont en train d'écrire...`
                    }
                  </span>
                </div>
              ) : (
                /* Indicateur de connexion par défaut */
                <div className={`inline-flex items-center space-x-2 px-3 py-1 rounded-full text-sm backdrop-blur-sm transition-all ${
                  connectionStatus.isConnected && connectionStatus.hasSocket
                    ? 'bg-green-100/80 text-green-800 border border-green-200/60' 
                    : 'bg-orange-100/80 text-orange-800 border border-orange-200/60'
                }`}>
                  <div className={`w-2 h-2 rounded-full animate-pulse ${
                    connectionStatus.isConnected && connectionStatus.hasSocket ? 'bg-green-600' : 'bg-orange-600'
                  }`} />
                  <span className="font-medium">
                    Messages en temps réel
                  </span>
                  {!(connectionStatus.isConnected && connectionStatus.hasSocket) && (
                    <span className="text-xs opacity-75">• Connexion en cours...</span>
                  )}
                  {!(connectionStatus.isConnected && connectionStatus.hasSocket) && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          console.log('🔄 Tentative de reconnexion manuelle...');
                          const diagnostics = getDiagnostics();
                          console.log('🔍 Diagnostic avant reconnexion:', diagnostics);
                          
                          toast.info('🔄 Tentative de reconnexion...');
                          reconnect();
                          
                          // Vérifier après un délai
                          setTimeout(() => {
                            const newDiagnostics = getDiagnostics();
                            console.log('🔍 Diagnostic après reconnexion:', newDiagnostics);
                            
                            if (newDiagnostics.isConnected) {
                              toast.success('✅ Reconnexion réussie !');
                            } else {
                              toast.error('❌ Reconnexion échouée - Vérifiez le serveur');
                            }
                          }, 2000);
                        }}
                        className="ml-2 text-xs px-2 py-1 h-auto hover:bg-orange-200/50"
                      >
                        Reconnecter
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          const diagnostics = getDiagnostics();
                          console.log('🔍 Diagnostic complet:', diagnostics);
                          
                          const message = `Diagnostic WebSocket:
• Socket créé: ${diagnostics.hasSocket ? '✅' : '❌'}
• Connecté: ${diagnostics.isConnected ? '✅' : '❌'}  
• Token: ${diagnostics.hasToken ? '✅' : '❌'}
• URL: ${diagnostics.url}`;

                          toast.info(message, { duration: TOAST_ERROR_DURATION });
                        }}
                        className="ml-1 text-xs px-2 py-1 h-auto hover:bg-orange-200/50"
                      >
                        Debug
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Feed des messages avec scroll naturel - Padding top pour l'indicateur fixe */}
          <div className="relative min-h-[calc(100vh-16rem)] pt-20">
            {/* Container des messages avec padding pour la zone de saisie */}
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-40 pt-4">
              
              <div 
                ref={messagesContainerRef}
                className="space-y-5 px-4 py-6"
                style={{ background: 'transparent' }}
              >
                <MessagesDisplay
                  messages={messages}
                  translatedMessages={translatedMessages}
                  isLoadingMessages={isLoadingMessages}
                  currentUser={user}
                  userLanguage={userLanguage}
                  usedLanguages={usedLanguages}
                  emptyStateMessage="Aucun message pour le moment"
                  emptyStateDescription="Soyez le premier à publier dans le stream global !"
                  reverseOrder={true}
                  className="space-y-5"
                />

                {/* Espace supplémentaire réduit pour éviter que le dernier message soit caché */}
                <div className="h-8" />
              </div>
            </div>
            
            {/* Dégradé inférieur - Transition progressive vers les couleurs générales de la page */}
            <div className="absolute bottom-0 left-0 right-0 xl:right-80 h-32 bg-gradient-to-t from-blue-50 via-blue-50/40 to-transparent pointer-events-none z-10" />
          </div>
        </div>

        {/* Zone de composition flottante - Position fixe avec transparence cohérente aux couleurs de la page */}
        <div className="fixed bottom-0 left-0 right-0 xl:right-80 z-30">
          {/* Dégradé de fond pour transition douce avec les couleurs générales */}
          <div className="h-10 bg-gradient-to-t from-blue-50 via-blue-50/40 to-transparent pointer-events-none" />
          
          {/* Zone de saisie avec transparence et couleurs harmonisées */}
          <div className="bg-blue-50/20 backdrop-blur-lg border-t border-blue-200/50 shadow-xl shadow-blue-500/10">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
              <div className="relative max-w-2xl mx-auto">
                <Textarea
                  ref={textareaRef}
                  value={newMessage}
                  onChange={(e) => handleTyping(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={`Partagez quelque chose avec le monde...`}
                  className="expandable-textarea min-h-[80px] max-h-40 resize-none pr-28 pb-14 pt-3 pl-3 text-base border-blue-200/60 bg-white/90 backdrop-blur-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-400/30 focus:bg-white/95 placeholder:text-gray-600 scroll-hidden transition-all duration-200"
                  maxLength={MAX_MESSAGE_LENGTH}
                  disabled={!isComposingEnabled}
                  style={{
                    borderRadius: '16px',
                    boxShadow: '0 4px 20px rgba(59, 130, 246, 0.15)',
                    paddingBottom: '56px' // Espace pour les éléments en bas
                  }}
                />
                
                {/* Indicateurs dans le textarea - Positionnés plus bas pour éviter l'entrelacement */}
                <div className="absolute bottom-3 left-3 flex items-center space-x-3 text-sm text-gray-600 pointer-events-auto">
                  {/* Sélecteur de langue d'envoi - Limité aux choix configurés par l'utilisateur */}
                  <LanguageSelector
                    value={selectedInputLanguage}
                    onValueChange={setSelectedInputLanguage}
                    placeholder="Langue d'écriture"
                    className="border-gray-200 hover:border-blue-300"
                    choices={languageChoices}
                  />
                  
                  {/* Indicateur de langue détectée */}
                  {detectedLanguage && detectedLanguage !== selectedInputLanguage && newMessage.trim().length > 15 && (
                    <div className="flex items-center space-x-1 px-2 py-1 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700">
                      <span>🔍</span>
                      <span>Détecté: {getLanguageName(detectedLanguage)}</span>
                    </div>
                  )}
                  
                  {/* Localisation */}
                  {location && (
                    <div className="flex items-center space-x-1">
                      <MapPin className="h-4 w-4" />
                      <span>{location}</span>
                    </div>
                  )}
                </div>

                {/* Bouton d'envoi et compteur - Positionnés pour éviter l'entrelacement */}
                <div className="absolute bottom-3 right-3 flex items-center space-x-2 pointer-events-auto">
                  {/* Compteur de caractères */}
                  <span className={`text-xs font-medium px-2 py-1 rounded-full bg-white/80 backdrop-blur-sm border ${
                    remainingChars < 50 
                      ? remainingChars < 0 
                        ? 'text-red-600 border-red-200 bg-red-50/80' 
                        : 'text-orange-600 border-orange-200 bg-orange-50/80'
                      : 'text-gray-500 border-gray-200 bg-white/80'
                  }`}>
                    {remainingChars}
                  </span>
                  
                  <Button
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim() || newMessage.length > MAX_MESSAGE_LENGTH}
                    size="sm"
                    className="send-button px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg backdrop-blur-sm transition-all duration-200"
                    style={{ borderRadius: '12px' }}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar droite - Desktop uniquement - FIXE avec scroll indépendant */}
        <div className="hidden xl:block w-80 fixed right-0 top-20 bottom-0 bg-white/60 backdrop-blur-lg border-l border-blue-200/30 z-40">
          <div 
            className="h-full overflow-y-auto p-6 scroll-hidden"
          >
            
            {/* Header avec langues globales */}
            <SidebarLanguageHeader 
              languageStats={messageLanguageStats} 
              userLanguage={userLanguage}
            />

            {/* Section Langues Actives - Foldable */}
            <FoldableSection
              title="Langues Actives"
              icon={<Languages className="h-4 w-4 mr-2" />}
              defaultExpanded={true}
            >
              <LanguageIndicators languageStats={activeLanguageStats} />
            </FoldableSection>

            {/* Section Utilisateurs Actifs - Foldable - Remontée en 2e position */}
            <FoldableSection
              title={`Utilisateurs Actifs (${activeUsers.length})`}
              icon={<Users className="h-4 w-4 mr-2" />}
              defaultExpanded={true}
            >
              <div className="space-y-3">
                {/* Affichage des 6 premiers utilisateurs */}
                {activeUsers.slice(0, 6).map((activeUser) => (
                  <div
                    key={activeUser.id}
                    className="flex items-center space-x-3 p-2 rounded hover:bg-gray-50/80 cursor-pointer transition-colors"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={activeUser.avatar} alt={activeUser.firstName} />
                      <AvatarFallback className="bg-gradient-to-br from-blue-400 to-indigo-500 text-white">
                        {activeUser.firstName?.charAt(0)}{activeUser.lastName?.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {activeUser.firstName} {activeUser.lastName}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        @{activeUser.username}
                      </p>
                    </div>
                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                  </div>
                ))}
                
                {/* Section scrollable pour les utilisateurs restants */}
                {activeUsers.length > 6 && (
                  <div 
                    className="max-h-48 overflow-y-auto space-y-3 pr-1 border-t border-gray-100 pt-3 mt-3 scroll-hidden"
                  >
                    {activeUsers.slice(6).map((activeUser) => (
                      <div
                        key={activeUser.id}
                        className="flex items-center space-x-3 p-2 rounded hover:bg-gray-50/80 cursor-pointer transition-colors"
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={activeUser.avatar} alt={activeUser.firstName} />
                          <AvatarFallback className="bg-gradient-to-br from-blue-400 to-indigo-500 text-white">
                            {activeUser.firstName?.charAt(0)}{activeUser.lastName?.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {activeUser.firstName} {activeUser.lastName}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            @{activeUser.username}
                          </p>
                        </div>
                        <div className="w-2 h-2 bg-green-500 rounded-full" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </FoldableSection>

            {/* Section Tendances - Statique non-interactive, grisée */}
            <div className="opacity-60 saturate-50 bg-gray-50/50 rounded-lg p-2">
              <Card className="mb-6 bg-white/80 backdrop-blur-sm border-gray-200/50 shadow-lg">
                <CardContent className="p-0">
                  {/* Header non-cliquable */}
                  <div className="flex items-center justify-between p-4 bg-gray-50/80">
                    <h3 className="font-semibold text-gray-500 flex items-center">
                      <TrendingUp className="h-4 w-4 mr-2 text-gray-400" />
                      Tendances
                    </h3>
                    <ChevronDown className="h-4 w-4 text-gray-300" />
                  </div>
                  
                  {/* Contenu statique (non-visible car fermé) */}
                  <div className="hidden">
                    <div className="px-4 pb-4 border-t border-gray-100">
                      <div className="mt-3 opacity-70">
                        <TrendingSection hashtags={trendingHashtags} />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>


    </>
  );
}