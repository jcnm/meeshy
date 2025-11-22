/**
 * Composant NotificationBell v2
 * Icône cloche avec badge compteur et dropdown
 */

'use client';

import React, { useState } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';
import { NotificationListWithFilters } from './NotificationList';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNotificationsManager } from '@/hooks/use-notifications-v2';
import type { NotificationBellProps } from '@/types/notification-v2';
import { cn } from '@/lib/utils';

/**
 * Composant NotificationBell
 */
export function NotificationBell({
  count,
  onClick,
  showBadge = true,
  animated = true,
  className
}: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const {
    notifications,
    unreadCount,
    isLoading,
    hasMore,
    filters,
    fetchMore,
    markAllAsRead,
    setFilters
  } = useNotificationsManager();

  const displayCount = count ?? unreadCount;
  const unreadNotifications = notifications.filter(n => !n.isRead);

  /**
   * Gère le clic sur la cloche
   */
  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      setIsOpen(!isOpen);
    }
  };

  /**
   * Gère le marquage de toutes les notifications comme lues
   */
  const handleMarkAllAsRead = async () => {
    await markAllAsRead();
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleClick}
          className={cn(
            'relative',
            animated && displayCount > 0 && 'animate-pulse',
            className
          )}
          aria-label={`Notifications (${displayCount} unread)`}
        >
          <Bell className="h-5 w-5" />

          {/* Badge compteur */}
          {showBadge && displayCount > 0 && (
            <span
              className={cn(
                'absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center',
                'rounded-full bg-red-500 text-[10px] font-bold text-white',
                'ring-2 ring-background',
                animated && 'animate-pulse'
              )}
            >
              {displayCount > 99 ? '99+' : displayCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-[400px] p-0"
        sideOffset={8}
      >
        <div className="flex flex-col h-[600px]">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Notifications
            </h3>

            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarkAllAsRead}
                className="text-xs text-blue-600 hover:text-blue-700"
              >
                Mark all as read
              </Button>
            )}
          </div>

          {/* Tabs */}
          <Tabs defaultValue="all" className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="w-full justify-start rounded-none border-b border-gray-200 dark:border-gray-700 bg-transparent px-4">
              <TabsTrigger value="all" className="relative">
                All
                {notifications.length > 0 && (
                  <span className="ml-2 px-1.5 py-0.5 text-[10px] font-semibold bg-gray-200 text-gray-700 rounded-full dark:bg-gray-700 dark:text-gray-200">
                    {notifications.length}
                  </span>
                )}
              </TabsTrigger>

              <TabsTrigger value="unread" className="relative">
                Unread
                {unreadCount > 0 && (
                  <span className="ml-2 px-1.5 py-0.5 text-[10px] font-semibold bg-blue-600 text-white rounded-full">
                    {unreadCount}
                  </span>
                )}
              </TabsTrigger>

              <TabsTrigger value="mentions">
                Mentions
              </TabsTrigger>
            </TabsList>

            {/* Toutes les notifications */}
            <TabsContent value="all" className="flex-1 overflow-hidden m-0">
              <NotificationListWithFilters
                notifications={notifications}
                filters={filters}
                onFilterChange={setFilters}
                onLoadMore={fetchMore}
                hasMore={hasMore}
                isLoading={isLoading}
                emptyMessage="You have no notifications"
                showFilters={false}
              />
            </TabsContent>

            {/* Notifications non lues */}
            <TabsContent value="unread" className="flex-1 overflow-hidden m-0">
              <NotificationListWithFilters
                notifications={unreadNotifications}
                filters={{ ...filters, isRead: false }}
                onFilterChange={setFilters}
                onLoadMore={fetchMore}
                hasMore={hasMore}
                isLoading={isLoading}
                emptyMessage="All caught up! No unread notifications."
                showFilters={false}
              />
            </TabsContent>

            {/* Mentions */}
            <TabsContent value="mentions" className="flex-1 overflow-hidden m-0">
              <NotificationListWithFilters
                notifications={notifications.filter(n => n.type === 'user_mentioned')}
                filters={{ ...filters, type: 'user_mentioned' }}
                onFilterChange={setFilters}
                emptyMessage="No mentions yet"
                showFilters={false}
              />
            </TabsContent>
          </Tabs>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsOpen(false);
                window.location.href = '/notifications';
              }}
              className="w-full text-blue-600 hover:text-blue-700"
            >
              View all notifications
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Composant NotificationBellSimple
 * Version simplifiée sans dropdown (juste le badge)
 */
export function NotificationBellSimple({
  count,
  onClick,
  showBadge = true,
  animated = true,
  className
}: NotificationBellProps) {
  const { unreadCount } = useNotificationsManager();
  const displayCount = count ?? unreadCount;

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      className={cn(
        'relative',
        animated && displayCount > 0 && 'animate-pulse',
        className
      )}
      aria-label={`Notifications (${displayCount} unread)`}
    >
      <Bell className="h-5 w-5" />

      {showBadge && displayCount > 0 && (
        <span
          className={cn(
            'absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center',
            'rounded-full bg-red-500 text-[10px] font-bold text-white',
            'ring-2 ring-background',
            animated && 'animate-pulse'
          )}
        >
          {displayCount > 99 ? '99+' : displayCount}
        </span>
      )}
    </Button>
  );
}

export default NotificationBell;
