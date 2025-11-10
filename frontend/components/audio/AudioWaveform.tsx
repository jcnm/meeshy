'use client';

import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

interface AudioWaveformProps {
  isRecording: boolean;
  audioLevel?: number;
  className?: string;
}

/**
 * Composant de visualisation d'onde audio animée
 * Affiche des barres animées qui réagissent au niveau audio
 */
export const AudioWaveform: React.FC<AudioWaveformProps> = ({
  isRecording,
  audioLevel = 0,
  className = '',
}) => {
  const bars = 20;
  const baseHeight = 4;
  const maxHeight = 40;

  // Générer des hauteurs aléatoires pour chaque barre basées sur le niveau audio
  const getBarHeight = (index: number) => {
    if (!isRecording) {
      return baseHeight;
    }

    // Créer un pattern de vague avec des hauteurs différentes
    const waveOffset = Math.sin((index / bars) * Math.PI * 2 + Date.now() / 200) * 0.5 + 0.5;
    const levelMultiplier = Math.max(0.2, audioLevel); // Min 20% d'activité
    const height = baseHeight + (maxHeight - baseHeight) * waveOffset * levelMultiplier;

    return height;
  };

  return (
    <div className={`flex items-center justify-center gap-1 h-12 ${className}`}>
      {Array.from({ length: bars }).map((_, index) => (
        <motion.div
          key={index}
          className={`w-1 rounded-full ${
            isRecording
              ? 'bg-gradient-to-t from-red-500 to-red-300'
              : 'bg-gray-300 dark:bg-gray-600'
          }`}
          animate={{
            height: isRecording ? getBarHeight(index) : baseHeight,
          }}
          transition={{
            duration: 0.15,
            repeat: isRecording ? Infinity : 0,
            repeatType: 'reverse',
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
};
