'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, MessageSquare, PhoneMissed, Settings, Users } from '@/lib/icons';
import type { LucideIcon } from 'lucide-react';

export type NotificationType = 'all' | 'new_message' | 'missed_call' | 'system' | 'conversation';

interface NotificationFiltersProps {
  selectedType: NotificationType;
  onTypeChange: (type: NotificationType) => void;
  counts?: {
    all: number;
    new_message: number;
    missed_call: number;
    system: number;
    conversation: number;
  };
}

export function NotificationFilters({ selectedType, onTypeChange, counts }: NotificationFiltersProps) {
  const filters: { label: string; value: NotificationType; Icon: LucideIcon }[] = [
    { label: 'Toutes', value: 'all', Icon: Bell },
    { label: 'Messages', value: 'new_message', Icon: MessageSquare },
    { label: 'Appels manqués', value: 'missed_call', Icon: PhoneMissed },
    { label: 'Système', value: 'system', Icon: Settings },
    { label: 'Conversations', value: 'conversation', Icon: Users },
  ];

  return (
    <div className="flex flex-wrap gap-2 mb-6">
      {filters.map((filter) => {
        const { Icon } = filter;
        return (
          <Button
            key={filter.value}
            variant={selectedType === filter.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => onTypeChange(filter.value)}
            className="flex items-center gap-2"
          >
            <Icon className="h-4 w-4" />
            <span>{filter.label}</span>
            {counts && counts[filter.value] > 0 && (
              <Badge variant="secondary" className="ml-1">
                {counts[filter.value]}
              </Badge>
            )}
          </Button>
        );
      })}
    </div>
  );
}
