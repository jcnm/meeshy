/**
 * USE AUDIO EFFECTS HOOK
 * Manages Web Audio API processing for voice effects
 *
 * Provides:
 * - Audio effect processing pipeline
 * - Real-time parameter updates
 * - Effect enable/disable
 * - Multiple effect chaining
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { logger } from '@/utils/logger';
import {
  createAudioEffectProcessor,
  VoiceCoderProcessor,
  BabyVoiceProcessor,
  DemonVoiceProcessor,
  BackSoundProcessor,
  BACK_SOUNDS,
  type AudioEffectProcessor,
} from '@/utils/audio-effects';
import type {
  AudioEffectType,
  VoiceCoderParams,
  BabyVoiceParams,
  DemonVoiceParams,
  BackSoundParams,
  AudioEffectsState,
} from '@shared/types/video-call';

// Default parameters for each effect
const DEFAULT_VOICE_CODER: VoiceCoderParams = {
  pitch: 0,
  harmonization: false,
  strength: 50,
};

const DEFAULT_BABY_VOICE: BabyVoiceParams = {
  pitch: 8,
  formant: 1.3,
  breathiness: 20,
};

const DEFAULT_DEMON_VOICE: DemonVoiceParams = {
  pitch: -10,
  distortion: 30,
  reverb: 60,
};

const DEFAULT_BACK_SOUND: BackSoundParams = {
  soundFile: BACK_SOUNDS[0].id,
  volume: 20,
  loopMode: 'N_TIMES',
  loopValue: 1,
};

export interface UseAudioEffectsOptions {
  inputStream: MediaStream | null;
  onOutputStreamReady?: (stream: MediaStream) => void;
}

export function useAudioEffects({ inputStream, onOutputStreamReady }: UseAudioEffectsOptions) {
  // Audio context and nodes
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const destinationNodeRef = useRef<MediaStreamAudioDestinationNode | null>(null);

  // Effect processors
  const processorsRef = useRef<Map<AudioEffectType, AudioEffectProcessor>>(new Map());

  // Output stream
  const [outputStream, setOutputStream] = useState<MediaStream | null>(null);

  // Effects state
  const [effectsState, setEffectsState] = useState<AudioEffectsState>({
    voiceCoder: {
      type: 'voice-coder',
      enabled: false,
      params: DEFAULT_VOICE_CODER,
    },
    babyVoice: {
      type: 'baby-voice',
      enabled: false,
      params: DEFAULT_BABY_VOICE,
    },
    demonVoice: {
      type: 'demon-voice',
      enabled: false,
      params: DEFAULT_DEMON_VOICE,
    },
    backSound: {
      type: 'back-sound',
      enabled: false,
      params: DEFAULT_BACK_SOUND,
    },
  });

  /**
   * Initialize audio context and pipeline
   */
  const initializeAudioPipeline = useCallback(() => {
    if (!inputStream) {
      logger.warn('[useAudioEffects]', 'No input stream available');
      return;
    }

    try {
      // Create audio context if needed
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
        logger.debug('[useAudioEffects]', 'AudioContext created', {
          sampleRate: audioContextRef.current.sampleRate,
        });
      }

      const context = audioContextRef.current;

      // Create source from input stream
      if (!sourceNodeRef.current) {
        sourceNodeRef.current = context.createMediaStreamSource(inputStream);
        logger.debug('[useAudioEffects]', 'Source node created');
      }

      // Create destination
      if (!destinationNodeRef.current) {
        destinationNodeRef.current = context.createMediaStreamDestination();
        logger.debug('[useAudioEffects]', 'Destination node created');
      }

      // Initially, connect source directly to destination (no effects)
      sourceNodeRef.current.connect(destinationNodeRef.current);

      // Set output stream
      const newOutputStream = destinationNodeRef.current.stream;
      setOutputStream(newOutputStream);
      onOutputStreamReady?.(newOutputStream);

      logger.info('[useAudioEffects]', 'Audio pipeline initialized');
    } catch (error) {
      logger.error('[useAudioEffects]', 'Failed to initialize audio pipeline', { error });
    }
  }, [inputStream, onOutputStreamReady]);

  /**
   * Rebuild audio graph with enabled effects
   */
  const rebuildAudioGraph = useCallback(() => {
    if (!audioContextRef.current || !sourceNodeRef.current || !destinationNodeRef.current) {
      logger.warn('[useAudioEffects]', 'Audio context not initialized');
      return;
    }

    logger.debug('[useAudioEffects]', 'Rebuilding audio graph');

    // Disconnect everything
    sourceNodeRef.current.disconnect();
    processorsRef.current.forEach((processor) => {
      processor.disconnect();
    });

    // Get enabled effects
    const enabledEffects = Object.values(effectsState).filter((effect) => effect.enabled);

    if (enabledEffects.length === 0) {
      // No effects enabled, connect directly
      sourceNodeRef.current.connect(destinationNodeRef.current);
      logger.debug('[useAudioEffects]', 'No effects enabled, direct connection');
      return;
    }

    // Chain effects
    let currentNode: AudioNode = sourceNodeRef.current;

    for (const effect of enabledEffects) {
      const processor = processorsRef.current.get(effect.type);
      if (processor) {
        // Create intermediate gain node
        const intermediateNode = audioContextRef.current.createGain();
        currentNode.connect(intermediateNode);
        processor.connect(intermediateNode);
        currentNode = intermediateNode;
      }
    }

    // Connect last node to destination
    currentNode.connect(destinationNodeRef.current);

    logger.debug('[useAudioEffects]', 'Audio graph rebuilt', {
      enabledEffects: enabledEffects.map((e) => e.type),
    });
  }, [effectsState]);

  /**
   * Toggle effect on/off
   */
  const toggleEffect = useCallback((effectType: AudioEffectType) => {
    setEffectsState((prev) => {
      const effectKey = getEffectKey(effectType);
      return {
        ...prev,
        [effectKey]: {
          ...prev[effectKey],
          enabled: !prev[effectKey].enabled,
        },
      };
    });

    logger.debug('[useAudioEffects]', 'Effect toggled', { effectType });
  }, []);

  /**
   * Update effect parameters
   */
  const updateEffectParams = useCallback(
    <T extends AudioEffectType>(
      effectType: T,
      params: Partial<
        T extends 'voice-coder'
          ? VoiceCoderParams
          : T extends 'baby-voice'
          ? BabyVoiceParams
          : T extends 'demon-voice'
          ? DemonVoiceParams
          : BackSoundParams
      >
    ) => {
      setEffectsState((prev) => {
        const effectKey = getEffectKey(effectType);
        return {
          ...prev,
          [effectKey]: {
            ...prev[effectKey],
            params: {
              ...prev[effectKey].params,
              ...params,
            },
          },
        };
      });

      // Update processor if exists
      const processor = processorsRef.current.get(effectType);
      if (processor) {
        const effectKey = getEffectKey(effectType);
        const updatedParams = {
          ...effectsState[effectKey].params,
          ...params,
        };
        processor.updateParams(updatedParams);
      }

      logger.debug('[useAudioEffects]', 'Effect params updated', { effectType, params });
    },
    [effectsState]
  );

  /**
   * Create or get processor for effect type
   */
  const getOrCreateProcessor = useCallback(
    (effectType: AudioEffectType): AudioEffectProcessor | null => {
      if (!audioContextRef.current || !inputStream) return null;

      let processor = processorsRef.current.get(effectType);

      if (!processor) {
        const effectKey = getEffectKey(effectType);
        const effectConfig = effectsState[effectKey];

        try {
          processor = createAudioEffectProcessor(
            effectType as any,
            audioContextRef.current,
            inputStream,
            effectConfig.params as any
          );

          processorsRef.current.set(effectType, processor);

          logger.debug('[useAudioEffects]', 'Processor created', { effectType });
        } catch (error) {
          logger.error('[useAudioEffects]', 'Failed to create processor', {
            effectType,
            error,
          });
          return null;
        }
      }

      return processor;
    },
    [inputStream, effectsState]
  );

  /**
   * Initialize audio pipeline when input stream is available
   */
  useEffect(() => {
    if (inputStream) {
      initializeAudioPipeline();
    }

    return () => {
      // Cleanup on unmount
      if (sourceNodeRef.current) {
        sourceNodeRef.current.disconnect();
        sourceNodeRef.current = null;
      }

      if (destinationNodeRef.current) {
        destinationNodeRef.current.disconnect();
        destinationNodeRef.current = null;
      }

      processorsRef.current.forEach((processor) => {
        processor.destroy();
      });
      processorsRef.current.clear();

      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, [inputStream, initializeAudioPipeline]);

  /**
   * Rebuild audio graph when effects change
   */
  useEffect(() => {
    // Create processors for enabled effects
    Object.values(effectsState).forEach((effect) => {
      if (effect.enabled) {
        getOrCreateProcessor(effect.type);
      }
    });

    // Rebuild graph
    rebuildAudioGraph();
  }, [effectsState, getOrCreateProcessor, rebuildAudioGraph]);

  /**
   * Load background sound when selected
   */
  useEffect(() => {
    if (effectsState.backSound.enabled) {
      const processor = processorsRef.current.get('back-sound') as BackSoundProcessor | undefined;
      if (processor) {
        const sound = BACK_SOUNDS.find((s) => s.id === effectsState.backSound.params.soundFile);
        if (sound) {
          processor.loadSound(sound.url).then(() => {
            processor.play();
            logger.debug('[useAudioEffects]', 'Background sound loaded and playing', {
              soundFile: sound.name,
            });
          }).catch((error) => {
            logger.error('[useAudioEffects]', 'Failed to load background sound', { error });
          });
        }
      }
    } else {
      // Stop background sound if disabled
      const processor = processorsRef.current.get('back-sound') as BackSoundProcessor | undefined;
      if (processor) {
        processor.stop();
      }
    }
  }, [effectsState.backSound.enabled, effectsState.backSound.params.soundFile]);

  return {
    outputStream,
    effectsState,
    toggleEffect,
    updateEffectParams,
    availableBackSounds: BACK_SOUNDS,
  };
}

/**
 * Helper to get effect key from type
 */
function getEffectKey(type: AudioEffectType): keyof AudioEffectsState {
  switch (type) {
    case 'voice-coder':
      return 'voiceCoder';
    case 'baby-voice':
      return 'babyVoice';
    case 'demon-voice':
      return 'demonVoice';
    case 'back-sound':
      return 'backSound';
  }
}
