'use client';

import {
  FileText,
  FileCode,
  FileAudio,
  FileVideo,
  FileImage,
  File,
  Clock,
  FileCheck,
  AlignLeft
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Attachment } from '@shared/types/attachment';
import { getAttachmentType } from '@shared/types/attachment';

interface AttachmentDetailsProps {
  attachment: Attachment;
  className?: string;
  showIcon?: boolean;
  iconSize?: 'sm' | 'md' | 'lg';
}

/**
 * Composant réutilisable pour afficher les détails d'un attachement
 * Affiche l'icône correspondante et les métadonnées pertinentes
 */
export function AttachmentDetails({
  attachment,
  className,
  showIcon = true,
  iconSize = 'md'
}: AttachmentDetailsProps) {
  const type = getAttachmentType(attachment.mimeType);

  // Tailles d'icônes
  const iconSizeClass = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6'
  }[iconSize];

  // Fonction pour formater la durée (secondes -> HH:MM:SS ou MM:SS)
  const formatDuration = (seconds: number): string => {
    if (!seconds || seconds <= 0) return '0:00';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  // Fonction pour formater la taille de fichier
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  // Obtenir l'icône et les détails selon le type
  const getIconAndDetails = () => {
    switch (type) {
      case 'audio': {
        const duration = attachment.duration ? formatDuration(attachment.duration) : null;
        const bitrate = attachment.bitrate ? `${Math.round(attachment.bitrate / 1000)}kbps` : null;

        return {
          icon: <FileAudio className={iconSizeClass} />,
          iconColor: 'text-purple-500',
          details: [
            duration && <span key="duration" className="flex items-center gap-1"><Clock className="h-3 w-3" />{duration}</span>,
            bitrate && <span key="bitrate">{bitrate}</span>
          ].filter(Boolean)
        };
      }

      case 'video': {
        const duration = attachment.duration ? formatDuration(attachment.duration) : null;
        const dimensions = attachment.width && attachment.height
          ? `${attachment.width}×${attachment.height}`
          : null;

        return {
          icon: <FileVideo className={iconSizeClass} />,
          iconColor: 'text-red-500',
          details: [
            duration && <span key="duration" className="flex items-center gap-1"><Clock className="h-3 w-3" />{duration}</span>,
            dimensions && <span key="dimensions">{dimensions}</span>
          ].filter(Boolean)
        };
      }

      case 'image': {
        const dimensions = attachment.width && attachment.height
          ? `${attachment.width}×${attachment.height}`
          : null;
        const fileSize = formatFileSize(attachment.fileSize);

        return {
          icon: <FileImage className={iconSizeClass} />,
          iconColor: 'text-blue-500',
          details: [
            dimensions && <span key="dimensions">{dimensions}</span>,
            fileSize && <span key="size">{fileSize}</span>
          ].filter(Boolean)
        };
      }

      case 'document': {
        // Pour les documents, afficher le nombre de pages si disponible (à implémenter côté backend)
        // Pour l'instant, afficher la taille du fichier
        const fileSize = formatFileSize(attachment.fileSize);
        const isPdf = attachment.mimeType === 'application/pdf';

        return {
          icon: <FileText className={iconSizeClass} />,
          iconColor: 'text-orange-500',
          details: [
            isPdf && <span key="pdf">PDF</span>,
            fileSize && <span key="size">{fileSize}</span>
          ].filter(Boolean)
        };
      }

      case 'code': {
        // Pour le code, afficher le nombre de lignes si disponible (à implémenter côté backend)
        const fileSize = formatFileSize(attachment.fileSize);
        const extension = attachment.originalName.split('.').pop()?.toUpperCase() || 'CODE';

        return {
          icon: <FileCode className={iconSizeClass} />,
          iconColor: 'text-green-500',
          details: [
            <span key="ext">{extension}</span>,
            fileSize && <span key="size">{fileSize}</span>
          ].filter(Boolean)
        };
      }

      case 'text': {
        const fileSize = formatFileSize(attachment.fileSize);

        return {
          icon: <AlignLeft className={iconSizeClass} />,
          iconColor: 'text-gray-500',
          details: [
            <span key="text">TXT</span>,
            fileSize && <span key="size">{fileSize}</span>
          ].filter(Boolean)
        };
      }

      default: {
        const fileSize = formatFileSize(attachment.fileSize);
        return {
          icon: <File className={iconSizeClass} />,
          iconColor: 'text-gray-500',
          details: [
            fileSize && <span key="size">{fileSize}</span>
          ].filter(Boolean)
        };
      }
    }
  };

  const { icon, iconColor, details } = getIconAndDetails();

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {showIcon && (
        <div className={cn('flex-shrink-0', iconColor)}>
          {icon}
        </div>
      )}
      {details.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {details.map((detail, index) => (
            <span key={index} className="flex items-center gap-1">
              {detail}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Version compacte pour afficher seulement l'icône et un résumé
 */
export function AttachmentDetailsSummary({
  attachment,
  className
}: {
  attachment: Attachment;
  className?: string;
}) {
  const type = getAttachmentType(attachment.mimeType);

  const getIconAndLabel = () => {
    switch (type) {
      case 'audio':
        return { icon: <FileAudio className="h-4 w-4" />, label: 'Audio', color: 'text-purple-500' };
      case 'video':
        return { icon: <FileVideo className="h-4 w-4" />, label: 'Vidéo', color: 'text-red-500' };
      case 'image':
        return { icon: <FileImage className="h-4 w-4" />, label: 'Image', color: 'text-blue-500' };
      case 'document':
        return { icon: <FileText className="h-4 w-4" />, label: 'Document', color: 'text-orange-500' };
      case 'code':
        return { icon: <FileCode className="h-4 w-4" />, label: 'Code', color: 'text-green-500' };
      case 'text':
        return { icon: <AlignLeft className="h-4 w-4" />, label: 'Texte', color: 'text-gray-500' };
      default:
        return { icon: <File className="h-4 w-4" />, label: 'Fichier', color: 'text-gray-500' };
    }
  };

  const { icon, label, color } = getIconAndLabel();

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <span className={cn('flex-shrink-0', color)}>{icon}</span>
      <span className="text-sm text-muted-foreground truncate">{label}</span>
    </div>
  );
}
