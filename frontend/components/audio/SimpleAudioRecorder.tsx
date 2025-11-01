'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, Square, Send, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SimpleAudioRecorderProps {
  onRecordingComplete: (audioBlob: Blob, duration: number) => void;
  onCancel: () => void;
  maxDuration?: number; // en secondes, défaut: 600 (10 min)
}

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

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Démarrer l'enregistrement
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Choisir le meilleur codec disponible
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioUrl(url);

        // Arrêter tous les tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(100); // Capture par chunks de 100ms
      setIsRecording(true);
      setRecordingTime(0);

      // Timer pour la durée
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          const newTime = prev + 1;
          if (newTime >= maxDuration) {
            stopRecording();
          }
          return newTime;
        });
      }, 1000);

    } catch (error) {
      console.error('Failed to start recording:', error);
      alert('Impossible d\'accéder au microphone. Veuillez vérifier les permissions.');
    }
  }, [maxDuration]);

  // Arrêter l'enregistrement
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
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
      // Reset
      setAudioBlob(null);
      setAudioUrl(null);
      setRecordingTime(0);
    }
  }, [audioBlob, recordingTime, onRecordingComplete]);

  // Envoyer directement après l'arrêt (optionnel - pour "cliquer pour envoyer")
  const stopAndSend = useCallback(() => {
    if (isRecording) {
      // Arrêter puis envoyer une fois que le blob est prêt
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.onstop = () => {
          const stream = mediaRecorderRef.current?.stream;
          const blob = new Blob(chunksRef.current, {
            type: mediaRecorderRef.current?.mimeType || 'audio/webm'
          });

          // Arrêter tous les tracks
          stream?.getTracks().forEach(track => track.stop());

          // Envoyer immédiatement
          onRecordingComplete(blob, recordingTime);

          // Reset
          setIsRecording(false);
          setRecordingTime(0);
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
        };

        mediaRecorderRef.current.stop();
      }
    }
  }, [isRecording, recordingTime, onRecordingComplete]);

  // Formater le temps
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  return (
    <div className="flex flex-col gap-4 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-900 rounded-xl border border-blue-200 dark:border-gray-700 shadow-lg">
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
        Durée maximale: {Math.floor(maxDuration / 60)} minutes
      </div>
    </div>
  );
};
