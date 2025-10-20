'use client';

import { memo, useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { X, Search, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import type { Message } from '@shared/types/conversation';
import { useMessageReactions } from '@/hooks/use-message-reactions';
import { useI18n } from '@/hooks/useI18n';

interface ReactionSelectionMessageViewProps {
  message: Message;
  isOwnMessage: boolean;
  onSelectReaction: (emoji: string) => void;
  onClose: () => void;
  recentEmojis?: string[];
  // Props pour les réactions
  conversationId?: string;
  currentUserId?: string;
  currentAnonymousUserId?: string;
  isAnonymous?: boolean;
}

// Catégories d'emojis avec traductions
const EMOJI_CATEGORIES = {
  recent: {
    key: 'recent',
    icon: '🕐',
    emojis: [] as string[], // Rempli dynamiquement
  },
  smileys: {
    key: 'smileys',
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
    key: 'people',
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
    key: 'nature',
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
    key: 'food',
    icon: '🍔',
    emojis: [
      '🍎', '🍏', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇',
      '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥',
      '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️',
      '🫑', '🌽', '🥕', '🫒', '🧄', '🧅', '🥔', '🍠'
    ]
  },
  activities: {
    key: 'activities',
    icon: '⚽',
    emojis: [
      '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉',
      '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍',
      '🏏', '🪃', '🥅', '⛳', '🪁', '🏹', '🎣', '🤿',
      '🥊', '🥋', '🎽', '🛹', '🛼', '🛷', '⛸️', '🥌'
    ]
  },
  objects: {
    key: 'objects',
    icon: '💡',
    emojis: [
      '💌', '💎', '💍', '💡', '💰', '💳', '💸', '💻',
      '⌚', '📱', '📲', '💽', '💾', '💿', '📀', '📷',
      '📸', '📹', '🎥', '📞', '☎️', '📟', '📠', '📺',
      '📻', '🎙️', '🎚️', '🎛️', '🧭', '⏱️', '⏲️', '⏰'
    ]
  },
  symbols: {
    key: 'symbols',
    icon: '❤️',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍',
      '🤎', '❤️‍🔥', '❤️‍🩹', '💔', '❣️', '💕', '💞', '💓',
      '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️',
      '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐'
    ]
  },
  flags: {
    key: 'flags',
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
  recentEmojis = ['❤️', '😀', '👍', '😂', '🔥', '🎉', '💯', '✨'],
  conversationId,
  currentUserId,
  currentAnonymousUserId,
  isAnonymous = false
}: ReactionSelectionMessageViewProps) {
  const { t } = useI18n('reactions');
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
        // Notifier le parent qui gérera la fermeture via exitMode()
        onSelectReaction(emoji);
      }
    } catch (error) {
      console.error('Failed to add reaction:', error);
      // La vue reste ouverte en cas d'erreur pour que l'utilisateur puisse réessayer
    }
  }, [addReaction, isLoading, onSelectReaction]);

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
            "grid w-full h-9 gap-1",
            "grid-cols-8",
            isOwnMessage 
              ? "bg-white/10" 
              : "bg-gray-100 dark:bg-gray-900"
          )}>
            {Object.entries(categories).map(([key, category]) => (
              <TabsTrigger
                key={key}
                value={key}
                className={cn(
                  "text-lg px-1 py-1 h-8 min-w-[40px]",
                  isOwnMessage 
                    ? "data-[state=active]:bg-white/30 data-[state=active]:text-white hover:bg-white/20" 
                    : "data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
                )}
                title={t(`category_${category.key}`)}
              >
                <span className="text-xl">{category.icon}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      {/* Emoji Grid */}
      <ScrollArea className="h-72 px-4 py-3">
        {filteredEmojis.length === 0 ? (
          <div className={cn(
            "flex flex-col items-center justify-center h-full py-12 text-center",
            isOwnMessage ? "text-white/70" : "text-gray-500 dark:text-gray-400"
          )}>
            <Search className="h-12 w-12 mb-3 opacity-50" />
            <p className="text-sm font-medium">{t('noEmojisFound')}</p>
            <p className="text-xs mt-1">{t('tryDifferentSearch')}</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearchQuery('')}
              className={cn(
                "mt-4",
                isOwnMessage 
                  ? "text-white/80 hover:text-white hover:bg-white/20" 
                  : "text-gray-600 hover:text-gray-800 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200"
              )}
            >
              {t('clearSearch')}
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-8 gap-1.5 pb-2">
            {filteredEmojis.map((emoji, index) => {
              const isReacted = userReactions.includes(emoji);
              return (
                <motion.button
                  key={`${emoji}-${index}`}
                  whileHover={{ scale: 1.15, rotate: [0, -8, 8, -8, 0] }}
                  whileTap={{ scale: 0.9 }}
                  transition={{ duration: 0.2, type: "spring", stiffness: 400 }}
                  disabled={isLoading}
                  className={cn(
                    "relative h-11 w-11 flex items-center justify-center rounded-lg text-2xl transition-all duration-200",
                    "focus:outline-none focus:ring-2 focus:ring-offset-1",
                    isReacted
                      ? isOwnMessage
                        ? "bg-white/40 border-2 border-white/70 shadow-md focus:ring-white/50"
                        : "bg-blue-100 border-2 border-blue-500 shadow-md dark:bg-blue-900/60 dark:border-blue-500 focus:ring-blue-400"
                      : hoveredEmoji === emoji 
                        ? isOwnMessage 
                          ? "bg-white/30 border border-white/50" 
                          : "bg-gray-100 border border-gray-300 dark:bg-gray-700 dark:border-gray-600"
                        : isOwnMessage 
                          ? "hover:bg-white/20 border border-transparent" 
                          : "hover:bg-gray-100 border border-transparent dark:hover:bg-gray-700",
                    isLoading && "opacity-40 cursor-not-allowed"
                  )}
                  onClick={() => handleEmojiSelect(emoji)}
                  onMouseEnter={() => setHoveredEmoji(emoji)}
                  onMouseLeave={() => setHoveredEmoji(null)}
                  aria-label={`${isReacted ? t('removeReaction') : t('addReaction')} ${emoji}`}
                  title={isReacted ? t('removeReaction') : t('addReaction')}
                >
                  <span className="leading-none select-none">{emoji}</span>
                  {isReacted && (
                    <motion.div
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: "spring", stiffness: 400, damping: 15 }}
                      className={cn(
                        "absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold shadow-sm",
                        isOwnMessage 
                          ? "bg-white text-blue-600" 
                          : "bg-blue-600 text-white"
                      )}
                    >
                      ✓
                    </motion.div>
                  )}
                  {isLoading && hoveredEmoji === emoji && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-lg backdrop-blur-sm"
                    >
                      <Loader2 className="h-4 w-4 animate-spin text-white" />
                    </motion.div>
                  )}
                </motion.button>
              );
            })}
          </div>
        )}
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