/**
 * VIDEO CALL INTERFACE - Mobile-Responsive
 * Complete mobile-optimized video call UI with draggable local video
 */

'use client';

import React, { useEffect, useCallback, useState } from 'react';
import { useCallStore } from '@/stores/call-store';
import { useAuth } from '@/hooks/use-auth';
import { useWebRTCP2P } from '@/hooks/use-webrtc-p2p';
import { VideoStream } from './VideoStream';
import { CallControls } from './CallControls';
import { CallStatusIndicator } from './CallStatusIndicator';
import { meeshySocketIOService } from '@/services/meeshy-socketio.service';
import { logger } from '@/utils/logger';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface VideoCallInterfaceProps {
  callId: string;
}

export function VideoCallInterface({ callId }: VideoCallInterfaceProps) {
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

  const [localVideoPosition, setLocalVideoPosition] = useState({ x: 20, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [callDuration, setCallDuration] = useState(0);

  // Stable error handler
  const handleWebRTCError = useCallback((error: Error) => {
    logger.error('[VideoCallInterface]', 'WebRTC error: ' + error.message);
    toast.error('Call connection error: ' + error.message);
  }, []);

  // Initialize WebRTC
  const { initializeLocalStream, createOffer, connectionState } = useWebRTCP2P({
    callId,
    userId: user?.id,
    onError: handleWebRTCError,
  });

  // Return loading state if user not loaded
  if (!user || !user.id) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
        <div className="text-white text-lg">Loading call...</div>
      </div>
    );
  }

  // Initialize local stream on mount
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        await initializeLocalStream();
      } catch (error) {
        if (mounted) {
          logger.error('[VideoCallInterface]', 'Failed to initialize local stream: ' + (error?.message || 'Unknown error'));
        }
      }
    };

    init();

    return () => {
      mounted = false;
    };
  }, [initializeLocalStream]);

  // Track call duration
  useEffect(() => {
    if (!currentCall?.startedAt) return;

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - new Date(currentCall.startedAt).getTime()) / 1000);
      setCallDuration(elapsed);
    }, 1000);

    return () => clearInterval(interval);
  }, [currentCall?.startedAt]);

  // Handle creating offers for participants
  const offersCreatedFor = React.useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!currentCall || !user) return;

    if (currentCall.initiatorId !== user.id) return;

    const activeParticipants = currentCall.participants?.filter(p => !p.leftAt) || [];

    activeParticipants.forEach((participant) => {
      const participantId = participant.userId || participant.anonymousId;

      if (!participantId || participantId === user.id) return;

      if (offersCreatedFor.current.has(participantId)) return;

      offersCreatedFor.current.add(participantId);

      logger.info('[VideoCallInterface]', 'Creating offer for new participant', { participantId });
      createOffer(participantId).catch((error) => {
        logger.error('[VideoCallInterface]', 'Failed to create offer', { participantId, error });
        offersCreatedFor.current.delete(participantId);
      });
    });
  }, [currentCall?.participants?.length, currentCall?.initiatorId, user?.id, createOffer]);

  // Handle media toggles
  const handleToggleAudio = () => {
    const newEnabled = !controls.audioEnabled;
    toggleAudio();

    const socket = meeshySocketIOService.getSocket();
    if (socket) {
      (socket as any).emit('call:toggle-audio', { callId, enabled: newEnabled });
    }
  };

  const handleToggleVideo = () => {
    const newEnabled = !controls.videoEnabled;
    toggleVideo();

    const socket = meeshySocketIOService.getSocket();
    if (socket) {
      (socket as any).emit('call:toggle-video', { callId, enabled: newEnabled });
    }
  };

  const handleSwitchCamera = async () => {
    try {
      if (!localStream) return;

      const videoTrack = localStream.getVideoTracks()[0];
      if (!videoTrack) return;

      const constraints = videoTrack.getConstraints();
      const currentFacingMode = (constraints as any).facingMode || 'user';
      const newFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';

      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: newFacingMode },
        audio: false,
      });

      const newVideoTrack = newStream.getVideoTracks()[0];

      // Replace track in peer connections
      useCallStore.getState().peerConnections.forEach((pc) => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          sender.replaceTrack(newVideoTrack);
        }
      });

      videoTrack.stop();
      localStream.removeTrack(videoTrack);
      localStream.addTrack(newVideoTrack);

      toast.success('Camera switched');
    } catch (error) {
      logger.error('[VideoCallInterface]', 'Failed to switch camera', { error });
      toast.error('Failed to switch camera');
    }
  };

  const handleHangUp = () => {
    const socket = meeshySocketIOService.getSocket();
    if (socket) {
      (socket as any).emit('call:leave', { callId });
    }
    reset();
  };

  // Draggable local video handlers
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDragging(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setDragStart({ x: clientX - localVideoPosition.x, y: clientY - localVideoPosition.y });
  };

  const handleDragMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDragging) return;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const newX = clientX - dragStart.x;
    const newY = clientY - dragStart.y;

    // Constrain to viewport
    const maxX = window.innerWidth - 160;
    const maxY = window.innerHeight - 240;

    setLocalVideoPosition({
      x: Math.max(0, Math.min(newX, maxX)),
      y: Math.max(0, Math.min(newY, maxY)),
    });
  }, [isDragging, dragStart]);

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
      window.addEventListener('touchmove', handleDragMove);
      window.addEventListener('touchend', handleDragEnd);
    }

    return () => {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchmove', handleDragMove);
      window.removeEventListener('touchend', handleDragEnd);
    };
  }, [isDragging, handleDragMove]);

  // Format call duration
  const formatDuration = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get remote participant info
  const remoteParticipant = currentCall?.participants?.find(
    p => (p.userId || p.anonymousId) !== user.id && !p.leftAt
  );

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Status Indicator */}
      <CallStatusIndicator
        connectionState={connectionState}
        callDuration={callDuration}
        participantName={remoteParticipant?.username || 'Unknown'}
      />

      {/* Remote Video - Full Screen */}
      <div className="absolute inset-0">
        {remoteStreams.size > 0 ? (
          Array.from(remoteStreams.entries()).map(([participantId, stream]) => (
            <VideoStream
              key={participantId}
              stream={stream}
              muted={false}
              isLocal={false}
              className="w-full h-full object-cover"
              participantName={remoteParticipant?.username}
              isAudioEnabled={remoteParticipant?.isAudioEnabled ?? true}
              isVideoEnabled={remoteParticipant?.isVideoEnabled ?? true}
            />
          ))
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center text-white">
              <div className="w-24 h-24 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-4xl">
                  {remoteParticipant?.username?.[0]?.toUpperCase() || '?'}
                </span>
              </div>
              <p className="text-lg">{remoteParticipant?.username || 'Waiting for participant...'}</p>
              <p className="text-sm text-gray-400 mt-2">
                {connectionState === 'connecting' ? 'Connecting...' : 'No video'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Local Video - Draggable Overlay */}
      <div
        className={cn(
          'absolute rounded-lg overflow-hidden shadow-2xl cursor-move',
          'w-32 h-40 md:w-40 md:h-52',
          'transition-shadow hover:shadow-3xl',
          isDragging && 'cursor-grabbing'
        )}
        style={{
          left: `${localVideoPosition.x}px`,
          top: `${localVideoPosition.y}px`,
        }}
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
      >
        <VideoStream
          stream={localStream}
          muted={true}
          isLocal={true}
          className="w-full h-full object-cover transform -scale-x-100"
          participantName="You"
          isAudioEnabled={controls.audioEnabled}
          isVideoEnabled={controls.videoEnabled}
        />
      </div>

      {/* Call Controls */}
      <CallControls
        audioEnabled={controls.audioEnabled}
        videoEnabled={controls.videoEnabled}
        onToggleAudio={handleToggleAudio}
        onToggleVideo={handleToggleVideo}
        onSwitchCamera={handleSwitchCamera}
        onHangUp={handleHangUp}
      />

      {/* Call Duration & Participant Count */}
      <div className="absolute top-4 left-4 flex flex-col gap-2">
        <div className="bg-black/60 backdrop-blur-sm px-4 py-2 rounded-lg">
          <p className="text-white text-sm font-medium">
            {formatDuration(callDuration)}
          </p>
        </div>
        <div className="bg-black/60 backdrop-blur-sm px-4 py-2 rounded-lg">
          <p className="text-white text-sm">
            {currentCall?.participants.filter(p => !p.leftAt).length || 0} participant(s)
          </p>
        </div>
      </div>
    </div>
  );
}
