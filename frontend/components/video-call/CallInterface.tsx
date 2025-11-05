/**
 * CALL INTERFACE COMPONENT
 * Main call UI with video grid and controls
 */

'use client';

import React, { useEffect, useCallback } from 'react';
import { useCallStore } from '@/stores/call-store';
import { useAuth } from '@/hooks/use-auth';
import { useWebRTCP2P } from '@/hooks/use-webrtc-p2p';
import { VideoGrid } from './VideoGrid';
import { CallControls } from './CallControls';
import { meeshySocketIOService } from '@/services/meeshy-socketio.service';
import { logger } from '@/utils/logger';
import { toast } from 'sonner';

interface CallInterfaceProps {
  callId: string;
  userId: string;  // CRITICAL: Pass userId as prop to avoid race condition
}

export function CallInterface({ callId, userId }: CallInterfaceProps) {
  const { user } = useAuth();

  // IMPORTANT: Call ALL hooks BEFORE any conditional returns to comply with React rules
  // Hooks must be called in the same order on every render
  const {
    localStream,
    remoteStreams,
    currentCall,
    controls,
    toggleAudio,
    toggleVideo,
    reset,
  } = useCallStore();

  // Stable error handler to prevent useWebRTCP2P from recreating on every render
  const handleWebRTCError = useCallback((error: Error) => {
    // Defensive: handle cases where error might not be a proper Error object
    const errorMessage = error?.message || String(error) || 'Unknown WebRTC error';
    logger.error('[CallInterface]', 'WebRTC error: ' + errorMessage, { error });
    toast.error('Call connection error: ' + errorMessage);
  }, []);

  // CRITICAL: Use userId from props (passed by CallManager) to avoid race condition
  const { initializeLocalStream, createOffer, connectionState } = useWebRTCP2P({
    callId,
    userId,  // Use prop instead of user?.id
    onError: handleWebRTCError,
  });

  // Initialize local stream on mount (only once)
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        // SAFARI FIX: Check for pre-authorized stream first
        const preauthorizedStream = (window as any).__preauthorizedMediaStream;

        if (preauthorizedStream) {
          logger.info('[CallInterface]', '✅ Using pre-authorized media stream (Safari-compatible)');
          console.log('✅ [CallInterface] Using pre-authorized media stream');

          // Use the pre-authorized stream directly
          const { setLocalStream } = useCallStore.getState();
          setLocalStream(preauthorizedStream);

          // Clean up the global reference
          delete (window as any).__preauthorizedMediaStream;
        } else {
          logger.debug('[CallInterface]', 'No pre-authorized stream, requesting permissions now');
          console.log('🎤📹 [CallInterface] No pre-authorized stream, requesting permissions...');
          await initializeLocalStream();
        }
      } catch (error) {
        if (mounted) {
          logger.error('[CallInterface]', 'Failed to initialize local stream: ' + (error?.message || 'Unknown error'));
        }
      }
    };

    init();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Handle creating offer when a participant joins (if we're the initiator)
  // Use a ref to track which participants we've already created offers for
  const offersCreatedFor = React.useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!currentCall || !user) return;

    // Only create offer if I'm the initiator
    if (currentCall.initiatorId !== user.id) return;

    // Find participants who don't have 'leftAt' (active participants)
    const activeParticipants = currentCall.participants?.filter(p => !p.leftAt) || [];

    // Create offers for all active participants except myself
    activeParticipants.forEach((participant) => {
      // Use userId or anonymousId for signaling (NOT participant.id which is the CallParticipant ID)
      const participantId = participant.userId || participant.anonymousId;

      if (!participantId) {
        logger.error('[CallInterface]', 'Participant has no userId or anonymousId', { participant });
        return;
      }

      // Skip if this is me
      if (participantId === user.id) return;

      // Skip if we've already created an offer for this participant
      if (offersCreatedFor.current.has(participantId)) {
        logger.debug('[CallInterface]', 'Offer already created for participant', { participantId });
        return;
      }

      // Mark as created before actually creating to prevent duplicates
      offersCreatedFor.current.add(participantId);

      // Create offer for this participant
      logger.info('[CallInterface]', 'Creating offer for new participant', { participantId });
      createOffer(participantId).catch((error) => {
        logger.error('[CallInterface]', 'Failed to create offer for participant', {
          participantId: participant.id,
          error,
        });
        // Remove from set if creation failed so we can retry
        offersCreatedFor.current.delete(participantId);
      });
    });
    // Only depend on participants array length and initiatorId to avoid re-creating offers
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCall?.participants?.length, currentCall?.initiatorId, user?.id]);

  // Handle media toggle events
  const handleToggleAudio = () => {
    // Calculate new state BEFORE toggling
    const newEnabled = !controls.audioEnabled;

    toggleAudio();

    const socket = meeshySocketIOService.getSocket();
    if (socket) {
      (socket as any).emit('call:toggle-audio', {
        callId,
        enabled: newEnabled,
      });
    }
  };

  const handleToggleVideo = () => {
    // Calculate new state BEFORE toggling
    const newEnabled = !controls.videoEnabled;

    toggleVideo();

    const socket = meeshySocketIOService.getSocket();
    if (socket) {
      (socket as any).emit('call:toggle-video', {
        callId,
        enabled: newEnabled,
      });
    }
  };

  const handleHangUp = useCallback(() => {
    logger.debug('[CallInterface]', 'Hanging up - callId: ' + callId);

    // Check if we're still in a call before leaving
    const { currentCall, isInCall } = useCallStore.getState();
    if (!isInCall || !currentCall) {
      logger.debug('[CallInterface]', 'Already left the call, skipping hangup');
      return;
    }

    const socket = meeshySocketIOService.getSocket();
    if (socket) {
      (socket as any).emit('call:leave', { callId });
    }

    // Reset immediately for instant UI feedback
    // CallManager will handle cleanup when receiving call:ended event
    reset();
  }, [callId, reset]);

  // AFTER all hooks have been called, check if user is loaded
  // This ensures hooks are always called in the same order
  if (!user || !user.id) {
    logger.warn('[CallInterface]', 'User not loaded yet, waiting...');
    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
        <div className="text-white text-lg">Loading call...</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Connection Status */}
      {connectionState !== 'connected' && connectionState !== 'new' && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10">
          <div className="bg-yellow-600 text-white px-4 py-2 rounded-lg shadow-lg">
            <p className="text-sm font-medium">
              {connectionState === 'connecting' && 'Connecting...'}
              {connectionState === 'disconnected' && 'Disconnected'}
              {connectionState === 'failed' && 'Connection failed'}
              {connectionState === 'closed' && 'Connection closed'}
            </p>
          </div>
        </div>
      )}

      {/* Video Grid */}
      <VideoGrid
        localStream={localStream}
        remoteStreams={Array.from(remoteStreams.entries())}
        participants={currentCall?.participants || []}
        localAudioEnabled={controls.audioEnabled}
        localVideoEnabled={controls.videoEnabled}
      />

      {/* Call Controls */}
      <CallControls
        audioEnabled={controls.audioEnabled}
        videoEnabled={controls.videoEnabled}
        onToggleAudio={handleToggleAudio}
        onToggleVideo={handleToggleVideo}
        onHangUp={handleHangUp}
      />

      {/* Participant Count */}
      <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm px-4 py-2 rounded-lg">
        <p className="text-white text-sm">
          {currentCall?.participants.length || 0} participant(s)
        </p>
      </div>

      {/* Call Duration (optional - can be added later) */}
      {/* <CallDuration startTime={currentCall?.startedAt} /> */}
    </div>
  );
}
