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
  Send,
  Languages,
  MapPin, 
  TrendingUp, 
  ChevronUp
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
  LanguageSelector,
  TranslationStats
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
  resolveUserPreferredLanguage,
  getUserLanguagePreferences,
  type BubbleStreamMessage,
  type BubbleStreamPageProps,
  type LanguageChoice
} from '@/lib/bubble-stream-modules';

import { BubbleMessage } from '@/components/common/bubble-message';
import { TrendingSection } from '@/components/common/trending-section';
import { useSocketIOMessaging } from '@/hooks/use-socketio-messaging';
import { useNotifications } from '@/hooks/use-notifications';
import { useMessageTranslations } from '@/hooks/use-message-translations';
import type { User, Message, BubbleTranslation } from '@/types';
import { buildApiUrl, API_ENDPOINTS } from '@/lib/config';

export function BubbleStreamPage({ user }: BubbleStreamPageProps) {
  const router = useRouter();
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Hook pour la gestion des traductions
  const {
    processMessageWithTranslations,
    getPreferredLanguageContent,
    getUserLanguagePreferences,
    resolveUserPreferredLanguage,
    shouldRequestTranslation,
    getRequiredTranslations
  } = useMessageTranslations({ currentUser: user });

  // États
  const [messages, setMessages] = useState<BubbleStreamMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [detectedLanguage, setDetectedLanguage] = useState<string>('fr');
  const [userLanguage, setUserLanguage] = useState<string>(resolveUserPreferredLanguage());
  const [selectedInputLanguage, setSelectedInputLanguage] = useState<string>(user.systemLanguage || 'fr');
  const [languageStats, setLanguageStats] = useState<LanguageStats[]>([]);
  const [isComposingEnabled, setIsComposingEnabled] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [location, setLocation] = useState<string>('');
  const [trendingHashtags, setTrendingHashtags] = useState<string[]>([]);
  const [activeUsers, setActiveUsers] = useState<User[]>([]);

  // Langues utilisées par l'utilisateur (basées sur ses préférences)
  const usedLanguages: string[] = getUserLanguagePreferences();

  // Obtenir les choix de langues pour l'utilisateur
  const getLanguageChoices = () => {
    const choices = [
      {
        code: user.systemLanguage || 'fr',
        name: 'Langue système',
        description: getLanguageName(user.systemLanguage) || 'Français',
        flag: getLanguageFlag(user.systemLanguage) || '🇫🇷',
        isDefault: true
      }
    ];

    if (user.regionalLanguage && user.regionalLanguage !== user.systemLanguage) {
      choices.push({
        code: user.regionalLanguage,
        name: 'Langue régionale',
        description: getLanguageName(user.regionalLanguage) || user.regionalLanguage,
        flag: getLanguageFlag(user.regionalLanguage) || '🌍',
        isDefault: false
      });
    }

    if (user.customDestinationLanguage && 
        user.customDestinationLanguage !== user.systemLanguage && 
        user.customDestinationLanguage !== user.regionalLanguage) {
      choices.push({
        code: user.customDestinationLanguage,
        name: 'Langue personnalisée',
        description: getLanguageName(user.customDestinationLanguage) || user.customDestinationLanguage,
        flag: getLanguageFlag(user.customDestinationLanguage) || '🎯',
        isDefault: false
      });
    }

    return choices;
  };

  const languageChoices = getLanguageChoices();

  // État pour les utilisateurs en train de taper
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  // Fonctions de gestion des événements utilisateur
  const handleUserTyping = useCallback((userId: string, username: string, isTyping: boolean) => {
    if (userId === user.id) return; // Ignorer nos propres événements de frappe
    
    setTypingUsers(prev => {
      if (isTyping) {
        // Ajouter l'utilisateur s'il n'est pas déjà dans la liste
        return prev.includes(username) ? prev : [...prev, username];
      } else {
        // Retirer l'utilisateur de la liste
        return prev.filter(name => name !== username);
      }
    });
  }, [user.id]);

  const handleUserStatus = useCallback((userId: string, username: string, isOnline: boolean) => {
    console.log('👤 Statut utilisateur changé:', { userId, username, isOnline });
    // TODO: Mettre à jour la liste des utilisateurs actifs
  }, []);

  const handleTranslation = useCallback((messageId: string, translations: any[]) => {
    console.log('🌐 Traductions reçues pour message:', messageId, translations);
    
    // Vérifier si des traductions existent déjà pour éviter les doublons
    let hasNewTranslation = false;
    
    // Mettre à jour le message avec les traductions reçues
    setMessages(prev => prev.map(msg => {
      if (msg.id === messageId) {
        // Convertir les traductions reçues au format BubbleTranslation
        const newTranslations: BubbleTranslation[] = translations.map(t => ({
          language: t.language || t.targetLanguage,
          content: t.content || t.translatedContent,
          status: 'completed' as const,
          timestamp: new Date(),
          confidence: t.confidence || 0.9
        }));

        // Fusionner avec les traductions existantes pour éviter les doublons
        const existingTranslations = msg.translations || [];
        const mergedTranslations: BubbleTranslation[] = [...existingTranslations];

        newTranslations.forEach(newTrans => {
          const existingIndex = mergedTranslations.findIndex(
            existing => existing.language === newTrans.language
          );
          
          if (existingIndex >= 0) {
            // Mettre à jour la traduction existante
            mergedTranslations[existingIndex] = newTrans;
          } else {
            // Ajouter nouvelle traduction
            mergedTranslations.push(newTrans);
            hasNewTranslation = true;
          }
        });

        // Mettre à jour le contenu du message si nous avons une traduction pour la langue système
        let updatedContent = msg.content;
        const systemLanguageTranslation = mergedTranslations.find(t => 
          t.language === user.systemLanguage && t.status === 'completed'
        );
        
        // Si le message n'est pas dans la langue système de l'utilisateur, utiliser la traduction
        if (msg.originalLanguage !== user.systemLanguage && systemLanguageTranslation) {
          updatedContent = systemLanguageTranslation.content;
        }

        return {
          ...msg,
          content: updatedContent,
          translations: mergedTranslations
        };
      }
      return msg;
    }));
    
    // Toast UNIQUEMENT pour les nouvelles traductions dans les langues de l'utilisateur
    if (hasNewTranslation) {
      const userLanguages = [
        user.systemLanguage,
        user.regionalLanguage,
        user.customDestinationLanguage
      ].filter(Boolean); // Enlever les valeurs undefined/null

      const relevantTranslation = translations.find(t => 
        userLanguages.includes(t.language || t.targetLanguage)
      );
      
      if (relevantTranslation) {
        const langInfo = getLanguageInfo(relevantTranslation.language || relevantTranslation.targetLanguage);
        
        console.log('✅ Toast pour traduction pertinente:', {
          langue: langInfo?.name,
          userLanguages,
          translationLanguage: relevantTranslation.language || relevantTranslation.targetLanguage
        });
        
        toast.success(`🌐 Message traduit en ${langInfo?.name || 'votre langue'}`, {
          duration: TOAST_SHORT_DURATION
        });
      }
    }
  }, [user.systemLanguage, user.regionalLanguage, user.customDestinationLanguage]);

  // Handler pour les nouveaux messages reçus via WebSocket avec traductions optimisées
  const handleNewMessage = useCallback((message: Message) => {
    console.log('📩 Message reçu via WebSocket:', { id: message.id, content: message.content, senderId: message.senderId });
    
    setMessages(prev => {
      // Éviter les doublons - vérifier par ID ET par contenu/senderId pour plus de sécurité
      const isDuplicate = prev.some(existingMsg => 
        existingMsg.id === message.id || 
        (existingMsg.senderId === message.senderId && 
         existingMsg.content === message.content && 
         Math.abs(new Date(existingMsg.createdAt).getTime() - new Date(message.createdAt).getTime()) < 5000)
      );
      
      if (isDuplicate) {
        console.log('🚫 Message dupliqué détecté, ignoré:', message.id);
        return prev;
      }

      // Utiliser le hook pour traiter le message avec traductions
      const bubbleMessage = processMessageWithTranslations(message);

      console.log('✅ Nouveau message ajouté au stream:', {
        id: bubbleMessage.id,
        isTranslated: bubbleMessage.isTranslated,
        translationsCount: bubbleMessage.translations.length
      });
      
      // ⬆️ Les nouveaux messages sont placés EN HAUT de la liste (ordre chronologique inverse)
      return [bubbleMessage, ...prev];
    });
    
    // Notification UNIQUEMENT pour les nouveaux messages d'autres utilisateurs
    if (message.senderId !== user.id) {
      toast.info(`📨 Nouveau message de ${message.sender?.firstName || 'Utilisateur'}`, {
        duration: TOAST_LONG_DURATION
      });
    } else {
      // Pour nos propres messages, juste un toast discret de confirmation
      console.log('✅ Mon message publié avec succès');
    }
    
    // Auto-scroll vers le nouveau message
    setTimeout(() => {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }, 100);
    
    console.log('📩 Traitement nouveau message terminé:', {
      from: message.sender?.username,
      content: message.content.substring(0, 50) + '...',
      isOwnMessage: message.senderId === user.id,
    });
  }, [user.id, processMessageWithTranslations]);

  // Hooks
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
          wsUrl: process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3000/ws'
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

  // Détection automatique de langue (désactivée au profit de la sélection manuelle)
  // useEffect(() => {
  //   if (newMessage.trim().length > 10) {
  //     // Simulation de détection de langue basique
  //     const detectLanguage = (text: string) => {
  //       const patterns = {
  //         fr: /\b(le|la|les|de|du|des|et|ou|un|une|ce|cette|pour|dans|avec|sur|par)\b/gi,
  //         en: /\b(the|and|or|a|an|this|that|for|in|with|on|by|from|to)\b/gi,
  //         es: /\b(el|la|los|las|de|del|y|o|un|una|este|esta|para|en|con|por)\b/gi,
  //         de: /\b(der|die|das|und|oder|ein|eine|dieser|diese|für|in|mit|auf|von)\b/gi,
  //       };

  //       for (const [lang, pattern] of Object.entries(patterns)) {
  //         if (pattern.test(text)) {
  //           return lang;
  //         }
  //       }
  //       return 'fr'; // Par défaut
  //     };

  //     setDetectedLanguage(detectLanguage(newMessage));
  //   }
  // }, [newMessage]);

  // Mise à jour automatique de la langue sélectionnée si l'utilisateur change
  useEffect(() => {
    const newUserLanguage = resolveUserPreferredLanguage();
    setUserLanguage(newUserLanguage);
    
    if (selectedInputLanguage !== user.systemLanguage && !languageChoices.find(choice => choice.code === selectedInputLanguage)) {
      // Si la langue sélectionnée n'est plus dans les choix, revenir à la langue système
      setSelectedInputLanguage(user.systemLanguage || 'fr');
    }
  }, [user.systemLanguage, user.regionalLanguage, user.customDestinationLanguage, selectedInputLanguage, languageChoices, resolveUserPreferredLanguage]);

  // Mise à jour des statistiques de langues
  useEffect(() => {
    const updateLanguageStats = () => {
      const stats = SUPPORTED_LANGUAGES.map(lang => {
        const count = messages.filter(msg => 
          msg.originalLanguage === lang.code
        ).length;
        
        return {
          language: lang.code,
          flag: lang.flag,
          count: Math.max(1, count + Math.floor(Math.random() * 50)), // Simulation
          color: lang.color
        };
      }).filter(stat => stat.count > 0);

      setLanguageStats(stats);
    };

    updateLanguageStats();
    const interval = setInterval(updateLanguageStats, 30000); // Mise à jour toutes les 30s

    return () => clearInterval(interval);
  }, [messages]);

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
    
    // Pas de simulation de messages - utilisateurs actifs seulement
    setActiveUsers([
      { 
        id: '1', 
        username: 'alice_fr', 
        firstName: 'Alice', 
        lastName: 'Martin', 
        email: 'alice@example.com',
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
      },
      { 
        id: '2', 
        username: 'bob_en', 
        firstName: 'Bob', 
        lastName: 'Smith', 
        email: 'bob@example.com',
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
        systemLanguage: 'en',
        regionalLanguage: 'en',
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
      }
    ]);
  }, []);

  // Fonction pour charger les messages existants depuis le serveur avec traductions optimisées
  const loadExistingMessages = useCallback(async () => {
    try {
      console.log('📥 Chargement des messages existants avec traductions optimisées...');
      const token = localStorage.getItem('auth_token');
      
      if (!token) {
        console.log('⚠️ Pas de token d\'authentification disponible');
        return;
      }
      
      const response = await fetch(buildApiUrl(`/conversations/any/messages`), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const responseData = await response.json();
        console.log('🔍 Debug: Structure complète de responseData:', responseData);
        
        // Gérer différents formats de réponse
        let existingMessages = [];
        if (responseData.data?.messages) {
          existingMessages = responseData.data.messages;
        } else if (responseData.messages) {
          existingMessages = responseData.messages;
        } else if (Array.isArray(responseData.data)) {
          existingMessages = responseData.data;
        } else if (Array.isArray(responseData)) {
          existingMessages = responseData;
        }
        
        console.log('✅ Messages existants chargés:', existingMessages.length);
        
        // Log détaillé des traductions dans les messages bruts
        if (existingMessages.length > 0) {
          console.log('🔍 Debug: Premier message brut avec traductions:');
          console.log('📦 Message brut:', existingMessages[0]);
          console.log('🌐 Traductions brutes:', existingMessages[0]?.translations);
          console.log('🔢 Nombre de traductions:', existingMessages[0]?.translations?.length || 0);
          
          // Analyser toutes les traductions disponibles
          const allTranslations = existingMessages.reduce((acc: any[], msg: any) => {
            if (msg.translations && Array.isArray(msg.translations)) {
              acc.push(...msg.translations);
            }
            return acc;
          }, []);
          
          console.log('📊 Analyse traductions brutes:', {
            totalMessages: existingMessages.length,
            totalTranslations: allTranslations.length,
            languesDisponibles: [...new Set(allTranslations.map((t: any) => t.targetLanguage))],
            exempleTraduction: allTranslations[0]
          });
        }
        
        // Vérifier que existingMessages est bien un tableau
        if (!Array.isArray(existingMessages)) {
          console.error('❌ existingMessages n\'est pas un tableau:', typeof existingMessages, existingMessages);
          toast.error('Format de données invalide');
          return;
        }
        
        // Utiliser le hook pour traiter les messages avec traductions
        const bubbleMessages: BubbleStreamMessage[] = existingMessages
          .map((msg: any, index: number) => {
            // Log détaillé pour chaque message traité
            const processed = processMessageWithTranslations(msg);
            
            if (index < 3) { // Log seulement les 3 premiers pour éviter le spam
              console.log(`🔍 Message ${index + 1} traité:`, {
                id: processed.id,
                originalLanguage: processed.originalLanguage,
                isTranslated: processed.isTranslated,
                translatedFrom: processed.translatedFrom,
                translationsCount: processed.translations.length,
                content: processed.content.substring(0, 50) + '...',
                translationLanguages: processed.translations.map(t => t.language)
              });
            }
            
            return processed;
          })
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        
        setMessages(bubbleMessages);
        
        // Compter les traductions disponibles et les traductions manquantes
        const totalTranslations = bubbleMessages.reduce((sum, msg) => sum + msg.translations.length, 0);
        const translatedMessages = bubbleMessages.filter(msg => msg.isTranslated).length;
        
        // Identifier les messages nécessitant des traductions
        const messagesNeedingTranslation = bubbleMessages.filter(msg => {
          const required = getRequiredTranslations(msg);
          return required.length > 0;
        });
        
        // Analyse détaillée des langues
        const languageAnalysis = bubbleMessages.reduce((acc, msg) => {
          // Langue originale
          acc.originalLanguages[msg.originalLanguage] = (acc.originalLanguages[msg.originalLanguage] || 0) + 1;
          
          // Langues traduites
          msg.translations.forEach(t => {
            acc.translatedLanguages[t.language] = (acc.translatedLanguages[t.language] || 0) + 1;
          });
          
          return acc;
        }, { originalLanguages: {} as Record<string, number>, translatedLanguages: {} as Record<string, number> });
        
        console.log(`📊 Statistiques traductions détaillées:`, {
          totalMessages: bubbleMessages.length,
          totalTranslations,
          translatedMessages,
          messagesNeedingTranslation: messagesNeedingTranslation.length,
          languageAnalysis,
          userPreferredLanguage: resolveUserPreferredLanguage(),
          userLanguagePreferences: getUserLanguagePreferences()
        });
        
        toast.success(`📨 ${existingMessages.length} messages chargés (${totalTranslations} traductions, ${messagesNeedingTranslation.length} nécessitent traduction)`);
        
        // TODO: Déclencher la traduction automatique des messages manquants si activée
        if (user.autoTranslateEnabled && messagesNeedingTranslation.length > 0) {
          console.log(`🔄 ${messagesNeedingTranslation.length} messages à traduire automatiquement`);
          // Ici on pourrait déclencher les traductions en arrière-plan
        }
        
      } else {
        console.log('⚠️ Impossible de charger les messages existants. Status:', response.status);
        try {
          const errorData = await response.text();
          console.log('🔍 Debug: Réponse d\'erreur:', errorData);
        } catch (e) {
          console.log('🔍 Debug: Impossible de lire la réponse d\'erreur');
        }
        toast.error('Erreur lors du chargement des messages');
      }
    } catch (error) {
      console.error('❌ Erreur lors du chargement des messages:', error);
      toast.error('Erreur de connexion lors du chargement des messages');
    }
  }, [processMessageWithTranslations, getRequiredTranslations, resolveUserPreferredLanguage, getUserLanguagePreferences, user.autoTranslateEnabled]);

  // Charger les messages existants dès la connexion avec debug amélioré
  useEffect(() => {
    if (connectionStatus.isConnected) {
      // Délai pour laisser le temps à la connexion de se stabiliser
      const loadTimeout = setTimeout(() => {
        console.log('🚀 Déclenchement chargement messages existants...');
        loadExistingMessages();
      }, 1000);
      
      return () => clearTimeout(loadTimeout);
    } else {
      console.log('⏳ En attente de connexion pour charger les messages...');
    }
  }, [connectionStatus.isConnected, loadExistingMessages]);

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
      // Essayer d'envoyer via le service WebSocket si connecté
      if (connectionStatus.isConnected) {
        try {
          // TODO: Modifier sendMessageToService pour inclure la langue source (selectedInputLanguage)
          // Cette langue sera propagée vers la gateway et utilisée comme langue source
          // après vérification avec le profil utilisateur
          await sendMessageToService(messageContent);
          console.log('✅ Message envoyé via WebSocket - sera reçu via onNewMessage');
          // Suppression du toast automatique pour éviter les doublons
          // Le toast se fera lors de la réception via onNewMessage
        } catch (error) {
          console.error('❌ Erreur envoi WebSocket:', error);
          toast.error('Erreur lors de l\'envoi du message');
          // Restaurer le message en cas d'erreur
          setNewMessage(messageContent);
          return;
        }
      } else {
        console.log('📡 WebSocket non connecté - Message en attente');
        toast.warning('Connexion en cours - Message sera envoyé dès la reconnexion');
        // Restaurer le message pour permettre un nouvel essai
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

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (token) {
        await fetch(buildApiUrl(API_ENDPOINTS.AUTH.LOGOUT), {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        });
      }
    } catch (error) {
      console.error('Erreur déconnexion:', error);
    } finally {
      localStorage.removeItem('auth_token');
      router.push('/');
      toast.success('Déconnexion réussie');
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
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
      {/* Header simplifié - Style Dashboard */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo et titre */}
            <div className="flex items-center space-x-4">
              <div 
                className="flex items-center space-x-2 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => router.push('/')}
              >
                <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                  <MessageSquare className="h-5 w-5 text-white" />
                </div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Meeshy</h1>
              </div>
              <div className="hidden lg:block">
                <span className="text-gray-400 mx-2">/</span>
                <span className="text-lg font-medium text-gray-700">{/* Stream Global */}</span>
              </div>
            </div>

            {/* Barre de recherche centrée - Responsive */}
            <div className="flex-1 max-w-sm sm:max-w-md lg:max-w-lg mx-4 sm:mx-8">
              <form onSubmit={handleSearch} className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Rechercher..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-full text-sm"
                />
              </form>
            </div>

            {/* Menu utilisateur - Responsive */}
            <div className="flex items-center space-x-2 sm:space-x-4">
              {/* Notifications */}
              <Button 
                variant="ghost" 
                size="sm" 
                className="relative"
                onClick={() => toast.info('Notifications disponibles prochainement')}
              >
                <Bell className="h-5 w-5" />
                {notifications.length > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 text-xs bg-red-500">
                    {notifications.length}
                  </Badge>
                )}
              </Button>

              {/* Menu utilisateur */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center space-x-2 sm:space-x-3 hover:bg-gray-100">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user.avatar} alt={user.firstName} />
                      <AvatarFallback>
                        {user.firstName?.charAt(0)}{user.lastName?.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="hidden sm:block text-left">
                      <p className="text-sm font-medium text-gray-900">
                        {user.firstName} {user.lastName}
                      </p>
                      <p className="text-xs text-gray-500">@{user.username}</p>
                    </div>
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  </Button>
                </DropdownMenuTrigger>
                
                <DropdownMenuContent align="end" className="w-56 z-50">
                  <DropdownMenuItem onClick={() => router.push('/dashboard')}>
                    <Home className="mr-2 h-4 w-4" />
                    <span>Tableau de bord</span>
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem onClick={() => router.push('/conversations')}>
                    <MessageSquare className="mr-2 h-4 w-4" />
                    <span>Conversations</span>
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem onClick={() => router.push('/groups')}>
                    <Users className="mr-2 h-4 w-4" />
                    <span>Groupes</span>
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem onClick={() => router.push('/contacts')}>
                    <UserPlus className="mr-2 h-4 w-4" />
                    <span>Contacts</span>
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem onClick={() => router.push('/links')}>
                    <LinkIcon className="mr-2 h-4 w-4" />
                    <span>Liens</span>
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem onClick={() => router.push('/models')}>
                    <Brain className="mr-2 h-4 w-4" />
                    <span>Modèles</span>
                  </DropdownMenuItem>
                  
                  <DropdownMenuSeparator />
                  
                  <DropdownMenuItem onClick={() => router.push('/profile')}>
                    <UserIcon className="mr-2 h-4 w-4" />
                    <span>Profil</span>
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem onClick={() => router.push('/settings')}>
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Paramètres</span>
                  </DropdownMenuItem>
                  
                  {user.permissions?.canAccessAdmin && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => router.push('/admin')}>
                        <Shield className="mr-2 h-4 w-4" />
                        <span>Administration</span>
                      </DropdownMenuItem>
                    </>
                  )}
                  
                  <DropdownMenuSeparator />
                  
                  <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Déconnexion</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      {/* Layout principal */}
      <div className="pt-16 min-h-screen relative">
        {/* Feed principal - Container avec gestion propre du scroll */}
        <div className="w-full xl:pr-80 relative">
          {/* Indicateur dynamique - Frappe prioritaire sur connexion */}
          <div className="fixed top-16 left-0 right-0 xl:right-80 z-40 px-4 sm:px-6 lg:px-8 pt-4 pb-2 bg-gradient-to-b from-blue-50 to-transparent pointer-events-none">
            <div className="pointer-events-auto">
              {/* Priorité à l'indicateur de frappe quand actif */}
              {typingUsers.length > 0 && connectionStatus.isConnected ? (
                <div className="inline-flex items-center space-x-2 px-4 py-2 rounded-full text-sm backdrop-blur-sm bg-blue-100/90 text-blue-800 border border-blue-200/80 transition-all">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce delay-75" />
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce delay-150" />
                  </div>
                  <span className="font-medium">
                    {typingUsers.length === 1 
                      ? `${typingUsers[0]} écrit...`
                      : typingUsers.length === 2
                      ? `${typingUsers[0]} et ${typingUsers[1]} écrivent...`
                      : `${typingUsers[0]} et ${typingUsers.length - 1} autres écrivent...`
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
                {messages.length === 0 ? (
                  <div className="text-center py-12">
                    <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      Aucun message pour le moment
                    </h3>
                    <p className="text-gray-500">
                      Soyez le premier à publier dans le stream global !
                    </p>
                    <p className="text-xs text-gray-400 mt-2">
                      📍 Les nouveaux messages apparaîtront en haut de cette page
                    </p>
                  </div>
                ) : (
                  messages.map((message) => (
                    <BubbleMessage
                      key={message.id}
                      message={message}
                      currentUser={user}
                      userLanguage={userLanguage}
                      usedLanguages={usedLanguages}
                    />
                  ))
                )}

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
                  {/* Sélecteur de langue d'envoi */}
                  <LanguageSelector
                    value={selectedInputLanguage}
                    onValueChange={setSelectedInputLanguage}
                    placeholder="Langue d'écriture"
                    className="border-gray-200 hover:border-blue-300"
                  />
                  
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
        <div className="hidden xl:block w-80 fixed right-0 top-16 bottom-0 bg-white/60 backdrop-blur-lg border-l border-blue-200/30 z-40">
          <div 
            className="h-full overflow-y-auto p-6 scroll-hidden"
          >
            
            {/* Header avec langues globales */}
            <SidebarLanguageHeader 
              languageStats={languageStats} 
              userLanguage={userLanguage}
            />

            {/* Section Langues Actives - Foldable */}
            <FoldableSection
              title="Langues Actives"
              icon={<Languages className="h-4 w-4 mr-2" />}
              defaultExpanded={true}
            >
              <LanguageIndicators languageStats={languageStats} />
            </FoldableSection>

            {/* Section Tendances - Foldable */}
            <FoldableSection
              title="Tendances"
              icon={<TrendingUp className="h-4 w-4 mr-2" />}
              defaultExpanded={true}
            >
              <TrendingSection hashtags={trendingHashtags} />
            </FoldableSection>

            {/* Section Utilisateurs Actifs - Foldable */}
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
          </div>
        </div>
      </div>
    </div>
  );
}