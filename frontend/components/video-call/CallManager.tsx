/**
 * CALL MANAGER COMPONENT
 * Orchestrates call lifecycle: incoming calls, joining, leaving, signaling
 */

'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { meeshySocketIOService } from '@/services/meeshy-socketio.service';
import { useCallStore } from '@/stores/call-store';
import { useAuth } from '@/hooks/use-auth';
import { useWebRTCP2P } from '@/hooks/use-webrtc-p2p';
import { CallNotification } from './CallNotification';
import { CallInterface } from './CallInterface';
import { logger } from '@/utils/logger';
import { toast } from 'sonner';
import type {
  CallInitiatedEvent,
  CallParticipantJoinedEvent,
  CallParticipantLeftEvent,
  CallEndedEvent,
  CallMediaToggleEvent,
  CallError,
} from '@shared/types/video-call';

const CALL_TIMEOUT_MS = 30000; // 30 seconds

export function CallManager() {
  const router = useRouter();
  const { user } = useAuth();
  const {
    currentCall,
    isInCall,
    setCurrentCall,
    setInCall,
    addParticipant,
    removeParticipant,
    updateParticipant,
    reset,
    removeRemoteStream,
    removePeerConnection,
  } = useCallStore();

  const [incomingCall, setIncomingCall] = useState<CallInitiatedEvent | null>(null);
  const callTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Clear call timeout
   */
  const clearCallTimeout = useCallback(() => {
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
      logger.debug('[CallManager]', 'Call timeout cleared');
    }
  }, []);

  /**
   * Start call timeout - auto-cleanup after 30s if no one joins
   */
  const startCallTimeout = useCallback((callId: string) => {
    // Clear any existing timeout
    clearCallTimeout();

    // Start new timeout
    callTimeoutRef.current = setTimeout(() => {
      const { currentCall } = useCallStore.getState();

      // Only cleanup if call is still in 'initiated' state (no one joined)
      if (currentCall?.id === callId && currentCall?.status === 'initiated') {
        logger.warn('[CallManager]', `Call timeout - no answer after ${CALL_TIMEOUT_MS/1000}s`);

        // Emit leave event to server
        const socket = meeshySocketIOService.getSocket();
        if (socket) {
          (socket as any).emit('call:leave', { callId });
        }

        // Reset local state
        reset();
        setIncomingCall(null);

        toast.info('Call ended - no answer');
      }
    }, CALL_TIMEOUT_MS);

    logger.debug('[CallManager]', `Call timeout started - ${CALL_TIMEOUT_MS/1000}s`);
  }, [clearCallTimeout, reset]);

  /**
   * Handle incoming call
   */
  const handleIncomingCall = useCallback(async (event: CallInitiatedEvent) => {
    console.log('🚨🚨🚨 [CallManager] INCOMING CALL RECEIVED 🚨🚨🚨', event);
    console.log('🚨 [CallManager] User state:', { hasUser: !!user, userId: user?.id });

    // Wait for user to be loaded
    if (!user) {
      console.error('❌ [CallManager] User not loaded yet - ignoring call:initiated');
      logger.warn('[CallManager]', 'User not loaded yet - ignoring call:initiated');
      toast.error('Cannot receive call: User not loaded');
      return;
    }

    console.log('✅ [CallManager] User loaded, processing call');
    logger.info('[CallManager]', 'Incoming call - callId: ' + event.callId, {
      callId: event.callId,
      initiatorId: event.initiator.userId,
      currentUserId: user.id,
      conversationId: event.conversationId
    });

    // Check if current user is the initiator
    const isInitiator = user.id === event.initiator.userId;

    if (isInitiator) {
      // I am the initiator - check if already in call to avoid duplicate
      if (isInCall && currentCall?.id === event.callId) {
        logger.debug('[CallManager]', 'Already in call - ignoring duplicate call:initiated');
        return;
      }

      // I am the initiator - automatically start the call
      logger.info('[CallManager]', 'I am the initiator - auto-starting call');

      // Set call as current
      setCurrentCall({
        id: event.callId,
        conversationId: event.conversationId,
        mode: event.mode,
        status: 'initiated',
        initiatorId: event.initiator.userId,
        startedAt: new Date(),
        participants: event.participants,
      });

      // Set call as active - CallInterface will initialize local stream
      setInCall(true);

      // Start timeout to auto-cleanup if no one joins
      startCallTimeout(event.callId);

      toast.success('Call started - waiting for participants...');
    } else {
      // I am being called - show notification
      logger.info('[CallManager]', 'Incoming call from ' + event.initiator.username);
      setIncomingCall(event);

      // Start timeout for incoming call too
      startCallTimeout(event.callId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, setCurrentCall, setInCall, isInCall, currentCall, startCallTimeout]);

  /**
   * Handle participant joined
   */
  const handleParticipantJoined = useCallback(
    (event: CallParticipantJoinedEvent) => {
      logger.info('[CallManager]', 'Participant joined - callId: ' + event.callId + ', participantId: ' + event.participant.id);

      // Clear timeout since someone joined
      clearCallTimeout();

      // Add participant to call
      addParticipant(event.participant);

      // Update call status to 'active' if it was 'initiated'
      const { currentCall } = useCallStore.getState();
      if (currentCall && currentCall.status === 'initiated') {
        setCurrentCall({
          ...currentCall,
          status: 'active',
        });
      }

      // Note: CallInterface will handle creating the WebRTC offer
      // based on currentCall.initiatorId check

      toast.success(`${event.participant.username || 'Someone'} joined the call`);
    },
    [addParticipant, setCurrentCall, clearCallTimeout]
  );

  /**
   * Handle participant left
   */
  const handleParticipantLeft = useCallback(
    (event: CallParticipantLeftEvent) => {
      logger.info('[CallManager]', 'Participant left - callId: ' + event.callId + ', participantId: ' + event.participantId);

      // Remove participant from call
      removeParticipant(event.participantId);

      // Remove their stream and peer connection
      removeRemoteStream(event.participantId);
      removePeerConnection(event.participantId);

      toast.info('Participant left the call');
    },
    [removeParticipant, removeRemoteStream, removePeerConnection]
  );

  /**
   * Handle call ended
   */
  const handleCallEnded = useCallback(
    (event: CallEndedEvent) => {
      logger.info('[CallManager]', 'Call ended - callId: ' + event.callId + ', duration: ' + event.duration);

      // Clear timeout
      clearCallTimeout();

      // Reset call state - CallInterface will handle WebRTC cleanup
      reset();

      // Clear incoming call notification
      setIncomingCall(null);

      toast.info('Call ended');
    },
    [reset, clearCallTimeout]
  );

  /**
   * Handle media toggle (remote participant)
   */
  const handleMediaToggle = useCallback(
    (event: CallMediaToggleEvent) => {
      logger.debug('[CallManager]', 'Media toggle - participantId: ' + event.participantId + ', type: ' + event.mediaType + ', enabled: ' + event.enabled);

      // Update participant state
      if (event.mediaType === 'audio') {
        updateParticipant(event.participantId, {
          isAudioEnabled: event.enabled,
        });
      } else if (event.mediaType === 'video') {
        updateParticipant(event.participantId, {
          isVideoEnabled: event.enabled,
        });
      }
    },
    [updateParticipant]
  );

  /**
   * Handle call error
   */
  const handleCallError = useCallback((error: CallError) => {
    logger.error('[CallManager]', 'Call error: ' + error.message);
    toast.error(error.message || 'Call error occurred');
  }, []);

  /**
   * Accept incoming call
   */
  const handleAcceptCall = useCallback(async () => {
    if (!incomingCall) return;

    logger.debug('[CallManager]', 'Accepting call - callId: ' + incomingCall.callId);

    try {
      // Clear timeout since we're accepting
      clearCallTimeout();

      // Stop ringtone immediately
      import('@/utils/ringtone').then(({ stopRingtone }) => {
        stopRingtone();
      });

      // Join call via Socket.IO - CallInterface will initialize local stream
      const socket = meeshySocketIOService.getSocket();
      if (!socket) {
        throw new Error('No socket connection');
      }

      (socket as any).emit('call:join', {
        callId: incomingCall.callId,
        settings: {
          audioEnabled: true,
          videoEnabled: true,
        },
      });

      // Create call session in store
      setCurrentCall({
        id: incomingCall.callId,
        conversationId: incomingCall.conversationId,
        mode: incomingCall.mode,
        status: 'active',
        initiatorId: incomingCall.initiator.userId,
        startedAt: new Date(),
        participants: incomingCall.participants,
      });

      // Set call as active
      setInCall(true);

      // Clear incoming call notification
      setIncomingCall(null);

      logger.info('[CallManager]', 'Call accepted - callId: ' + incomingCall.callId);
    } catch (error: any) {
      logger.error('[CallManager]', 'Failed to accept call: ' + (error?.message || 'Unknown error'));
      toast.error('Failed to join call');
      setIncomingCall(null);
    }
  }, [incomingCall, setCurrentCall, setInCall, clearCallTimeout]);

  /**
   * Reject incoming call
   */
  const handleRejectCall = useCallback(() => {
    if (!incomingCall) return;

    logger.debug('[CallManager]', 'Rejecting call - callId: ' + incomingCall.callId);

    // Clear timeout since we're rejecting
    clearCallTimeout();

    // Stop ringtone immediately
    import('@/utils/ringtone').then(({ stopRingtone }) => {
      stopRingtone();
    });

    // Emit leave event
    const socket = meeshySocketIOService.getSocket();
    if (socket) {
      (socket as any).emit('call:leave', {
        callId: incomingCall.callId,
      });
    }

    // Clear notification
    setIncomingCall(null);

    toast.info('Call declined');
  }, [incomingCall, clearCallTimeout]);

  /**
   * Setup Socket.IO listeners
   * Poll for socket availability and re-setup listeners when it becomes available
   */
  useEffect(() => {
    let isSubscribed = true;
    let checkInterval: NodeJS.Timeout;

    const setupListeners = () => {
      // Wait for user to be loaded before setting up listeners
      if (!user || !user.id) {
        logger.warn('[CallManager]', 'User not loaded yet, waiting before setting up listeners...');
        return false;
      }

      const socket = meeshySocketIOService.getSocket();

      if (!socket) {
        logger.warn('[CallManager]', 'No socket available, will retry...');
        return false;
      }

      if (!socket.connected) {
        logger.warn('[CallManager]', 'Socket not connected, will retry...');
        return false;
      }

      console.log('🎧 [CallManager] Setting up Socket.IO call listeners', {
        socketId: socket.id,
        connected: socket.connected,
        userId: user.id
      });
      logger.info('[CallManager]', 'Setting up Socket.IO listeners', {
        socketId: socket.id
      });

      // Remove any existing listeners first to avoid duplicates
      (socket as any).off('call:initiated', handleIncomingCall);
      (socket as any).off('call:participant-joined', handleParticipantJoined);
      (socket as any).off('call:participant-left', handleParticipantLeft);
      (socket as any).off('call:ended', handleCallEnded);
      (socket as any).off('call:media-toggled', handleMediaToggle);
      (socket as any).off('call:error', handleCallError);

      // Listen for call events
      (socket as any).on('call:initiated', handleIncomingCall);
      (socket as any).on('call:participant-joined', handleParticipantJoined);
      (socket as any).on('call:participant-left', handleParticipantLeft);
      (socket as any).on('call:ended', handleCallEnded);
      (socket as any).on('call:media-toggled', handleMediaToggle);
      (socket as any).on('call:error', handleCallError);

      console.log('✅ [CallManager] All call listeners registered');
      logger.info('[CallManager]', '✅ All call listeners registered');

      return true;
    };

    // Try to setup listeners immediately
    const success = setupListeners();

    // If not successful, poll every second until socket is available
    if (!success && isSubscribed) {
      checkInterval = setInterval(() => {
        if (isSubscribed && setupListeners()) {
          clearInterval(checkInterval);
        }
      }, 1000);
    }

    return () => {
      isSubscribed = false;
      if (checkInterval) {
        clearInterval(checkInterval);
      }

      // Cleanup listeners
      const socket = meeshySocketIOService.getSocket();
      if (socket) {
        logger.debug('[CallManager]', 'Cleaning up Socket.IO listeners');
        (socket as any).off('call:initiated', handleIncomingCall);
        (socket as any).off('call:participant-joined', handleParticipantJoined);
        (socket as any).off('call:participant-left', handleParticipantLeft);
        (socket as any).off('call:ended', handleCallEnded);
        (socket as any).off('call:media-toggled', handleMediaToggle);
        (socket as any).off('call:error', handleCallError);
      }
    };
  }, [
    user,
    handleIncomingCall,
    handleParticipantJoined,
    handleParticipantLeft,
    handleCallEnded,
    handleMediaToggle,
    handleCallError,
  ]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      // Clear timeout on unmount
      clearCallTimeout();

      if (isInCall) {
        logger.debug('[CallManager]', 'Cleaning up on unmount');
        reset();
        // CallInterface will handle WebRTC cleanup
      }
    };
  }, [isInCall, reset, clearCallTimeout]);

  return (
    <>
      {/* Incoming Call Notification */}
      {incomingCall && (
        <CallNotification
          call={incomingCall}
          onAccept={handleAcceptCall}
          onReject={handleRejectCall}
        />
      )}

      {/* Active Call Interface */}
      {isInCall && currentCall && <CallInterface callId={currentCall.id} />}
    </>
  );
}
