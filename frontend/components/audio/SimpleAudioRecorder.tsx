'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, Square, Send, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface SimpleAudioRecorderProps {
  onRecordingComplete: (audioBlob: Blob, duration: number) => void;
  onCancel: () => void;
  maxDuration?: number; // en secondes, défaut: 600 (10 min)
}

// Constantes
const MAX_ALLOWED_DURATION = 600; // 10 minutes - HARD LIMIT
const ALLOWED_CODECS = [
  'audio/webm;codecs=opus', // Preferred
  'audio/webm',
] as const;

/**
 * Composant d'enregistrement audio SIMPLE et MODERNE
 * - Cliquer pour enregistrer
 * - Cliquer pour arrêter OU cliquer envoyer pour arrêter puis envoyer
 */
export const SimpleAudioRecorder: React.FC<SimpleAudioRecorderProps> = ({
  onRecordingComplete,
  onCancel,
  maxDuration = 600
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const sendAfterStopRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);

  // Enforce hard limit
  const effectiveDuration = Math.min(maxDuration, MAX_ALLOWED_DURATION);

  // Warn if prop exceeds limit
  useEffect(() => {
    if (maxDuration > MAX_ALLOWED_DURATION) {
      console.warn(`[SimpleAudioRecorder] maxDuration ${maxDuration} exceeds limit ${MAX_ALLOWED_DURATION}, clamping to limit`);
    }
  }, [maxDuration]);

  // Fonction pour obtenir le codec sécurisé
  const getSecureAudioCodec = (): string => {
    for (const codec of ALLOWED_CODECS) {
      if (MediaRecorder.isTypeSupported(codec)) {
        return codec;
      }
    }
    throw new Error('No supported audio codec found. Please use a modern browser (Chrome, Firefox, Edge).');
  };

  // Démarrer l'enregistrement
  const startRecording = useCallback(async () => {
    setPermissionError(null);

    try {
      // Vérifier le contexte sécurisé
      if (!window.isSecureContext) {
        toast.error('Audio recording requires HTTPS. Please use https:// URL.');
        return;
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast.error('Your browser does not support audio recording.');
        return;
      }

      // Vérifier les permissions
      if (navigator.permissions) {
        try {
          const permission = await navigator.permissions.query({ name: 'microphone' as PermissionName });

          if (permission.state === 'denied') {
            setPermissionError('Microphone access denied. Please enable it in browser settings.');
            toast.error('Microphone access denied. Please enable it in browser settings.');
            return;
          }

          if (permission.state === 'prompt') {
            toast.info('Please allow microphone access to record audio.');
          }
        } catch (e) {
          // Permission API may not be supported, continue anyway
        }
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
        audioBitsPerSecond: 128000 // Limit bitrate to prevent huge files
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

        if (sendAfterStopRef.current) {
          // Send immediately
          sendAfterStopRef.current = false;
          onRecordingComplete(blob, recordingTime);
          setRecordingTime(0);
          // Don't set audioBlob/audioUrl for preview
        } else {
          // Normal stop - show preview
          // Revoke old URL before creating new one
          if (audioUrlRef.current) {
            URL.revokeObjectURL(audioUrlRef.current);
            audioUrlRef.current = null;
          }

          const url = URL.createObjectURL(blob);
          audioUrlRef.current = url;
          setAudioBlob(blob);
          setAudioUrl(url);
        }
      };

      mediaRecorder.start(100); // Capture par chunks de 100ms
      setIsRecording(true);
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

      if (error instanceof DOMException) {
        if (error.name === 'NotAllowedError') {
          setPermissionError('Accès au microphone refusé. Veuillez autoriser l\'accès dans les paramètres du navigateur.');
          toast.error('Accès au microphone refusé.');
        } else if (error.name === 'NotFoundError') {
          setPermissionError('Aucun microphone détecté sur cet appareil.');
          toast.error('Aucun microphone détecté.');
        } else {
          setPermissionError('Erreur lors de l\'accès au microphone: ' + error.message);
          toast.error('Erreur lors de l\'accès au microphone.');
        }
      } else if (error.message && error.message.includes('codec')) {
        toast.error('Your browser does not support audio recording. Please use Chrome, Firefox, or Edge.');
      } else {
        toast.error('Impossible d\'accéder au microphone.');
      }
    }
  }, [effectiveDuration, onRecordingComplete, recordingTime]);

  // Arrêter l'enregistrement
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      if (mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [isRecording]);

  // Annuler l'enregistrement
  const cancelRecording = useCallback(() => {
    stopRecording();

    // Revoke URL when canceling
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }

    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingTime(0);
    chunksRef.current = [];
    onCancel();
  }, [stopRecording, onCancel]);

  // Envoyer l'enregistrement
  const sendRecording = useCallback(() => {
    if (audioBlob) {
      onRecordingComplete(audioBlob, recordingTime);

      // Revoke URL after sending
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }

      // Reset
      setAudioBlob(null);
      setAudioUrl(null);
      setRecordingTime(0);
    }
  }, [audioBlob, recordingTime, onRecordingComplete]);

  // Envoyer directement après l'arrêt
  const stopAndSend = useCallback(() => {
    if (isRecording && mediaRecorderRef.current) {
      sendAfterStopRef.current = true;
      if (mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [isRecording]);

  // Formater le temps
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

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
        // Stop all tracks
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

  return (
    <div className="flex flex-col gap-4 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-900 rounded-xl border border-blue-200 dark:border-gray-700 shadow-lg">
      {/* Erreur de permission */}
      {permissionError && (
        <div className="text-red-600 text-sm p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
          {permissionError}
        </div>
      )}

      {/* Affichage du temps - Grand et clair */}
      <div className="text-center">
        <div className="text-4xl font-bold font-mono text-blue-600 dark:text-blue-400">
          {formatTime(recordingTime)}
        </div>
        {isRecording && (
          <div className="flex items-center justify-center gap-2 mt-2">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            <span className="text-sm text-red-600 dark:text-red-400 font-medium">
              Enregistrement en cours...
            </span>
          </div>
        )}
        {audioBlob && !isRecording && (
          <div className="text-sm text-green-600 dark:text-green-400 font-medium mt-2">
            ✓ Enregistrement terminé
          </div>
        )}
      </div>

      {/* Visualisation simple pendant l'enregistrement */}
      {isRecording && (
        <div className="flex items-center justify-center gap-1 h-16 px-4">
          {[...Array(25)].map((_, i) => (
            <div
              key={i}
              className="w-1 bg-blue-500 dark:bg-blue-400 rounded-full transition-all duration-150"
              style={{
                height: `${20 + Math.random() * 80}%`,
                animation: `pulse 0.${5 + i}s ease-in-out infinite alternate`,
              }}
            />
          ))}
        </div>
      )}

      {/* Lecteur audio simple (après enregistrement) */}
      {audioUrl && !isRecording && (
        <div className="px-2">
          <audio
            src={audioUrl}
            controls
            className="w-full h-10 rounded-lg"
            style={{
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))'
            }}
          />
        </div>
      )}

      {/* Boutons de contrôle - Simple et clair */}
      <div className="flex items-center justify-center gap-3">
        {/* État: Prêt à enregistrer */}
        {!isRecording && !audioBlob && (
          <Button
            onClick={startRecording}
            size="lg"
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 px-6 py-3 rounded-full"
          >
            <Mic className="w-5 h-5" />
            <span className="font-semibold">Enregistrer</span>
          </Button>
        )}

        {/* État: En cours d'enregistrement */}
        {isRecording && (
          <>
            <Button
              onClick={stopRecording}
              size="lg"
              variant="outline"
              className="flex items-center gap-2 border-2 border-gray-400 hover:border-gray-600 dark:border-gray-600 dark:hover:border-gray-400 px-6 py-3 rounded-full"
            >
              <Square className="w-5 h-5 fill-current" />
              <span className="font-semibold">Arrêter</span>
            </Button>

            <Button
              onClick={stopAndSend}
              size="lg"
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 px-6 py-3 rounded-full"
            >
              <Send className="w-5 h-5" />
              <span className="font-semibold">Envoyer</span>
            </Button>
          </>
        )}

        {/* État: Enregistrement terminé */}
        {audioBlob && !isRecording && (
          <>
            <Button
              onClick={cancelRecording}
              size="lg"
              variant="outline"
              className="flex items-center gap-2 border-2 border-red-400 hover:border-red-600 text-red-600 hover:text-red-700 dark:border-red-600 dark:hover:border-red-400 px-5 py-3 rounded-full"
            >
              <Trash2 className="w-4 h-4" />
              <span className="font-semibold">Supprimer</span>
            </Button>

            <Button
              onClick={sendRecording}
              size="lg"
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 px-6 py-3 rounded-full"
            >
              <Send className="w-5 h-5" />
              <span className="font-semibold">Envoyer</span>
            </Button>
          </>
        )}
      </div>

      {/* Info durée maximale */}
      <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
        Durée maximale: {Math.floor(effectiveDuration / 60)} minutes
      </div>
    </div>
  );
};
