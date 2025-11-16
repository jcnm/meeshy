'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Play, Pause, Download, AlertTriangle, Gauge } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import type { UploadedAttachmentResponse } from '@/shared/types/attachment';
import type { AudioEffectType } from '@/shared/types/video-call';
import { apiService } from '@/services/api.service';

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
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [playbackRate, setPlaybackRate] = useState(1.0); // Vitesse de lecture (0.1 à 5)
  const [isSpeedPopoverOpen, setIsSpeedPopoverOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Extraire les effets appliqués depuis la timeline
  const appliedEffects = useMemo((): AudioEffectType[] => {
    // audioEffectsTimeline peut être soit directement sur attachment (upload response)
    // soit dans attachment.metadata (messages récupérés depuis la DB)
    const timeline = (attachment as any).audioEffectsTimeline || (attachment as any).metadata?.audioEffectsTimeline;

    console.log('🎭 [SimpleAudioPlayer] Extraction timeline des effets:', {
      attachmentId: attachment.id,
      hasAudioEffectsTimeline: !!(attachment as any).audioEffectsTimeline,
      hasMetadata: !!(attachment as any).metadata,
      hasMetadataTimeline: !!(attachment as any).metadata?.audioEffectsTimeline,
      timeline: timeline,
      timelineEvents: timeline?.events,
      attachmentKeys: Object.keys(attachment),
      fullAttachmentStringified: JSON.stringify(attachment, null, 2)
    });

    if (!timeline || !timeline.events || timeline.events.length === 0) {
      console.log('⚠️ [SimpleAudioPlayer] Pas de timeline ou pas d\'événements');
      return [];
    }

    // Récupérer les effets uniques qui ont été activés au moins une fois
    const effects = new Set<AudioEffectType>();
    for (const event of timeline.events) {
      if (event.action === 'activate') {
        effects.add(event.effectType);
      }
    }

    console.log('✅ [SimpleAudioPlayer] Effets appliqués extraits:', Array.from(effects));
    return Array.from(effects);
  }, [attachment]);

  // Icônes pour les effets
  const effectIcons: Record<AudioEffectType, string> = {
    'voice-coder': '🎵',
    'baby-voice': '👶',
    'demon-voice': '😈',
    'back-sound': '🎶',
  };

  // Extraire les valeurs primitives pour éviter les re-renders
  const attachmentId = attachment.id;
  const attachmentDuration = attachment.duration;
  const attachmentMimeType = attachment.mimeType;
  const attachmentFileUrl = attachment.fileUrl;

  // Charger l'audio via apiService - fetch blob et créer object URL
  useEffect(() => {
    let isMounted = true;
    let currentObjectUrl: string | null = null;

    const loadAudio = async () => {
      if (!attachmentFileUrl) {
        setHasError(true);
        setErrorMessage('URL du fichier manquante');
        return;
      }

      try {
        setIsLoading(true);
        setHasError(false);

        // Extraire le chemin API de l'URL (enlever le domaine si présent)
        let apiPath = attachmentFileUrl;

        // Si c'est une URL absolue, extraire le pathname
        if (attachmentFileUrl.startsWith('http://') || attachmentFileUrl.startsWith('https://')) {
          try {
            const url = new URL(attachmentFileUrl);
            apiPath = url.pathname;
          } catch {
            // Si parsing échoue, utiliser tel quel
          }
        }

        // Enlever le préfixe /api si présent (apiService l'ajoute automatiquement)
        if (apiPath.startsWith('/api/')) {
          apiPath = apiPath.substring(4);
        }

        console.log('🎵 [SimpleAudioPlayer] Fetching audio via apiService:', {
          original: attachmentFileUrl,
          apiPath,
          attachmentId
        });

        // Fetch via apiService - utilise automatiquement le bon backend URL
        const blob = await apiService.getBlob(apiPath);

        if (!isMounted) {
          return;
        }

        // Créer un object URL depuis le blob
        currentObjectUrl = URL.createObjectURL(blob);
        setObjectUrl(currentObjectUrl);

        console.log('✅ [SimpleAudioPlayer] Audio loaded successfully:', {
          blobSize: blob.size,
          blobType: blob.type,
          objectUrl: currentObjectUrl
        });

        // Charger l'audio une fois l'object URL créé
        if (audioRef.current) {
          audioRef.current.load();
        }

        setIsLoading(false);
      } catch (error: any) {
        console.error('❌ [SimpleAudioPlayer] Failed to load audio:', error);

        if (!isMounted) {
          return;
        }

        setHasError(true);
        setIsLoading(false);

        if (error?.status === 404) {
          setErrorMessage('Fichier audio introuvable');
        } else if (error?.status === 500) {
          setErrorMessage('Erreur serveur');
        } else if (error?.code === 'TIMEOUT') {
          setErrorMessage('Timeout - fichier trop volumineux');
        } else {
          setErrorMessage('Erreur de chargement');
        }
      }
    };

    loadAudio();

    // Cleanup: révoquer l'object URL quand le composant unmount ou l'URL change
    return () => {
      isMounted = false;
      if (currentObjectUrl) {
        console.log('🧹 [SimpleAudioPlayer] Revoking object URL:', currentObjectUrl);
        URL.revokeObjectURL(currentObjectUrl);
      }
    };
  }, [attachmentId, attachmentFileUrl]);

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

    // Vérifier si l'audio a une source valide (objectUrl créé)
    if (!objectUrl) {
      setHasError(true);
      setErrorMessage('Audio non chargé');
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
  }, [objectUrl, isPlaying]);

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

  // Appliquer la vitesse de lecture à l'élément audio
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // Handler pour changer la vitesse de lecture avec points d'accroche
  const handlePlaybackRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);

    // Points d'accroche (snap points) - tolérance de 0.05
    const snapPoints = [1.0, 1.5, 2.0, 3.0];
    const snapTolerance = 0.05;

    let finalValue = value;
    for (const snapPoint of snapPoints) {
      if (Math.abs(value - snapPoint) < snapTolerance) {
        finalValue = snapPoint;
        break;
      }
    }

    setPlaybackRate(finalValue);
  };

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
      className={`relative flex items-center gap-3 p-2 pr-12 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-900 rounded-lg border ${
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

      {/* Contrôle de vitesse de lecture - Popover avec slider vertical */}
      <Popover open={isSpeedPopoverOpen} onOpenChange={setIsSpeedPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            size="sm"
            variant="ghost"
            className="flex-shrink-0 w-10 h-10 rounded-full hover:bg-white/50 dark:hover:bg-gray-700/50 transition-all duration-200 p-0 flex flex-col items-center justify-center"
            title={`Vitesse: ${playbackRate}x`}
          >
            <Gauge className="w-4 h-4 text-gray-700 dark:text-gray-300" />
            <span className="text-[8px] font-bold text-gray-700 dark:text-gray-300">
              {playbackRate.toFixed(1)}x
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-20 p-3" side="top" align="center">
          <div className="flex flex-col items-center gap-2">
            {/* Titre */}
            <div className="text-[10px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
              Vitesse
            </div>

            {/* Slider vertical */}
            <div className="relative h-48 w-8 flex items-center justify-center">
              {/* Marqueurs des points d'accroche */}
              <div className="absolute left-0 h-full flex flex-col justify-between py-2 pointer-events-none">
                <div className="flex items-center gap-1">
                  <div className="w-1 h-0.5 bg-gray-400 dark:bg-gray-500" />
                  <span className="text-[7px] text-gray-500 dark:text-gray-400">5x</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-0.5 bg-purple-500" />
                  <span className="text-[7px] font-bold text-purple-600 dark:text-purple-400">3x</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-0.5 bg-purple-500" />
                  <span className="text-[7px] font-bold text-purple-600 dark:text-purple-400">2x</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-0.5 bg-purple-500" />
                  <span className="text-[7px] font-bold text-purple-600 dark:text-purple-400">1.5x</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-0.5 bg-blue-600 dark:bg-blue-500" />
                  <span className="text-[7px] font-bold text-blue-600 dark:text-blue-400">1x</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-1 h-0.5 bg-gray-400 dark:bg-gray-500" />
                  <span className="text-[7px] text-gray-500 dark:text-gray-400">0.1x</span>
                </div>
              </div>

              {/* Slider (input vertical) */}
              <input
                type="range"
                min="0.1"
                max="5"
                step="0.1"
                value={playbackRate}
                onChange={handlePlaybackRateChange}
                className="absolute h-full w-2 appearance-none bg-transparent cursor-pointer"
                style={{
                  writingMode: 'bt-lr', // Vertical
                  WebkitAppearance: 'slider-vertical',
                }}
              />
            </div>

            {/* Affichage de la vitesse actuelle */}
            <div className="text-sm font-bold text-blue-600 dark:text-blue-400 mt-1">
              {playbackRate.toFixed(1)}x
            </div>

            {/* Bouton reset à 1x */}
            {playbackRate !== 1.0 && (
              <Button
                size="sm"
                variant="outline"
                className="text-[10px] h-6 px-2"
                onClick={() => setPlaybackRate(1.0)}
              >
                Réinitialiser
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>

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
        <div className="text-sm font-mono text-gray-600 dark:text-gray-300">
          {hasError ? (
            <span className="font-semibold text-red-600 dark:text-red-400 text-[10px]">
              {errorMessage}
            </span>
          ) : duration > 0 ? (
            <span className="font-bold text-blue-600 dark:text-blue-400 tracking-wider">
              {formatTime(Math.max(0, duration - currentTime))}
            </span>
          ) : (
            <span className="font-semibold text-gray-400 dark:text-gray-500 text-[10px]">
              Chargement...
            </span>
          )}
        </div>
      </div>

      {/* Badge des effets appliqués - Position absolue en haut à droite */}
      {appliedEffects.length > 0 && (
        <div className="absolute top-2 right-2 z-10">
          {appliedEffects.length === 1 ? (
            <div
              className="inline-flex items-center justify-center w-7 h-7 bg-purple-500 dark:bg-purple-600 rounded-full shadow-lg"
              title={`Effet: ${appliedEffects[0]}`}
            >
              <span className="text-[16px]">{effectIcons[appliedEffects[0]]}</span>
            </div>
          ) : (
            <div
              className="inline-flex items-center justify-center w-7 h-7 bg-purple-500 dark:bg-purple-600 rounded-full shadow-lg"
              title={`${appliedEffects.length} effets appliqués`}
            >
              <span className="text-[16px]">🎚️</span>
            </div>
          )}
        </div>
      )}

      {/* Bouton télécharger - Position absolue en bas à droite */}
      <a
        href={objectUrl || '#'}
        download={attachment.originalName}
        className="absolute bottom-2 right-2 z-10 p-1.5 hover:bg-white/80 dark:hover:bg-gray-700/80 bg-white/50 dark:bg-gray-700/50 rounded-full transition-all duration-200 shadow-md"
        title="Télécharger"
        onClick={(e) => {
          if (!objectUrl) {
            e.preventDefault();
          }
        }}
      >
        <Download className="w-4 h-4 text-gray-700 dark:text-gray-200" />
      </a>

      {/* Audio element caché - src from object URL */}
      <audio
        ref={audioRef}
        src={objectUrl || undefined}
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
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Charger l'audio via apiService
  useEffect(() => {
    let isMounted = true;
    let currentObjectUrl: string | null = null;

    const loadAudio = async () => {
      if (!attachment.fileUrl) return;

      try {
        // Extraire le chemin API
        let apiPath = attachment.fileUrl;

        if (apiPath.startsWith('http://') || apiPath.startsWith('https://')) {
          try {
            const url = new URL(apiPath);
            apiPath = url.pathname;
          } catch {
            // Ignore parsing errors
          }
        }

        if (apiPath.startsWith('/api/')) {
          apiPath = apiPath.substring(4);
        }

        const blob = await apiService.getBlob(apiPath);

        if (!isMounted) return;

        currentObjectUrl = URL.createObjectURL(blob);
        setObjectUrl(currentObjectUrl);

        if (audioRef.current) {
          audioRef.current.load();
        }
      } catch (error) {
        console.error('CompactAudioPlayer: Failed to load audio', error);
      }
    };

    loadAudio();

    return () => {
      isMounted = false;
      if (currentObjectUrl) {
        URL.revokeObjectURL(currentObjectUrl);
      }
    };
  }, [attachment.fileUrl]);

  const togglePlay = async () => {
    if (!audioRef.current || !objectUrl) return;

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
        disabled={!objectUrl}
        className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center transition-all duration-200 disabled:opacity-50"
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
        src={objectUrl || undefined}
        onEnded={() => setIsPlaying(false)}
        preload="metadata"
      />
    </div>
  );
};
