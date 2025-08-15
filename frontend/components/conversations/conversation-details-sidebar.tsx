'use client';

import { useState, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Users,
  MessageSquare,
  Calendar,
  Globe,
  Settings,
  UserPlus,
  X,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Conversation, User, Message } from '@/types';
import { conversationsService } from '@/services/conversations.service';
import { getLanguageDisplayName, getLanguageFlag } from '@/utils/language-utils';

interface ConversationDetailsSidebarProps {
  conversation: Conversation;
  currentUser: User;
  messages: Message[];
  isOpen: boolean;
  onClose: () => void;
}

interface ConversationStats {
  totalMessages: number;
  participantsCount: number;
  messagesPerLanguage: Record<string, number>;
  participantsPerLanguage: Record<string, number>;
  createdAt: Date;
  lastActivity: Date;
}

export function ConversationDetailsSidebar({
  conversation,
  currentUser,
  messages,
  isOpen,
  onClose
}: ConversationDetailsSidebarProps) {
  const [stats, setStats] = useState<ConversationStats | null>(null);
  const [isParticipantsExpanded, setIsParticipantsExpanded] = useState(true);
  const [isStatsExpanded, setIsStatsExpanded] = useState(true);

  // Calculer les statistiques à partir des messages et conversation
  useEffect(() => {
    const calculateStats = () => {
      const messagesPerLanguage: Record<string, number> = {};
      const participantsPerLanguage: Record<string, number> = {};

      // Compter les messages par langue
      messages.forEach(message => {
        const lang = message.originalLanguage || 'fr';
        messagesPerLanguage[lang] = (messagesPerLanguage[lang] || 0) + 1;
      });

      // Compter les participants par langue système
      if (conversation.participants) {
        conversation.participants.forEach(participant => {
          const lang = participant.user?.systemLanguage || 'fr';
          participantsPerLanguage[lang] = (participantsPerLanguage[lang] || 0) + 1;
        });
      }

      const conversationStats: ConversationStats = {
        totalMessages: messages.length,
        participantsCount: conversation.participants?.length || 0,
        messagesPerLanguage,
        participantsPerLanguage,
        createdAt: new Date(conversation.createdAt),
        lastActivity: messages.length > 0 
          ? new Date(Math.max(...messages.map(m => new Date(m.createdAt).getTime())))
          : new Date(conversation.createdAt)
      };

      setStats(conversationStats);
    };

    calculateStats();
  }, [conversation, messages]);

  const getConversationDisplayName = (conv: Conversation) => {
    if (conv.isGroup) {
      return conv.title || 'Conversation de groupe';
    }
    
    const otherParticipant = conv.participants?.find(p => p.userId !== currentUser.id);
    if (otherParticipant && otherParticipant.user) {
      return `${otherParticipant.user.firstName} ${otherParticipant.user.lastName}`;
    }
    
    return 'Conversation';
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-80 bg-white/95 backdrop-blur-lg border-l border-border/30 z-50 shadow-xl">
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/30">
          <h2 className="text-lg font-semibold">Détails de la conversation</h2>
          <Button
            size="sm"
            variant="ghost"
            onClick={onClose}
            className="h-8 w-8 p-0 rounded-full"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-6">
            {/* Info principale */}
            <div className="text-center space-y-3">
              <Avatar className="h-16 w-16 mx-auto ring-2 ring-primary/20">
                <AvatarImage />
                <AvatarFallback className="bg-primary/20 text-primary font-bold text-lg">
                  {conversation.isGroup ? (
                    <Users className="h-8 w-8" />
                  ) : (
                    getConversationDisplayName(conversation).charAt(0).toUpperCase()
                  )}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-semibold text-lg">{getConversationDisplayName(conversation)}</h3>
                <p className="text-sm text-muted-foreground">
                  {conversation.isGroup ? 'Conversation de groupe' : 'Conversation privée'}
                </p>
              </div>
            </div>

            <Separator />

            {/* Participants */}
            <div>
              <Button
                variant="ghost"
                onClick={() => setIsParticipantsExpanded(!isParticipantsExpanded)}
                className="w-full justify-between p-0 h-auto font-semibold"
              >
                <div className="flex items-center">
                  <Users className="h-4 w-4 mr-2" />
                  Participants ({stats?.participantsCount || 0})
                </div>
                {isParticipantsExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
              
              {isParticipantsExpanded && (
                <div className="mt-3 space-y-2">
                  {conversation.participants?.map((participant) => (
                    <div key={participant.userId} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50">
                      <Avatar className="h-8 w-8">
                        <AvatarImage />
                        <AvatarFallback className="text-xs">
                          {participant.user?.firstName?.charAt(0)}{participant.user?.lastName?.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {participant.user?.firstName} {participant.user?.lastName}
                        </p>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {getLanguageFlag(participant.user?.systemLanguage || 'fr')} {getLanguageDisplayName(participant.user?.systemLanguage || 'fr')}
                          </span>
                          {participant.user?.isOnline && (
                            <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* Statistiques */}
            <div>
              <Button
                variant="ghost"
                onClick={() => setIsStatsExpanded(!isStatsExpanded)}
                className="w-full justify-between p-0 h-auto font-semibold"
              >
                <div className="flex items-center">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Statistiques
                </div>
                {isStatsExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
              
              {isStatsExpanded && stats && (
                <div className="mt-3 space-y-4">
                  {/* Messages totaux */}
                  <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                    <span className="text-sm font-medium">Messages totaux</span>
                    <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                      {stats.totalMessages}
                    </Badge>
                  </div>

                  {/* Messages par langue */}
                  {Object.keys(stats.messagesPerLanguage).length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-2">Messages par langue</h4>
                      <div className="space-y-2">
                        {Object.entries(stats.messagesPerLanguage)
                          .sort(([,a], [,b]) => b - a)
                          .map(([lang, count]) => (
                          <div key={lang} className="flex justify-between items-center text-sm">
                            <div className="flex items-center gap-2">
                              <span>{getLanguageFlag(lang)}</span>
                              <span>{getLanguageDisplayName(lang)}</span>
                            </div>
                            <Badge variant="outline">{count}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Participants par langue */}
                  {Object.keys(stats.participantsPerLanguage).length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-2">Participants par langue</h4>
                      <div className="space-y-2">
                        {Object.entries(stats.participantsPerLanguage)
                          .sort(([,a], [,b]) => b - a)
                          .map(([lang, count]) => (
                          <div key={lang} className="flex justify-between items-center text-sm">
                            <div className="flex items-center gap-2">
                              <span>{getLanguageFlag(lang)}</span>
                              <span>{getLanguageDisplayName(lang)}</span>
                            </div>
                            <Badge variant="outline">{count}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <Separator />

            {/* Informations générales */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold flex items-center">
                <Calendar className="h-4 w-4 mr-2" />
                Informations
              </h4>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Créée le</span>
                  <span>{stats ? formatDate(stats.createdAt) : '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Dernière activité</span>
                  <span>{stats ? formatDate(stats.lastActivity) : '-'}</span>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* Actions */}
        <div className="p-4 border-t border-border/30 space-y-2">
          {conversation.isGroup && (
            <Button variant="outline" size="sm" className="w-full">
              <UserPlus className="h-4 w-4 mr-2" />
              Ajouter un participant
            </Button>
          )}
          <Button variant="outline" size="sm" className="w-full">
            <Settings className="h-4 w-4 mr-2" />
            Paramètres de conversation
          </Button>
        </div>
      </div>
    </div>
  );
}
