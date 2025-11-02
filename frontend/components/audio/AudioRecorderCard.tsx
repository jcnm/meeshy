'use client';

import React, { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Square, Play, Pause, Trash2, Mic, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

// Types pour les métadonnées audio extraites
interface AudioMetadata {
  duration: number; // Durée exacte en secondes avec millisecondes
  codec: string; // Codec utilisé
  mimeType: string; // Type MIME complet
  bitrate?: number; // Bitrate si disponible
  sampleRate?: number; // Sample rate si disponible
}

interface AudioRecorderCardProps {
  onRecordingComplete: (audioBlob: Blob, duration: number, metadata?: AudioMetadata) => void;
  onRemove: () => void;
  autoStart?: boolean;
  maxDuration?: number; // en secondes, défaut: 600 (10 min)
}

export interface AudioRecorderCardRef {
  stopRecording: () => void;
  isRecording: () => boolean;
}

// Constantes
const MAX_ALLOWED_DURATION = 600; // 10 minutes - HARD LIMIT

// Détection du navigateur pour adapter le codec audio
const getBrowserInfo = () => {
  const ua = navigator.userAgent.toLowerCase();
  return {
    isSafari: /^((?!chrome|android).)*safari/i.test(navigator.userAgent),
    isChrome: ua.includes('chrome') && !ua.includes('edge'),
    isFirefox: ua.includes('firefox'),
    isEdge: ua.includes('edge') || ua.includes('edg/'),
  };
};

// Codecs audio par navigateur (ordre de préférence)
const CODEC_PRIORITIES = {
  safari: [
    'audio/mp4',               // Safari préfère MP4/AAC
    'audio/webm;codecs=opus',  // Safari récent peut supporter WebM
    'audio/webm',
  ],
  chrome: [
    'audio/webm;codecs=opus',  // Meilleure qualité pour Chrome
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ],
  firefox: [
    'audio/webm;codecs=opus',  // Firefox supporte bien Opus
    'audio/ogg;codecs=opus',
    'audio/webm',
    'audio/mp4',
  ],
  edge: [
    'audio/webm;codecs=opus',  // Edge Chromium
    'audio/webm',
    'audio/mp4',
  ],
  default: [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ],
} as const;

/**
 * Carte d'enregistrement audio compacte pour le carrousel d'attachments
 * - Auto-démarre l'enregistrement
 * - Affiche timer et visualisation pendant l'enregistrement
 * - Lecteur audio après l'enregistrement
 */
export const AudioRecorderCard = forwardRef<AudioRecorderCardRef, AudioRecorderCardProps>(({
  onRecordingComplete,
  onRemove,
  autoStart = true,
  maxDuration = 600
}, ref) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0); // En millisecondes
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(autoStart);
  const [audioFormat, setAudioFormat] = useState<string>('WEBM');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0); // Utiliser performance.now() pour précision
  const animationFrameRef = useRef<number | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const selectedCodecRef = useRef<string>('');

  // Enforce hard limit
  const effectiveDuration = Math.min(maxDuration, MAX_ALLOWED_DURATION);

  // Fonction pour obtenir le meilleur codec selon le navigateur
  const getBestAudioCodec = (): { mimeType: string; browserType: string } => {
    const browserInfo = getBrowserInfo();

    let browserType = 'default';
    let codecs: readonly string[] = CODEC_PRIORITIES.default;

    if (browserInfo.isSafari) {
      browserType = 'Safari';
      codecs = CODEC_PRIORITIES.safari;
    } else if (browserInfo.isChrome) {
      browserType = 'Chrome';
      codecs = CODEC_PRIORITIES.chrome;
    } else if (browserInfo.isFirefox) {
      browserType = 'Firefox';
      codecs = CODEC_PRIORITIES.firefox;
    } else if (browserInfo.isEdge) {
      browserType = 'Edge';
      codecs = CODEC_PRIORITIES.edge;
    }

    // Tester chaque codec dans l'ordre de préférence
    for (const codec of codecs) {
      if (MediaRecorder.isTypeSupported(codec)) {
        return { mimeType: codec, browserType };
      }
    }

    throw new Error(`No supported audio codec found for ${browserType}. Please use a modern browser.`);
  };

  // Fonction pour extraire les métadonnées audio d'un blob
  // Version simplifiée : utilise le temps d'enregistrement (plus fiable)
  const extractAudioMetadata = async (blob: Blob, mimeType: string): Promise<AudioMetadata> => {
    const browserInfo = getBrowserInfo();
    const codec = mimeType.includes('opus') ? 'Opus' :
                 mimeType.includes('aac') ? 'AAC' :
                 mimeType.includes('mp4') ? 'MP4' :
                 mimeType.includes('webm') ? 'WebM' : 'Unknown';

    // Sur Safari ou si c'est du MP4, utiliser directement le temps d'enregistrement
    // Safari ne supporte pas bien Web Audio API avec certains formats
    if (browserInfo.isSafari || mimeType.includes('mp4')) {
      const metadata: AudioMetadata = {
        duration: recordingTime / 1000, // Utiliser le temps mesuré (plus fiable)
        codec: codec,
        mimeType: mimeType,
      };
      return metadata;
    }

    // Pour les autres navigateurs, essayer d'obtenir la durée de l'audio element
    return new Promise((resolve) => {
      const audio = document.createElement('audio');
      const url = URL.createObjectURL(blob);
      let resolved = false;

      const cleanup = () => {
        URL.revokeObjectURL(url);
        audio.remove();
      };

      // Timeout de 500ms - si les métadonnées ne chargent pas, utiliser le temps enregistré
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve({
            duration: recordingTime / 1000,
            codec: codec,
            mimeType: mimeType,
          });
        }
      }, 500);

      audio.addEventListener('loadedmetadata', () => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeout);

        const duration = audio.duration;

        // Si duration est Infinity ou invalide, utiliser le temps d'enregistrement
        const finalDuration = (duration === Infinity || !isFinite(duration) || duration <= 0)
          ? recordingTime / 1000
          : duration;

        const metadata: AudioMetadata = {
          duration: finalDuration,
          codec: codec,
          mimeType: mimeType,
        };

        cleanup();
        resolve(metadata);
      });

      audio.addEventListener('error', () => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeout);
        cleanup();
        resolve({
          duration: recordingTime / 1000,
          codec: codec,
          mimeType: mimeType,
        });
      });

      audio.src = url;
    });
  };

  // Timer précis utilisant requestAnimationFrame pour les millisecondes
  const updateTimer = useCallback(() => {
    if (!startTimeRef.current || !mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') {
      return;
    }

    const elapsed = performance.now() - startTimeRef.current;
    setRecordingTime(elapsed);

    // Vérifier si on a atteint la durée maximale
    if (elapsed >= effectiveDuration * 1000) {
      stopRecording();
      return;
    }

    // Continuer l'animation
    animationFrameRef.current = requestAnimationFrame(updateTimer);
  }, [effectiveDuration]);

  // Démarrer l'enregistrement
  const startRecording = useCallback(async () => {
    setPermissionError(null);
    setIsInitializing(true);

    try {
      // Vérifier le contexte sécurisé
      if (!window.isSecureContext) {
        toast.error('Audio recording requires HTTPS.');
        setPermissionError('HTTPS required');
        setIsInitializing(false);
        return;
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast.error('Your browser does not support audio recording.');
        setPermissionError('Browser not supported');
        setIsInitializing(false);
        return;
      }

      // Obtenir le meilleur codec pour le navigateur
      const { mimeType, browserType } = getBestAudioCodec();
      selectedCodecRef.current = mimeType;

      // Contraintes audio optimisées
      const browserInfo = getBrowserInfo();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: browserInfo.isSafari ? {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 48000,
        } : {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 1,
        }
      });

      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 128000, // 128 kbps pour bonne qualité
        bitsPerSecond: 128000
      });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());

        // Revoke old URL before creating new one
        if (audioUrlRef.current) {
          URL.revokeObjectURL(audioUrlRef.current);
          audioUrlRef.current = null;
        }

        // Détecter le format depuis le mimeType
        const format = mimeType.includes('webm') ? 'WEBM' :
                      mimeType.includes('mp4') ? 'MP4' :
                      mimeType.includes('ogg') ? 'OGG' :
                      mimeType.includes('wav') ? 'WAV' : 'AUDIO';
        setAudioFormat(format);

        const url = URL.createObjectURL(blob);
        audioUrlRef.current = url;
        setAudioBlob(blob);
        setAudioUrl(url);

        // Extraire les métadonnées audio
        const metadata = await extractAudioMetadata(blob, mimeType);

        // Notifier le parent avec métadonnées
        onRecordingComplete(blob, metadata.duration, metadata);
      };

      // Adapter le timeslice selon le navigateur
      if (browserInfo.isSafari) {
        mediaRecorder.start();
      } else {
        mediaRecorder.start(1000);
      }

      setIsRecording(true);
      setIsInitializing(false);
      setRecordingTime(0);

      // Démarrer le timer haute précision avec requestAnimationFrame
      startTimeRef.current = performance.now();
      animationFrameRef.current = requestAnimationFrame(updateTimer);

    } catch (error: any) {
      setIsInitializing(false);

      if (error instanceof DOMException) {
        if (error.name === 'NotAllowedError') {
          setPermissionError('Microphone access denied');
          toast.error('Accès au microphone refusé.');
        } else if (error.name === 'NotFoundError') {
          setPermissionError('No microphone found');
          toast.error('Aucun microphone détecté.');
        } else {
          setPermissionError('Microphone error');
          toast.error('Erreur microphone.');
        }
      } else {
        toast.error('Impossible d\'accéder au microphone.');
        setPermissionError('Recording error');
      }
    }
  }, [effectiveDuration, onRecordingComplete, getBestAudioCodec, extractAudioMetadata, updateTimer]);

  // Arrêter l'enregistrement
  const stopRecording = useCallback(() => {
    // Toujours arrêter le timer d'animation d'abord
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    startTimeRef.current = 0;

    // Puis arrêter le media recorder
    if (mediaRecorderRef.current) {
      if (mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    }

    setIsRecording(false);
  }, []);

  // Exposer les méthodes via ref pour contrôle externe
  useImperativeHandle(ref, () => ({
    stopRecording,
    isRecording: () => isRecording
  }), [stopRecording, isRecording]);

  // Toggle play/pause
  const togglePlayPause = useCallback(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        // Réinitialiser à 0 si terminé
        if (audioRef.current.ended) {
          audioRef.current.currentTime = 0;
        }
        audioRef.current.play().catch(error => {
          toast.error('Erreur lors de la lecture');
          setIsPlaying(false);
        });
        setIsPlaying(true);
      }
    }
  }, [isPlaying]);

  // Auto-start recording si demandé (only on mount)
  useEffect(() => {
    if (autoStart) {
      startRecording();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount when autoStart is true

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clean up animation frame
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      // Clean up media recorder
      if (mediaRecorderRef.current) {
        const stream = mediaRecorderRef.current.stream;
        if (mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
        stream?.getTracks().forEach(track => track.stop());
      }

      // Clean up stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      // Clean up object URL
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }
    };
  }, []);

  // Formater le temps avec millisecondes (MM:SS.ms)
  const formatTime = (milliseconds: number): string => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const ms = Math.floor((milliseconds % 1000) / 10); // Deux chiffres pour les centièmes
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  // État: Initialisation
  if (isInitializing) {
    return (
      <div className="relative group pt-3 pb-2">
        <div className="relative flex flex-col items-center justify-center w-40 h-20 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 border-2 border-blue-400 dark:border-blue-500 rounded-lg">
          <Loader2 className="w-6 h-6 text-blue-600 dark:text-blue-400 animate-spin" />
          <div className="text-[9px] text-blue-600 dark:text-blue-400 mt-1">
            Initializing...
          </div>
        </div>
        {/* Bouton supprimer */}
        <button
          onClick={onRemove}
          className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg z-10"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  // État: Erreur de permission
  if (permissionError) {
    return (
      <div className="relative group pt-3 pb-2">
        <div className="relative flex flex-col items-center justify-center w-40 h-20 bg-red-50 dark:bg-red-900/20 border-2 border-red-400 dark:border-red-500 rounded-lg">
          <Mic className="w-5 h-5 text-red-600 dark:text-red-400 mb-1" />
          <div className="text-[8px] text-red-600 dark:text-red-400 text-center px-1">
            {permissionError}
          </div>
        </div>
        {/* Bouton supprimer */}
        <button
          onClick={onRemove}
          className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg z-10"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  // État: En cours d'enregistrement
  if (isRecording) {
    return (
      <div className="relative group pt-3 pb-2">
        <div className="relative flex flex-row items-center justify-between w-40 h-20 bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/30 dark:to-orange-900/30 border-2 border-red-400 dark:border-red-500 rounded-lg px-3">
          {/* Timer et indicateur */}
          <div className="flex flex-col items-start">
            <div className="text-lg font-bold text-red-600 dark:text-red-400 font-mono">
              {formatTime(recordingTime)}
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-[9px] text-red-600 dark:text-red-400 font-medium">RECORDING</span>
            </div>
          </div>

          {/* Bouton stop */}
          <Button
            onClick={stopRecording}
            size="sm"
            className="group bg-white dark:bg-gray-800 hover:bg-black dark:hover:bg-white h-10 w-10 p-0 flex flex-col items-center justify-center gap-0 border-2 border-gray-300 dark:border-gray-600 hover:border-black dark:hover:border-white transition-all"
          >
            <Square className="w-3 h-3 fill-transparent stroke-gray-700 dark:stroke-gray-300 group-hover:stroke-white dark:group-hover:stroke-black stroke-[1.5]" />
            <span className="text-[8px] leading-tight font-semibold text-gray-700 dark:text-gray-300 group-hover:text-white dark:group-hover:text-black">STOP</span>
          </Button>
        </div>

        {/* Badge durée max */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 bg-gray-700 text-white text-[9px] px-1.5 py-0.5 rounded-full whitespace-nowrap shadow-sm">
          Max {Math.floor(effectiveDuration / 60)}min
        </div>
      </div>
    );
  }

  // État: Enregistrement terminé
  if (audioBlob && audioUrl) {
    return (
      <div className="relative group pt-3 pb-2">
        <div className="relative flex flex-row items-center justify-between w-40 h-20 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 border-2 border-green-400 dark:border-green-500 rounded-lg px-3">
          {/* Lecteur audio caché */}
          <audio
            ref={audioRef}
            src={audioUrl}
            preload="auto"
            onEnded={() => setIsPlaying(false)}
            onError={(e) => {
              setIsPlaying(false);
              toast.error('Erreur de lecture audio');
            }}
            onPause={() => setIsPlaying(false)}
            onPlay={() => setIsPlaying(true)}
            className="hidden"
          />

          {/* Infos audio */}
          <div className="flex flex-col items-start gap-0.5">
            <div className="text-sm font-bold text-green-600 dark:text-green-400 font-mono">
              {formatTime(recordingTime)}
            </div>
            <div className="text-[9px] text-green-600 dark:text-green-400 font-medium">
              {audioFormat} · {(audioBlob.size / 1024).toFixed(0)} KB
            </div>
            <div className="text-[8px] text-gray-500 dark:text-gray-400">
              {isPlaying ? 'Playing...' : 'Ready'}
            </div>
          </div>

          {/* Bouton Play/Pause */}
          <Button
            onClick={togglePlayPause}
            size="sm"
            className="bg-green-600 hover:bg-green-700 h-10 w-10 p-0 rounded-full flex-shrink-0"
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-current" />
            ) : (
              <Play className="w-4 h-4 fill-current ml-0.5" />
            )}
          </Button>
        </div>

        {/* Bouton supprimer */}
        <button
          onClick={onRemove}
          className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-10"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  // État par défaut (ne devrait jamais être atteint)
  return null;
});

AudioRecorderCard.displayName = 'AudioRecorderCard';
