'use client';

import { useState, useCallback, useMemo } from 'react';
import { Archive, Users, MessageSquare, Grid3x3 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import type { Conversation, SocketIOUser as User } from '@shared/types';
import type { UserConversationCategory } from '@/types/user-preferences';

interface CommunityCarouselProps {
  conversations: Conversation[];
  categories: UserConversationCategory[];
  selectedFilter: CommunityFilter;
  onFilterChange: (filter: CommunityFilter) => void;
  t: (key: string) => string;
  preferencesMap?: Map<string, UserConversationPreferences>;
}

interface UserConversationPreferences {
  id: string;
  userId: string;
  conversationId: string;
  isPinned: boolean;
  isMuted: boolean;
  isArchived: boolean;
  tags: string[];
  categoryId: string | null;
  orderInCategory: number | null;
  customName: string | null;
  reaction: string | null;
  createdAt: string;
  updatedAt: string;
}

export type CommunityFilter =
  | { type: 'all' }
  | { type: 'category'; categoryId: string }
  | { type: 'archived' };

interface CardData {
  id: string;
  type: 'all' | 'category' | 'archived';
  title: string;
  image?: string;
  memberCount?: number;
  conversationCount: number;
  categoryId?: string;
}

export function CommunityCarousel({
  conversations,
  categories,
  selectedFilter,
  onFilterChange,
  t,
  preferencesMap = new Map()
}: CommunityCarouselProps) {
  // Calculer les données des cartes
  const cards = useMemo((): CardData[] => {
    const result: CardData[] = [];

    // Carte "All" - toutes les conversations sauf archivées
    const nonArchivedCount = conversations.filter(c => {
      const prefs = preferencesMap.get(c.id);
      return !(prefs?.isArchived || false);
    }).length;

    result.push({
      id: 'all',
      type: 'all',
      title: t('conversationsList.all') || 'All',
      conversationCount: nonArchivedCount
    });

    // Cartes des catégories
    categories.forEach(category => {
      const categoryConversations = conversations.filter(c => {
        const prefs = preferencesMap.get(c.id);
        return prefs?.categoryId === category.id && !(prefs?.isArchived || false);
      });

      result.push({
        id: category.id,
        type: 'category',
        title: category.name,
        image: category.icon,
        conversationCount: categoryConversations.length,
        categoryId: category.id
      });
    });

    // Carte "Archived" - conversations archivées
    const archivedCount = conversations.filter(c => {
      const prefs = preferencesMap.get(c.id);
      return prefs?.isArchived || false;
    }).length;

    result.push({
      id: 'archived',
      type: 'archived',
      title: t('conversationsList.archived') || 'Archived',
      conversationCount: archivedCount
    });

    return result;
  }, [conversations, categories, t, preferencesMap]);

  const handleCardClick = useCallback((card: CardData) => {
    if (card.type === 'all') {
      onFilterChange({ type: 'all' });
    } else if (card.type === 'category' && card.categoryId) {
      onFilterChange({ type: 'category', categoryId: card.categoryId });
    } else if (card.type === 'archived') {
      onFilterChange({ type: 'archived' });
    }
  }, [onFilterChange]);

  const isSelected = useCallback((card: CardData): boolean => {
    if (selectedFilter.type === 'all' && card.type === 'all') return true;
    if (selectedFilter.type === 'archived' && card.type === 'archived') return true;
    if (selectedFilter.type === 'category' && card.type === 'category') {
      return selectedFilter.categoryId === card.categoryId;
    }
    return false;
  }, [selectedFilter]);

  return (
    <div className="w-full py-3 px-2 border-b border-border bg-background/50">
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex gap-3 pb-2">
          {cards.map((card) => (
            <CommunityCard
              key={card.id}
              card={card}
              isSelected={isSelected(card)}
              onClick={() => handleCardClick(card)}
            />
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}

interface CommunityCardProps {
  card: CardData;
  isSelected: boolean;
  onClick: () => void;
}

function CommunityCard({ card, isSelected, onClick }: CommunityCardProps) {
  const getCardIcon = () => {
    if (card.type === 'all') return <Grid3x3 className="h-8 w-8" />;
    if (card.type === 'archived') return <Archive className="h-8 w-8" />;
    return <Users className="h-8 w-8" />;
  };

  const getCardGradient = () => {
    if (card.type === 'all') return 'from-primary/20 to-primary/10';
    if (card.type === 'archived') return 'from-muted to-muted/50';
    return 'from-blue-500/20 to-purple-500/10';
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex-shrink-0 w-32 h-24 rounded-xl overflow-hidden transition-all",
        "hover:scale-105 hover:shadow-lg",
        "border-2",
        isSelected
          ? "border-primary shadow-md scale-105"
          : "border-transparent hover:border-primary/50"
      )}
    >
      {/* Background avec image ou gradient */}
      <div className={cn(
        "absolute inset-0 bg-gradient-to-br",
        getCardGradient()
      )}>
        {card.image ? (
          <Avatar className="w-full h-full rounded-none">
            <AvatarImage src={card.image} className="object-cover" />
            <AvatarFallback className="rounded-none">
              {getCardIcon()}
            </AvatarFallback>
          </Avatar>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-primary/60">
            {getCardIcon()}
          </div>
        )}
      </div>

      {/* Overlay avec informations */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex flex-col justify-end p-2">
        <h3 className="text-white font-semibold text-sm truncate mb-1">
          {card.title}
        </h3>
        <div className="flex items-center gap-2 text-xs text-white/80">
          <div className="flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            <span>{card.conversationCount}</span>
          </div>
          {card.memberCount !== undefined && (
            <div className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              <span>{card.memberCount}</span>
            </div>
          )}
        </div>
      </div>

      {/* Indicateur de sélection */}
      {isSelected && (
        <div className="absolute top-2 right-2 h-2 w-2 bg-primary rounded-full animate-pulse" />
      )}
    </button>
  );
}
