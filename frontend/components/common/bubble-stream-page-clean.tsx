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
  Languages,
  MapPin, 
  TrendingUp, 
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
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

// Import des modules réutilisables extraits
import {
  BubbleMessage,
  FoldableSection,
  LanguageIndicators,
  SidebarLanguageHeader,
  SUPPORTED_LANGUAGES,
  MAX_MESSAGE_LENGTH,
  TOAST_SHORT_DURATION,
  TOAST_LONG_DURATION,
  TOAST_ERROR_DURATION,
  TYPING_CANCELATION_DELAY,
  getUserLanguageChoices,
  resolveUserPreferredLanguage,
  getUserLanguagePreferences,
  type LanguageStats,
  type BubbleStreamMessage,
  type BubbleStreamPageProps,
  type LanguageChoice
} from '@/lib/bubble-stream-modules';

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
    getUserLanguagePreferences: getTranslationPreferences,
    resolveUserPreferredLanguage: resolvePreferredLanguage,
    shouldRequestTranslation,
    getRequiredTranslations
  } = useMessageTranslations({ currentUser: user });

  // États
  const [messages, setMessages] = useState<BubbleStreamMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [detectedLanguage, setDetectedLanguage] = useState<string>('fr');
  const [userLanguage, setUserLanguage] = useState<string>(resolveUserPreferredLanguage(user));
  const [selectedInputLanguage, setSelectedInputLanguage] = useState<string>(user.systemLanguage || 'fr');
  const [languageStats, setLanguageStats] = useState<LanguageStats[]>([]);
  const [isComposingEnabled, setIsComposingEnabled] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [location, setLocation] = useState<string>('');
  const [trendingHashtags, setTrendingHashtags] = useState<string[]>([]);
  const [activeUsers, setActiveUsers] = useState<User[]>([]);

  // Langues utilisées par l'utilisateur (basées sur ses préférences)
  const usedLanguages: string[] = getUserLanguagePreferences(user);

  // Obtenir les choix de langues pour l'utilisateur
  const languageChoices = getUserLanguageChoices(user);

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
        const langInfo = SUPPORTED_LANGUAGES.find(lang => 
          lang.code === (relevantTranslation.language || relevantTranslation.targetLanguage)
        );
        
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

  // Reste de la logique du composant...
  // (Les autres useEffect, fonctions, et JSX restent identiques)

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Contenu temporaire pour validation */}
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Bubble Stream Page - Modules Réutilisables</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h2 className="text-lg font-semibold mb-2">Langues Utilisateur</h2>
            <div className="space-y-2">
              {languageChoices.map(choice => (
                <div key={choice.code} className="flex items-center gap-2 p-2 border rounded">
                  <span>{choice.flag}</span>
                  <span>{choice.name}</span>
                  {choice.isDefault && <Badge variant="secondary">Par défaut</Badge>}
                </div>
              ))}
            </div>
          </div>
          
          <div>
            <h2 className="text-lg font-semibold mb-2">Statistiques Langues</h2>
            <LanguageIndicators languageStats={languageStats} />
          </div>
        </div>
        
        <div className="mt-6">
          <SidebarLanguageHeader 
            languageStats={languageStats} 
            userLanguage={userLanguage}
          />
        </div>
        
        <FoldableSection
          title="Section de Test"
          icon={<Languages className="h-4 w-4 mr-2" />}
        >
          <p>Contenu de la section pliable.</p>
        </FoldableSection>
      </div>
    </div>
  );
}
