/**
 * Composant Lightbox pour afficher les vidéos en plein écran
 * Supporte : navigation, contrôles vidéo, téléchargement, clavier
 */

'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  X,
  Download,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Attachment, formatFileSize } from '../../shared/types/attachment';
import { Button } from '../ui/button';

interface VideoLightboxProps {
  videos: Attachment[];
  initialIndex: number;
  isOpen: boolean;
  onClose: () => void;
}

export function VideoLightbox({
  videos,
  initialIndex,
  isOpen,
  onClose,
}: VideoLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Reset état quand on change de vidéo
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, [currentIndex]);

  // Fonction pour mettre à jour le temps avec requestAnimationFrame
  const updateProgress = useCallback(() => {
    if (videoRef.current && !videoRef.current.paused) {
      setCurrentTime(videoRef.current.currentTime);
      animationFrameRef.current = requestAnimationFrame(updateProgress);
    }
  }, []);

  // Gérer l'animation de progression
  useEffect(() => {
    if (isPlaying && videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      animationFrameRef.current = requestAnimationFrame(updateProgress);
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [isPlaying, updateProgress]);

  // Navigation clavier
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          goToPrevious();
          break;
        case 'ArrowRight':
          goToNext();
          break;
        case ' ':
          e.preventDefault();
          togglePlay();
          break;
        case 'm':
        case 'M':
          toggleMute();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, isPlaying, isMuted]);

  // Empêcher le scroll du body quand le lightbox est ouvert
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const currentVideo = videos[currentIndex];
  const canGoPrevious = currentIndex > 0;
  const canGoNext = currentIndex < videos.length - 1;

  const goToPrevious = useCallback(() => {
    if (canGoPrevious) {
      setCurrentIndex((prev) => prev - 1);
    }
  }, [canGoPrevious]);

  const goToNext = useCallback(() => {
    if (canGoNext) {
      setCurrentIndex((prev) => prev + 1);
    }
  }, [canGoNext]);

  const togglePlay = useCallback(async () => {
    if (!videoRef.current) return;

    try {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        await videoRef.current.play();
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('Erreur de lecture vidéo:', error);
    }
  }, [isPlaying]);

  const toggleMute = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  }, [isMuted]);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      if (newVolume > 0 && isMuted) {
        setIsMuted(false);
        videoRef.current.muted = false;
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  };

  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  }, []);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    if (videoRef.current && duration > 0) {
      setCurrentTime(duration);
    }
  }, [duration]);

  const handleDownload = useCallback(() => {
    if (!currentVideo) return;

    const link = document.createElement('a');
    link.href = currentVideo.fileUrl;
    link.download = currentVideo.originalName;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [currentVideo]);

  const formatTime = (seconds: number): string => {
    if (!isFinite(seconds) || isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (!isOpen || !currentVideo) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] bg-black/95 dark:bg-black/98 backdrop-blur-sm"
        onClick={onClose}
      >
        {/* Barre d'outils supérieure */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/50 to-transparent">
          <div className="flex flex-col text-white">
            <span className="font-medium text-sm md:text-base truncate max-w-xs md:max-w-md">
              {currentVideo.originalName}
            </span>
            <span className="text-xs text-gray-300">
              {formatFileSize(currentVideo.fileSize)}
              {currentVideo.width &&
                currentVideo.height &&
                ` • ${currentVideo.width}x${currentVideo.height}`}
              {currentVideo.duration && ` • ${formatTime(currentVideo.duration)}`}
              {videos.length > 1 && ` • ${currentIndex + 1} / ${videos.length}`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                handleDownload();
              }}
              className="text-white hover:bg-white/10"
              aria-label="Télécharger la vidéo"
            >
              <Download className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="text-white hover:bg-white/10"
              aria-label="Fermer"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Zone d'affichage de la vidéo */}
        <div className="absolute inset-0 flex items-center justify-center p-4 md:p-8">
          <motion.div
            key={currentVideo.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{
              opacity: 1,
              scale: 1,
            }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-6xl aspect-video"
            onClick={(e) => e.stopPropagation()}
          >
            <video
              ref={videoRef}
              src={currentVideo.fileUrl}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={handleEnded}
              className="w-full h-full object-contain rounded-lg"
              onClick={togglePlay}
              playsInline
            >
              Votre navigateur ne supporte pas la lecture vidéo.
            </video>

            {/* Bouton play central (quand en pause) */}
            {!isPlaying && (
              <button
                onClick={togglePlay}
                className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 transition-all duration-200 group rounded-lg"
              >
                <div className="w-20 h-20 rounded-full bg-purple-600 hover:bg-purple-700 flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform">
                  <Play className="w-10 h-10 text-white ml-1 fill-current" />
                </div>
              </button>
            )}
          </motion.div>
        </div>

        {/* Navigation gauche */}
        {canGoPrevious && (
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              goToPrevious();
            }}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 text-white hover:bg-white/10 bg-black/30"
            aria-label="Vidéo précédente"
          >
            <ChevronLeft className="w-8 h-8" />
          </Button>
        )}

        {/* Navigation droite */}
        {canGoNext && (
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              goToNext();
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 text-white hover:bg-white/10 bg-black/30"
            aria-label="Vidéo suivante"
          >
            <ChevronRight className="w-8 h-8" />
          </Button>
        )}

        {/* Contrôles vidéo en bas */}
        <div className="absolute bottom-0 left-0 right-0 z-10 p-4 bg-gradient-to-t from-black/70 to-transparent">
          <div className="max-w-6xl mx-auto flex flex-col gap-3">
            {/* Barre de progression */}
            <div className="relative w-full h-2 bg-white/20 rounded-full overflow-visible group cursor-pointer">
              <div
                className="absolute top-0 left-0 h-full rounded-full bg-gradient-to-r from-purple-500 via-purple-600 to-purple-500"
                style={{
                  width: `${progress}%`,
                  transition: 'none',
                }}
              />

              <div
                className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg border-2 border-purple-600 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
                style={{
                  left: `calc(${progress}% - 8px)`,
                }}
              />

              <input
                type="range"
                min="0"
                max={duration || 100}
                value={currentTime}
                onChange={handleSeek}
                className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer z-10"
                style={{ touchAction: 'none' }}
              />
            </div>

            {/* Contrôles de lecture */}
            <div className="flex items-center gap-3 text-white">
              {/* Bouton Play/Pause */}
              <Button
                onClick={togglePlay}
                size="sm"
                className="w-10 h-10 rounded-full bg-purple-600 hover:bg-purple-700 text-white p-0 flex items-center justify-center"
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5 fill-current" />
                ) : (
                  <Play className="w-5 h-5 ml-0.5 fill-current" />
                )}
              </Button>

              {/* Temps */}
              <span className="text-sm font-mono flex-shrink-0">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>

              {/* Spacer */}
              <div className="flex-1" />

              {/* Contrôles volume */}
              <div className="hidden sm:flex items-center gap-2">
                <Button
                  onClick={toggleMute}
                  size="sm"
                  variant="ghost"
                  className="w-9 h-9 p-0 text-white hover:bg-white/10"
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-5 h-5" />
                  ) : (
                    <Volume2 className="w-5 h-5" />
                  )}
                </Button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-20 h-1 accent-purple-600"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Instructions clavier (desktop uniquement) */}
        <div className="hidden md:block absolute bottom-24 left-1/2 -translate-x-1/2 text-white/60 text-xs text-center">
          <p>
            Utilisez les flèches ← → pour naviguer • Espace pour play/pause • M
            pour mute • Échap pour fermer
          </p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
