/**
 * CALL INTERFACE COMPONENT
 * Main call UI with video grid and controls
 */

'use client';

import React, { useEffect } from 'react';
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
  const {
    localStream,
    remoteStreams,
    currentCall,
    controls,
    toggleAudio,
    toggleVideo,
    reset,
  } = useCallStore();

  const { initializeLocalStream, connectionState } = useWebRTCP2P({
    callId,
    userId: user?.id,
    onError: (error) => {
      logger.error('[CallInterface] WebRTC error: ' + error.message);
      toast.error('Call connection error: ' + error.message);
    },
  });

  // Initialize local stream on mount
  useEffect(() => {
    initializeLocalStream().catch((error) => {
      logger.error('[CallInterface] Failed to initialize local stream: ' + (error?.message || 'Unknown error'));
    });
  }, [initializeLocalStream]);

  // Handle media toggle events
  const handleToggleAudio = () => {
    toggleAudio();

    const socket = meeshySocketIOService.getSocket();
    if (socket) {
      (socket as any).emit('call:toggle-audio', {
        callId,
        enabled: !controls.audioEnabled,
      });
    }
  };

  const handleToggleVideo = () => {
    toggleVideo();

    const socket = meeshySocketIOService.getSocket();
    if (socket) {
      (socket as any).emit('call:toggle-video', {
        callId,
        enabled: !controls.videoEnabled,
      });
    }
  };

  const handleHangUp = () => {
    logger.debug('[CallInterface] Hanging up - callId: ' + callId);

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
