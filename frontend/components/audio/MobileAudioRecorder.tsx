'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { Mic, X, Send, Lock, ArrowLeft, Trash2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { AudioWaveform } from './AudioWaveform';
import { useAudioEffects } from '@/hooks/use-audio-effects';
import { AudioEffectsPanel } from '@/components/video-calls/AudioEffectsPanel';

interface MobileAudioRecorderProps {
  onRecordingComplete: (audioBlob: Blob, duration: number) => void;
  maxDuration?: number;
  isComposingEnabled?: boolean;
}

type RecordingState = 'idle' | 'recording' | 'locked' | 'preview';

const MAX_ALLOWED_DURATION = 600; // 10 minutes

// Codecs audio
const UNIVERSAL_CODEC_PRIORITIES = [
  'audio/mp4',
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
] as const;

const getBestAudioCodec = (): string => {
  for (const codec of UNIVERSAL_CODEC_PRIORITIES) {
    if (MediaRecorder.isTypeSupported(codec)) {
      return codec;
    }
  }
  throw new Error('No supported audio codec found');
};

/**
 * Composant d'enregistrement audio moderne pour mobile
 * Features:
 * - Hold-to-record (maintenir appuyé)
 * - Swipe up to lock (glisser vers le haut pour verrouiller)
 * - Swipe left to cancel (glisser à gauche pour annuler)
 * - Bottom sheet UI élégant
 * - Waveform animée en temps réel
 * - Circular progress timer
 * - Haptic feedback
 * - Preview avant envoi
 */
export const MobileAudioRecorder: React.FC<MobileAudioRecorderProps> = ({
  onRecordingComplete,
  maxDuration = 600,
  isComposingEnabled = true,
}) => {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [recordingTime, setRecordingTime] = useState(0);
  const [swipeOffset, setSwipeOffset] = useState({ x: 0, y: 0 });
  const [showCancelHint, setShowCancelHint] = useState(false);
  const [showLockHint, setShowLockHint] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showEffectsPanel, setShowEffectsPanel] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  const selectedCodecRef = useRef<string>('');
  const requestDataIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const rawStreamRef = useRef<MediaStream | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const processedAudioStreamRef = useRef<MediaStream | null>(null);
  const sendDirectlyRef = useRef<boolean>(false); // Flag pour envoyer directement sans preview

  const [rawStream, setRawStream] = useState<MediaStream | null>(null);

  const { vibrate } = useHapticFeedback();

  const effectiveDuration = Math.min(maxDuration, MAX_ALLOWED_DURATION);

  // Initialiser useAudioEffects
  const {
    outputStream: processedAudioStream,
    effectsState,
    toggleEffect,
    updateEffectParams,
    loadPreset,
    currentPreset,
    availableBackSounds,
    availablePresets,
  } = useAudioEffects({
    inputStream: rawStream,
  });

  const audioEffectsActive = Object.values(effectsState).some(effect => effect.enabled);

  // Mettre à jour la ref du stream processé
  useEffect(() => {
    processedAudioStreamRef.current = processedAudioStream;
  }, [processedAudioStream]);

  // Formater le temps
  const formatTime = (milliseconds: number): string => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculer le pourcentage de progression
  const progress = Math.min((recordingTime / (effectiveDuration * 1000)) * 100, 100);

  // Timer précis
  const updateTimer = useCallback(() => {
    if (!startTimeRef.current || !mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') {
      return;
    }

    const elapsed = performance.now() - startTimeRef.current;
    setRecordingTime(elapsed);

    if (elapsed >= effectiveDuration * 1000) {
      stopRecording();
      return;
    }

    animationFrameRef.current = requestAnimationFrame(updateTimer);
  }, [effectiveDuration]);

  // Arrêter l'enregistrement
  const stopRecording = useCallback(() => {
    if (requestDataIntervalRef.current) {
      clearInterval(requestDataIntervalRef.current);
      requestDataIntervalRef.current = null;
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Arrêter le media recorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    // Arrêter le stream brut
    if (rawStreamRef.current) {
      rawStreamRef.current.getTracks().forEach(track => track.stop());
      rawStreamRef.current = null;
    }
    setRawStream(null);

    vibrate('medium');
  }, [vibrate]);

  // Démarrer l'enregistrement
  const startRecording = useCallback(async () => {
    try {
      if (!window.isSecureContext) {
        toast.error('Audio recording requires HTTPS.');
        return;
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast.error('Your browser does not support audio recording.');
        return;
      }

      const mimeType = getBestAudioCodec();
      selectedCodecRef.current = mimeType;

      // Obtenir le stream brut du microphone
      const newRawStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 48000,
          channelCount: 1,
        }
      });

      rawStreamRef.current = newRawStream;
      setRawStream(newRawStream);

      // Attendre TOUJOURS que useAudioEffects initialise le stream de sortie
      // Cela permet d'activer les effets PENDANT l'enregistrement
      const maxWaitTime = 3000;
      const checkInterval = 100;
      const startWait = Date.now();

      let streamToRecord = newRawStream;

      while (Date.now() - startWait < maxWaitTime) {
        const currentProcessedStream = processedAudioStreamRef.current;

        if (currentProcessedStream && currentProcessedStream.getAudioTracks().length > 0) {
          streamToRecord = currentProcessedStream;
          console.log('✅ [MobileAudioRecorder] Using processed audio stream');
          break;
        }

        await new Promise(resolve => setTimeout(resolve, checkInterval));
      }

      // Si le stream processé n'est pas prêt après 3s, utiliser le stream brut
      if (streamToRecord === newRawStream) {
        console.warn('⚠️ [MobileAudioRecorder] processedAudioStream not ready, using raw stream');
        toast.warning('Effets audio non disponibles - utilisation du micro direct');
      }

      const mediaRecorder = new MediaRecorder(streamToRecord, {
        mimeType,
        audioBitsPerSecond: 128000,
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
        const duration = recordingTime / 1000;

        // Arrêter tous les tracks du stream brut
        newRawStream.getTracks().forEach(track => track.stop());
        setRawStream(null);

        // Si on doit envoyer directement (mode release-to-send)
        if (sendDirectlyRef.current) {
          sendDirectlyRef.current = false; // Reset le flag

          if (duration < 0.5) {
            // Enregistrement trop court
            toast.warning('Enregistrement trop court');
            setRecordingState('idle');
            setRecordingTime(0);
            vibrate('warning');
          } else {
            // Envoyer directement
            onRecordingComplete(blob, duration);
            setRecordingState('idle');
            setRecordingTime(0);
            vibrate('success');
          }
        } else {
          // Mode preview (quand on arrête manuellement en mode verrouillé)
          setAudioBlob(blob);
          setRecordingState('preview');
        }
      };

      mediaRecorder.start();

      // requestData() manuel
      requestDataIntervalRef.current = setInterval(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.requestData();
        }
      }, 1000);

      setRecordingState('recording');
      setRecordingTime(0);
      startTimeRef.current = performance.now();
      animationFrameRef.current = requestAnimationFrame(updateTimer);

      // Haptic feedback
      vibrate('medium');

    } catch (error: any) {
      if (error instanceof DOMException) {
        if (error.name === 'NotAllowedError') {
          toast.error('Accès au microphone refusé.');
        } else if (error.name === 'NotFoundError') {
          toast.error('Aucun microphone détecté.');
        } else {
          toast.error('Erreur microphone.');
        }
      } else {
        toast.error('Impossible d\'accéder au microphone.');
      }
    }
  }, [updateTimer, vibrate]);

  // Annuler l'enregistrement
  const cancelRecording = useCallback(() => {
    stopRecording();
    setRecordingState('idle');
    setRecordingTime(0);
    setSwipeOffset({ x: 0, y: 0 });
    setAudioBlob(null);
    vibrate('error');
  }, [stopRecording, vibrate]);

  // Verrouiller l'enregistrement
  const lockRecording = useCallback(() => {
    setRecordingState('locked');
    setSwipeOffset({ x: 0, y: 0 });
    vibrate('success');
  }, [vibrate]);

  // Envoyer l'enregistrement
  const sendRecording = useCallback(() => {
    if (audioBlob) {
      const duration = recordingTime / 1000;
      onRecordingComplete(audioBlob, duration);
      setRecordingState('idle');
      setRecordingTime(0);
      setAudioBlob(null);
      vibrate('success');
    }
  }, [audioBlob, recordingTime, onRecordingComplete, vibrate]);

  // Réenregistrer
  const reRecord = useCallback(() => {
    setRecordingState('idle');
    setRecordingTime(0);
    setAudioBlob(null);
    startRecording();
  }, [startRecording]);

  // Play/pause preview
  const togglePlayPreview = useCallback(() => {
    if (!audioBlob) return;

    if (isPlaying && audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      setIsPlaying(false);
    } else {
      if (!audioPlayerRef.current) {
        audioPlayerRef.current = new Audio(URL.createObjectURL(audioBlob));
        audioPlayerRef.current.onended = () => setIsPlaying(false);
      }
      audioPlayerRef.current.play();
      setIsPlaying(true);
    }
  }, [audioBlob, isPlaying]);

  // Gérer le hold-to-record
  const handleMicPress = useCallback(() => {
    if (!isComposingEnabled) return;
    startRecording();
  }, [isComposingEnabled, startRecording]);

  const handleMicRelease = useCallback(() => {
    if (recordingState === 'recording') {
      // Enregistrement non verrouillé, arrêter et envoyer directement
      sendDirectlyRef.current = true; // Activer le flag pour envoyer directement
      stopRecording(); // mediaRecorder.onstop gérera l'envoi
    }
  }, [recordingState, stopRecording]);

  // Gérer les swipe gestures
  const handlePan = useCallback((event: any, info: PanInfo) => {
    if (recordingState !== 'recording') return;

    const { offset } = info;
    setSwipeOffset({ x: offset.x, y: offset.y });

    // Swipe left to cancel (> 100px)
    if (offset.x < -100) {
      setShowCancelHint(true);
    } else {
      setShowCancelHint(false);
    }

    // Swipe up to lock (> 100px)
    if (offset.y < -100) {
      setShowLockHint(true);
    } else {
      setShowLockHint(false);
    }
  }, [recordingState]);

  const handlePanEnd = useCallback((event: any, info: PanInfo) => {
    if (recordingState !== 'recording') return;

    const { offset } = info;

    // Swipe left: annuler
    if (offset.x < -150) {
      cancelRecording();
      return;
    }

    // Swipe up: verrouiller
    if (offset.y < -150) {
      lockRecording();
      return;
    }

    // Réinitialiser l'offset si pas de geste validé
    setSwipeOffset({ x: 0, y: 0 });
    setShowCancelHint(false);
    setShowLockHint(false);
  }, [recordingState, cancelRecording, lockRecording]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (requestDataIntervalRef.current) {
        clearInterval(requestDataIntervalRef.current);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (rawStreamRef.current) {
        rawStreamRef.current.getTracks().forEach(track => track.stop());
        rawStreamRef.current = null;
      }
      setRawStream(null);
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current = null;
      }
    };
  }, []);

  return (
    <>
      {/* Bouton micro principal */}
      <motion.button
        onPointerDown={handleMicPress}
        onPointerUp={handleMicRelease}
        onPointerLeave={handleMicRelease}
        disabled={!isComposingEnabled}
        className={`relative h-10 w-10 rounded-full flex items-center justify-center transition-all ${
          recordingState === 'idle'
            ? 'bg-blue-500 hover:bg-blue-600'
            : 'bg-red-500'
        } ${!isComposingEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        whileTap={{ scale: 0.9 }}
      >
        <Mic className="h-5 w-5 text-white" />
      </motion.button>

      {/* Bottom sheet pour l'enregistrement */}
      <AnimatePresence>
        {(recordingState === 'recording' || recordingState === 'locked') && (
          <>
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-[9998]"
              onClick={() => {
                if (recordingState === 'locked') {
                  cancelRecording();
                }
              }}
            />

            {/* Bottom Sheet */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{
                y: 0,
                x: recordingState === 'recording' ? swipeOffset.x : 0,
              }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              onPan={handlePan}
              onPanEnd={handlePanEnd}
              className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 rounded-t-3xl shadow-2xl z-[9999] px-6 py-8"
              style={{
                maxHeight: '60vh',
              }}
            >
              {/* Indicateur de drag */}
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-12 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />

              {/* Header avec timer et progression circulaire */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  {/* Circular progress */}
                  <div className="relative w-16 h-16">
                    <svg className="w-16 h-16 -rotate-90">
                      <circle
                        cx="32"
                        cy="32"
                        r="28"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                        className="text-gray-200 dark:text-gray-700"
                      />
                      <circle
                        cx="32"
                        cy="32"
                        r="28"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                        strokeDasharray={`${2 * Math.PI * 28}`}
                        strokeDashoffset={`${2 * Math.PI * 28 * (1 - progress / 100)}`}
                        className="text-red-500 transition-all duration-300"
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                    </div>
                  </div>

                  <div>
                    <div className="text-2xl font-bold font-mono text-red-500">
                      {formatTime(recordingTime)}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Enregistrement...
                    </div>
                  </div>
                </div>

                {/* Bouton effets audio */}
                <button
                  onClick={() => setShowEffectsPanel(true)}
                  className={`relative w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                    audioEffectsActive
                      ? 'bg-gradient-to-br from-purple-500 to-pink-500 shadow-lg'
                      : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                >
                  <span className="text-2xl">🎭</span>
                  {audioEffectsActive && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
                  )}
                </button>
              </div>

              {/* Waveform */}
              <div className="mb-8">
                <AudioWaveform isRecording={true} audioLevel={0.7} />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between">
                {/* Annuler */}
                <motion.button
                  onClick={cancelRecording}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                  whileTap={{ scale: 0.95 }}
                >
                  <Trash2 className="w-5 h-5" />
                  <span className="text-sm font-medium">Annuler</span>
                </motion.button>

                {/* Stop (mode verrouillé uniquement) */}
                {recordingState === 'locked' && (
                  <motion.button
                    onClick={stopRecording}
                    className="flex items-center gap-2 px-6 py-3 rounded-full bg-blue-500 text-white shadow-lg"
                    whileTap={{ scale: 0.95 }}
                  >
                    <Send className="w-5 h-5" />
                    <span className="font-medium">Envoyer</span>
                  </motion.button>
                )}
              </div>

              {/* Hints pour les gestes */}
              {recordingState === 'recording' && (
                <div className="mt-6 space-y-2">
                  <motion.div
                    animate={{ opacity: showLockHint ? 1 : 0.5 }}
                    className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400"
                  >
                    <Lock className="w-4 h-4" />
                    <span>Glissez vers le haut pour verrouiller</span>
                  </motion.div>
                  <motion.div
                    animate={{ opacity: showCancelHint ? 1 : 0.5 }}
                    className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Glissez vers la gauche pour annuler</span>
                  </motion.div>
                  <div className="text-xs text-gray-500 dark:text-gray-500 text-center mt-2">
                    Relâchez pour envoyer
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Modal de preview */}
      <AnimatePresence>
        {recordingState === 'preview' && audioBlob && (
          <>
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-[9998]"
            />

            {/* Modal */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl z-[9999] p-6 w-[90vw] max-w-md"
            >
              <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
                Prévisualisation
              </h3>

              {/* Waveform statique */}
              <div className="mb-4">
                <AudioWaveform isRecording={false} />
              </div>

              {/* Durée */}
              <div className="text-center mb-6">
                <div className="text-2xl font-mono font-bold text-gray-900 dark:text-white">
                  {formatTime(recordingTime)}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <motion.button
                  onClick={cancelRecording}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                  whileTap={{ scale: 0.95 }}
                >
                  <X className="w-5 h-5" />
                  <span>Annuler</span>
                </motion.button>

                <motion.button
                  onClick={reRecord}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                  whileTap={{ scale: 0.95 }}
                >
                  <RotateCcw className="w-5 h-5" />
                  <span>Réenregistrer</span>
                </motion.button>

                <motion.button
                  onClick={sendRecording}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-500 text-white shadow-lg"
                  whileTap={{ scale: 0.95 }}
                >
                  <Send className="w-5 h-5" />
                  <span>Envoyer</span>
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Panneau des effets audio */}
      <AnimatePresence>
        {showEffectsPanel && (
          <>
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-[10000]"
              onClick={() => setShowEffectsPanel(false)}
            />

            {/* Panneau */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-[10001] max-h-[80vh] overflow-auto"
            >
              <AudioEffectsPanel
                effectsState={effectsState}
                onToggleEffect={toggleEffect}
                onUpdateParams={updateEffectParams}
                onLoadPreset={loadPreset}
                currentPreset={currentPreset}
                availablePresets={availablePresets}
                availableBackSounds={availableBackSounds}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
