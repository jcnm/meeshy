/**
 * Hook for managing voice effects during calls
 */

'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { VoiceEffectsProcessor, type VoiceEffectType } from '@/lib/audio/voice-effects';

export interface UseVoiceEffectsOptions {
  initialEffect?: VoiceEffectType;
  initialIntensity?: number;
}

export function useVoiceEffects(options: UseVoiceEffectsOptions = {}) {
  const {
    initialEffect = 'none',
    initialIntensity = 50,
  } = options;

  const [currentEffect, setCurrentEffect] = useState<VoiceEffectType>(initialEffect);
  const [intensity, setIntensity] = useState(initialIntensity);
  const [isProcessing, setIsProcessing] = useState(false);

  const processorRef = useRef<VoiceEffectsProcessor | null>(null);
  const processedStreamRef = useRef<MediaStream | null>(null);

  // Initialize processor
  useEffect(() => {
    processorRef.current = new VoiceEffectsProcessor();

    return () => {
      if (processorRef.current) {
        processorRef.current.destroy();
        processorRef.current = null;
      }
      if (processedStreamRef.current) {
        processedStreamRef.current.getTracks().forEach(track => track.stop());
        processedStreamRef.current = null;
      }
    };
  }, []);

  /**
   * Apply voice effect to a media stream
   */
  const applyEffect = useCallback((
    inputStream: MediaStream,
    effect?: VoiceEffectType,
    effectIntensity?: number
  ): MediaStream => {
    const effectToApply = effect || currentEffect;
    const intensityToApply = effectIntensity !== undefined ? effectIntensity : intensity;

    if (!processorRef.current) {
      console.warn('Voice effects processor not initialized');
      return inputStream;
    }

    try {
      setIsProcessing(true);

      // Clean up previous processed stream
      if (processedStreamRef.current) {
        processedStreamRef.current.getTracks().forEach(track => track.stop());
      }

      // Apply effect
      const processedStream = processorRef.current.applyEffect(inputStream, {
        type: effectToApply,
        intensity: intensityToApply,
      });

      processedStreamRef.current = processedStream;
      setIsProcessing(false);

      return processedStream;
    } catch (error) {
      console.error('Failed to apply voice effect:', error);
      setIsProcessing(false);
      return inputStream;
    }
  }, [currentEffect, intensity]);

  /**
   * Change voice effect
   */
  const changeEffect = useCallback((effect: VoiceEffectType) => {
    setCurrentEffect(effect);
  }, []);

  /**
   * Change effect intensity
   */
  const changeIntensity = useCallback((newIntensity: number) => {
    setIntensity(Math.max(0, Math.min(100, newIntensity)));
  }, []);

  /**
   * Reset to no effect
   */
  const resetEffect = useCallback(() => {
    setCurrentEffect('none');
    setIntensity(50);
  }, []);

  /**
   * Get current effect info
   */
  const getCurrentEffectInfo = useCallback(() => {
    const effects = VoiceEffectsProcessor.getAvailableEffects();
    return effects.find(e => e.value === currentEffect) || effects[0];
  }, [currentEffect]);

  return {
    currentEffect,
    intensity,
    isProcessing,
    applyEffect,
    changeEffect,
    changeIntensity,
    resetEffect,
    getCurrentEffectInfo,
  };
}
