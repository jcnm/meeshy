'use client';

import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useMessageReactions } from '@/hooks/use-message-reactions';
import { useI18n } from '@/hooks/use-i18n';
import type { ReactionAggregation } from '@shared/types/reaction';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface MessageReactionsProps {
  messageId: string;
  conversationId: string;
  currentUserId?: string;
  currentAnonymousUserId?: string;
  isAnonymous?: boolean;
  className?: string;
  maxVisibleReactions?: number;
  showAddButton?: boolean;
  onAddReactionClick?: () => void;
}

/**
 * Composant MessageReactions
 * 
 * Affiche les réactions d'un message de manière élégante et responsive.
 * Features:
 * - Groupement des réactions par emoji avec compteur
 * - Highlight de la réaction de l'utilisateur actuel
 * - Animations d'apparition/disparition (Framer Motion)
 * - Tooltip avec liste des utilisateurs ayant réagi
 * - Click pour toggle la réaction
 * - Bouton "+" pour ajouter une nouvelle réaction
 * - Responsive (stack sur mobile, inline sur desktop)
 */
export const MessageReactions: React.FC<MessageReactionsProps> = ({
  messageId,
  conversationId,
  currentUserId,
  currentAnonymousUserId,
  isAnonymous = false,
  className,
  maxVisibleReactions = 10,
  showAddButton = true,
  onAddReactionClick,
}) => {
  const { t } = useI18n('reactions');
  const [previousReactionsCount, setPreviousReactionsCount] = React.useState(0);
  const [isNewReaction, setIsNewReaction] = React.useState(false);
  const [reactionCounts, setReactionCounts] = React.useState<Record<string, number>>({});
  const [animatingEmojis, setAnimatingEmojis] = React.useState<Set<string>>(new Set());
  
  const { 
    reactions, 
    toggleReaction, 
    isLoading,
    userReactions
  } = useMessageReactions({
    messageId,
    currentUserId: isAnonymous ? currentAnonymousUserId : currentUserId,
    isAnonymous
  });

  // Limiter le nombre de réactions affichées
  const visibleReactions = useMemo(() => {
    return reactions.slice(0, maxVisibleReactions);
  }, [reactions, maxVisibleReactions]);

  // Détecter les nouvelles réactions pour l'animation
  React.useEffect(() => {
    const currentCount = reactions.reduce((sum, r) => sum + r.count, 0);
    
    if (currentCount > previousReactionsCount && previousReactionsCount > 0) {
      console.log('✨ [MessageReactions] Nouvelle réaction détectée!', {
        previous: previousReactionsCount,
        current: currentCount
      });
      setIsNewReaction(true);
      
      // Arrêter l'animation après 600ms
      const timer = setTimeout(() => {
        setIsNewReaction(false);
      }, 600);
      
      return () => clearTimeout(timer);
    }
    
    setPreviousReactionsCount(currentCount);
  }, [reactions, previousReactionsCount]);

  // Tracker les changements de compteur par emoji pour animer
  React.useEffect(() => {
    const newCounts: Record<string, number> = {};
    const newAnimating = new Set<string>();
    
    reactions.forEach(reaction => {
      const prevCount = reactionCounts[reaction.emoji] || 0;
      newCounts[reaction.emoji] = reaction.count;
      
      // Si le compteur a augmenté, animer cet emoji
      if (reaction.count > prevCount && prevCount > 0) {
        console.log('🎯 [MessageReactions] Compteur augmenté pour:', reaction.emoji, {
          from: prevCount,
          to: reaction.count
        });
        newAnimating.add(reaction.emoji);
        
        // Arrêter l'animation après 500ms
        setTimeout(() => {
          setAnimatingEmojis(prev => {
            const next = new Set(prev);
            next.delete(reaction.emoji);
            return next;
          });
        }, 500);
      }
    });
    
    setReactionCounts(newCounts);
    if (newAnimating.size > 0) {
      setAnimatingEmojis(prev => new Set([...prev, ...newAnimating]));
    }
  }, [reactions]);

  const handleReactionClick = async (emoji: string) => {
    if (isLoading) return;
    await toggleReaction(emoji);
  };

  // DEBUG: Log pour diagnostiquer
  console.log('[MessageReactions] Rendu:', {
    messageId,
    reactionsCount: reactions.length,
    visibleReactionsCount: visibleReactions.length,
    showAddButton,
    isLoading,
    userReactions
  });

  // Ne pas retourner null même si vide - le hook doit rester actif pour écouter les événements temps réel
  // Si pas de réactions, on rend un container vide mais présent
  if (visibleReactions.length === 0 && !showAddButton) {
    console.log('[MessageReactions] Aucune réaction, mais container actif pour temps-réel');
    return (
      <TooltipProvider>
        <div className={cn('flex flex-wrap items-end gap-1 min-h-[1px]', className)} />
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <motion.div
        animate={isNewReaction ? {
          scale: [1, 1.05, 1],
          transition: {
            duration: 0.3,
            ease: "easeInOut"
          }
        } : {}}
        className={cn(
          'flex flex-wrap items-end gap-1',
          className
        )}
      >
        <AnimatePresence mode="popLayout">
          {visibleReactions.map((reaction) => {
            const hasUserReacted = userReactions.includes(reaction.emoji);
            
            return (
              <Tooltip key={reaction.emoji}>
                <TooltipTrigger asChild>
                  <motion.button
                    layout
                    initial={{ scale: 0, opacity: 0, y: 10 }}
                    animate={{ 
                      scale: 1, 
                      opacity: 1, 
                      y: 0,
                    }}
                    exit={{ scale: 0, opacity: 0, y: 10 }}
                    whileHover={{ scale: 1.15, y: -4 }}
                    whileTap={{ scale: 0.9 }}
                    transition={{
                      layout: {
                        type: 'spring',
                        stiffness: 500,
                        damping: 30,
                      },
                      default: {
                        type: 'spring',
                        stiffness: 400,
                        damping: 20,
                      }
                    }}
                    onClick={() => handleReactionClick(reaction.emoji)}
                    disabled={isLoading}
                    className={cn(
                      'relative flex flex-col items-center justify-center',
                      'w-7 h-7 rounded-full',
                      'bg-white dark:bg-gray-800',
                      'border shadow-md',
                      'transition-all duration-200',
                      'disabled:opacity-50 disabled:cursor-not-allowed',
                      'hover:shadow-lg',
                      hasUserReacted
                        ? 'border-primary ring-1 ring-primary/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-primary/50'
                    )}
                  >
                    {/* Emoji */}
                    <motion.span 
                      className="text-sm leading-none"
                      key={`emoji-${reaction.emoji}`}
                      animate={
                        animatingEmojis.has(reaction.emoji)
                          ? {
                              scale: [1, 1.3, 1],
                              rotate: [0, -15, 15, -15, 0],
                            }
                          : hasUserReacted 
                            ? { scale: 1.1 }
                            : { scale: 1 }
                      }
                      transition={{
                        duration: 0.5,
                        ease: "easeInOut"
                      }}
                    >
                      {reaction.emoji}
                    </motion.span>
                    
                    {/* Badge avec le nombre - au-dessus de l'emoji */}
                    <motion.span 
                      key={`count-${reaction.emoji}-${reaction.count}`}
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={
                        animatingEmojis.has(reaction.emoji)
                          ? { 
                              scale: [1, 1.4, 1],
                              opacity: 1,
                            }
                          : { scale: 1, opacity: 1 }
                      }
                      transition={{
                        type: 'spring',
                        stiffness: 600,
                        damping: 20,
                        duration: 0.4,
                      }}
                      className={cn(
                        'absolute -top-0.5 -right-0.5',
                        'flex items-center justify-center',
                        'min-w-[14px] h-[14px] px-0.5',
                        'rounded-full text-[8px] font-bold',
                        'shadow-sm border',
                        animatingEmojis.has(reaction.emoji)
                          ? 'ring-2 ring-primary/50 ring-offset-1'
                          : '',
                        hasUserReacted
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600'
                      )}
                    >
                      {reaction.count}
                    </motion.span>
                  </motion.button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <div className="text-xs">
                    {hasUserReacted ? (
                      <p className="font-medium mb-1">
                        {t('youAndOthers', { count: reaction.count - 1 })}
                      </p>
                    ) : (
                      <p className="font-medium mb-1">
                        {t('peopleReacted', { count: reaction.count })}
                      </p>
                    )}
                    <p className="text-muted-foreground">
                      {hasUserReacted ? t('clickToRemove') : t('clickToReact')}
                    </p>
                  </div>
                </TooltipContent>
              </Tooltip>
            );
          })}

          {showAddButton && (
            <motion.button
              key="add-reaction"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              whileHover={{ scale: 1.1, rotate: 90 }}
              whileTap={{ scale: 0.95 }}
              transition={{
                type: 'spring',
                stiffness: 500,
                damping: 30,
              }}
              onClick={onAddReactionClick}
              className={cn(
                'flex items-center justify-center',
                'w-7 h-7 rounded-full',
                'bg-secondary/50 border border-border',
                'text-muted-foreground hover:text-foreground',
                'hover:bg-secondary hover:border-primary/50',
                'hover:shadow-sm active:shadow-none',
                'transition-all duration-200'
              )}
              aria-label={t('add')}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </motion.button>
          )}
        </AnimatePresence>
      </motion.div>
    </TooltipProvider>
  );
};

export default MessageReactions;
