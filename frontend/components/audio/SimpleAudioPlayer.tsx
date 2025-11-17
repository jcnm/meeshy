'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Play, Pause, AlertTriangle, Gauge, Download, Mic2, Baby, Skull, Music, Sliders } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  const [isEffectsDropdownOpen, setIsEffectsDropdownOpen] = useState(false);
  const [selectedEffectTab, setSelectedEffectTab] = useState<AudioEffectType | 'overview'>('overview');
  const [visibleCurves, setVisibleCurves] = useState<Record<string, Record<string, boolean>>>({});
  const audioRef = useRef<HTMLAudioElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Extraire les valeurs primitives pour éviter les re-renders
  const attachmentId = attachment.id;
  const attachmentDuration = attachment.duration;
  const attachmentMimeType = attachment.mimeType;
  const attachmentFileUrl = attachment.fileUrl;

  // Extraire les effets appliqués depuis la timeline - VERSION ROBUSTE
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
      timelineMetadata: timeline?.metadata,
      attachmentKeys: Object.keys(attachment),
      fullAttachmentStringified: JSON.stringify(attachment, null, 2)
    });

    if (!timeline || !timeline.events || timeline.events.length === 0) {
      console.log('⚠️ [SimpleAudioPlayer] Pas de timeline ou pas d\'événements');
      return [];
    }

    // STRATÉGIE ROBUSTE MULTI-SOURCES:
    // 1. Priorité: metadata.finalActiveEffects (le plus fiable - effets actifs à la fin)
    // 2. Fallback: Analyser tous les événements (activate + deactivate pour détecter les effets utilisés)
    const effects = new Set<AudioEffectType>();

    // Source 1: metadata.finalActiveEffects (si disponible)
    if (timeline.metadata?.finalActiveEffects && Array.isArray(timeline.metadata.finalActiveEffects)) {
      console.log('✅ [SimpleAudioPlayer] Utilisation de metadata.finalActiveEffects:', timeline.metadata.finalActiveEffects);
      timeline.metadata.finalActiveEffects.forEach(effect => effects.add(effect));
    }

    // Source 2: Parcourir tous les événements pour trouver les effets activés
    // Un effet est considéré "utilisé" s'il a été activé au moins une fois
    for (const event of timeline.events) {
      if (event.action === 'activate') {
        effects.add(event.effectType);
      }
      // IMPORTANT: Si un effet a été désactivé, c'est qu'il était actif avant
      // Donc on l'ajoute aussi (au cas où l'événement 'activate' manque)
      else if (event.action === 'deactivate') {
        effects.add(event.effectType);
      }
    }

    const effectsArray = Array.from(effects);
    console.log('✅ [SimpleAudioPlayer] Effets appliqués extraits:', {
      count: effectsArray.length,
      effects: effectsArray,
      fromMetadata: timeline.metadata?.finalActiveEffects?.length || 0,
      fromEvents: effects.size
    });

    return effectsArray;
  }, [attachment]);

  // Composant pour les icônes d'effets
  const EffectIcon: React.FC<{ effect: AudioEffectType; className?: string }> = ({ effect, className = 'w-4 h-4' }) => {
    switch (effect) {
      case 'voice-coder':
        return <Mic2 className={className} />;
      case 'baby-voice':
        return <Baby className={className} />;
      case 'demon-voice':
        return <Skull className={className} />;
      case 'back-sound':
        return <Music className={className} />;
      default:
        return null;
    }
  };

  // Noms affichables pour les effets
  const effectNames: Record<AudioEffectType, string> = {
    'voice-coder': 'Voice Coder',
    'baby-voice': 'Baby Voice',
    'demon-voice': 'Demon Voice',
    'back-sound': 'Background Sound',
  };

  // Couleurs pour les effets
  const effectColors: Record<AudioEffectType, string> = {
    'voice-coder': '#8b5cf6', // purple
    'baby-voice': '#ec4899', // pink
    'demon-voice': '#ef4444', // red
    'back-sound': '#3b82f6', // blue
  };

  // Extraire la timeline des effets pour la visualisation
  const effectsTimeline = useMemo(() => {
    const timeline = (attachment as any).audioEffectsTimeline || (attachment as any).metadata?.audioEffectsTimeline;

    console.log('📊 [SimpleAudioPlayer] Extraction timeline segments:', {
      hasTimeline: !!timeline,
      hasEvents: !!timeline?.events,
      eventsCount: timeline?.events?.length || 0,
      events: timeline?.events,
      currentDuration: duration,
      attachmentDuration: attachmentDuration,
    });

    if (!timeline || !timeline.events || timeline.events.length === 0) {
      console.log('⚠️ [SimpleAudioPlayer] Pas de timeline events pour les segments');
      return [];
    }

    // Créer des segments pour chaque effet montrant quand il était actif
    const segments: Array<{
      effectType: AudioEffectType;
      startTime: number;
      endTime: number;
    }> = [];

    // Map pour suivre les états actifs
    const activeEffects = new Map<AudioEffectType, number>(); // effectType -> startTime

    for (const event of timeline.events) {
      console.log('🔄 [SimpleAudioPlayer] Timeline event:', {
        action: event.action,
        effectType: event.effectType,
        timestamp: event.timestamp,
      });

      if (event.action === 'activate') {
        // Marquer le début d'activation
        activeEffects.set(event.effectType, event.timestamp);
      } else if (event.action === 'deactivate') {
        // Marquer la fin d'activation
        const startTime = activeEffects.get(event.effectType);
        if (startTime !== undefined) {
          const segment = {
            effectType: event.effectType,
            startTime,
            endTime: event.timestamp,
          };
          segments.push(segment);
          console.log('✅ [SimpleAudioPlayer] Segment créé:', segment);
          activeEffects.delete(event.effectType);
        }
      }
    }

    // Pour les effets encore actifs à la fin, utiliser la durée totale
    const totalDuration = duration || attachmentDuration || 0;
    console.log('⏱️ [SimpleAudioPlayer] Effets encore actifs:', {
      count: activeEffects.size,
      effects: Array.from(activeEffects.keys()),
      totalDuration,
    });

    activeEffects.forEach((startTime, effectType) => {
      const segment = {
        effectType,
        startTime,
        endTime: totalDuration,
      };
      segments.push(segment);
      console.log('✅ [SimpleAudioPlayer] Segment actif jusqu\'à la fin:', segment);
    });

    console.log('📊 [SimpleAudioPlayer] Segments extraits:', {
      count: segments.length,
      segments,
    });

    return segments;
  }, [attachment, duration, attachmentDuration]);

  // Extraire les configurations des effets pour les graphiques
  const effectsConfigurations = useMemo(() => {
    const timeline = (attachment as any).audioEffectsTimeline || (attachment as any).metadata?.audioEffectsTimeline;

    console.log('🎨 [SimpleAudioPlayer] Extraction configurations:', {
      hasTimeline: !!timeline,
      hasEvents: !!timeline?.events,
      eventsCount: timeline?.events?.length || 0,
      events: timeline?.events,
    });

    if (!timeline || !timeline.events || timeline.events.length === 0) {
      return {};
    }

    const configs: Record<AudioEffectType, Array<{
      timestamp: number;
      config: Record<string, number>;
    }>> = {} as any;

    // Suivre les dernières configurations de chaque effet
    const lastConfigs: Record<AudioEffectType, Record<string, number>> = {} as any;

    for (const event of timeline.events) {
      console.log('🔍 [SimpleAudioPlayer] Event:', {
        action: event.action,
        effectType: event.effectType,
        hasParams: !!event.params,
        params: event.params,
      });

      // Collecter les configurations des événements 'activate' et 'update'
      if ((event.action === 'activate' || event.action === 'update') && event.params) {
        if (!configs[event.effectType]) {
          configs[event.effectType] = [];
        }

        // Convertir params en config numérique
        const numericConfig: Record<string, number> = {};
        Object.keys(event.params).forEach(key => {
          const value = (event.params as any)[key];
          if (typeof value === 'number') {
            numericConfig[key] = value;
          }
        });

        configs[event.effectType].push({
          timestamp: event.timestamp,
          config: numericConfig,
        });

        // Sauvegarder la dernière config connue
        lastConfigs[event.effectType] = numericConfig;
      }

      // Pour 'deactivate', ajouter un point final avec les dernières valeurs connues
      else if (event.action === 'deactivate' && lastConfigs[event.effectType]) {
        if (!configs[event.effectType]) {
          configs[event.effectType] = [];
        }

        configs[event.effectType].push({
          timestamp: event.timestamp,
          config: lastConfigs[event.effectType],
        });
      }
    }

    console.log('✅ [SimpleAudioPlayer] Configurations extraites:', configs);

    return configs;
  }, [attachment]);

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

  // Handler pour chercher à un moment spécifique (en secondes)
  const handleSeekToTime = useCallback((timeInSeconds: number) => {
    if (audioRef.current && isFinite(timeInSeconds) && timeInSeconds >= 0) {
      const clampedTime = Math.min(timeInSeconds, duration || 0);
      audioRef.current.currentTime = clampedTime;
      setCurrentTime(clampedTime);
    }
  }, [duration]);

  // Formater le temps avec millisecondes (MM:SS.ms ou HH:MM:SS.ms selon la durée)
  const formatTime = (seconds: number): string => {
    if (!isFinite(seconds) || isNaN(seconds) || seconds < 0) return '0:00.00';
    const totalMs = Math.floor(seconds * 1000);
    const hours = Math.floor(totalMs / 3600000);
    const mins = Math.floor((totalMs % 3600000) / 60000);
    const secs = Math.floor((totalMs % 60000) / 1000);
    const ms = Math.floor((totalMs % 1000) / 10); // Deux chiffres pour les centièmes

    // Si >= 1h : HH:MM:SS.ms, sinon MM:SS.ms
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
    }
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

  // Fonction pour générer le graphique fusionné de tous les effets
  const renderMergedEffectsGraph = () => {
    const totalDuration = duration || attachmentDuration || 1;
    const width = 350;
    const height = 200;
    const padding = { top: 10, right: 10, bottom: 40, left: 40 };
    const graphWidth = width - padding.left - padding.right;
    const graphHeight = height - padding.top - padding.bottom;

    // Collecter tous les points de toutes les courbes de tous les effets
    const allCurves: Array<{
      effectType: AudioEffectType;
      key: string;
      points: Array<{ timestamp: number; value: number }>;
      color: string;
    }> = [];

    const curveColors = [
      '#3b82f6', // blue
      '#ef4444', // red
      '#10b981', // green
      '#f59e0b', // amber
      '#8b5cf6', // purple
      '#ec4899', // pink
      '#06b6d4', // cyan
      '#14b8a6', // teal
    ];

    let colorIndex = 0;

    appliedEffects.forEach(effect => {
      const configs = effectsConfigurations[effect] || [];
      if (configs.length === 0) return;

      const configKeys = Array.from(new Set(configs.flatMap(c =>
        Object.keys(c.config).filter(key => typeof c.config[key] === 'number')
      )));

      configKeys.forEach(key => {
        const points = configs
          .filter(c => typeof c.config[key] === 'number' && isFinite(c.config[key]))
          .map(c => ({
            timestamp: c.timestamp / 1000,
            value: c.config[key] as number,
          }));

        if (points.length > 0) {
          allCurves.push({
            effectType: effect,
            key,
            points,
            color: curveColors[colorIndex % curveColors.length],
          });
          colorIndex++;
        }
      });
    });

    if (allCurves.length === 0) return null;

    // Calculer min/max global
    let minValue = Infinity;
    let maxValue = -Infinity;

    allCurves.forEach(curve => {
      curve.points.forEach(p => {
        minValue = Math.min(minValue, p.value);
        maxValue = Math.max(maxValue, p.value);
      });
    });

    // Ajouter une marge de 10%
    if (isFinite(minValue) && isFinite(maxValue)) {
      const range = maxValue - minValue;
      const margin = range * 0.1;
      minValue -= margin;
      maxValue += margin;
    } else {
      minValue = 0;
      maxValue = 1;
    }

    const timeToX = (time: number) => (time / totalDuration) * graphWidth;
    const valueToY = (value: number) => graphHeight - ((value - minValue) / (maxValue - minValue)) * graphHeight;

    return (
      <div className="space-y-3">
        {/* Graphique SVG */}
        <svg width={width} height={height} className="border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-900">
          {/* Axes */}
          <line
            x1={padding.left}
            y1={padding.top}
            x2={padding.left}
            y2={height - padding.bottom}
            stroke="currentColor"
            className="text-gray-400"
            strokeWidth="1"
          />
          <line
            x1={padding.left}
            y1={height - padding.bottom}
            x2={width - padding.right}
            y2={height - padding.bottom}
            stroke="currentColor"
            className="text-gray-400"
            strokeWidth="1"
          />

          {/* Grille horizontale */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
            const y = padding.top + graphHeight * ratio;
            const value = maxValue - (maxValue - minValue) * ratio;
            return (
              <g key={i}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke="currentColor"
                  className="text-gray-200 dark:text-gray-700"
                  strokeWidth="0.5"
                  strokeDasharray="2,2"
                />
                <text
                  x={padding.left - 5}
                  y={y}
                  textAnchor="end"
                  alignmentBaseline="middle"
                  className="text-[8px] fill-gray-500 dark:fill-gray-400"
                >
                  {value.toFixed(1)}
                </text>
              </g>
            );
          })}

          {/* Grille verticale (temps) */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
            const x = padding.left + graphWidth * ratio;
            const time = totalDuration * ratio;
            return (
              <g key={i}>
                <line
                  x1={x}
                  y1={padding.top}
                  x2={x}
                  y2={height - padding.bottom}
                  stroke="currentColor"
                  className="text-gray-200 dark:text-gray-700"
                  strokeWidth="0.5"
                  strokeDasharray="2,2"
                />
                <text
                  x={x}
                  y={height - padding.bottom + 15}
                  textAnchor="middle"
                  className="text-[8px] fill-gray-500 dark:fill-gray-400"
                >
                  {formatTime(time)}
                </text>
              </g>
            );
          })}

          {/* Toutes les courbes */}
          {allCurves.map((curve, idx) => {
            const pointsData = curve.points.map(p => ({
              x: padding.left + timeToX(p.timestamp),
              y: padding.top + valueToY(p.value),
              timestamp: p.timestamp,
              value: p.value,
            }));

            if (pointsData.length === 0) return null;

            const pathData = pointsData.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

            return (
              <g key={`${curve.effectType}-${curve.key}`}>
                <path
                  d={pathData}
                  fill="none"
                  stroke={curve.color}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.7"
                />
                {/* Points */}
                {pointsData.map((p, i) => (
                  <circle
                    key={i}
                    cx={p.x}
                    cy={p.y}
                    r="3"
                    fill={curve.color}
                    className="cursor-pointer transition-all"
                    onClick={() => handleSeekToTime(p.timestamp)}
                    onMouseEnter={(e) => e.currentTarget.setAttribute('r', '5')}
                    onMouseLeave={(e) => e.currentTarget.setAttribute('r', '3')}
                    style={{ cursor: 'pointer' }}
                  >
                    <title>{`${effectNames[curve.effectType]} - ${curve.key}: ${p.value.toFixed(2)} à ${formatTime(p.timestamp)}`}</title>
                  </circle>
                ))}
              </g>
            );
          })}
        </svg>

        {/* Légende interactive */}
        <div className="flex flex-wrap gap-2 justify-center">
          {allCurves.map((curve, idx) => (
            <div
              key={`${curve.effectType}-${curve.key}`}
              className="px-2 py-1 text-xs rounded-full border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 flex items-center gap-1"
            >
              <span
                className="inline-block w-3 h-3 rounded-full"
                style={{ backgroundColor: curve.color }}
              />
              <EffectIcon effect={curve.effectType} className="w-3 h-3" />
              <span>{curve.key}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Fonction pour générer le graphique SVG d'un effet
  const renderEffectGraph = (effect: AudioEffectType) => {
    const configs = effectsConfigurations[effect] || [];
    if (configs.length === 0) return null;

    const totalDuration = duration || attachmentDuration || 1;
    const width = 350;
    const height = 150;
    const padding = { top: 10, right: 10, bottom: 40, left: 40 };
    const graphWidth = width - padding.left - padding.right;
    const graphHeight = height - padding.top - padding.bottom;

    // Extraire toutes les clés de configuration (seulement les valeurs numériques)
    const configKeys = Array.from(new Set(configs.flatMap(c =>
      Object.keys(c.config).filter(key => typeof c.config[key] === 'number')
    )));

    console.log(`📈 [renderEffectGraph] Effect: ${effect}`, {
      configs,
      configKeys,
      totalDuration,
    });

    // Initialiser la visibilité des courbes si nécessaire
    if (!visibleCurves[effect]) {
      const initialVisibility: Record<string, boolean> = {};
      configKeys.forEach(key => {
        initialVisibility[key] = true;
      });
      setVisibleCurves(prev => ({ ...prev, [effect]: initialVisibility }));
    }

    const currentVisibility = visibleCurves[effect] || {};

    // Calculer les min/max pour les courbes visibles
    let minValue = Infinity;
    let maxValue = -Infinity;

    configKeys.forEach(key => {
      if (currentVisibility[key] !== false) {
        configs.forEach(c => {
          const value = c.config[key];
          if (typeof value === 'number' && isFinite(value)) {
            minValue = Math.min(minValue, value);
            maxValue = Math.max(maxValue, value);
          }
        });
      }
    });

    // Ajouter une marge de 10%
    if (isFinite(minValue) && isFinite(maxValue)) {
      const range = maxValue - minValue;
      const margin = range * 0.1;
      minValue -= margin;
      maxValue += margin;
    } else {
      minValue = 0;
      maxValue = 1;
    }

    // Fonction pour convertir les coordonnées en pixels
    const timeToX = (time: number) => (time / totalDuration) * graphWidth;
    const valueToY = (value: number) => graphHeight - ((value - minValue) / (maxValue - minValue)) * graphHeight;

    // Couleurs pour les courbes
    const curveColors = [
      '#3b82f6', // blue
      '#ef4444', // red
      '#10b981', // green
      '#f59e0b', // amber
      '#8b5cf6', // purple
      '#ec4899', // pink
    ];

    return (
      <div className="space-y-3">
        {/* Graphique SVG */}
        <svg width={width} height={height} className="border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-900">
          {/* Axes */}
          <line
            x1={padding.left}
            y1={padding.top}
            x2={padding.left}
            y2={height - padding.bottom}
            stroke="currentColor"
            className="text-gray-400"
            strokeWidth="1"
          />
          <line
            x1={padding.left}
            y1={height - padding.bottom}
            x2={width - padding.right}
            y2={height - padding.bottom}
            stroke="currentColor"
            className="text-gray-400"
            strokeWidth="1"
          />

          {/* Grille horizontale */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
            const y = padding.top + graphHeight * ratio;
            const value = maxValue - (maxValue - minValue) * ratio;
            return (
              <g key={i}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke="currentColor"
                  className="text-gray-200 dark:text-gray-700"
                  strokeWidth="0.5"
                  strokeDasharray="2,2"
                />
                <text
                  x={padding.left - 5}
                  y={y}
                  textAnchor="end"
                  alignmentBaseline="middle"
                  className="text-[8px] fill-gray-500 dark:fill-gray-400"
                >
                  {value.toFixed(1)}
                </text>
              </g>
            );
          })}

          {/* Grille verticale (temps) */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
            const x = padding.left + graphWidth * ratio;
            const time = totalDuration * ratio;
            return (
              <g key={i}>
                <line
                  x1={x}
                  y1={padding.top}
                  x2={x}
                  y2={height - padding.bottom}
                  stroke="currentColor"
                  className="text-gray-200 dark:text-gray-700"
                  strokeWidth="0.5"
                  strokeDasharray="2,2"
                />
                <text
                  x={x}
                  y={height - padding.bottom + 15}
                  textAnchor="middle"
                  className="text-[8px] fill-gray-500 dark:fill-gray-400"
                >
                  {formatTime(time)}
                </text>
              </g>
            );
          })}

          {/* Courbes */}
          {configKeys.map((key, idx) => {
            if (currentVisibility[key] === false) return null;

            const pointsData = configs
              .filter(c => typeof c.config[key] === 'number' && isFinite(c.config[key]))
              .map(c => ({
                x: padding.left + timeToX(c.timestamp / 1000), // Convertir ms en secondes
                y: padding.top + valueToY(c.config[key] as number),
                timestamp: c.timestamp / 1000, // Timestamp en secondes pour le seek
                value: c.config[key] as number,
              }));

            if (pointsData.length === 0) return null;

            // Créer le path SVG
            const pathData = pointsData.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

            return (
              <g key={key}>
                <path
                  d={pathData}
                  fill="none"
                  stroke={curveColors[idx % curveColors.length]}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* Points */}
                {pointsData.map((p, i) => (
                  <circle
                    key={i}
                    cx={p.x}
                    cy={p.y}
                    r="4"
                    fill={curveColors[idx % curveColors.length]}
                    className="cursor-pointer transition-all"
                    onClick={() => handleSeekToTime(p.timestamp)}
                    onMouseEnter={(e) => e.currentTarget.setAttribute('r', '6')}
                    onMouseLeave={(e) => e.currentTarget.setAttribute('r', '4')}
                    style={{ cursor: 'pointer' }}
                  >
                    <title>{`${key}: ${p.value.toFixed(2)} à ${formatTime(p.timestamp)} - Cliquez pour aller à ce moment`}</title>
                  </circle>
                ))}
              </g>
            );
          })}
        </svg>

        {/* Légende interactive */}
        <div className="flex flex-wrap gap-2 justify-center">
          {configKeys.map((key, idx) => (
            <button
              key={key}
              onClick={() => {
                setVisibleCurves(prev => ({
                  ...prev,
                  [effect]: {
                    ...prev[effect],
                    [key]: !(prev[effect]?.[key] ?? true),
                  },
                }));
              }}
              className={`px-2 py-1 text-xs rounded-full border transition-all ${
                currentVisibility[key] !== false
                  ? 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600'
                  : 'bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600 opacity-50'
              }`}
              style={{
                borderColor: currentVisibility[key] !== false ? curveColors[idx % curveColors.length] : undefined,
              }}
            >
              <span
                className="inline-block w-3 h-3 rounded-full mr-1"
                style={{ backgroundColor: curveColors[idx % curveColors.length] }}
              />
              {key}
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div
      className={`relative flex flex-col gap-1.5 p-2 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-900 rounded-lg border ${
        hasError ? 'border-red-300 dark:border-red-700' : 'border-blue-200 dark:border-gray-700'
      } shadow-md hover:shadow-lg transition-all duration-200 w-full sm:max-w-2xl ${className}`}
    >
      {/* Ligne principale: Colonne Play+Download + Zone centrale (Gauge/% + Barre + Timer) + Colonne actions (Effet) */}
      <div className="flex items-center gap-3">
        {/* Colonne gauche: Play/Pause + Gauge (vitesse uniquement) */}
        <div className="flex flex-col gap-1 items-center">
          {/* Bouton Play/Pause - Design moderne compact */}
          <Button
            onClick={togglePlay}
            disabled={isLoading || hasError}
            size="sm"
            className={`flex-shrink-0 w-7 h-7 rounded-full ${
              hasError
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-blue-600 hover:bg-blue-700'
            } text-white shadow-lg hover:shadow-xl transition-all duration-200 p-0 flex items-center justify-center disabled:opacity-50`}
          >
            {isLoading ? (
              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : hasError ? (
              <AlertTriangle className="w-3 h-3" />
            ) : isPlaying ? (
              <Pause className="w-3 h-3 fill-current" />
            ) : (
              <Play className="w-3 h-3 ml-0.5 fill-current" />
            )}
          </Button>

          {/* Bouton Gauge - Vitesse de lecture */}
          <DropdownMenu open={isSpeedPopoverOpen} onOpenChange={setIsSpeedPopoverOpen}>
            <DropdownMenuTrigger asChild>
              <a
                href="#"
                className="flex-shrink-0 inline-flex items-center justify-center w-5 h-5 bg-white/70 dark:bg-gray-700/70 hover:bg-white dark:hover:bg-gray-700 rounded-full shadow-sm transition-all cursor-pointer"
                title={`Vitesse: ${playbackRate}x`}
                onClick={(e) => e.preventDefault()}
              >
                <Gauge className="w-2.5 h-2.5 text-gray-700 dark:text-gray-200" />
              </a>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="min-w-0 w-auto p-0.5" side="top" align="center">
              <div className="flex flex-col items-center gap-0.5 px-1">
                {/* Slider vertical simplifié */}
                <div className="relative h-16 flex items-center justify-center">
                  {/* Slider (input vertical) */}
                  <input
                    type="range"
                    min="0.1"
                    max="5"
                    step="0.01"
                    value={playbackRate}
                    onChange={handlePlaybackRateChange}
                    onInput={handlePlaybackRateChange}
                    onTouchMove={handlePlaybackRateChange}
                    className="h-full appearance-none bg-gray-200 dark:bg-gray-600 rounded-full cursor-pointer"
                    style={{
                      writingMode: 'bt-lr',
                      WebkitAppearance: 'slider-vertical',
                      width: '4px',
                      touchAction: 'none',
                    }}
                  />
                </div>

                {/* Affichage de la vitesse actuelle */}
                <div className="text-[8px] font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                  {playbackRate.toFixed(1)}x
                </div>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Zone centrale: Timer + Barre de progression */}
        <div className="flex-1 min-w-0 flex flex-col gap-1">

          {/* Ligne en haut: Timer + Effects + Download */}
          <div className="flex items-center justify-center gap-2">
            <div className="text-[12px] font-mono text-gray-600 dark:text-gray-300">
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

            {/* Bouton Effects - sans fond */}
            {appliedEffects.length > 0 && (
              <DropdownMenu open={isEffectsDropdownOpen} onOpenChange={setIsEffectsDropdownOpen}>
                <DropdownMenuTrigger asChild>
                  <a
                    href="#"
                    className="flex-shrink-0 inline-flex items-center justify-center w-5 h-5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-all cursor-pointer"
                    title={appliedEffects.length === 1 ? `Effet: ${appliedEffects[0]}` : `${appliedEffects.length} effets appliqués`}
                    onClick={(e) => e.preventDefault()}
                  >
                    {appliedEffects.length === 1 ? (
                      <EffectIcon effect={appliedEffects[0]} className="w-3 h-3" />
                    ) : (
                      <Sliders className="w-3 h-3" />
                    )}
                  </a>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-96 p-4 max-h-96 overflow-hidden" side="top" align="end">
                <Tabs value={selectedEffectTab} onValueChange={(value) => setSelectedEffectTab(value as AudioEffectType | 'overview')}>
                  <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${appliedEffects.length + 1}, 1fr)` }}>
                    <TabsTrigger value="overview" className="text-xs">Vue d'ensemble</TabsTrigger>
                    {appliedEffects.map((effect) => (
                      <TabsTrigger key={effect} value={effect} className="text-xs flex flex-col items-center gap-0.5 py-1">
                        <EffectIcon effect={effect} className="w-4 h-4" />
                        <span className="text-[10px] leading-tight">{effectNames[effect]}</span>
                      </TabsTrigger>
                    ))}
                  </TabsList>

                  {/* Tab Vue d'ensemble - Timeline de tous les effets */}
                  <TabsContent value="overview" className="mt-4 space-y-3 max-h-72 overflow-x-auto overflow-y-auto">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Timeline des effets</h3>

                    {effectsTimeline.length === 0 ? (
                      <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded">
                        Aucune donnée de timeline disponible. Vérifiez la console pour les détails.
                      </div>
                    ) : (
                      <>
                        {/* Graphique de timeline */}
                        <div className="space-y-2">
                          {appliedEffects.map((effect) => {
                            const segments = effectsTimeline.filter(s => s.effectType === effect);
                            const totalDuration = duration || attachmentDuration || 1;

                            return (
                              <div key={effect} className="space-y-1">
                                <div className="flex items-center gap-2 text-xs">
                                  <EffectIcon effect={effect} className="w-3.5 h-3.5" />
                                  <span className="font-medium text-gray-700 dark:text-gray-300">{effectNames[effect]}</span>
                                  <span className="text-gray-400">({segments.length} segment{segments.length > 1 ? 's' : ''})</span>
                                </div>

                                {/* Barre de timeline */}
                                <div className="relative h-6 bg-gray-100 dark:bg-gray-800 rounded overflow-hidden">
                                  {segments.length === 0 ? (
                                    <div className="absolute inset-0 flex items-center justify-center text-[10px] text-gray-400">
                                      Aucun segment
                                    </div>
                                  ) : (
                                    segments.map((segment, idx) => {
                                      const startTimeSeconds = segment.startTime / 1000; // Convertir ms en secondes
                                      const endTimeSeconds = segment.endTime / 1000;
                                      const startPercent = (startTimeSeconds / totalDuration) * 100;
                                      const widthPercent = ((endTimeSeconds - startTimeSeconds) / totalDuration) * 100;

                                      return (
                                        <div
                                          key={idx}
                                          className="absolute h-full rounded cursor-pointer hover:opacity-100 transition-opacity"
                                          style={{
                                            left: `${startPercent}%`,
                                            width: `${widthPercent}%`,
                                            backgroundColor: effectColors[effect],
                                            opacity: 0.8,
                                          }}
                                          title={`${startTimeSeconds.toFixed(2)}s - ${endTimeSeconds.toFixed(2)}s - Cliquez pour aller à ce moment`}
                                          onClick={() => handleSeekToTime(startTimeSeconds)}
                                        />
                                      );
                                    })
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Légende du temps */}
                        <div className="flex justify-between text-[10px] text-gray-500 dark:text-gray-400 mt-1">
                          <span>0:00</span>
                          <span>{formatTime(duration || attachmentDuration || 0)}</span>
                        </div>

                        {/* Graphe fusionné de toutes les courbes */}
                        {appliedEffects.some(effect => effectsConfigurations[effect]?.length > 0) && (
                          <div className="mt-4 space-y-2">
                            <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300">Évolution de tous les paramètres</h4>
                            {renderMergedEffectsGraph()}
                          </div>
                        )}
                      </>
                    )}
                  </TabsContent>

                  {/* Tabs individuels pour chaque effet */}
                  {appliedEffects.map((effect) => {
                    const segments = effectsTimeline.filter(s => s.effectType === effect);

                    return (
                      <TabsContent key={effect} value={effect} className="mt-4 space-y-3 max-h-72 overflow-x-auto overflow-y-auto">
                        <div className="flex items-center gap-2">
                          <EffectIcon effect={effect} className="w-5 h-5" />
                          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{effectNames[effect]}</h3>
                        </div>

                        {/* Informations sur l'effet */}
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Périodes d'activation:</span>
                            <span className="font-medium text-gray-900 dark:text-gray-100">{segments.length}</span>
                          </div>

                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Temps total:</span>
                            <span className="font-medium text-gray-900 dark:text-gray-100">
                              {formatTime(segments.reduce((acc, s) => acc + (s.endTime - s.startTime), 0))}
                            </span>
                          </div>
                        </div>

                        {/* Graphique des configurations */}
                        <div className="space-y-2">
                          <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300">Évolution des paramètres</h4>
                          {effectsConfigurations[effect] && effectsConfigurations[effect].length > 0 ? (
                            renderEffectGraph(effect)
                          ) : (
                            <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded">
                              Aucune configuration disponible pour cet effet. Vérifiez la console pour les détails.
                            </div>
                          )}
                        </div>
                      </TabsContent>
                    );
                  })}
                </Tabs>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Bouton Download */}
            <a
              href={objectUrl || '#'}
              download={attachment.originalName}
              className="flex-shrink-0 inline-flex items-center justify-center w-5 h-5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-all"
              title="Télécharger l'audio"
              onClick={(e) => {
                if (!objectUrl) {
                  e.preventDefault();
                }
              }}
            >
              <Download className="w-3 h-3 text-gray-700 dark:text-gray-200" />
            </a>
          </div>

          {/* Barre de progression avec pourcentage intégré */}
          <div className="relative w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-visible group cursor-pointer">
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

            {/* Pourcentage centré dans la barre (horizontalement ET verticalement) */}
            {duration > 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="text-[9px] font-semibold text-white dark:text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]">
                  {progress.toFixed(0)}%
                </span>
              </div>
            )}

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
        </div>
      </div>

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
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    // Si >= 1h : HH:MM:SS, sinon MM:SS
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
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
