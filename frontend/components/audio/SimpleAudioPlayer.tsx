'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Download, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { UploadedAttachmentResponse } from '@/shared/types/attachment';

interface SimpleAudioPlayerProps {
  attachment: UploadedAttachmentResponse;
  className?: string;
}

// Gestionnaire global pour arrêter tous les autres audios
class AudioManager {
  private static instance: AudioManager;
  private currentAudio: HTMLAudioElement | null = null;

  static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  play(audio: HTMLAudioElement) {
    // Arrêter l'audio en cours s'il y en a un
    if (this.currentAudio && this.currentAudio !== audio) {
      this.currentAudio.pause();
    }
    this.currentAudio = audio;
  }

  stop(audio: HTMLAudioElement) {
    if (this.currentAudio === audio) {
      this.currentAudio = null;
    }
  }
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
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoadedMetadata, setHasLoadedMetadata] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const audioRef = useRef<HTMLAudioElement>(null);
  const animationFrameRef = useRef<number | null>(null);


  // Extraire les valeurs primitives pour éviter les re-renders
  const attachmentId = attachment.id;
  const attachmentDuration = attachment.duration;
  const attachmentFileUrl = attachment.fileUrl;
  const attachmentMimeType = attachment.mimeType;

  // Définir le src de l'audio après le montage
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (attachmentFileUrl) {
      // Valider que l'URL est absolue (commence par http:// ou https://)
      const isValidUrl = attachmentFileUrl.startsWith('http://') || attachmentFileUrl.startsWith('https://');

      if (isValidUrl) {
        audio.src = attachmentFileUrl;
        audio.load();
      } else {
        setHasError(true);
        setErrorMessage('URL du fichier invalide');
      }
    } else {
      setHasError(true);
      setErrorMessage('URL du fichier manquante');
    }
  }, [attachmentId, attachmentFileUrl, attachment]);

  // Fonction pour mettre à jour le temps avec requestAnimationFrame (fluide)
  const updateProgress = useCallback(() => {
    if (audioRef.current && !audioRef.current.paused) {
      setCurrentTime(audioRef.current.currentTime);
      animationFrameRef.current = requestAnimationFrame(updateProgress);
    }
  }, []);

  // Gérer le démarrage/arrêt de l'animation de progression
  useEffect(() => {
    if (isPlaying && audioRef.current) {
      // Démarrer l'animation immédiatement
      setCurrentTime(audioRef.current.currentTime);
      animationFrameRef.current = requestAnimationFrame(updateProgress);
    } else {
      // Arrêter l'animation si pause
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    }

    // Cleanup à la fin
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [isPlaying, updateProgress]);

  // Toggle play/pause
  const togglePlay = useCallback(async () => {
    if (!audioRef.current) {
      return;
    }

    // Vérifier si l'audio a une source valide
    if (!attachmentFileUrl) {
      setHasError(true);
      setErrorMessage('URL du fichier audio manquante');
      return;
    }

    try {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
        AudioManager.getInstance().stop(audioRef.current);
      } else {
        setIsLoading(true);
        setHasError(false);

        // Arrêter tous les autres audios avant de démarrer celui-ci
        AudioManager.getInstance().play(audioRef.current);

        // Forcer le chargement de la source si nécessaire
        if (audioRef.current.readyState === 0) {
          audioRef.current.load();
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        await audioRef.current.play();
        setIsPlaying(true);
        setIsLoading(false);
      }
    } catch (error: any) {
      setIsLoading(false);
      setIsPlaying(false);
      setHasError(true);

      // Messages d'erreur plus explicites
      if (error?.name === 'NotSupportedError') {
        setErrorMessage('Format audio non supporté');
      } else if (error?.name === 'NotAllowedError') {
        setErrorMessage('Lecture bloquée par le navigateur');
      } else {
        setErrorMessage('Erreur de lecture audio');
      }
    }
  }, [attachmentId, attachmentFileUrl, isPlaying]);

  // Handler pour récupérer la durée - VERSION SIMPLIFIÉE
  const tryToGetDuration = useCallback(() => {
    // Priorité 1 : Utiliser attachment.duration du backend (fiable)
    if (attachmentDuration && attachmentDuration > 0 && !hasLoadedMetadata) {
      setDuration(attachmentDuration);
      setHasLoadedMetadata(true);
      return;
    }

    // Priorité 2 : Essayer audio.duration si disponible et valide
    if (audioRef.current) {
      const audioDuration = audioRef.current.duration;
      if (isFinite(audioDuration) && audioDuration > 0 && !hasLoadedMetadata) {
        setDuration(audioDuration);
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

    // À la fin de la lecture, currentTime devrait être à duration pour afficher 0:00.00
    // Le navigateur réinitialise parfois à 0, donc on force à duration
    if (audioRef.current && duration > 0) {
      setCurrentTime(duration);
    }
  }, [duration]);

  // Handler pour les erreurs de l'élément audio - VERSION SIMPLIFIÉE
  const handleAudioError = useCallback((e: React.SyntheticEvent<HTMLAudioElement, Event>) => {
    const audio = e.currentTarget;
    const error = audio.error;

    // Safari ne supporte pas WebM - afficher message adapté
    if (error?.code === MediaError.MEDIA_ERR_DECODE && attachmentMimeType?.includes('webm')) {
      setHasError(true);
      setIsLoading(false);
      setIsPlaying(false);
      setErrorMessage('Format non supporté sur ce navigateur');
      return;
    }

    // Si on a déjà une durée, ignorer l'erreur
    if (duration > 0) return;

    // Erreurs critiques uniquement
    if (error && (error.code === MediaError.MEDIA_ERR_NETWORK || error.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED)) {
      setHasError(true);
      setIsLoading(false);
      setIsPlaying(false);
      setErrorMessage(error.code === MediaError.MEDIA_ERR_NETWORK ? 'Erreur réseau' : 'Format non supporté');
    }
  }, [attachmentMimeType, duration]);

  // Écouter les événements de pause provenant d'autres lecteurs
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePause = () => {
      setIsPlaying(false);

      // Arrêter l'animation de progression
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };

    audio.addEventListener('pause', handlePause);

    return () => {
      audio.removeEventListener('pause', handlePause);
      audio.pause();
      AudioManager.getInstance().stop(audio);

      // Arrêter l'animation de progression
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      // Ne pas définir src = '' car cela peut causer des problèmes de chargement
      // Simplement pause et removeAttribute
      audio.removeAttribute('src');
      audio.load();
    };
  }, []);

  // Initialiser la durée depuis l'attachment si disponible (une seule fois au montage)
  useEffect(() => {
    if (attachmentDuration && attachmentDuration > 0) {
      setDuration(attachmentDuration);
    }
  }, [attachmentId, attachmentDuration]); // Dépendre seulement de l'ID et la durée (valeurs primitives)

  // Forcer le chargement des métadonnées au montage
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // Si les métadonnées ne sont pas chargées après 2s, forcer le load
    const timeout = setTimeout(() => {
      if (!hasLoadedMetadata && duration === 0 && audio.src) {
        audio.load();
      }
    }, 2000);

    return () => clearTimeout(timeout);
  }, [hasLoadedMetadata, duration]);

  // Initialiser la durée au chargement du composant - VERSION SIMPLIFIÉE
  useEffect(() => {
    // Essayer d'obtenir la durée dès que possible
    if (!duration && attachmentDuration && attachmentDuration > 0) {
      setDuration(attachmentDuration);
      setHasLoadedMetadata(true);
    }
  }, [attachmentDuration, duration]);

  // Handler pour changer la position dans l'audio
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  // Formater le temps avec millisecondes (MM:SS.ms pour le décompteur)
  const formatTime = (seconds: number): string => {
    if (!isFinite(seconds) || isNaN(seconds) || seconds < 0) return '0:00.00';
    const totalMs = Math.floor(seconds * 1000);
    const mins = Math.floor(totalMs / 60000);
    const secs = Math.floor((totalMs % 60000) / 1000);
    const ms = Math.floor((totalMs % 1000) / 10); // Deux chiffres pour les centièmes
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  // Calculer le pourcentage de progression
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Debug temporaire
  if (isPlaying && typeof window !== 'undefined') {
    (window as any)._audioDebug = {
      currentTime,
      duration,
      progress: progress.toFixed(2),
      isPlaying,
    };
  }

  return (
    <div
      className={`flex items-center gap-3 p-2 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-900 rounded-lg border ${
        hasError ? 'border-red-300 dark:border-red-700' : 'border-blue-200 dark:border-gray-700'
      } shadow-md hover:shadow-lg transition-all duration-200 w-full sm:max-w-2xl ${className}`}
    >
      {/* Bouton Play/Pause - Design moderne */}
      <Button
        onClick={togglePlay}
        disabled={isLoading || hasError}
        size="sm"
        className={`flex-shrink-0 w-10 h-10 rounded-full ${
          hasError
            ? 'bg-red-500 hover:bg-red-600'
            : 'bg-blue-600 hover:bg-blue-700'
        } text-white shadow-lg hover:shadow-xl transition-all duration-200 p-0 flex items-center justify-center disabled:opacity-50`}
      >
        {isLoading ? (
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : hasError ? (
          <AlertTriangle className="w-5 h-5" />
        ) : isPlaying ? (
          <Pause className="w-5 h-5 fill-current" />
        ) : (
          <Play className="w-5 h-5 ml-0.5 fill-current" />
        )}
      </Button>

      {/* Zone de progression et temps */}
      <div className="flex-1 min-w-0">
        {/* Barre de progression */}
        <div className="relative w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-visible mb-2 group cursor-pointer">
          {/* Barre de progression remplie avec animation fluide */}
          <div
            className={`absolute top-0 left-0 h-full rounded-full ${
              isPlaying
                ? 'bg-gradient-to-r from-blue-500 via-blue-600 to-blue-500 dark:from-blue-400 dark:via-blue-500 dark:to-blue-400'
                : 'bg-blue-600 dark:bg-blue-500'
            }`}
            style={{
              width: `${progress}%`,
              transition: 'none', // Pas de transition pour un rendu fluide à 60fps
            }}
          />

          {/* Curseur de position - Visible au survol avec animation smooth */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white dark:bg-gray-100 rounded-full shadow-lg border-2 border-blue-600 dark:border-blue-400 opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity duration-200 pointer-events-none"
            style={{
              left: `calc(${progress}% - 8px)`,
            }}
          />

          {/* Input range invisible pour le contrôle */}
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

        {/* Affichage du temps - TOUJOURS en mode décompteur avec millisecondes */}
        <div className="flex justify-between items-center text-sm font-mono text-gray-600 dark:text-gray-300">
          {hasError ? (
            <span className="font-semibold text-red-600 dark:text-red-400 text-[10px]">
              {errorMessage}
            </span>
          ) : duration > 0 ? (
            <>
              <span className="font-bold text-blue-600 dark:text-blue-400 tracking-wider">
                {formatTime(Math.max(0, duration - currentTime))}
              </span>
              <span className="text-[10px] text-gray-400 dark:text-gray-500 ml-2">
                {progress.toFixed(0)}%
              </span>
            </>
          ) : (
            <span className="font-semibold text-gray-400 dark:text-gray-500 text-[10px]">
              Chargement...
            </span>
          )}
        </div>
      </div>

      {/* Bouton télécharger - Plus petit */}
      <a
        href={attachment.fileUrl}
        download={attachment.originalName}
        className="flex-shrink-0 p-1.5 hover:bg-white/50 dark:hover:bg-gray-700/50 rounded-full transition-all duration-200"
        title="Télécharger"
      >
        <Download className="w-4 h-4 text-gray-600 dark:text-gray-300" />
      </a>

      {/* Audio element caché - src défini via useEffect pour éviter les problèmes de timing */}
      <audio
        ref={audioRef}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onError={handleAudioError}
        preload="metadata"
      >
        Votre navigateur ne supporte pas la lecture audio.
      </audio>
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
      // Erreur silencieuse
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
