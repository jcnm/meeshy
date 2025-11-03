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
}

export function CallInterface({ callId }: CallInterfaceProps) {
  const { user } = useAuth();

  // Return loading state BEFORE calling hooks if user not loaded yet
  // This prevents hooks from being called with undefined userId
  if (!user || !user.id) {
    logger.warn('[CallInterface]', 'User not loaded yet, waiting...');
    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
        <div className="text-white text-lg">Loading call...</div>
      </div>
    );
  }

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
    logger.error('[CallInterface]', 'WebRTC error: ' + error.message);
    toast.error('Call connection error: ' + error.message);
  }, []);

  // Now we can safely call useWebRTCP2P with guaranteed user.id
  const { initializeLocalStream, createOffer, connectionState } = useWebRTCP2P({
    callId,
    userId: user.id,
    onError: handleWebRTCError,
  });

  // Initialize local stream on mount (only once)
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        await initializeLocalStream();
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

  const handleHangUp = () => {
    logger.debug('[CallInterface]', 'Hanging up - callId: ' + callId);

    const socket = meeshySocketIOService.getSocket();
    if (socket) {
      (socket as any).emit('call:leave', { callId });
    }

    // Reset will be handled by CallManager after receiving call:ended event
    // but we also reset here for immediate UI feedback
    reset();
  };

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
