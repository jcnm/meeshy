/**
 * Composant pour afficher les attachments dans un message reçu
 * Optimisé pour mobile avec affichage adaptatif
 */

'use client';

import React, { useState, useMemo } from 'react';
import { Download, File, Image as ImageIcon, FileText, Video, Music, ChevronRight, Grid3X3 } from 'lucide-react';
import { Attachment, formatFileSize, getAttachmentType } from '../../shared/types/attachment';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import { Button } from '../ui/button';
import { useI18n } from '@/hooks/useI18n';

interface MessageAttachmentsProps {
  attachments: Attachment[];
  onImageClick?: (attachmentId: string) => void;
}

export function MessageAttachments({ attachments, onImageClick }: MessageAttachmentsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const { t } = useI18n('common');

  // Détecter si on est sur mobile
  React.useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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

    // Image attachment - miniature cliquable
    if (type === 'image') {
      // Déterminer si on doit afficher en grand (moins de 5 images)
      const shouldDisplayLarge = imageAttachments.length < 5 && imageAttachments.length > 0;
      
      return (
        <TooltipProvider key={attachment.id}>
          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <div 
                className="relative group cursor-pointer flex-shrink-0 snap-start"
                onClick={() => onImageClick?.(attachment.id)}
              >
                <div className={`relative bg-gray-100 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden hover:border-blue-400 dark:hover:border-blue-500 transition-all hover:shadow-md dark:hover:shadow-blue-500/20 flex-shrink-0 ${
                  shouldDisplayLarge 
                    ? isMobile ? 'w-24 h-24' : 'w-32 h-32'  // Taille plus grande pour moins de 5 images
                    : isMobile ? 'w-14 h-14' : 'w-16 h-16'   // Taille normale pour 5+ images
                }`}>
                  <img
                    src={attachment.thumbnailUrl || attachment.fileUrl}
                    alt={attachment.originalName}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                  {/* Extension badge */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-1 py-0.5">
                    <div className="text-white text-[9px] font-medium truncate">
                      {extension.toUpperCase()}
                    </div>
                  </div>
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
                  {formatFileSize(attachment.fileSize)}
                  {attachment.width && attachment.height && ` • ${attachment.width}x${attachment.height}`}
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    // Audio attachment
    if (type === 'audio') {
      return (
        <div key={attachment.id} className="col-span-full">
          <div className="flex items-center gap-2 p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg">
            <Music className="w-4 h-4 text-green-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">
                {attachment.originalName}
              </div>
              <div className="text-[10px] text-gray-500 dark:text-gray-400">
                {formatFileSize(attachment.fileSize)}
              </div>
            </div>
            <audio 
              controls 
              className="h-8" 
              src={attachment.fileUrl}
              preload="metadata"
            />
          </div>
        </div>
      );
    }

    // Autres types (document, video, text) - icône simple
    return (
      <TooltipProvider key={attachment.id}>
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <a
              href={attachment.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="relative group flex-shrink-0 snap-start"
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
                {/* Download indicator */}
                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Download className="w-3 h-3 text-gray-600 dark:text-gray-400" />
                </div>
              </div>
              {/* Size badge */}
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-gray-700 dark:bg-gray-600 text-white text-[8px] px-1 py-0.5 rounded-full whitespace-nowrap shadow-sm">
                {formatFileSize(attachment.fileSize)}
              </div>
            </a>
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

  return (
    <div className="mt-2 p-2 bg-gray-50/50 dark:bg-gray-800/30 rounded-lg border border-gray-200 dark:border-gray-700 max-w-full overflow-hidden">
      {/* Affichage principal des attachments */}
      <div className={`flex items-center gap-2 pb-1 ${
        shouldUseMultiRow
          ? 'flex-wrap overflow-y-auto max-h-40 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent'
          : 'overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent snap-x snap-mandatory'
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
    </div>
  );
}

