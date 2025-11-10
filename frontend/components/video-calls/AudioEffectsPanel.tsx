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
  VoiceCoderPreset,
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
  onLoadPreset?: (preset: VoiceCoderPreset) => void;
  currentPreset?: VoiceCoderPreset;
  availablePresets?: Record<string, { name: string; description: string; params: VoiceCoderParams }>;
  availableBackSounds: readonly { id: string; name: string; url: string }[];
  className?: string;
}

export function AudioEffectsPanel({
  effectsState,
  onToggleEffect,
  onUpdateParams,
  onLoadPreset,
  currentPreset,
  availablePresets,
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
            <h3 className="text-white text-lg font-bold">Effets Audio</h3>
            <p className="text-gray-400 text-[10px]">Transformez votre voix</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Voice Coder Effect */}
        <Card className="bg-gradient-to-br from-blue-900/40 to-blue-800/20 border-blue-500/30 p-3 hover:border-blue-400/50 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/20">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <span className="text-lg">🎵</span>
              <Label className="text-white font-medium text-sm">Perfect Voice</Label>
            </div>
            <Switch
              checked={effectsState.voiceCoder.enabled}
              onCheckedChange={() => onToggleEffect('voice-coder')}
            />
          </div>

          <div className={cn('space-y-2', !effectsState.voiceCoder.enabled && 'opacity-50')}>
            {/* Preset Selector */}
            {availablePresets && onLoadPreset && (
              <div>
                <Label className="text-gray-300 text-xs font-semibold">Configuration rapide</Label>
                <p className="text-gray-500 text-[9px] mb-0.5">
                  Choisissez un style prédéfini ou personnalisez
                </p>
                <Select
                  value={currentPreset || 'correction-subtile'}
                  onValueChange={(value: VoiceCoderPreset) => onLoadPreset(value)}
                  disabled={!effectsState.voiceCoder.enabled}
                >
                  <SelectTrigger className="mt-1 bg-gray-800 border-gray-600 text-white h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(availablePresets).map(([key, preset]) => (
                      <SelectItem key={key} value={key}>
                        <div className="flex flex-col">
                          <span className="font-medium">{preset.name}</span>
                          <span className="text-[10px] text-gray-400">{preset.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                    <SelectItem value="custom">
                      <div className="flex flex-col">
                        <span className="font-medium">Personnalisé</span>
                        <span className="text-[10px] text-gray-400">Vos propres réglages</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {/* Rapidité de correction */}
            <div>
              <Label className="text-gray-300 text-xs font-semibold">
                Rapidité de correction ({effectsState.voiceCoder.params.retuneSpeed}%)
              </Label>
              <p className="text-gray-500 text-[9px] mb-0.5">
                {effectsState.voiceCoder.params.retuneSpeed < 30
                  ? 'Très naturel et doux'
                  : effectsState.voiceCoder.params.retuneSpeed < 70
                  ? 'Équilibré'
                  : 'Rapide et robotique'}
              </p>
              <Slider
                value={[effectsState.voiceCoder.params.retuneSpeed]}
                min={0}
                max={100}
                step={5}
                onValueChange={([value]) =>
                  onUpdateParams('voice-coder', { retuneSpeed: value })
                }
                disabled={!effectsState.voiceCoder.enabled}
                className="mt-1"
              />
            </div>

            {/* Gamme & Tonalité */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-gray-300 text-xs">Gamme</Label>
                <Select
                  value={effectsState.voiceCoder.params.scale}
                  onValueChange={(value: 'chromatic' | 'major' | 'minor' | 'pentatonic') =>
                    onUpdateParams('voice-coder', { scale: value })
                  }
                  disabled={!effectsState.voiceCoder.enabled}
                >
                  <SelectTrigger className="mt-1 bg-gray-800 border-gray-600 text-white h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="chromatic">Toutes les notes</SelectItem>
                    <SelectItem value="major">Majeure (joyeux)</SelectItem>
                    <SelectItem value="minor">Mineure (triste)</SelectItem>
                    <SelectItem value="pentatonic">Pentatonique</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-gray-300 text-xs">Tonalité</Label>
                <Select
                  value={effectsState.voiceCoder.params.key}
                  onValueChange={(value: 'C' | 'C#' | 'D' | 'D#' | 'E' | 'F' | 'F#' | 'G' | 'G#' | 'A' | 'A#' | 'B') =>
                    onUpdateParams('voice-coder', { key: value })
                  }
                  disabled={!effectsState.voiceCoder.enabled}
                >
                  <SelectTrigger className="mt-1 bg-gray-800 border-gray-600 text-white h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="C">Do (C)</SelectItem>
                    <SelectItem value="C#">Do# (C#)</SelectItem>
                    <SelectItem value="D">Ré (D)</SelectItem>
                    <SelectItem value="D#">Ré# (D#)</SelectItem>
                    <SelectItem value="E">Mi (E)</SelectItem>
                    <SelectItem value="F">Fa (F)</SelectItem>
                    <SelectItem value="F#">Fa# (F#)</SelectItem>
                    <SelectItem value="G">Sol (G)</SelectItem>
                    <SelectItem value="G#">Sol# (G#)</SelectItem>
                    <SelectItem value="A">La (A)</SelectItem>
                    <SelectItem value="A#">La# (A#)</SelectItem>
                    <SelectItem value="B">Si (B)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Force de l'effet */}
            <div>
              <Label className="text-gray-300 text-xs">Force de l'effet ({effectsState.voiceCoder.params.strength}%)</Label>
              <p className="text-gray-500 text-[9px] mb-0.5">
                Plus élevé = voix plus parfaite, moins naturelle
              </p>
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

            {/* Expression naturelle */}
            <div>
              <Label className="text-gray-300 text-xs">Expression naturelle ({effectsState.voiceCoder.params.naturalVibrato}%)</Label>
              <p className="text-gray-500 text-[9px] mb-0.5">
                Garde les variations naturelles de votre voix
              </p>
              <Slider
                value={[effectsState.voiceCoder.params.naturalVibrato]}
                min={0}
                max={100}
                step={5}
                onValueChange={([value]) =>
                  onUpdateParams('voice-coder', { naturalVibrato: value })
                }
                disabled={!effectsState.voiceCoder.enabled}
                className="mt-1"
              />
            </div>

            {/* Hauteur globale */}
            <div>
              <Label className="text-gray-300 text-xs">Hauteur de voix ({effectsState.voiceCoder.params.pitch > 0 ? '+' : ''}{effectsState.voiceCoder.params.pitch})</Label>
              <p className="text-gray-500 text-[9px] mb-0.5">
                Chanter plus aigu (+) ou plus grave (-)
              </p>
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

            {/* Harmonisation */}
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-gray-300 text-xs">Harmonies vocales</Label>
                <p className="text-gray-500 text-[9px]">Ajoute des voix d'accompagnement</p>
              </div>
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
              <Label className="text-white font-medium text-sm">Voix d'Enfant</Label>
            </div>
            <Switch
              checked={effectsState.babyVoice.enabled}
              onCheckedChange={() => onToggleEffect('baby-voice')}
            />
          </div>

          <div className={cn('space-y-2', !effectsState.babyVoice.enabled && 'opacity-50')}>
            <div>
              <Label className="text-gray-300 text-xs">Hauteur de voix (+{effectsState.babyVoice.params.pitch})</Label>
              <p className="text-gray-500 text-[9px] mb-0.5">
                Plus élevé = voix plus aiguë et enfantine
              </p>
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
              <Label className="text-gray-300 text-xs">Timbre ({effectsState.babyVoice.params.formant.toFixed(1)}x)</Label>
              <p className="text-gray-500 text-[9px] mb-0.5">
                Change la couleur de la voix
              </p>
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
              <Label className="text-gray-300 text-xs">Souffle ({effectsState.babyVoice.params.breathiness}%)</Label>
              <p className="text-gray-500 text-[9px] mb-0.5">
                Ajoute un effet de souffle doux
              </p>
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
              <Label className="text-white font-medium text-sm">Voix de Démon</Label>
            </div>
            <Switch
              checked={effectsState.demonVoice.enabled}
              onCheckedChange={() => onToggleEffect('demon-voice')}
            />
          </div>

          <div className={cn('space-y-2', !effectsState.demonVoice.enabled && 'opacity-50')}>
            <div>
              <Label className="text-gray-300 text-xs">Hauteur de voix ({effectsState.demonVoice.params.pitch})</Label>
              <p className="text-gray-500 text-[9px] mb-0.5">
                Plus bas = voix plus grave et effrayante
              </p>
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
              <Label className="text-gray-300 text-xs">Distorsion ({effectsState.demonVoice.params.distortion}%)</Label>
              <p className="text-gray-500 text-[9px] mb-0.5">
                Ajoute une texture agressive
              </p>
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
              <Label className="text-gray-300 text-xs">Écho ({effectsState.demonVoice.params.reverb}%)</Label>
              <p className="text-gray-500 text-[9px] mb-0.5">
                Effet de cathédrale sombre
              </p>
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
              <Label className="text-white font-medium text-sm">Musique de Fond</Label>
            </div>
            <Switch
              checked={effectsState.backSound.enabled}
              onCheckedChange={() => onToggleEffect('back-sound')}
            />
          </div>

          <div className={cn('space-y-2', !effectsState.backSound.enabled && 'opacity-50')}>
            <div>
              <Label className="text-gray-300 text-xs">Ambiance sonore</Label>
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
              <p className="text-gray-500 text-[9px] mb-0.5">
                Ajuste le volume de la musique de fond
              </p>
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
              <Label className="text-gray-300 text-xs">Mode de lecture</Label>
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
                  <SelectItem value="N_TIMES">Nombre de fois</SelectItem>
                  <SelectItem value="N_MINUTES">Durée en minutes</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-gray-300 text-xs">
                {effectsState.backSound.params.loopMode === 'N_TIMES' ? 'Répétitions' : 'Minutes'} ({effectsState.backSound.params.loopValue})
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
