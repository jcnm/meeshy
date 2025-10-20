'use client';

import { memo, useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { X, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import type { Message } from '@shared/types/conversation';
import { useMessageReactions } from '@/hooks/use-message-reactions';

interface ReactionSelectionMessageViewProps {
  message: Message;
  isOwnMessage: boolean;
  onSelectReaction: (emoji: string) => void;
  onClose: () => void;
  t: (key: string) => string;
  recentEmojis?: string[];
  // Props pour les réactions
  conversationId?: string;
  currentUserId?: string;
  currentAnonymousUserId?: string;
  isAnonymous?: boolean;
}

// Catégories d'emojis
const EMOJI_CATEGORIES = {
  recent: {
    label: 'Récents',
    icon: '🕐',
    emojis: [] as string[], // Rempli dynamiquement
  },
  smileys: {
    label: 'Smileys',
    icon: '😀',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂',
      '🙂', '🙃', '🫠', '😉', '😊', '😇', '🥰', '😍',
      '🤩', '😘', '😗', '☺️', '😚', '😙', '🥲', '😋',
      '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🫢',
      '🫣', '🤫', '🤔', '🫡', '🤐', '🤨', '😐', '😑',
      '😶', '🫥', '😶‍🌫️', '😏', '😒', '🙄', '😬', '😮‍💨',
      '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒',
      '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵',
      '😵‍💫', '🤯', '🤠', '🥳', '🥸', '😎', '🤓', '🧐',
      '😕', '🫤', '😟', '🙁', '☹️', '😮', '😯', '😲',
      '😳', '🥺', '🥹', '😦', '😧', '😨', '😰', '😥',
      '😢', '😭', '😱', '😖', '😣', '😞', '😓', '😩',
      '😫', '🥱', '😤', '😡', '😠', '🤬', '😈', '👿'
    ]
  },
  people: {
    label: 'Personnes',
    icon: '👤',
    emojis: [
      '👋', '🤚', '🖐️', '✋', '🖖', '🫱', '🫲', '🫳',
      '🫴', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘',
      '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '🫵',
      '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌',
      '🫶', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳',
      '💪', '🦾', '🦵', '🦿', '🦶', '👂', '🦻', '👃'
    ]
  },
  nature: {
    label: 'Nature',
    icon: '🌲',
    emojis: [
      '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼',
      '🐻‍❄️', '🐨', '🐯', '🦁', '🐮', '🐷', '🐽', '🐸',
      '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦',
      '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇', '🐺',
      '🐗', '🐴', '🦄', '🐝', '🪱', '🐛', '🦋', '🐌',
      '🐞', '🐜', '🪰', '🪲', '🪳', '🦟', '🦗', '🕷️'
    ]
  },
  food: {
    label: 'Nourriture',
    icon: '🍔',
    emojis: [
      '🍎', '🍏', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇',
      '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥',
      '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️',
      '🫑', '🌽', '🥕', '🫒', '🧄', '🧅', '🥔', '🍠'
    ]
  },
  activities: {
    label: 'Activités',
    icon: '⚽',
    emojis: [
      '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉',
      '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍',
      '🏏', '🪃', '🥅', '⛳', '🪁', '🏹', '🎣', '🤿',
      '🥊', '🥋', '🎽', '🛹', '🛼', '🛷', '⛸️', '🥌'
    ]
  },
  objects: {
    label: 'Objets',
    icon: '💡',
    emojis: [
      '💌', '💎', '💍', '💡', '💰', '💳', '💸', '💻',
      '⌚', '📱', '📲', '💽', '💾', '💿', '📀', '📷',
      '📸', '📹', '🎥', '📞', '☎️', '📟', '📠', '📺',
      '📻', '🎙️', '🎚️', '🎛️', '🧭', '⏱️', '⏲️', '⏰'
    ]
  },
  symbols: {
    label: 'Symboles',
    icon: '❤️',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍',
      '🤎', '❤️‍🔥', '❤️‍🩹', '💔', '❣️', '💕', '💞', '💓',
      '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️',
      '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐'
    ]
  },
  flags: {
    label: 'Drapeaux',
    icon: '🏁',
    emojis: [
      '🏁', '🚩', '🎌', '🏴', '🏳️', '🏳️‍🌈', '🏳️‍⚧️', '🏴‍☠️',
      '🇦🇫', '🇦🇽', '🇦🇱', '🇩🇿', '🇦🇸', '🇦🇩', '🇦🇴', '🇦🇮',
      '🇦🇶', '🇦🇬', '🇦🇷', '🇦🇲', '🇦🇼', '🇦🇺', '🇦🇹', '🇦🇿',
      '🇧🇸', '🇧🇭', '🇧🇩', '🇧🇧', '🇧🇾', '🇧🇪', '🇧🇿', '🇧🇯',
      '🇧🇲', '🇧🇹', '🇧🇴', '🇧🇦', '🇧🇼', '🇧🇷', '🇮🇴', '🇻🇬'
    ]
  }
};

export const ReactionSelectionMessageView = memo(function ReactionSelectionMessageView({
  message,
  isOwnMessage,
  onSelectReaction,
  onClose,
  t,
  recentEmojis = ['❤️', '😀', '👍', '😂', '🔥', '🎉', '💯', '✨'],
  conversationId,
  currentUserId,
  currentAnonymousUserId,
  isAnonymous = false
}: ReactionSelectionMessageViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('recent');
  const [hoveredEmoji, setHoveredEmoji] = useState<string | null>(null);

  // Hook de réactions intégré
  const { addReaction, isLoading, userReactions } = useMessageReactions({
    messageId: message.id,
    currentUserId: isAnonymous ? currentAnonymousUserId : currentUserId,
    isAnonymous
  });

  // Mettre à jour les emojis récents
  const categories = useMemo(() => {
    const cats = { ...EMOJI_CATEGORIES };
    cats.recent.emojis = recentEmojis;
    return cats;
  }, [recentEmojis]);

  // Filtrer les emojis selon la recherche
  const filteredEmojis = useMemo(() => {
    if (!searchQuery) {
      return categories[selectedCategory as keyof typeof categories]?.emojis || [];
    }

    // Rechercher dans toutes les catégories
    const allEmojis: string[] = [];
    Object.values(categories).forEach(category => {
      if (category.emojis) {
        allEmojis.push(...category.emojis);
      }
    });

    // Filtrer les doublons et retourner les résultats
    return Array.from(new Set(allEmojis));
  }, [searchQuery, selectedCategory, categories]);

  const handleEmojiSelect = useCallback(async (emoji: string) => {
    // Éviter les doubles clics pendant le traitement
    if (isLoading) return;
    
    try {
      // Ajouter la réaction via le hook
      const success = await addReaction(emoji);
      
      if (success) {
        // Notifier le parent (pour actions additionnelles si nécessaire)
        onSelectReaction(emoji);
        // Fermer la vue
        onClose();
      }
    } catch (error) {
      console.error('Failed to add reaction:', error);
      // La vue reste ouverte en cas d'erreur pour que l'utilisateur puisse réessayer
    }
  }, [addReaction, isLoading, onSelectReaction, onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: -10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 10 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className={cn(
        "relative w-full max-w-md mx-auto rounded-lg border shadow-lg overflow-hidden",
        isOwnMessage 
          ? "bg-gradient-to-br from-blue-400/95 to-blue-500/95 border-blue-400 backdrop-blur-sm" 
          : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
      )}
      onKeyDown={handleKeyDown}
    >
      {/* Header */}
      <div className={cn(
        "flex items-center justify-between px-4 py-3 border-b",
        isOwnMessage 
          ? "border-white/20 bg-white/10" 
          : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50"
      )}>
        <h3 className={cn(
          "text-sm font-semibold",
          isOwnMessage ? "text-white" : "text-gray-800 dark:text-gray-100"
        )}>
          {t('chooseReaction')}
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className={cn(
            "h-6 w-6 p-0 rounded-full",
            isOwnMessage 
              ? "text-white/70 hover:text-white hover:bg-white/20" 
              : "text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:bg-gray-700"
          )}
          aria-label={t('close')}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Search Bar */}
      <div className="px-4 py-3">
        <div className="relative">
          <Search className={cn(
            "absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4",
            isOwnMessage ? "text-white/50" : "text-gray-400"
          )} />
          <Input
            type="text"
            placeholder={t('searchEmoji')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn(
              "pl-10 pr-4 h-9 text-sm",
              isOwnMessage 
                ? "bg-white/20 border-white/30 text-white placeholder:text-white/60 focus:bg-white/30 focus:border-white/50" 
                : "bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600"
            )}
            autoFocus
          />
        </div>
      </div>

      {/* Category Tabs */}
      {!searchQuery && (
        <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="px-4">
          <TabsList className={cn(
            "grid w-full h-8",
            `grid-cols-${Object.keys(categories).length > 6 ? '6' : Object.keys(categories).length}`,
            isOwnMessage 
              ? "bg-white/10" 
              : "bg-gray-100 dark:bg-gray-900"
          )}>
            {Object.entries(categories).slice(0, 6).map(([key, category]) => (
              <TabsTrigger
                key={key}
                value={key}
                className={cn(
                  "text-xs px-2 py-1",
                  isOwnMessage 
                    ? "data-[state=active]:bg-white/20 data-[state=active]:text-white" 
                    : "data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800"
                )}
                title={category.label}
              >
                <span className="text-base">{category.icon}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      {/* Emoji Grid */}
      <ScrollArea className="h-64 px-4 py-2">
        <div className="grid grid-cols-8 gap-1">
          {filteredEmojis.map((emoji, index) => (
            <motion.button
              key={`${emoji}-${index}`}
              whileHover={{ scale: 1.2, rotate: [0, -5, 5, -5, 0] }}
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 0.2 }}
              disabled={isLoading}
              className={cn(
                "h-10 w-10 flex items-center justify-center rounded-md text-2xl transition-colors relative",
                userReactions.includes(emoji)
                  ? isOwnMessage
                    ? "bg-white/40 border-2 border-white/60"
                    : "bg-blue-100 border-2 border-blue-400 dark:bg-blue-900/50 dark:border-blue-600"
                  : hoveredEmoji === emoji 
                    ? isOwnMessage 
                      ? "bg-white/30" 
                      : "bg-gray-100 dark:bg-gray-700"
                    : isOwnMessage 
                      ? "hover:bg-white/20" 
                      : "hover:bg-gray-100 dark:hover:bg-gray-700",
                isLoading && "opacity-50 cursor-not-allowed"
              )}
              onClick={() => handleEmojiSelect(emoji)}
              onMouseEnter={() => setHoveredEmoji(emoji)}
              onMouseLeave={() => setHoveredEmoji(null)}
              aria-label={`${userReactions.includes(emoji) ? 'Remove' : 'Add'} ${emoji}`}
              title={userReactions.includes(emoji) ? t('removeReaction') : t('addReaction')}
            >
              {emoji}
              {userReactions.includes(emoji) && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className={cn(
                    "absolute -top-1 -right-1 w-3 h-3 rounded-full flex items-center justify-center",
                    isOwnMessage ? "bg-white text-blue-600" : "bg-blue-600 text-white"
                  )}
                >
                  <span className="text-xs">✓</span>
                </motion.div>
              )}
            </motion.button>
          ))}
        </div>
      </ScrollArea>

      {/* Most Used Section */}
      {recentEmojis.length > 0 && (
        <div className={cn(
          "px-4 py-2 border-t",
          isOwnMessage 
            ? "border-white/20 bg-white/5" 
            : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50"
        )}>
          <p className={cn(
            "text-xs mb-1",
            isOwnMessage ? "text-white/70" : "text-gray-500 dark:text-gray-400"
          )}>
            {t('mostUsed')}:
          </p>
          <div className="flex gap-1">
            {recentEmojis.slice(0, 8).map((emoji, index) => (
              <motion.button
                key={`recent-${emoji}-${index}`}
                whileHover={{ scale: 1.2 }}
                whileTap={{ scale: 0.95 }}
                className={cn(
                  "h-8 w-8 flex items-center justify-center rounded text-xl transition-colors",
                  isOwnMessage 
                    ? "hover:bg-white/20" 
                    : "hover:bg-gray-100 dark:hover:bg-gray-700"
                )}
                onClick={() => handleEmojiSelect(emoji)}
                aria-label={`Select ${emoji}`}
              >
                {emoji}
              </motion.button>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
});