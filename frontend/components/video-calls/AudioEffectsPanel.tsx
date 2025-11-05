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
        'bg-black/80 backdrop-blur-md rounded-lg p-4 max-h-[80vh] overflow-y-auto',
        className
      )}
    >
      <h3 className="text-white text-lg font-semibold mb-4">Audio Effects</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Voice Coder Effect */}
        <Card className="bg-gray-900/90 border-gray-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🎵</span>
              <Label className="text-white font-medium">Voice Coder</Label>
            </div>
            <Switch
              checked={effectsState.voiceCoder.enabled}
              onCheckedChange={() => onToggleEffect('voice-coder')}
            />
          </div>

          <div className={cn('space-y-3', !effectsState.voiceCoder.enabled && 'opacity-50')}>
            <div>
              <Label className="text-gray-300 text-sm">Pitch ({effectsState.voiceCoder.params.pitch} semitones)</Label>
              <Slider
                value={[effectsState.voiceCoder.params.pitch]}
                min={-12}
                max={12}
                step={1}
                onValueChange={([value]) =>
                  onUpdateParams('voice-coder', { pitch: value })
                }
                disabled={!effectsState.voiceCoder.enabled}
                className="mt-2"
              />
            </div>

            <div>
              <Label className="text-gray-300 text-sm">Strength ({effectsState.voiceCoder.params.strength}%)</Label>
              <Slider
                value={[effectsState.voiceCoder.params.strength]}
                min={0}
                max={100}
                step={5}
                onValueChange={([value]) =>
                  onUpdateParams('voice-coder', { strength: value })
                }
                disabled={!effectsState.voiceCoder.enabled}
                className="mt-2"
              />
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-gray-300 text-sm">Harmonization</Label>
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
        <Card className="bg-gray-900/90 border-gray-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl">👶</span>
              <Label className="text-white font-medium">Baby Voice</Label>
            </div>
            <Switch
              checked={effectsState.babyVoice.enabled}
              onCheckedChange={() => onToggleEffect('baby-voice')}
            />
          </div>

          <div className={cn('space-y-3', !effectsState.babyVoice.enabled && 'opacity-50')}>
            <div>
              <Label className="text-gray-300 text-sm">Pitch (+{effectsState.babyVoice.params.pitch} semitones)</Label>
              <Slider
                value={[effectsState.babyVoice.params.pitch]}
                min={6}
                max={12}
                step={1}
                onValueChange={([value]) =>
                  onUpdateParams('baby-voice', { pitch: value })
                }
                disabled={!effectsState.babyVoice.enabled}
                className="mt-2"
              />
            </div>

            <div>
              <Label className="text-gray-300 text-sm">Formant ({effectsState.babyVoice.params.formant.toFixed(1)}x)</Label>
              <Slider
                value={[effectsState.babyVoice.params.formant * 10]}
                min={12}
                max={15}
                step={1}
                onValueChange={([value]) =>
                  onUpdateParams('baby-voice', { formant: value / 10 })
                }
                disabled={!effectsState.babyVoice.enabled}
                className="mt-2"
              />
            </div>

            <div>
              <Label className="text-gray-300 text-sm">Breathiness ({effectsState.babyVoice.params.breathiness}%)</Label>
              <Slider
                value={[effectsState.babyVoice.params.breathiness]}
                min={0}
                max={100}
                step={5}
                onValueChange={([value]) =>
                  onUpdateParams('baby-voice', { breathiness: value })
                }
                disabled={!effectsState.babyVoice.enabled}
                className="mt-2"
              />
            </div>
          </div>
        </Card>

        {/* Demon Voice Effect */}
        <Card className="bg-gray-900/90 border-gray-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl">😈</span>
              <Label className="text-white font-medium">Demon Voice</Label>
            </div>
            <Switch
              checked={effectsState.demonVoice.enabled}
              onCheckedChange={() => onToggleEffect('demon-voice')}
            />
          </div>

          <div className={cn('space-y-3', !effectsState.demonVoice.enabled && 'opacity-50')}>
            <div>
              <Label className="text-gray-300 text-sm">Pitch ({effectsState.demonVoice.params.pitch} semitones)</Label>
              <Slider
                value={[effectsState.demonVoice.params.pitch]}
                min={-12}
                max={-8}
                step={1}
                onValueChange={([value]) =>
                  onUpdateParams('demon-voice', { pitch: value })
                }
                disabled={!effectsState.demonVoice.enabled}
                className="mt-2"
              />
            </div>

            <div>
              <Label className="text-gray-300 text-sm">Distortion ({effectsState.demonVoice.params.distortion}%)</Label>
              <Slider
                value={[effectsState.demonVoice.params.distortion]}
                min={0}
                max={100}
                step={5}
                onValueChange={([value]) =>
                  onUpdateParams('demon-voice', { distortion: value })
                }
                disabled={!effectsState.demonVoice.enabled}
                className="mt-2"
              />
            </div>

            <div>
              <Label className="text-gray-300 text-sm">Reverb ({effectsState.demonVoice.params.reverb}%)</Label>
              <Slider
                value={[effectsState.demonVoice.params.reverb]}
                min={0}
                max={100}
                step={5}
                onValueChange={([value]) =>
                  onUpdateParams('demon-voice', { reverb: value })
                }
                disabled={!effectsState.demonVoice.enabled}
                className="mt-2"
              />
            </div>
          </div>
        </Card>

        {/* Back Sound Effect */}
        <Card className="bg-gray-900/90 border-gray-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🎶</span>
              <Label className="text-white font-medium">Back Sound</Label>
            </div>
            <Switch
              checked={effectsState.backSound.enabled}
              onCheckedChange={() => onToggleEffect('back-sound')}
            />
          </div>

          <div className={cn('space-y-3', !effectsState.backSound.enabled && 'opacity-50')}>
            <div>
              <Label className="text-gray-300 text-sm">Sound</Label>
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
              <Label className="text-gray-300 text-sm">Volume ({effectsState.backSound.params.volume}%)</Label>
              <Slider
                value={[effectsState.backSound.params.volume]}
                min={0}
                max={100}
                step={5}
                onValueChange={([value]) =>
                  onUpdateParams('back-sound', { volume: value })
                }
                disabled={!effectsState.backSound.enabled}
                className="mt-2"
              />
            </div>

            <div>
              <Label className="text-gray-300 text-sm">Loop Mode</Label>
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
              <Label className="text-gray-300 text-sm">
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
                className="mt-2"
              />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
