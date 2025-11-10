/**
 * AUDIO EFFECTS PANEL
 * Grid layout with 4 audio effect cards
 *
 * Features:
 * - Voice Coder (auto-tune)
 * - Baby Voice
 * - Demon Voice
 * - Back Sound Code (background music)
 */

'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type {
  AudioEffectsState,
  VoiceCoderParams,
  BabyVoiceParams,
  DemonVoiceParams,
  BackSoundParams,
  AudioEffectType,
} from '@shared/types/video-call';

interface AudioEffectsPanelProps {
  effectsState: AudioEffectsState;
  onToggleEffect: (type: AudioEffectType) => void;
  onUpdateParams: <T extends AudioEffectType>(
    type: T,
    params: Partial<
      T extends 'voice-coder'
        ? VoiceCoderParams
        : T extends 'baby-voice'
        ? BabyVoiceParams
        : T extends 'demon-voice'
        ? DemonVoiceParams
        : BackSoundParams
    >
  ) => void;
  availableBackSounds: readonly { id: string; name: string; url: string }[];
  className?: string;
}

export function AudioEffectsPanel({
  effectsState,
  onToggleEffect,
  onUpdateParams,
  availableBackSounds,
  className,
}: AudioEffectsPanelProps) {
  return (
    <div
      className={cn(
        'bg-gradient-to-br from-gray-900/95 via-black/95 to-purple-900/95',
        'backdrop-blur-xl rounded-xl p-4 max-h-[70vh] overflow-y-auto',
        'border border-white/10 shadow-2xl',
        'animate-in slide-in-from-bottom duration-300',
        className
      )}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
            <span className="text-xl">🎭</span>
          </div>
          <div>
            <h3 className="text-white text-lg font-bold">Audio Effects</h3>
            <p className="text-gray-400 text-[10px]">Transform your voice</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Voice Coder Effect */}
        <Card className="bg-gradient-to-br from-blue-900/40 to-blue-800/20 border-blue-500/30 p-3 hover:border-blue-400/50 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/20">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <span className="text-lg">🎵</span>
              <Label className="text-white font-medium text-sm">Voice Coder</Label>
            </div>
            <Switch
              checked={effectsState.voiceCoder.enabled}
              onCheckedChange={() => onToggleEffect('voice-coder')}
            />
          </div>

          <div className={cn('space-y-2', !effectsState.voiceCoder.enabled && 'opacity-50')}>
            <div>
              <Label className="text-gray-300 text-xs">Pitch ({effectsState.voiceCoder.params.pitch} semitones)</Label>
              <Slider
                value={[effectsState.voiceCoder.params.pitch]}
                min={-12}
                max={12}
                step={1}
                onValueChange={([value]) =>
                  onUpdateParams('voice-coder', { pitch: value })
                }
                disabled={!effectsState.voiceCoder.enabled}
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-gray-300 text-xs">Strength ({effectsState.voiceCoder.params.strength}%)</Label>
              <Slider
                value={[effectsState.voiceCoder.params.strength]}
                min={0}
                max={100}
                step={5}
                onValueChange={([value]) =>
                  onUpdateParams('voice-coder', { strength: value })
                }
                disabled={!effectsState.voiceCoder.enabled}
                className="mt-1"
              />
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-gray-300 text-xs">Harmonization</Label>
              <Switch
                checked={effectsState.voiceCoder.params.harmonization}
                onCheckedChange={(checked) =>
                  onUpdateParams('voice-coder', { harmonization: checked })
                }
                disabled={!effectsState.voiceCoder.enabled}
              />
            </div>
          </div>
        </Card>

        {/* Baby Voice Effect */}
        <Card className="bg-gradient-to-br from-pink-900/40 to-pink-800/20 border-pink-500/30 p-3 hover:border-pink-400/50 transition-all duration-300 hover:shadow-lg hover:shadow-pink-500/20">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <span className="text-lg">👶</span>
              <Label className="text-white font-medium text-sm">Baby Voice</Label>
            </div>
            <Switch
              checked={effectsState.babyVoice.enabled}
              onCheckedChange={() => onToggleEffect('baby-voice')}
            />
          </div>

          <div className={cn('space-y-2', !effectsState.babyVoice.enabled && 'opacity-50')}>
            <div>
              <Label className="text-gray-300 text-xs">Pitch (+{effectsState.babyVoice.params.pitch} semitones)</Label>
              <Slider
                value={[effectsState.babyVoice.params.pitch]}
                min={6}
                max={12}
                step={1}
                onValueChange={([value]) =>
                  onUpdateParams('baby-voice', { pitch: value })
                }
                disabled={!effectsState.babyVoice.enabled}
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-gray-300 text-xs">Formant ({effectsState.babyVoice.params.formant.toFixed(1)}x)</Label>
              <Slider
                value={[effectsState.babyVoice.params.formant * 10]}
                min={12}
                max={15}
                step={1}
                onValueChange={([value]) =>
                  onUpdateParams('baby-voice', { formant: value / 10 })
                }
                disabled={!effectsState.babyVoice.enabled}
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-gray-300 text-xs">Breathiness ({effectsState.babyVoice.params.breathiness}%)</Label>
              <Slider
                value={[effectsState.babyVoice.params.breathiness]}
                min={0}
                max={100}
                step={5}
                onValueChange={([value]) =>
                  onUpdateParams('baby-voice', { breathiness: value })
                }
                disabled={!effectsState.babyVoice.enabled}
                className="mt-1"
              />
            </div>
          </div>
        </Card>

        {/* Demon Voice Effect */}
        <Card className="bg-gradient-to-br from-red-900/40 to-red-800/20 border-red-500/30 p-3 hover:border-red-400/50 transition-all duration-300 hover:shadow-lg hover:shadow-red-500/20">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <span className="text-lg">😈</span>
              <Label className="text-white font-medium text-sm">Demon Voice</Label>
            </div>
            <Switch
              checked={effectsState.demonVoice.enabled}
              onCheckedChange={() => onToggleEffect('demon-voice')}
            />
          </div>

          <div className={cn('space-y-2', !effectsState.demonVoice.enabled && 'opacity-50')}>
            <div>
              <Label className="text-gray-300 text-xs">Pitch ({effectsState.demonVoice.params.pitch} semitones)</Label>
              <Slider
                value={[effectsState.demonVoice.params.pitch]}
                min={-12}
                max={-8}
                step={1}
                onValueChange={([value]) =>
                  onUpdateParams('demon-voice', { pitch: value })
                }
                disabled={!effectsState.demonVoice.enabled}
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-gray-300 text-xs">Distortion ({effectsState.demonVoice.params.distortion}%)</Label>
              <Slider
                value={[effectsState.demonVoice.params.distortion]}
                min={0}
                max={100}
                step={5}
                onValueChange={([value]) =>
                  onUpdateParams('demon-voice', { distortion: value })
                }
                disabled={!effectsState.demonVoice.enabled}
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-gray-300 text-xs">Reverb ({effectsState.demonVoice.params.reverb}%)</Label>
              <Slider
                value={[effectsState.demonVoice.params.reverb]}
                min={0}
                max={100}
                step={5}
                onValueChange={([value]) =>
                  onUpdateParams('demon-voice', { reverb: value })
                }
                disabled={!effectsState.demonVoice.enabled}
                className="mt-1"
              />
            </div>
          </div>
        </Card>

        {/* Back Sound Effect */}
        <Card className="bg-gradient-to-br from-green-900/40 to-green-800/20 border-green-500/30 p-3 hover:border-green-400/50 transition-all duration-300 hover:shadow-lg hover:shadow-green-500/20">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <span className="text-lg">🎶</span>
              <Label className="text-white font-medium text-sm">Back Sound</Label>
            </div>
            <Switch
              checked={effectsState.backSound.enabled}
              onCheckedChange={() => onToggleEffect('back-sound')}
            />
          </div>

          <div className={cn('space-y-2', !effectsState.backSound.enabled && 'opacity-50')}>
            <div>
              <Label className="text-gray-300 text-xs">Sound</Label>
              <Select
                value={effectsState.backSound.params.soundFile}
                onValueChange={(value) =>
                  onUpdateParams('back-sound', { soundFile: value })
                }
                disabled={!effectsState.backSound.enabled}
              >
                <SelectTrigger className="mt-1 bg-gray-800 border-gray-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableBackSounds.map((sound) => (
                    <SelectItem key={sound.id} value={sound.id}>
                      {sound.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-gray-300 text-xs">Volume ({effectsState.backSound.params.volume}%)</Label>
              <Slider
                value={[effectsState.backSound.params.volume]}
                min={0}
                max={100}
                step={5}
                onValueChange={([value]) =>
                  onUpdateParams('back-sound', { volume: value })
                }
                disabled={!effectsState.backSound.enabled}
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-gray-300 text-xs">Loop Mode</Label>
              <Select
                value={effectsState.backSound.params.loopMode}
                onValueChange={(value: 'N_TIMES' | 'N_MINUTES') =>
                  onUpdateParams('back-sound', { loopMode: value })
                }
                disabled={!effectsState.backSound.enabled}
              >
                <SelectTrigger className="mt-1 bg-gray-800 border-gray-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="N_TIMES">N Times</SelectItem>
                  <SelectItem value="N_MINUTES">N Minutes</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-gray-300 text-xs">
                {effectsState.backSound.params.loopMode === 'N_TIMES' ? 'Times' : 'Minutes'} ({effectsState.backSound.params.loopValue})
              </Label>
              <Slider
                value={[effectsState.backSound.params.loopValue]}
                min={1}
                max={effectsState.backSound.params.loopMode === 'N_TIMES' ? 10 : 60}
                step={1}
                onValueChange={([value]) =>
                  onUpdateParams('back-sound', { loopValue: value })
                }
                disabled={!effectsState.backSound.enabled}
                className="mt-1"
              />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
