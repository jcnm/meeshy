'use client';

import React, { useState } from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Wand2, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { VoiceEffectsProcessor, type VoiceEffectType } from '@/lib/audio/voice-effects';

interface EnhancedCallControlsProps {
  audioEnabled: boolean;
  videoEnabled: boolean;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onHangUp: () => void;
  voiceEffect?: VoiceEffectType;
  voiceEffectIntensity?: number;
  onVoiceEffectChange?: (effect: VoiceEffectType, intensity: number) => void;
}

export function EnhancedCallControls({
  audioEnabled,
  videoEnabled,
  onToggleAudio,
  onToggleVideo,
  onHangUp,
  voiceEffect = 'none',
  voiceEffectIntensity = 50,
  onVoiceEffectChange,
}: EnhancedCallControlsProps) {
  const [localEffect, setLocalEffect] = useState<VoiceEffectType>(voiceEffect);
  const [localIntensity, setLocalIntensity] = useState(voiceEffectIntensity);
  const [isEffectsOpen, setIsEffectsOpen] = useState(false);

  const availableEffects = VoiceEffectsProcessor.getAvailableEffects();

  const handleEffectChange = (effect: VoiceEffectType) => {
    setLocalEffect(effect);
    if (onVoiceEffectChange) {
      onVoiceEffectChange(effect, localIntensity);
    }
  };

  const handleIntensityChange = (value: number[]) => {
    setLocalIntensity(value[0]);
    if (onVoiceEffectChange) {
      onVoiceEffectChange(localEffect, value[0]);
    }
  };

  return (
    <div
      className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex flex-col items-center gap-3"
      role="toolbar"
      aria-label="Call controls"
    >
      {/* Voice Effects Panel */}
      {isEffectsOpen && (
        <div className="bg-gray-900/95 backdrop-blur-md rounded-2xl shadow-2xl p-4 border border-gray-700 animate-in slide-in-from-bottom-4">
          <div className="mb-3">
            <h4 className="text-white font-semibold text-sm mb-2 flex items-center gap-2">
              <Wand2 className="w-4 h-4" />
              Voice Effects
            </h4>
          </div>

          <div className="space-y-3 max-w-xs">
            {/* Effect Selection */}
            <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto">
              {availableEffects.map(effect => (
                <button
                  key={effect.value}
                  onClick={() => handleEffectChange(effect.value)}
                  className={cn(
                    'p-2 rounded-lg text-left transition-all',
                    localEffect === effect.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  )}
                >
                  <div className="text-base mb-1">{effect.icon}</div>
                  <div className="text-xs font-semibold">{effect.label}</div>
                </button>
              ))}
            </div>

            {/* Intensity Slider */}
            {localEffect !== 'none' && (
              <div className="pt-2 border-t border-gray-700">
                <label className="text-xs text-gray-400 block mb-2">
                  Intensity: {localIntensity}%
                </label>
                <Slider
                  value={[localIntensity]}
                  onValueChange={handleIntensityChange}
                  min={0}
                  max={100}
                  step={5}
                  className="w-full"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Controls */}
      <div className="flex gap-4 bg-black/60 backdrop-blur-md px-6 py-4 rounded-full shadow-2xl">
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

        {/* Voice Effects Toggle */}
        <Button
          size="icon"
          variant={localEffect !== 'none' ? 'default' : 'secondary'}
          onClick={() => setIsEffectsOpen(!isEffectsOpen)}
          className={cn(
            'w-12 h-12 rounded-full transition-all relative',
            localEffect !== 'none'
              ? 'bg-purple-600 hover:bg-purple-700 text-white'
              : 'bg-gray-700 hover:bg-gray-600 text-white'
          )}
          aria-label="Voice effects"
          title="Voice effects"
        >
          <Wand2 className="w-5 h-5" />
          {localEffect !== 'none' && (
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-purple-400 rounded-full animate-pulse" />
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

      {/* Expand Indicator */}
      {!isEffectsOpen && localEffect !== 'none' && (
        <div className="text-xs text-gray-400 flex items-center gap-1">
          <ChevronUp className="w-3 h-3" />
          {availableEffects.find(e => e.value === localEffect)?.icon} {availableEffects.find(e => e.value === localEffect)?.label} active
        </div>
      )}
    </div>
  );
}
