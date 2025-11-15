/**
 * AUDIO EFFECTS CAROUSEL
 * Horizontal scrolling carousel with effect tiles
 *
 * Features:
 * - Reset tile (first)
 * - Effect tiles with status
 * - Click to expand details
 * - Precise sliders (0.01 step)
 * - Same UI on desktop and mobile
 */

'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { useI18n } from '@/hooks/useI18n';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, ChevronLeft, ChevronRight, RotateCcw, Upload, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

interface AudioEffectsCarouselProps {
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
  onClose?: () => void;
  className?: string;
}

type EffectTileType = 'reset' | AudioEffectType;

export function AudioEffectsCarousel({
  effectsState,
  onToggleEffect,
  onUpdateParams,
  onLoadPreset,
  currentPreset,
  availablePresets,
  availableBackSounds,
  onClose,
  className,
}: AudioEffectsCarouselProps) {
  const { t } = useI18n('audioEffects');
  const [selectedEffect, setSelectedEffect] = useState<EffectTileType | null>(null);
  const [scrollPosition, setScrollPosition] = useState(0);

  // Handler to disable all effects
  const handleResetAll = () => {
    Object.values(effectsState).forEach((effect) => {
      if (effect.enabled) {
        onToggleEffect(effect.type);
      }
    });
    setSelectedEffect(null);
  };

  // Effect tiles configuration
  const effectTiles: Array<{
    id: EffectTileType;
    icon: string;
    title: string;
    color: string;
    gradient: string;
  }> = [
    {
      id: 'reset',
      icon: '🔄',
      title: t('resetAll') || 'Reset All',
      color: 'gray',
      gradient: 'from-gray-700 to-gray-900',
    },
    {
      id: 'voice-coder',
      icon: '🎵',
      title: t('voiceCoder.title') || 'Voice Coder',
      color: 'blue',
      gradient: 'from-blue-600 to-blue-800',
    },
    {
      id: 'back-sound',
      icon: '🎶',
      title: t('backSound.title') || 'Background',
      color: 'green',
      gradient: 'from-green-600 to-green-800',
    },
    {
      id: 'baby-voice',
      icon: '👶',
      title: t('babyVoice.title') || 'Baby Voice',
      color: 'pink',
      gradient: 'from-pink-600 to-pink-800',
    },
    {
      id: 'demon-voice',
      icon: '😈',
      title: t('demonVoice.title') || 'Demon Voice',
      color: 'red',
      gradient: 'from-red-600 to-red-800',
    },
  ];

  // Get effect status
  const getEffectStatus = (id: EffectTileType) => {
    if (id === 'reset') return null;
    return effectsState[id as AudioEffectType];
  };

  // Scroll handlers
  const scrollLeft = () => {
    const container = document.getElementById('effects-carousel');
    if (container) {
      container.scrollBy({ left: -200, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    const container = document.getElementById('effects-carousel');
    if (container) {
      container.scrollBy({ left: 200, behavior: 'smooth' });
    }
  };

  return (
    <div
      className={cn(
        'bg-gradient-to-br from-gray-900/95 via-black/95 to-purple-900/95',
        'backdrop-blur-xl rounded-lg p-3 max-h-[90vh] overflow-hidden flex flex-col',
        'border border-white/10 shadow-2xl',
        'animate-in slide-in-from-bottom duration-300',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-md flex items-center justify-center">
            <span className="text-lg">🎭</span>
          </div>
          <div>
            <h3 className="text-white text-sm font-bold">{t('title') || 'Audio Effects'}</h3>
            <p className="text-gray-400 text-[10px]">{t('subtitle') || 'Customize your voice'}</p>
          </div>
        </div>

        {onClose && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0 rounded-full hover:bg-white/10 text-gray-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Carousel */}
      <div className="relative mb-3">
        {/* Scroll Left Button */}
        <button
          onClick={scrollLeft}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-black/80 hover:bg-black rounded-full flex items-center justify-center text-white shadow-lg"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Tiles Container */}
        <div
          id="effects-carousel"
          className="flex gap-3 overflow-x-auto scrollbar-hide px-10 py-2"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {effectTiles.map((tile) => {
            const status = getEffectStatus(tile.id);
            const isActive = status?.enabled || false;
            const isSelected = selectedEffect === tile.id;

            return (
              <Card
                key={tile.id}
                onClick={() => {
                  if (tile.id === 'reset') {
                    handleResetAll();
                  } else {
                    // Ouvrir la configuration de l'effet
                    setSelectedEffect(isSelected ? null : tile.id);
                  }
                }}
                className={cn(
                  'relative flex-shrink-0 w-32 h-32 p-3 cursor-pointer transition-all duration-300',
                  `bg-gradient-to-br ${tile.gradient}`,
                  'hover:scale-105 hover:shadow-xl',
                  isSelected && 'ring-2 ring-white scale-105',
                  isActive && 'shadow-lg shadow-' + tile.color + '-500/50'
                )}
              >
                <div className="flex flex-col items-center justify-between h-full text-white">
                  {/* Icon */}
                  <div className="text-3xl">{tile.icon}</div>

                  {/* Title */}
                  <div className="text-center flex-1 flex items-center">
                    <p className="text-xs font-semibold leading-tight">{tile.title}</p>
                  </div>

                  {/* Switch ON/OFF (pour activer/désactiver sans ouvrir) */}
                  {tile.id !== 'reset' && (
                    <div
                      onClick={(e) => {
                        e.stopPropagation(); // Ne pas ouvrir la config
                      }}
                      className="flex items-center gap-2"
                    >
                      <span className="text-[8px] uppercase font-bold">
                        {isActive ? 'ON' : 'OFF'}
                      </span>
                      <Switch
                        checked={isActive}
                        onCheckedChange={() => onToggleEffect(tile.id as AudioEffectType)}
                        className="scale-75 data-[state=checked]:bg-green-500"
                      />
                    </div>
                  )}

                  {tile.id === 'reset' && (
                    <RotateCcw className="w-4 h-4 opacity-70" />
                  )}
                </div>
              </Card>
            );
          })}
        </div>

        {/* Scroll Right Button */}
        <button
          onClick={scrollRight}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-black/80 hover:bg-black rounded-full flex items-center justify-center text-white shadow-lg"
        >
          <ChevronRight className="w-4 w-4" />
        </button>
      </div>

      {/* Effect Details Panel */}
      {selectedEffect && selectedEffect !== 'reset' && (
        <div className="flex-1 overflow-y-auto">
          {selectedEffect === 'voice-coder' && (
            <VoiceCoderDetails
              effect={effectsState.voiceCoder}
              onToggle={() => onToggleEffect('voice-coder')}
              onUpdateParams={(params) => onUpdateParams('voice-coder', params)}
              onLoadPreset={onLoadPreset}
              currentPreset={currentPreset}
              availablePresets={availablePresets}
            />
          )}

          {selectedEffect === 'back-sound' && (
            <BackSoundDetails
              effect={effectsState.backSound}
              onToggle={() => onToggleEffect('back-sound')}
              onUpdateParams={(params) => onUpdateParams('back-sound', params)}
              availableBackSounds={availableBackSounds}
            />
          )}

          {selectedEffect === 'baby-voice' && (
            <BabyVoiceDetails
              effect={effectsState.babyVoice}
              onToggle={() => onToggleEffect('baby-voice')}
              onUpdateParams={(params) => onUpdateParams('baby-voice', params)}
            />
          )}

          {selectedEffect === 'demon-voice' && (
            <DemonVoiceDetails
              effect={effectsState.demonVoice}
              onToggle={() => onToggleEffect('demon-voice')}
              onUpdateParams={(params) => onUpdateParams('demon-voice', params)}
            />
          )}
        </div>
      )}

      {!selectedEffect && (
        <div className="flex-1 flex items-center justify-center text-gray-400 text-sm text-center px-4">
          <p>{t('selectEffectPrompt') || 'Click on an effect to configure it'}</p>
        </div>
      )}
    </div>
  );
}

// Voice Coder Details Component
function VoiceCoderDetails({
  effect,
  onToggle,
  onUpdateParams,
  onLoadPreset,
  currentPreset,
  availablePresets,
}: {
  effect: AudioEffectsState['voiceCoder'];
  onToggle: () => void;
  onUpdateParams: (params: Partial<VoiceCoderParams>) => void;
  onLoadPreset?: (preset: VoiceCoderPreset) => void;
  currentPreset?: VoiceCoderPreset;
  availablePresets?: Record<string, { name: string; description: string; params: VoiceCoderParams }>;
}) {
  const { t } = useI18n('audioEffects');

  return (
    <Card className="bg-gradient-to-br from-blue-900/40 to-blue-800/20 border-blue-500/30 p-4">
      <div className="space-y-4">
        {/* Header with toggle */}
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-white font-bold text-base flex items-center gap-2">
              <span className="text-2xl">🎵</span>
              {t('voiceCoder.title')}
            </h4>
            <p className="text-gray-400 text-xs mt-1">
              Auto-tune et correction de justesse
            </p>
          </div>
          <Switch checked={effect.enabled} onCheckedChange={onToggle} />
        </div>

        <div className={cn('space-y-3', !effect.enabled && 'opacity-50 pointer-events-none')}>
          {/* Preset Selector */}
          {availablePresets && onLoadPreset && (
            <div>
              <Label className="text-white text-sm mb-2 block">Configuration rapide</Label>
              <Select
                value={currentPreset || 'correction-subtile'}
                onValueChange={(value: VoiceCoderPreset) => onLoadPreset(value)}
              >
                <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(availablePresets).map(([key, preset]) => (
                    <SelectItem key={key} value={key}>
                      {preset.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">Personnalisé</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Sliders with precise control (0.01 step where applicable) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-white text-xs mb-1 block">
                Rapidité: {effect.params.retuneSpeed}%
              </Label>
              <Slider
                value={[effect.params.retuneSpeed]}
                min={0}
                max={100}
                step={0.01}
                onValueChange={([value]) => onUpdateParams({ retuneSpeed: Math.round(value * 100) / 100 })}
              />
            </div>

            <div>
              <Label className="text-white text-xs mb-1 block">
                Force: {effect.params.strength}%
              </Label>
              <Slider
                value={[effect.params.strength]}
                min={0}
                max={100}
                step={0.01}
                onValueChange={([value]) => onUpdateParams({ strength: Math.round(value * 100) / 100 })}
              />
            </div>

            <div>
              <Label className="text-white text-xs mb-1 block">
                Vibrato: {effect.params.naturalVibrato}%
              </Label>
              <Slider
                value={[effect.params.naturalVibrato]}
                min={0}
                max={100}
                step={0.01}
                onValueChange={([value]) => onUpdateParams({ naturalVibrato: Math.round(value * 100) / 100 })}
              />
            </div>

            <div>
              <Label className="text-white text-xs mb-1 block">
                Pitch: {effect.params.pitch > 0 ? '+' : ''}{effect.params.pitch}
              </Label>
              <Slider
                value={[effect.params.pitch]}
                min={-12}
                max={12}
                step={0.01}
                onValueChange={([value]) => onUpdateParams({ pitch: Math.round(value * 100) / 100 })}
              />
            </div>
          </div>

          {/* Scale and Key */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-white text-xs mb-1 block">Gamme</Label>
              <Select
                value={effect.params.scale}
                onValueChange={(value: 'chromatic' | 'major' | 'minor' | 'pentatonic') =>
                  onUpdateParams({ scale: value })
                }
              >
                <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="chromatic">Chromatique</SelectItem>
                  <SelectItem value="major">Majeur</SelectItem>
                  <SelectItem value="minor">Mineur</SelectItem>
                  <SelectItem value="pentatonic">Pentatonique</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-white text-xs mb-1 block">Tonalité</Label>
              <Select
                value={effect.params.key}
                onValueChange={(value) => onUpdateParams({ key: value as any })}
              >
                <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].map((key) => (
                    <SelectItem key={key} value={key}>
                      {key}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Harmonization */}
          <div className="flex items-center justify-between p-2 bg-gray-800/50 rounded">
            <Label className="text-white text-sm">Harmonisation</Label>
            <Switch
              checked={effect.params.harmonization}
              onCheckedChange={(checked) => onUpdateParams({ harmonization: checked })}
            />
          </div>
        </div>
      </div>
    </Card>
  );
}

// Back Sound Details Component
function BackSoundDetails({
  effect,
  onToggle,
  onUpdateParams,
  availableBackSounds,
}: {
  effect: AudioEffectsState['backSound'];
  onToggle: () => void;
  onUpdateParams: (params: Partial<BackSoundParams>) => void;
  availableBackSounds: readonly { id: string; name: string; url: string }[];
}) {
  const { t } = useI18n('audioEffects');

  return (
    <Card className="bg-gradient-to-br from-green-900/40 to-green-800/20 border-green-500/30 p-4">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-white font-bold text-base flex items-center gap-2">
              <span className="text-2xl">🎶</span>
              {t('backSound.title')}
            </h4>
            <p className="text-gray-400 text-xs mt-1">
              Musique de fond
            </p>
          </div>
          <Switch checked={effect.enabled} onCheckedChange={onToggle} />
        </div>

        <div className={cn('space-y-3', !effect.enabled && 'opacity-50 pointer-events-none')}>
          {/* Upload */}
          <div>
            <Label className="text-white text-sm mb-2 block">Importer un fichier</Label>
            <label className="flex items-center justify-center gap-2 w-full py-2 px-3 bg-gray-800 border border-gray-600 rounded-md text-white text-sm cursor-pointer hover:bg-gray-700">
              <Upload className="w-4 h-4" />
              <span>Choisir un fichier audio</span>
              <input
                type="file"
                accept="audio/mp3,audio/wav,audio/mpeg,audio/x-wav"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const url = URL.createObjectURL(file);
                    onUpdateParams({ soundFile: url });
                  }
                }}
              />
            </label>
          </div>

          {/* Volume */}
          <div>
            <Label className="text-white text-xs mb-1 block">
              Volume: {effect.params.volume}%
            </Label>
            <Slider
              value={[effect.params.volume]}
              min={0}
              max={100}
              step={0.01}
              onValueChange={([value]) => onUpdateParams({ volume: Math.round(value * 100) / 100 })}
            />
          </div>

          {/* Loop Mode */}
          <div>
            <Label className="text-white text-sm mb-2 block">Mode de lecture</Label>
            <Select
              value={effect.params.loopMode}
              onValueChange={(value: 'N_TIMES' | 'N_MINUTES') => onUpdateParams({ loopMode: value })}
            >
              <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="N_TIMES">Nombre de fois</SelectItem>
                <SelectItem value="N_MINUTES">Durée (minutes)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Loop Value */}
          <div>
            <Label className="text-white text-xs mb-1 block">
              {effect.params.loopMode === 'N_TIMES' ? 'Répétitions' : 'Minutes'}: {effect.params.loopValue}
            </Label>
            <Slider
              value={[effect.params.loopValue]}
              min={1}
              max={effect.params.loopMode === 'N_TIMES' ? 10 : 60}
              step={1}
              onValueChange={([value]) => onUpdateParams({ loopValue: value })}
            />
          </div>
        </div>
      </div>
    </Card>
  );
}

// Baby Voice Details Component
function BabyVoiceDetails({
  effect,
  onToggle,
  onUpdateParams,
}: {
  effect: AudioEffectsState['babyVoice'];
  onToggle: () => void;
  onUpdateParams: (params: Partial<BabyVoiceParams>) => void;
}) {
  const { t } = useI18n('audioEffects');

  return (
    <Card className="bg-gradient-to-br from-pink-900/40 to-pink-800/20 border-pink-500/30 p-4">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-white font-bold text-base flex items-center gap-2">
              <span className="text-2xl">👶</span>
              {t('babyVoice.title')}
            </h4>
            <p className="text-gray-400 text-xs mt-1">
              Voix enfantine
            </p>
          </div>
          <Switch checked={effect.enabled} onCheckedChange={onToggle} />
        </div>

        <div className={cn('space-y-3', !effect.enabled && 'opacity-50 pointer-events-none')}>
          <div>
            <Label className="text-white text-xs mb-1 block">
              Pitch: +{effect.params.pitch}
            </Label>
            <Slider
              value={[effect.params.pitch]}
              min={6}
              max={12}
              step={0.01}
              onValueChange={([value]) => onUpdateParams({ pitch: Math.round(value * 100) / 100 })}
            />
          </div>

          <div>
            <Label className="text-white text-xs mb-1 block">
              Formant: {effect.params.formant.toFixed(2)}x
            </Label>
            <Slider
              value={[effect.params.formant * 100]}
              min={120}
              max={150}
              step={0.01}
              onValueChange={([value]) => onUpdateParams({ formant: Math.round(value * 100) / 10000 })}
            />
          </div>

          <div>
            <Label className="text-white text-xs mb-1 block">
              Breathiness: {effect.params.breathiness}%
            </Label>
            <Slider
              value={[effect.params.breathiness]}
              min={0}
              max={100}
              step={0.01}
              onValueChange={([value]) => onUpdateParams({ breathiness: Math.round(value * 100) / 100 })}
            />
          </div>
        </div>
      </div>
    </Card>
  );
}

// Demon Voice Details Component
function DemonVoiceDetails({
  effect,
  onToggle,
  onUpdateParams,
}: {
  effect: AudioEffectsState['demonVoice'];
  onToggle: () => void;
  onUpdateParams: (params: Partial<DemonVoiceParams>) => void;
}) {
  const { t } = useI18n('audioEffects');

  return (
    <Card className="bg-gradient-to-br from-red-900/40 to-red-800/20 border-red-500/30 p-4">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-white font-bold text-base flex items-center gap-2">
              <span className="text-2xl">😈</span>
              {t('demonVoice.title')}
            </h4>
            <p className="text-gray-400 text-xs mt-1">
              Voix démoniaque
            </p>
          </div>
          <Switch checked={effect.enabled} onCheckedChange={onToggle} />
        </div>

        <div className={cn('space-y-3', !effect.enabled && 'opacity-50 pointer-events-none')}>
          <div>
            <Label className="text-white text-xs mb-1 block">
              Pitch: {effect.params.pitch}
            </Label>
            <Slider
              value={[effect.params.pitch]}
              min={-12}
              max={-8}
              step={0.01}
              onValueChange={([value]) => onUpdateParams({ pitch: Math.round(value * 100) / 100 })}
            />
          </div>

          <div>
            <Label className="text-white text-xs mb-1 block">
              Distortion: {effect.params.distortion}%
            </Label>
            <Slider
              value={[effect.params.distortion]}
              min={0}
              max={100}
              step={0.01}
              onValueChange={([value]) => onUpdateParams({ distortion: Math.round(value * 100) / 100 })}
            />
          </div>

          <div>
            <Label className="text-white text-xs mb-1 block">
              Reverb: {effect.params.reverb}%
            </Label>
            <Slider
              value={[effect.params.reverb]}
              min={0}
              max={100}
              step={0.01}
              onValueChange={([value]) => onUpdateParams({ reverb: Math.round(value * 100) / 100 })}
            />
          </div>
        </div>
      </div>
    </Card>
  );
}
