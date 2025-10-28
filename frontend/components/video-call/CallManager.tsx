/**
 * CALL MANAGER COMPONENT
 * Orchestrates call lifecycle: incoming calls, joining, leaving, signaling
 */

'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { meeshySocketIOService } from '@/services/meeshy-socketio.service';
import { useCallStore } from '@/stores/call-store';
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

export function CallManager() {
  const router = useRouter();
  const {
    currentCall,
    isInCall,
    setCurrentCall,
    addParticipant,
    removeParticipant,
    updateParticipant,
    reset,
    removeRemoteStream,
    removePeerConnection,
  } = useCallStore();

  const [incomingCall, setIncomingCall] = useState<CallInitiatedEvent | null>(null);

  // Get WebRTC hook for current call
  const webrtcHook = useWebRTCP2P({
    callId: currentCall?.id || '',
    onError: (error) => {
      logger.error('[CallManager] WebRTC error: ' + error.message);
    },
  });

  /**
   * Handle incoming call
   */
  const handleIncomingCall = useCallback((event: CallInitiatedEvent) => {
    logger.info('[CallManager] Incoming call - callId: ' + event.callId);

    // Show notification
    setIncomingCall(event);

    // Play ringtone (optional - can be added later)
    // playRingtone();
  }, []);

  /**
   * Handle participant joined
   */
  const handleParticipantJoined = useCallback(
    (event: CallParticipantJoinedEvent) => {
      logger.info('[CallManager] Participant joined - callId: ' + event.callId + ', participantId: ' + event.participant.id);

      // Add participant to call
      addParticipant(event.participant);

      // If this is the first remote participant and we're the initiator, create offer
      if (currentCall?.initiatorId === event.participant.userId) {
        // Wait a bit for the other side to be ready
        setTimeout(() => {
          webrtcHook.createOffer(event.participant.id);
        }, 500);
      }

      toast.success(`${event.participant.username || 'Someone'} joined the call`);
    },
    [addParticipant, currentCall, webrtcHook]
  );

  /**
   * Handle participant left
   */
  const handleParticipantLeft = useCallback(
    (event: CallParticipantLeftEvent) => {
      logger.info('[CallManager] Participant left - callId: ' + event.callId + ', participantId: ' + event.participantId);

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
      logger.info('[CallManager] Call ended - callId: ' + event.callId + ', duration: ' + event.duration);

      // Cleanup
      webrtcHook.cleanup();
      reset();

      // Clear incoming call notification
      setIncomingCall(null);

      toast.info('Call ended');
    },
    [reset, webrtcHook]
  );

  /**
   * Handle media toggle (remote participant)
   */
  const handleMediaToggle = useCallback(
    (event: CallMediaToggleEvent) => {
      logger.debug('[CallManager] Media toggle - participantId: ' + event.participantId + ', type: ' + event.mediaType + ', enabled: ' + event.enabled);

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
    logger.error('[CallManager] Call error: ' + error.message);
    toast.error(error.message || 'Call error occurred');
  }, []);

  /**
   * Accept incoming call
   */
  const handleAcceptCall = useCallback(async () => {
    if (!incomingCall) return;

    logger.debug('[CallManager] Accepting call - callId: ' + incomingCall.callId);

    try {
      // Stop ringtone immediately
      import('@/utils/ringtone').then(({ stopRingtone }) => {
        stopRingtone();
      });

      // Initialize local stream first
      await webrtcHook.initializeLocalStream();

      // Join call via Socket.IO
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
        conversationId: '',
        mode: incomingCall.mode,
        status: 'active',
        initiatorId: incomingCall.initiator.userId,
        startedAt: new Date(),
        participants: incomingCall.participants,
      });

      // Clear incoming call notification
      setIncomingCall(null);

      logger.info('[CallManager] Call accepted - callId: ' + incomingCall.callId);
    } catch (error: any) {
      logger.error('[CallManager] Failed to accept call: ' + (error?.message || 'Unknown error'));
      toast.error('Failed to join call');
      setIncomingCall(null);
    }
  }, [incomingCall, webrtcHook, setCurrentCall]);

  /**
   * Reject incoming call
   */
  const handleRejectCall = useCallback(() => {
    if (!incomingCall) return;

    logger.debug('[CallManager] Rejecting call - callId: ' + incomingCall.callId);

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
  }, [incomingCall]);

  /**
   * Setup Socket.IO listeners
   */
  useEffect(() => {
    const socket = meeshySocketIOService.getSocket();
    if (!socket) {
      logger.warn('[CallManager] No socket available');
      return;
    }

    logger.debug('[CallManager] Setting up Socket.IO listeners');

    // Listen for call events
    (socket as any).on('call:initiated', handleIncomingCall);
    (socket as any).on('call:participant-joined', handleParticipantJoined);
    (socket as any).on('call:participant-left', handleParticipantLeft);
    (socket as any).on('call:ended', handleCallEnded);
    (socket as any).on('call:media-toggled', handleMediaToggle);
    (socket as any).on('call:error', handleCallError);

    return () => {
      logger.debug('[CallManager] Cleaning up Socket.IO listeners');
      (socket as any).off('call:initiated', handleIncomingCall);
      (socket as any).off('call:participant-joined', handleParticipantJoined);
      (socket as any).off('call:participant-left', handleParticipantLeft);
      (socket as any).off('call:ended', handleCallEnded);
      (socket as any).off('call:media-toggled', handleMediaToggle);
      (socket as any).off('call:error', handleCallError);
    };
  }, [
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
      if (isInCall) {
        logger.debug('[CallManager] Cleaning up on unmount');
        webrtcHook.cleanup();
        reset();
      }
    };
  }, [isInCall, webrtcHook, reset]);

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
