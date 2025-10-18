/**
 * Composant carrousel compact pour afficher les attachments sous forme d'icônes
 * Optimisé pour mobile avec miniatures légères et traitement asynchrone
 */

'use client';

import React, { useMemo, useEffect, useState } from 'react';
import { X, File, Image, FileText, Video, Music, FileArchive } from 'lucide-react';
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
}

export const AttachmentCarousel = React.memo(function AttachmentCarousel({ 
  files, 
  onRemove, 
  uploadProgress = {},
  disabled = false 
}: AttachmentCarouselProps) {
  // Mémoriser les miniatures d'images (beaucoup plus léger que les images complètes)
  const [thumbnails, setThumbnails] = useState<Map<string, string>>(new Map());
  const [isGeneratingThumbnails, setIsGeneratingThumbnails] = useState(false);
  
  // Détecter si c'est un appareil bas de gamme pour adapter les performances
  const isLowEnd = useMemo(() => isLowEndDevice(), []);

  // Créer les miniatures de manière asynchrone et optimisée
  useEffect(() => {
    let isCancelled = false;

    const generateThumbnails = async () => {
      setThumbnails((prevThumbnails) => {
        // Identifier les nouveaux fichiers qui nécessitent des miniatures
        const newFiles = files.filter((file) => {
          const fileKey = `${file.name}-${file.size}-${file.lastModified}`;
          return file.type.startsWith('image/') && !prevThumbnails.has(fileKey);
        });

        if (newFiles.length === 0) return prevThumbnails;

        // Lancer la génération en arrière-plan
        (async () => {
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
        })();

        return prevThumbnails;
      });
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
  }, [files]);

  // Cleanup final : révoquer toutes les URLs au démontage
  useEffect(() => {
    return () => {
      thumbnails.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  if (files.length === 0) return null;

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
    const extension = getFileExtension(file.name);
    const fileKey = `${file.name}-${file.size}-${file.lastModified}`;
    const thumbnailUrl = thumbnails.get(fileKey);
    
    // Afficher un placeholder si la miniature est en cours de génération
    const isLoadingThumbnail = type === 'image' && !thumbnailUrl && isGeneratingThumbnails;
    
    return (
      <TooltipProvider key={`${file.name}-${index}`}>
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <div className="relative group pt-3 pb-2">
              <div className="relative flex flex-col items-center justify-center w-20 h-20 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-600 rounded-lg hover:border-blue-400 dark:hover:border-blue-500 transition-all duration-200 hover:shadow-md dark:hover:shadow-blue-500/20">
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
                  </div>
                ) : isLoadingThumbnail ? (
                  /* Placeholder pendant le chargement de la miniature */
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                    <div className="text-[9px] text-gray-500 dark:text-gray-400">
                      Aperçu...
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Icon pour les autres types */}
                    <div className="flex flex-col items-center gap-0.5">
                      {getFileIcon(file)}
                      <div className="text-[10px] font-medium text-gray-600 dark:text-gray-300">
                        {extension.toUpperCase()}
                      </div>
                    </div>
                  </>
                )}

                {/* Progress overlay */}
                {isUploading && (
                  <div className="absolute inset-0 bg-white/90 dark:bg-gray-800/90 rounded-lg flex flex-col items-center justify-center">
                    <div className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <div className="text-xs text-blue-600 dark:text-blue-400 font-medium mt-1">
                      {progress}%
                    </div>
                  </div>
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
        {files.map((file, index) => getFilePreview(file, index))}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Optimisation : ne re-rendre que si les fichiers, la progression ou le statut disabled changent
  return (
    prevProps.files.length === nextProps.files.length &&
    prevProps.files.every((file, i) => 
      file === nextProps.files[i] &&
      prevProps.uploadProgress?.[i] === nextProps.uploadProgress?.[i]
    ) &&
    prevProps.disabled === nextProps.disabled
  );
});

