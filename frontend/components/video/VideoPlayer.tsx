'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  Download,
  AlertTriangle,
  Volume2,
  VolumeX,
  Maximize,
  Minimize
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { UploadedAttachmentResponse } from '@/shared/types/attachment';

interface VideoPlayerProps {
  attachment: UploadedAttachmentResponse;
  className?: string;
  onOpenLightbox?: () => void;
}

// Gestionnaire global pour arrêter toutes les autres vidéos
class VideoManager {
  private static instance: VideoManager;
  private currentVideo: HTMLVideoElement | null = null;

  static getInstance(): VideoManager {
    if (!VideoManager.instance) {
      VideoManager.instance = new VideoManager();
    }
    return VideoManager.instance;
  }

  play(video: HTMLVideoElement) {
    // Arrêter la vidéo en cours s'il y en a une
    if (this.currentVideo && this.currentVideo !== video) {
      this.currentVideo.pause();
    }
    this.currentVideo = video;
  }

  stop(video: HTMLVideoElement) {
    if (this.currentVideo === video) {
      this.currentVideo = null;
    }
  }
}

/**
 * Lecteur vidéo MODERNE avec contrôles complets
 * - Bouton Play/Pause
 * - Barre de progression
 * - Contrôle du volume
 * - Mode plein écran
 * - Bouton télécharger
 */
export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  attachment,
  className = '',
  onOpenLightbox
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoadedMetadata, setHasLoadedMetadata] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Extraire les valeurs primitives pour éviter les re-renders
  const attachmentId = attachment.id;
  const attachmentDuration = attachment.duration;
  const attachmentFileUrl = attachment.fileUrl;
  const attachmentMimeType = attachment.mimeType;

  // Définir le src de la vidéo après le montage
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (attachmentFileUrl) {
      const isValidUrl =
        attachmentFileUrl.startsWith('http://') ||
        attachmentFileUrl.startsWith('https://');

      if (isValidUrl) {
        video.src = attachmentFileUrl;
        video.load();
      } else {
        setHasError(true);
        setErrorMessage('URL du fichier invalide');
      }
    } else {
      setHasError(true);
      setErrorMessage('URL du fichier manquante');
    }
  }, [attachmentId, attachmentFileUrl]);

  // Fonction pour mettre à jour le temps avec requestAnimationFrame (fluide)
  const updateProgress = useCallback(() => {
    if (videoRef.current && !videoRef.current.paused) {
      setCurrentTime(videoRef.current.currentTime);
      animationFrameRef.current = requestAnimationFrame(updateProgress);
    }
  }, []);

  // Gérer le démarrage/arrêt de l'animation de progression
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

  // Toggle play/pause
  const togglePlay = useCallback(async () => {
    if (!videoRef.current) {
      return;
    }

    if (!attachmentFileUrl) {
      setHasError(true);
      setErrorMessage('URL du fichier vidéo manquante');
      return;
    }

    try {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
        VideoManager.getInstance().stop(videoRef.current);
      } else {
        setIsLoading(true);
        setHasError(false);

        // Arrêter toutes les autres vidéos avant de démarrer celle-ci
        VideoManager.getInstance().play(videoRef.current);

        // Forcer le chargement de la source si nécessaire
        if (videoRef.current.readyState === 0) {
          videoRef.current.load();
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        await videoRef.current.play();
        setIsPlaying(true);
        setIsLoading(false);
      }
    } catch (error: any) {
      setIsLoading(false);
      setIsPlaying(false);
      setHasError(true);

      if (error?.name === 'NotSupportedError') {
        setErrorMessage('Format vidéo non supporté');
      } else if (error?.name === 'NotAllowedError') {
        setErrorMessage('Lecture bloquée par le navigateur');
      } else {
        setErrorMessage('Erreur de lecture vidéo');
      }
    }
  }, [attachmentId, attachmentFileUrl, isPlaying]);

  // Handler pour récupérer la durée
  const tryToGetDuration = useCallback(() => {
    if (attachmentDuration && attachmentDuration > 0 && !hasLoadedMetadata) {
      setDuration(attachmentDuration);
      setHasLoadedMetadata(true);
      return;
    }

    if (videoRef.current) {
      const videoDuration = videoRef.current.duration;
      if (isFinite(videoDuration) && videoDuration > 0 && !hasLoadedMetadata) {
        setDuration(videoDuration);
        setHasLoadedMetadata(true);
        return;
      }
    }
  }, [attachmentDuration, hasLoadedMetadata]);

  // Handler pour les métadonnées chargées
  const handleLoadedMetadata = useCallback(() => {
    tryToGetDuration();
  }, [tryToGetDuration]);

  // Handler pour la fin de lecture
  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    if (videoRef.current && duration > 0) {
      setCurrentTime(duration);
    }
  }, [duration]);

  // Handler pour les erreurs de l'élément vidéo
  const handleVideoError = useCallback(
    (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
      const video = e.currentTarget;
      const error = video.error;

      if (
        error?.code === MediaError.MEDIA_ERR_DECODE &&
        attachmentMimeType?.includes('webm')
      ) {
        setHasError(true);
        setIsLoading(false);
        setIsPlaying(false);
        setErrorMessage('Format non supporté sur ce navigateur');
        return;
      }

      if (duration > 0) return;

      if (
        error &&
        (error.code === MediaError.MEDIA_ERR_NETWORK ||
          error.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED)
      ) {
        setHasError(true);
        setIsLoading(false);
        setIsPlaying(false);
        setErrorMessage(
          error.code === MediaError.MEDIA_ERR_NETWORK
            ? 'Erreur réseau'
            : 'Format non supporté'
        );
      }
    },
    [attachmentMimeType, duration]
  );

  // Écouter les événements de pause
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePause = () => {
      setIsPlaying(false);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };

    video.addEventListener('pause', handlePause);

    return () => {
      video.removeEventListener('pause', handlePause);
      video.pause();
      VideoManager.getInstance().stop(video);

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      video.removeAttribute('src');
      video.load();
    };
  }, []);

  // Initialiser la durée depuis l'attachment si disponible
  useEffect(() => {
    if (attachmentDuration && attachmentDuration > 0) {
      setDuration(attachmentDuration);
    }
  }, [attachmentId, attachmentDuration]);

  // Handler pour changer la position dans la vidéo
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  };

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  }, [isMuted]);

  // Changer le volume
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

  // Toggle plein écran
  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return;

    try {
      if (!isFullscreen) {
        if (containerRef.current.requestFullscreen) {
          await containerRef.current.requestFullscreen();
        }
        setIsFullscreen(true);
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
        setIsFullscreen(false);
      }
    } catch (error) {
      console.error('Erreur plein écran:', error);
    }
  }, [isFullscreen]);

  // Écouter les changements de plein écran
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Formater le temps (MM:SS)
  const formatTime = (seconds: number): string => {
    if (!isFinite(seconds) || isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculer le pourcentage de progression
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className={`flex flex-col gap-2 p-3 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-gray-800 dark:to-gray-900 rounded-lg border ${
        hasError
          ? 'border-red-300 dark:border-red-700'
          : 'border-purple-200 dark:border-gray-700'
      } shadow-md hover:shadow-lg transition-all duration-200 w-full max-w-full min-w-0 overflow-hidden ${className}`}
    >
      {/* Élément vidéo - adapts to video aspect ratio */}
      <div className="relative w-full max-w-full bg-black rounded-lg overflow-hidden" style={{ aspectRatio: attachment.width && attachment.height ? `${attachment.width}/${attachment.height}` : '16/9' }}>
        <video
          ref={videoRef}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleEnded}
          onError={handleVideoError}
          preload="metadata"
          className="w-full h-full object-contain cursor-pointer"
          onClick={togglePlay}
          playsInline
        >
          Votre navigateur ne supporte pas la lecture vidéo.
        </video>

        {/* Overlay de chargement/erreur */}
        {(isLoading || hasError) && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            {isLoading ? (
              <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin" />
            ) : hasError ? (
              <div className="flex flex-col items-center gap-2 text-white">
                <AlertTriangle className="w-12 h-12" />
                <span className="text-sm">{errorMessage}</span>
              </div>
            ) : null}
          </div>
        )}

        {/* Bouton play central (quand en pause) */}
        {!isPlaying && !isLoading && !hasError && (
          <button
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 transition-all duration-200 group"
          >
            <div className="w-16 h-16 rounded-full bg-purple-600 hover:bg-purple-700 flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform">
              <Play className="w-8 h-8 text-white ml-1 fill-current" />
            </div>
          </button>
        )}
      </div>

      {/* Contrôles */}
      <div className="flex items-center gap-2">
        {/* Bouton Play/Pause */}
        <Button
          onClick={togglePlay}
          disabled={isLoading || hasError}
          size="sm"
          className={`flex-shrink-0 w-9 h-9 rounded-full ${
            hasError
              ? 'bg-red-500 hover:bg-red-600'
              : 'bg-purple-600 hover:bg-purple-700'
          } text-white shadow-lg hover:shadow-xl transition-all duration-200 p-0 flex items-center justify-center disabled:opacity-50`}
        >
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : hasError ? (
            <AlertTriangle className="w-4 h-4" />
          ) : isPlaying ? (
            <Pause className="w-4 h-4 fill-current" />
          ) : (
            <Play className="w-4 h-4 ml-0.5 fill-current" />
          )}
        </Button>

        {/* Temps actuel */}
        <span className="text-xs font-mono text-gray-600 dark:text-gray-300 flex-shrink-0">
          {formatTime(currentTime)}
        </span>

        {/* Barre de progression */}
        <div className="flex-1 relative h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-visible group cursor-pointer">
          <div
            className="absolute top-0 left-0 h-full rounded-full bg-gradient-to-r from-purple-500 via-purple-600 to-purple-500 dark:from-purple-400 dark:via-purple-500 dark:to-purple-400"
            style={{
              width: `${progress}%`,
              transition: 'none',
            }}
          />

          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white dark:bg-gray-100 rounded-full shadow-lg border-2 border-purple-600 dark:border-purple-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
            style={{
              left: `calc(${progress}% - 6px)`,
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

        {/* Durée totale */}
        <span className="text-xs font-mono text-gray-600 dark:text-gray-300 flex-shrink-0">
          {formatTime(duration)}
        </span>

        {/* Contrôles volume */}
        <div className="hidden sm:flex items-center gap-1">
          <Button
            onClick={toggleMute}
            size="sm"
            variant="ghost"
            className="w-8 h-8 p-0"
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-4 h-4" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </Button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            className="w-16 h-1 accent-purple-600"
          />
        </div>

        {/* Bouton plein écran */}
        <Button
          onClick={onOpenLightbox || toggleFullscreen}
          size="sm"
          variant="ghost"
          className="w-8 h-8 p-0"
          title={onOpenLightbox ? 'Ouvrir en lightbox' : 'Plein écran'}
        >
          {isFullscreen ? (
            <Minimize className="w-4 h-4" />
          ) : (
            <Maximize className="w-4 h-4" />
          )}
        </Button>

        {/* Bouton télécharger */}
        <a
          href={attachment.fileUrl}
          download={attachment.originalName}
          className="flex-shrink-0 p-1.5 hover:bg-white/50 dark:hover:bg-gray-700/50 rounded-full transition-all duration-200"
          title="Télécharger"
          onClick={(e) => e.stopPropagation()}
        >
          <Download className="w-4 h-4 text-gray-600 dark:text-gray-300" />
        </a>
      </div>
    </div>
  );
};
