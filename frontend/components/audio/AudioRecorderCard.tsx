'use client';

import React, { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Square, Play, Pause, Trash2, Mic, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface AudioRecorderCardProps {
  onRecordingComplete: (audioBlob: Blob, duration: number) => void;
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
const ALLOWED_CODECS = [
  'audio/webm;codecs=opus', // Preferred - meilleure qualité
  'audio/webm',             // Fallback WebM
  'audio/ogg;codecs=opus',  // Fallback OGG
  'audio/mp4',              // Fallback MP4 (Safari)
] as const;

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
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(autoStart);
  const [audioFormat, setAudioFormat] = useState<string>('WEBM');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Enforce hard limit
  const effectiveDuration = Math.min(maxDuration, MAX_ALLOWED_DURATION);

  // Fonction pour obtenir le codec sécurisé
  const getSecureAudioCodec = (): string => {
    for (const codec of ALLOWED_CODECS) {
      if (MediaRecorder.isTypeSupported(codec)) {
        return codec;
      }
    }
    throw new Error('No supported audio codec found. Please use a modern browser.');
  };

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

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      streamRef.current = stream;

      // Choisir le codec sécurisé
      const mimeType = getSecureAudioCodec();

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

      mediaRecorder.onstop = () => {
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

        // Notifier le parent
        onRecordingComplete(blob, recordingTime);
      };

      mediaRecorder.start(1000); // Chunks de 1 seconde pour meilleure stabilité
      setIsRecording(true);
      setIsInitializing(false);
      setRecordingTime(0);

      // Timer pour la durée
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          const newTime = prev + 1;
          if (newTime >= effectiveDuration) {
            stopRecording();
          }
          return newTime;
        });
      }, 1000);

    } catch (error: any) {
      console.error('Failed to start recording:', error);
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
  }, [effectiveDuration, onRecordingComplete, recordingTime]);

  // Arrêter l'enregistrement
  const stopRecording = useCallback(() => {
    // Toujours arrêter le timer d'abord
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

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
          console.error('Erreur de lecture audio:', error);
          toast.error('Erreur lors de la lecture');
          setIsPlaying(false);
        });
        setIsPlaying(true);
      }
    }
  }, [isPlaying]);

  // Auto-start recording si demandé
  useEffect(() => {
    if (autoStart && !isRecording && !audioBlob && !permissionError) {
      startRecording();
    }
  }, [autoStart]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clean up timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
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

  // Formater le temps
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
            className="bg-gray-700 hover:bg-gray-800 h-7 w-14 text-[9px] px-2"
          >
            <Square className="w-3 h-3 fill-current mr-1" />
            Stop
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
              console.error('Audio error:', e);
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
