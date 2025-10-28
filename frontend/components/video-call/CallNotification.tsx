/**
 * CALL NOTIFICATION COMPONENT
 * Displays incoming call notification with accept/reject buttons
 */

'use client';

import React from 'react';
import { Phone, PhoneOff, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CallInitiatedEvent } from '@shared/types/video-call';

interface CallNotificationProps {
  call: CallInitiatedEvent;
  onAccept: () => void;
  onReject: () => void;
}

export function CallNotification({ call, onAccept, onReject }: CallNotificationProps) {
  return (
    <div
      className="fixed top-4 right-4 z-50 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 min-w-[320px] animate-in slide-in-from-top-5"
      role="alertdialog"
      aria-labelledby="call-notification-title"
      aria-describedby="call-notification-description"
    >
      <div className="flex items-center gap-4 mb-4">
        <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
          <Video className="w-6 h-6 text-green-600 dark:text-green-400 animate-pulse" />
        </div>
        <div className="flex-1">
          <h3
            id="call-notification-title"
            className="font-bold text-lg text-gray-900 dark:text-white"
          >
            Incoming Call
          </h3>
          <p
            id="call-notification-description"
            className="text-sm text-gray-600 dark:text-gray-300"
          >
            {call.initiator.username} is calling...
          </p>
        </div>
      </div>

      <div className="flex gap-3">
        <Button
          variant="default"
          className="flex-1 bg-green-600 hover:bg-green-700 text-white"
          onClick={onAccept}
          aria-label="Accept call"
        >
          <Phone className="w-4 h-4" />
          Accept
        </Button>
        <Button
          variant="destructive"
          className="flex-1"
          onClick={onReject}
          aria-label="Reject call"
        >
          <PhoneOff className="w-4 h-4" />
          Reject
        </Button>
      </div>
    </div>
  );
}
