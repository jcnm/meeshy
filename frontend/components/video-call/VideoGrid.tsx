/**
 * VIDEO GRID COMPONENT
 * Displays local and remote video streams in a responsive grid
 */

'use client';

import React, { useEffect, useRef } from 'react';
import { Mic, MicOff, Video as VideoIcon, VideoOff } from 'lucide-react';
import type { CallParticipant } from '@shared/types/video-call';
import { cn } from '@/lib/utils';

interface VideoGridProps {
  localStream: MediaStream | null;
  remoteStreams: [string, MediaStream][];
  participants: CallParticipant[];
  localAudioEnabled?: boolean;
  localVideoEnabled?: boolean;
}

export function VideoGrid({
  localStream,
  remoteStreams,
  participants,
  localAudioEnabled = true,
  localVideoEnabled = true,
}: VideoGridProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

  // Attach local stream
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Attach remote streams
  useEffect(() => {
    remoteStreams.forEach(([participantId, stream]) => {
      const videoEl = remoteVideoRefs.current.get(participantId);
      if (videoEl && videoEl.srcObject !== stream) {
        videoEl.srcObject = stream;
      }
    });
  }, [remoteStreams]);

  const getParticipantInfo = (participantId: string) => {
    return participants.find((p) => p.id === participantId);
  };

  // Determine grid layout
  const totalVideos = 1 + remoteStreams.length;
  const gridClass =
    totalVideos === 1
      ? 'grid-cols-1'
      : totalVideos === 2
      ? 'grid-cols-1 md:grid-cols-2'
      : totalVideos <= 4
      ? 'grid-cols-2'
      : 'grid-cols-3';

  return (
    <div className={cn('grid gap-4 p-4 h-full w-full', gridClass)}>
      {/* Local Video */}
      <div className="relative bg-gray-900 rounded-lg overflow-hidden aspect-video">
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className={cn(
            'w-full h-full object-cover',
            'transform -scale-x-100', // Mirror effect
            !localVideoEnabled && 'hidden'
          )}
          aria-label="Your video"
        />

        {/* No video placeholder */}
        {!localVideoEnabled && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
            <div className="text-center">
              <VideoOff className="w-12 h-12 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-300">Video Off</p>
            </div>
          </div>
        )}

        {/* Participant name and status */}
        <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
          <div className="bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-md">
            <span className="text-white text-sm font-medium">You</span>
          </div>

          <div className="flex gap-2">
            {!localAudioEnabled && (
              <div
                className="bg-red-600 p-1.5 rounded-full"
                title="Microphone muted"
              >
                <MicOff className="w-3 h-3 text-white" />
              </div>
            )}
            {!localVideoEnabled && (
              <div className="bg-red-600 p-1.5 rounded-full" title="Video off">
                <VideoOff className="w-3 h-3 text-white" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Remote Videos */}
      {remoteStreams.map(([participantId, stream]) => {
        const participant = getParticipantInfo(participantId);
        const isAudioEnabled = participant?.isAudioEnabled ?? true;
        const isVideoEnabled = participant?.isVideoEnabled ?? true;

        return (
          <div
            key={participantId}
            className="relative bg-gray-900 rounded-lg overflow-hidden aspect-video"
          >
            <video
              ref={(el) => {
                if (el) {
                  remoteVideoRefs.current.set(participantId, el);
                }
              }}
              autoPlay
              playsInline
              className={cn(
                'w-full h-full object-cover',
                !isVideoEnabled && 'hidden'
              )}
              aria-label={`${participant?.username || 'Participant'}'s video`}
            />

            {/* No video placeholder */}
            {!isVideoEnabled && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                <div className="text-center">
                  <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-2">
                    <span className="text-2xl text-white font-bold">
                      {participant?.username?.[0]?.toUpperCase() || '?'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-300">
                    {participant?.username || 'Unknown'}
                  </p>
                </div>
              </div>
            )}

            {/* Participant name and status */}
            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
              <div className="bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-md">
                <span className="text-white text-sm font-medium">
                  {participant?.username || 'Unknown'}
                </span>
              </div>

              <div className="flex gap-2">
                {!isAudioEnabled && (
                  <div
                    className="bg-red-600 p-1.5 rounded-full"
                    title="Microphone muted"
                  >
                    <MicOff className="w-3 h-3 text-white" />
                  </div>
                )}
                {!isVideoEnabled && (
                  <div
                    className="bg-red-600 p-1.5 rounded-full"
                    title="Video off"
                  >
                    <VideoOff className="w-3 h-3 text-white" />
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
