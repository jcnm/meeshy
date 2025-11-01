/**
 * Composant carrousel compact pour afficher les attachments sous forme d'icônes
 * Optimisé pour mobile avec miniatures légères et traitement asynchrone
 */

'use client';

import React, { useMemo, useEffect, useState, useRef } from 'react';
import { X, File, Image, FileText, Video, Music, FileArchive, Loader2, CheckCircle, Play, Pause } from 'lucide-react';
import { formatFileSize, getAttachmentType } from '../../shared/types/attachment';
import { Button } from '../ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import { createThumbnailsBatch, isLowEndDevice } from '@/lib/utils/image-thumbnail';

interface AttachmentCarouselProps {
  files: File[];
  onRemove: (index: number) => void;
  uploadProgress?: { [key: number]: number };
  disabled?: boolean;
  audioRecorderSlot?: React.ReactNode; // Slot pour la carte d'enregistrement audio
}

export const AttachmentCarousel = React.memo(function AttachmentCarousel({
  files,
  onRemove,
  uploadProgress = {},
  disabled = false,
  audioRecorderSlot
}: AttachmentCarouselProps) {
  // Mémoriser les miniatures d'images (beaucoup plus léger que les images complètes)
  const [thumbnails, setThumbnails] = useState<Map<string, string>>(new Map());
  const [isGeneratingThumbnails, setIsGeneratingThumbnails] = useState(false);
  const processedFilesRef = useRef<Set<string>>(new Set());

  // Détecter si c'est un appareil bas de gamme pour adapter les performances
  const isLowEnd = useMemo(() => isLowEndDevice(), []);

  // Créer les miniatures de manière asynchrone et optimisée
  useEffect(() => {
    let isCancelled = false;

    const generateThumbnails = async () => {
      // Identifier les nouveaux fichiers qui nécessitent des miniatures
      const newFiles = files.filter((file) => {
        const fileKey = `${file.name}-${file.size}-${file.lastModified}`;
        return file.type.startsWith('image/') && !processedFilesRef.current.has(fileKey);
      });

      if (newFiles.length === 0) return;

      // Mark files as being processed
      newFiles.forEach((file) => {
        const fileKey = `${file.name}-${file.size}-${file.lastModified}`;
        processedFilesRef.current.add(fileKey);
      });

      setIsGeneratingThumbnails(true);

      try {
        // Créer les miniatures par batch (non bloquant)
        const newThumbnails = await createThumbnailsBatch(newFiles, {
          maxWidth: isLowEnd ? 80 : 120,
          maxHeight: isLowEnd ? 80 : 120,
          quality: isLowEnd ? 0.6 : 0.7,
        });

        if (!isCancelled) {
          setThumbnails((prev) => {
            const updated = new Map(prev);
            newThumbnails.forEach((url, key) => {
              updated.set(key, url);
            });
            return updated;
          });
        }
      } catch (error) {
        console.error('Erreur génération miniatures:', error);
      } finally {
        if (!isCancelled) {
          setIsGeneratingThumbnails(false);
        }
      }
    };

    // Différer légèrement pour ne pas bloquer le rendu initial
    const timeoutId = setTimeout(() => {
      generateThumbnails();
    }, 0);

    return () => {
      isCancelled = true;
      clearTimeout(timeoutId);
    };
  }, [files, isLowEnd]);

  // Nettoyer les miniatures qui ne sont plus utilisées
  useEffect(() => {
    const currentFileKeys = new Set(
      files.map((file) => `${file.name}-${file.size}-${file.lastModified}`)
    );

    // Clean up thumbnails
    setThumbnails((prev) => {
      let hasChanges = false;
      const updated = new Map(prev);

      prev.forEach((url, key) => {
        if (!currentFileKeys.has(key)) {
          URL.revokeObjectURL(url);
          updated.delete(key);
          hasChanges = true;
        }
      });

      return hasChanges ? updated : prev;
    });

    // Clean up processedFilesRef
    const keysToRemove: string[] = [];
    processedFilesRef.current.forEach((key) => {
      if (!currentFileKeys.has(key)) {
        keysToRemove.push(key);
      }
    });
    keysToRemove.forEach((key) => processedFilesRef.current.delete(key));
  }, [files]);

  // Cleanup final : révoquer toutes les URLs au démontage
  useEffect(() => {
    return () => {
      thumbnails.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  if (files.length === 0 && !audioRecorderSlot) return null;

  const getFileIcon = (file: File) => {
    const type = getAttachmentType(file.type);
    const iconClass = "w-5 h-5";
    
    switch (type) {
      case 'image':
        return <Image className={`${iconClass} text-blue-500`} />;
      case 'video':
        return <Video className={`${iconClass} text-purple-500`} />;
      case 'audio':
        return <Music className={`${iconClass} text-green-500`} />;
      case 'text':
        return <FileText className={`${iconClass} text-gray-600`} />;
      default:
        return <File className={`${iconClass} text-gray-500`} />;
    }
  };

  const getFileExtension = (filename: string): string => {
    const parts = filename.split('.');
    return parts.length > 1 ? `.${parts[parts.length - 1]}` : '';
  };

  const getFilePreview = (file: File, index: number) => {
    const type = getAttachmentType(file.type);
    const progress = uploadProgress[index];
    const isUploading = progress !== undefined && progress < 100;
    const isUploaded = progress === 100;
    const extension = getFileExtension(file.name);
    const fileKey = `${file.name}-${file.size}-${file.lastModified}`;
    const thumbnailUrl = thumbnails.get(fileKey);

    // Afficher un placeholder si la miniature est en cours de génération
    const isLoadingThumbnail = type === 'image' && !thumbnailUrl && isGeneratingThumbnails;

    // Audio files get wider size (160x80) to match AudioRecorderCard
    const isAudio = type === 'audio';
    const cardSizeClass = isAudio ? 'w-40 h-20' : 'w-20 h-20';

    // Créer une URL blob pour les fichiers audio afin d'afficher un lecteur
    const [audioUrl, setAudioUrl] = React.useState<string | null>(null);
    const [audioDuration, setAudioDuration] = React.useState<number>(0);
    const [currentTime, setCurrentTime] = React.useState<number>(0);
    const [isPlayingAudio, setIsPlayingAudio] = React.useState(false);
    const audioRef = React.useRef<HTMLAudioElement>(null);

    React.useEffect(() => {
      if (isAudio && file) {
        const url = URL.createObjectURL(file);
        setAudioUrl(url);

        // Créer un audio element temporaire pour obtenir la durée
        const audio = new Audio(url);
        audio.addEventListener('loadedmetadata', () => {
          setAudioDuration(audio.duration || 0);
        });

        return () => {
          URL.revokeObjectURL(url);
        };
      }
    }, [file, isAudio]);

    // Handler pour mettre à jour le temps actuel
    const handleTimeUpdate = () => {
      if (audioRef.current) {
        setCurrentTime(audioRef.current.currentTime);
      }
    };

    const toggleAudioPlay = () => {
      if (audioRef.current) {
        if (isPlayingAudio) {
          audioRef.current.pause();
          setIsPlayingAudio(false);
        } else {
          audioRef.current.play().catch(error => {
            console.error('Error playing audio:', error);
          });
          setIsPlayingAudio(true);
        }
      }
    };

    const formatTime = (seconds: number): string => {
      if (!isFinite(seconds) || isNaN(seconds)) return '0:00';
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
      <TooltipProvider key={`${file.name}-${index}`}>
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <div className="relative group pt-3 pb-2">
              <div className={`relative flex ${isAudio ? 'flex-row items-center justify-between px-3' : 'flex-col items-center justify-center'} ${cardSizeClass} bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-600 rounded-lg hover:border-blue-400 dark:hover:border-blue-500 transition-all duration-200 hover:shadow-md dark:hover:shadow-blue-500/20 ${
                isUploading ? 'border-blue-400 dark:border-blue-500' : ''
              } ${isUploaded ? 'border-green-400 dark:border-green-500' : ''} ${
                isAudio ? 'bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 border-green-400 dark:border-green-500' : ''
              }`}>
                {/* Image preview avec miniature optimisée */}
                {type === 'image' && thumbnailUrl ? (
                  <div className="absolute inset-0 rounded-lg overflow-hidden">
                    <img
                      src={thumbnailUrl}
                      alt={file.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                    {/* Overlay with extension */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-1 py-0.5">
                      <div className="text-white text-[10px] font-medium truncate">
                        {extension.toUpperCase()}
                      </div>
                    </div>
                    
                    {/* Indicateur d'upload pour les images */}
                    {isUploading && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
                        <div className="text-center">
                          <Loader2 className="w-4 h-4 text-white animate-spin mx-auto mb-1" />
                          <div className="text-white text-[8px] font-medium">
                            {Math.round(progress)}%
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Indicateur d'upload terminé pour les images */}
                    {isUploaded && (
                      <div className="absolute top-1 right-1">
                        <CheckCircle className="w-3 h-3 text-green-500 bg-white rounded-full" />
                      </div>
                    )}
                  </div>
                ) : isLoadingThumbnail ? (
                  /* Placeholder pendant le chargement de la miniature */
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                    <div className="text-[9px] text-gray-500 dark:text-gray-400">
                      Aperçu...
                    </div>
                  </div>
                ) : isAudio && audioUrl ? (
                  /* Mini lecteur audio pour les fichiers audio */
                  <>
                    {/* Audio element caché */}
                    <audio
                      ref={audioRef}
                      src={audioUrl}
                      preload="metadata"
                      onTimeUpdate={handleTimeUpdate}
                      onEnded={() => {
                        setIsPlayingAudio(false);
                        setCurrentTime(0);
                      }}
                      onPause={() => setIsPlayingAudio(false)}
                      onPlay={() => setIsPlayingAudio(true)}
                      className="hidden"
                    />

                    {/* Container flex-col pour infos et barre de progression */}
                    <div className="flex flex-col gap-1 flex-1 min-w-0">
                      {/* Countdown et format */}
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-bold text-green-600 dark:text-green-400 font-mono">
                          {formatTime(isPlayingAudio ? audioDuration - currentTime : audioDuration)}
                        </div>
                        <div className="text-[9px] text-green-600 dark:text-green-400 font-medium">
                          {extension.toUpperCase()}
                        </div>
                      </div>

                      {/* Barre de progression */}
                      <div className="relative w-full h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="absolute top-0 left-0 h-full bg-green-600 dark:bg-green-500 rounded-full transition-all duration-100"
                          style={{
                            width: `${audioDuration > 0 ? (currentTime / audioDuration) * 100 : 0}%`
                          }}
                        />
                      </div>

                      {/* Taille et status */}
                      <div className="flex items-center justify-between text-[8px] text-gray-500 dark:text-gray-400">
                        <span>{(file.size / 1024).toFixed(0)} KB</span>
                        <span>{isPlayingAudio ? 'Playing...' : 'Ready'}</span>
                      </div>
                    </div>

                    {/* Bouton Play/Pause */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleAudioPlay();
                      }}
                      className="flex-shrink-0 w-10 h-10 bg-green-600 hover:bg-green-700 text-white rounded-full flex items-center justify-center transition-colors ml-2"
                      disabled={isUploading}
                    >
                      {isPlayingAudio ? (
                        <Pause className="w-4 h-4 fill-current" />
                      ) : (
                        <Play className="w-4 h-4 fill-current ml-0.5" />
                      )}
                    </button>

                    {/* Indicateur d'upload pour audio */}
                    {isUploading && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
                        <div className="text-center">
                          <Loader2 className="w-4 h-4 text-white animate-spin mx-auto mb-1" />
                          <div className="text-white text-[8px] font-medium">
                            {Math.round(progress)}%
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Indicateur d'upload terminé pour audio */}
                    {isUploaded && (
                      <div className="absolute top-1 right-1">
                        <CheckCircle className="w-3 h-3 text-green-500 bg-white rounded-full" />
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {/* Icon pour les autres types */}
                    <div className="flex flex-col items-center gap-0.5">
                      {getFileIcon(file)}
                      <div className="text-[10px] font-medium text-gray-600 dark:text-gray-300">
                        {extension.toUpperCase()}
                      </div>
                    </div>

                    {/* Indicateur d'upload pour les autres fichiers */}
                    {isUploading && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
                        <div className="text-center">
                          <Loader2 className="w-4 h-4 text-white animate-spin mx-auto mb-1" />
                          <div className="text-white text-[8px] font-medium">
                            {Math.round(progress)}%
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Indicateur d'upload terminé pour les autres fichiers */}
                    {isUploaded && (
                      <div className="absolute top-1 right-1">
                        <CheckCircle className="w-3 h-3 text-green-500 bg-white rounded-full" />
                      </div>
                    )}
                  </>
                )}


                {/* Remove button */}
                {!disabled && !isUploading && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(index);
                    }}
                    className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-10"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Size badge */}
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 bg-gray-700 dark:bg-gray-600 text-white text-[9px] px-1.5 py-0.5 rounded-full whitespace-nowrap shadow-sm">
                {formatFileSize(file.size)}
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <div className="text-sm">
              <div className="font-medium truncate">{file.name}</div>
              <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                {formatFileSize(file.size)} • {getAttachmentType(file.type)}
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  return (
    <div className="px-3 py-3 bg-gradient-to-r from-gray-50 to-gray-100/50 dark:from-gray-800 dark:to-gray-700/50 border-t border-gray-200 dark:border-gray-600">
      <div className="flex items-center gap-3 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent pb-1">
        {audioRecorderSlot}
        {files.map((file, index) => getFilePreview(file, index))}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Optimisation : ne re-rendre que si les fichiers, la progression, le statut disabled ou le slot audio changent
  return (
    prevProps.files.length === nextProps.files.length &&
    prevProps.files.every((file, i) =>
      file === nextProps.files[i] &&
      prevProps.uploadProgress?.[i] === nextProps.uploadProgress?.[i]
    ) &&
    prevProps.disabled === nextProps.disabled &&
    prevProps.audioRecorderSlot === nextProps.audioRecorderSlot
  );
});

