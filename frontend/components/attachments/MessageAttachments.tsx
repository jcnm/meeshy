/**
 * Composant pour afficher les attachments dans un message reçu
 * Optimisé pour mobile avec affichage adaptatif
 */

'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Download, File, Image as ImageIcon, FileText, Video, Music, ChevronRight, Grid3X3, X } from 'lucide-react';
import { Attachment, formatFileSize, getAttachmentType } from '../../shared/types/attachment';
import { SimpleAudioPlayer } from '@/components/audio/SimpleAudioPlayer';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { useI18n } from '@/hooks/useI18n';
import { AttachmentService } from '@/services/attachmentService';
import { toast } from 'sonner';

interface MessageAttachmentsProps {
  attachments: Attachment[];
  onImageClick?: (attachmentId: string) => void;
  /**
   * ID de l'utilisateur courant (pour vérifier les permissions)
   */
  currentUserId?: string;
  /**
   * Token d'authentification
   */
  token?: string;
  /**
   * Callback appelé après suppression d'un attachment
   */
  onAttachmentDeleted?: (attachmentId: string) => void;
}

export function MessageAttachments({
  attachments,
  onImageClick,
  currentUserId,
  token,
  onAttachmentDeleted
}: MessageAttachmentsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [attachmentToDelete, setAttachmentToDelete] = useState<Attachment | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedAttachmentId, setSelectedAttachmentId] = useState<string | null>(null);
  const { t } = useI18n('common');

  // Handler pour ouvrir la confirmation de suppression
  const handleOpenDeleteConfirm = useCallback((attachment: Attachment, event: React.MouseEvent) => {
    // Empêcher le clic normal
    event.preventDefault();
    event.stopPropagation();

    setAttachmentToDelete(attachment);
  }, []);

  // Handler pour confirmer la suppression
  const handleDeleteConfirm = useCallback(async () => {
    if (!attachmentToDelete || !token) return;

    setIsDeleting(true);
    try {
      await AttachmentService.deleteAttachment(attachmentToDelete.id, token);
      onAttachmentDeleted?.(attachmentToDelete.id);
      toast.success('Fichier supprimé avec succès');
      setAttachmentToDelete(null);
    } catch (error) {
      console.error('Erreur suppression attachment:', error);
      toast.error('Impossible de supprimer le fichier');
    } finally {
      setIsDeleting(false);
    }
  }, [attachmentToDelete, token, onAttachmentDeleted]);

  // Handler pour annuler la suppression
  const handleDeleteCancel = useCallback(() => {
    setAttachmentToDelete(null);
  }, []);

  // Détecter si on est sur mobile
  React.useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Désélectionner l'attachment quand on clique ailleurs (mobile)
  React.useEffect(() => {
    if (!selectedAttachmentId) return;

    const handleClickOutside = () => {
      setSelectedAttachmentId(null);
    };

    // Attendre un peu avant d'ajouter le listener pour éviter de détecter le clic qui a sélectionné
    const timeoutId = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [selectedAttachmentId]);

  if (!attachments || attachments.length === 0) return null;

  // Séparer les images des autres types
  const imageAttachments = attachments.filter(att => getAttachmentType(att.mimeType) === 'image');
  const otherAttachments = attachments.filter(att => getAttachmentType(att.mimeType) !== 'image');

  // Seuil pour passer en mode multi-lignes : 10+ attachments
  const multiRowThreshold = 10;
  const shouldUseMultiRow = attachments.length >= multiRowThreshold;
  const shouldShowExpandButton = attachments.length > multiRowThreshold;
  const displayedAttachments = isExpanded || !shouldShowExpandButton 
    ? attachments 
    : attachments.slice(0, multiRowThreshold);

  const getFileIcon = (attachment: Attachment) => {
    const type = getAttachmentType(attachment.mimeType);
    const iconClass = "w-4 h-4";
    
    switch (type) {
      case 'image':
        return <ImageIcon className={`${iconClass} text-blue-500`} />;
      case 'video':
        return <Video className={`${iconClass} text-purple-500`} />;
      case 'audio':
        return <Music className={`${iconClass} text-green-500`} />;
      case 'text':
        return <FileText className={`${iconClass} text-gray-600 dark:text-gray-400`} />;
      default:
        return <File className={`${iconClass} text-gray-500 dark:text-gray-400`} />;
    }
  };

  const getExtension = (filename: string): string => {
    const parts = filename.split('.');
    return parts.length > 1 ? `.${parts[parts.length - 1]}` : '';
  };

  const renderAttachment = (attachment: Attachment, index: number) => {
    const type = getAttachmentType(attachment.mimeType);
    const extension = getExtension(attachment.originalName);

    // Vérifier si l'utilisateur peut supprimer cet attachment
    const canDelete = currentUserId === attachment.uploadedBy;

    // Image attachment - miniature cliquable
    if (type === 'image') {
      // Handler pour ouvrir la confirmation de suppression
      const handleDeleteClick = (event: React.MouseEvent) => {
        handleOpenDeleteConfirm(attachment, event);
      };

      // Handler pour le tap sur mobile (toggle actions visibility)
      const handleImageClick = (event: React.MouseEvent) => {
        if (isMobile && canDelete) {
          // Sur mobile, premier tap = afficher les actions, second tap = ouvrir l'image
          if (selectedAttachmentId === attachment.id) {
            // Déjà sélectionné, ouvrir l'image
            onImageClick?.(attachment.id);
          } else {
            // Pas encore sélectionné, afficher les actions
            event.stopPropagation();
            setSelectedAttachmentId(attachment.id);
          }
        } else {
          // Desktop ou pas de droits de suppression: ouvrir directement
          onImageClick?.(attachment.id);
        }
      };

      // Déterminer la taille d'affichage selon le nombre d'images
      // Augmentation de 40% sur toutes les tailles
      let sizeClasses = '';
      let aspectRatioClass = '';

      if (imageAttachments.length === 1) {
        // 1 image: très grand, pleine largeur
        sizeClasses = isMobile ? 'w-full max-w-lg' : 'w-full max-w-2xl';
        aspectRatioClass = 'aspect-video'; // 16:9 ratio
      } else if (imageAttachments.length === 2) {
        // 2 images: côte à côte, moyennement grandes
        sizeClasses = isMobile ? 'w-[calc(50%-4px)]' : 'w-[calc(50%-8px)]';
        aspectRatioClass = 'aspect-square';
      } else if (imageAttachments.length <= 4) {
        // 3-4 images: grid 2x2 (+40%)
        sizeClasses = isMobile ? 'w-44 h-44' : 'w-56 h-56';
      } else {
        // 5+ images: miniatures compactes (+40%)
        sizeClasses = isMobile ? 'w-28 h-28' : 'w-32 h-32';
      }

      // Utiliser l'image originale pour 1 ou 2 images (meilleure qualité)
      const useOriginalImage = imageAttachments.length <= 2;
      const imageUrl = useOriginalImage ? attachment.fileUrl : (attachment.thumbnailUrl || attachment.fileUrl);

      // Déterminer si les actions doivent être visibles
      const isActionsVisible = selectedAttachmentId === attachment.id;

      return (
        <TooltipProvider key={attachment.id}>
          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <div
                className="relative group cursor-pointer flex-shrink-0 snap-start"
                onClick={handleImageClick}
              >
                <div className={`relative bg-gray-100 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden hover:border-blue-400 dark:hover:border-blue-500 transition-all hover:shadow-lg dark:hover:shadow-blue-500/30 flex-shrink-0 ${sizeClasses} ${aspectRatioClass}`}>
                  <img
                    src={imageUrl}
                    alt={attachment.originalName}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />

                  {/* Bouton de suppression (visible si l'utilisateur a les droits) */}
                  {canDelete && (
                    <button
                      onClick={handleDeleteClick}
                      className={`absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-opacity shadow-md z-10 ${
                        isActionsVisible ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                      }`}
                      title="Supprimer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Extension badge - seulement pour petites images */}
                  {imageAttachments.length > 2 && (
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 py-1">
                      <div className="text-white text-[10px] font-medium truncate">
                        {extension.toUpperCase()}
                      </div>
                    </div>
                  )}
                </div>
                {/* Size badge - seulement pour petites images */}
                {imageAttachments.length > 2 && (
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-gray-700 dark:bg-gray-600 text-white text-[9px] px-1.5 py-0.5 rounded-full whitespace-nowrap shadow-sm">
                    {formatFileSize(attachment.fileSize)}
                  </div>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent side="top">
              <div className="text-xs">
                <div className="font-medium truncate max-w-[200px]">{attachment.originalName}</div>
                <div className="text-gray-400 dark:text-gray-500">
                  {formatFileSize(attachment.fileSize)}
                  {attachment.width && attachment.height && ` • ${attachment.width}x${attachment.height}`}
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    // Audio attachment - Utiliser SimpleAudioPlayer
    if (type === 'audio') {
      // Proper type conversion
      const audioAttachment = {
        id: attachment.id,
        messageId: attachment.messageId,
        fileName: attachment.fileName,
        originalName: attachment.originalName,
        mimeType: attachment.mimeType,
        fileSize: attachment.fileSize,
        fileUrl: attachment.fileUrl,
        thumbnailUrl: attachment.thumbnailUrl,
        width: attachment.width,
        height: attachment.height,
        duration: attachment.duration,
        uploadedBy: attachment.uploadedBy,
        isAnonymous: attachment.isAnonymous,
        createdAt: attachment.createdAt
      };

      return (
        <div key={attachment.id} className="col-span-full">
          <SimpleAudioPlayer attachment={audioAttachment as any} />
        </div>
      );
    }

    // Autres types (document, video, text) - icône simple
    // Handler pour ouvrir la confirmation de suppression
    const handleDeleteClick = (event: React.MouseEvent) => {
      handleOpenDeleteConfirm(attachment, event);
    };

    // Handler pour le tap sur mobile (toggle actions visibility)
    const handleFileClick = (event: React.MouseEvent) => {
      if (isMobile && canDelete) {
        // Sur mobile, premier tap = afficher les actions, second tap = ouvrir le fichier
        if (selectedAttachmentId === attachment.id) {
          // Déjà sélectionné, ouvrir le fichier
          window.open(attachment.fileUrl, '_blank');
        } else {
          // Pas encore sélectionné, afficher les actions
          event.stopPropagation();
          setSelectedAttachmentId(attachment.id);
        }
      } else {
        // Desktop ou pas de droits de suppression: ouvrir directement
        window.open(attachment.fileUrl, '_blank');
      }
    };

    // Déterminer si les actions doivent être visibles
    const isActionsVisible = selectedAttachmentId === attachment.id;

    return (
      <TooltipProvider key={attachment.id}>
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <div
              className="relative group flex-shrink-0 snap-start cursor-pointer"
              onClick={handleFileClick}
            >
              <div className={`relative flex flex-col items-center justify-center bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-600 rounded-lg hover:border-blue-400 dark:hover:border-blue-500 transition-all hover:shadow-md dark:hover:shadow-blue-500/20 flex-shrink-0 ${
                isMobile ? 'w-14 h-14' : 'w-16 h-16'
              }`}>
                <div className="flex flex-col items-center gap-0.5">
                  {getFileIcon(attachment)}
                  <div className="text-[9px] font-medium text-gray-600 dark:text-gray-300">
                    {extension.toUpperCase()}
                  </div>
                </div>

                {/* Bouton de suppression (visible si l'utilisateur a les droits) */}
                {canDelete ? (
                  <button
                    onClick={handleDeleteClick}
                    className={`absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-opacity shadow-md z-10 ${
                      isActionsVisible ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    }`}
                    title="Supprimer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                ) : (
                  /* Download indicator si pas de droits de suppression */
                  <div className={`absolute top-1 right-1 transition-opacity ${
                    isActionsVisible ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  }`}>
                    <Download className="w-3 h-3 text-gray-600 dark:text-gray-400" />
                  </div>
                )}
              </div>
              {/* Size badge */}
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-gray-700 dark:bg-gray-600 text-white text-[8px] px-1 py-0.5 rounded-full whitespace-nowrap shadow-sm">
                {formatFileSize(attachment.fileSize)}
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top">
            <div className="text-xs">
              <div className="font-medium truncate max-w-[200px]">{attachment.originalName}</div>
              <div className="text-gray-400 dark:text-gray-500">
                {formatFileSize(attachment.fileSize)} • {type}
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  // Déterminer le layout selon le nombre d'images
  const getImageLayoutClasses = () => {
    const imageCount = imageAttachments.length;

    if (imageCount === 1) {
      return 'flex flex-col gap-2';
    } else if (imageCount === 2) {
      return 'flex flex-row gap-2 flex-wrap';
    } else if (imageCount <= 4) {
      return 'grid grid-cols-2 gap-2';
    } else {
      return 'flex flex-wrap gap-2';
    }
  };

  return (
    <div className="mt-2 p-2 bg-gray-50/50 dark:bg-gray-800/30 rounded-lg border border-gray-200 dark:border-gray-700 max-w-full overflow-hidden">
      {/* Affichage principal des attachments */}
      <div className={`${getImageLayoutClasses()} pb-1 ${
        shouldUseMultiRow && imageAttachments.length > 4
          ? 'overflow-y-auto max-h-96 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent'
          : ''
      }`}>
        {displayedAttachments.map((attachment, index) => renderAttachment(attachment, index))}
        
        {/* Bouton d'expansion sur mobile */}
        {shouldShowExpandButton && !isExpanded && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(true)}
            className="flex-shrink-0 h-14 w-14 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 border-2 border-dashed border-gray-300 dark:border-gray-500 rounded-lg"
          >
            <div className="flex flex-col items-center gap-1">
              <Grid3X3 className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              <span className="text-[9px] text-gray-500 dark:text-gray-400 font-medium">
                +{attachments.length - multiRowThreshold}
              </span>
            </div>
          </Button>
        )}
      </div>

      {/* Bouton de réduction sur mobile */}
      {isExpanded && shouldShowExpandButton && (
        <div className="mt-2 flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(false)}
            className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
          >
            <ChevronRight className="w-3 h-3 mr-1 rotate-90" />
            {t('showLess')}
          </Button>
        </div>
      )}

      {/* Dialog de confirmation de suppression */}
      <Dialog open={!!attachmentToDelete} onOpenChange={(open) => !open && handleDeleteCancel()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmer la suppression</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer ce fichier ? Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          {attachmentToDelete && (
            <div className="mt-2 p-2 bg-muted rounded-md">
              <div className="text-sm font-medium text-foreground">
                {attachmentToDelete.originalName}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Le fichier sera définitivement supprimé du serveur.
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={handleDeleteCancel}
              disabled={isDeleting}
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
            >
              {isDeleting ? 'Suppression...' : 'Supprimer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

