/**
 * CALL CONTROLS COMPONENT
 * Controls for mute, video, and hang up
 */

'use client';

import React from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CallControlsProps {
  audioEnabled: boolean;
  videoEnabled: boolean;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onHangUp: () => void;
}

export function CallControls({
  audioEnabled,
  videoEnabled,
  onToggleAudio,
  onToggleVideo,
  onHangUp,
}: CallControlsProps) {
  return (
    <div
      className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex gap-4 bg-black/60 backdrop-blur-md px-6 py-4 rounded-full shadow-2xl"
      role="toolbar"
      aria-label="Call controls"
    >
      {/* Mute/Unmute Audio */}
      <Button
        size="icon"
        variant={audioEnabled ? 'default' : 'destructive'}
        onClick={onToggleAudio}
        className={cn(
          'w-12 h-12 rounded-full transition-all',
          audioEnabled
            ? 'bg-gray-700 hover:bg-gray-600 text-white'
            : 'bg-red-600 hover:bg-red-700 text-white'
        )}
        aria-label={audioEnabled ? 'Mute microphone' : 'Unmute microphone'}
        title={audioEnabled ? 'Mute' : 'Unmute'}
      >
        {audioEnabled ? (
          <Mic className="w-5 h-5" />
        ) : (
          <MicOff className="w-5 h-5" />
        )}
      </Button>

      {/* Toggle Video */}
      <Button
        size="icon"
        variant={videoEnabled ? 'default' : 'destructive'}
        onClick={onToggleVideo}
        className={cn(
          'w-12 h-12 rounded-full transition-all',
          videoEnabled
            ? 'bg-gray-700 hover:bg-gray-600 text-white'
            : 'bg-red-600 hover:bg-red-700 text-white'
        )}
        aria-label={videoEnabled ? 'Turn off video' : 'Turn on video'}
        title={videoEnabled ? 'Turn off video' : 'Turn on video'}
      >
        {videoEnabled ? (
          <Video className="w-5 h-5" />
        ) : (
          <VideoOff className="w-5 h-5" />
        )}
      </Button>

      {/* Hang Up */}
      <Button
        size="icon"
        variant="destructive"
        onClick={onHangUp}
        className="w-12 h-12 rounded-full bg-red-600 hover:bg-red-700 text-white"
        aria-label="End call"
        title="End call"
      >
        <PhoneOff className="w-5 h-5" />
      </Button>
    </div>
  );
}
