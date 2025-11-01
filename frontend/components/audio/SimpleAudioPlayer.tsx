'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { UploadedAttachmentResponse } from '@/shared/types/attachment';

interface SimpleAudioPlayerProps {
  attachment: UploadedAttachmentResponse;
  className?: string;
}

/**
 * Lecteur audio SIMPLE et MODERNE
 * - Bouton Play/Pause central
 * - Barre de progression
 * - Durée affichée
 * - Bouton télécharger
 */
export const SimpleAudioPlayer: React.FC<SimpleAudioPlayerProps> = ({
  attachment,
  className = ''
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(attachment.duration || 0);
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Toggle play/pause
  const togglePlay = async () => {
    if (!audioRef.current) return;

    try {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        setIsLoading(true);
        await audioRef.current.play();
        setIsPlaying(true);
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Error playing audio:', error);
      setIsLoading(false);
      setIsPlaying(false);
    }
  };

  // Handler pour la mise à jour du temps
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  // Handler pour les métadonnées chargées
  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  // Handler pour la fin de lecture
  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  // Handler pour changer la position dans l'audio
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  // Formater le temps
  const formatTime = (seconds: number): string => {
    if (!isFinite(seconds) || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculer le pourcentage de progression
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className={`flex items-center gap-3 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-900 rounded-xl border border-blue-200 dark:border-gray-700 shadow-md hover:shadow-lg transition-all duration-200 ${className}`}
    >
      {/* Bouton Play/Pause - Grand et clair */}
      <Button
        onClick={togglePlay}
        disabled={isLoading}
        size="lg"
        className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 p-0 flex items-center justify-center"
      >
        {isLoading ? (
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : isPlaying ? (
          <Pause className="w-6 h-6 fill-current" />
        ) : (
          <Play className="w-6 h-6 ml-0.5 fill-current" />
        )}
      </Button>

      {/* Zone de progression et temps */}
      <div className="flex-1 min-w-0">
        {/* Barre de progression */}
        <div className="relative w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-2">
          {/* Barre de progression remplie */}
          <div
            className="absolute top-0 left-0 h-full bg-blue-600 dark:bg-blue-500 transition-all duration-150 rounded-full"
            style={{ width: `${progress}%` }}
          />

          {/* Input range invisible pour le contrôle */}
          <input
            type="range"
            min="0"
            max={duration || 100}
            value={currentTime}
            onChange={handleSeek}
            className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer"
          />
        </div>

        {/* Affichage du temps */}
        <div className="flex justify-between items-center text-xs sm:text-sm font-mono text-gray-600 dark:text-gray-300">
          <span className="font-semibold">{formatTime(currentTime)}</span>
          <span className="text-gray-400 dark:text-gray-500">
            {formatTime(duration)}
          </span>
        </div>
      </div>

      {/* Bouton télécharger */}
      <a
        href={attachment.fileUrl}
        download={attachment.originalName}
        className="flex-shrink-0 p-2 hover:bg-white/50 dark:hover:bg-gray-700/50 rounded-full transition-all duration-200"
        title="Télécharger"
      >
        <Download className="w-5 h-5 text-gray-600 dark:text-gray-300" />
      </a>

      {/* Audio element caché */}
      <audio
        ref={audioRef}
        src={attachment.fileUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        preload="metadata"
      />
    </div>
  );
};

/**
 * Version compacte pour les petits écrans
 */
export const CompactAudioPlayer: React.FC<SimpleAudioPlayerProps> = ({
  attachment,
  className = ''
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const togglePlay = async () => {
    if (!audioRef.current) return;

    try {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        await audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    } catch (error) {
      console.error('Error playing audio:', error);
    }
  };

  const formatDuration = (seconds: number): string => {
    if (!seconds || !isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-2 bg-blue-100 dark:bg-blue-900/30 rounded-full ${className}`}
    >
      {/* Bouton Play/Pause compact */}
      <button
        onClick={togglePlay}
        className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center transition-all duration-200"
      >
        {isPlaying ? (
          <Pause className="w-4 h-4 fill-current" />
        ) : (
          <Play className="w-4 h-4 ml-0.5 fill-current" />
        )}
      </button>

      {/* Durée */}
      <span className="text-sm font-mono text-blue-700 dark:text-blue-300">
        {formatDuration(attachment.duration || 0)}
      </span>

      {/* Audio element caché */}
      <audio
        ref={audioRef}
        src={attachment.fileUrl}
        onEnded={() => setIsPlaying(false)}
        preload="metadata"
      />
    </div>
  );
};
