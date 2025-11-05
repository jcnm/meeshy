'use client';

import React, { useState } from 'react';
import {
  Download,
  AlertTriangle,
  Maximize,
  Minimize,
  ZoomIn,
  ZoomOut,
  FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { UploadedAttachmentResponse } from '@/shared/types/attachment';

interface PDFViewerProps {
  attachment: UploadedAttachmentResponse;
  className?: string;
  onOpenLightbox?: () => void;
}

/**
 * Lecteur PDF MODERNE avec affichage inline
 * - Affichage via iframe
 * - Bouton plein écran
 * - Bouton télécharger
 * - Gestion d'erreurs
 */
export const PDFViewer: React.FC<PDFViewerProps> = ({
  attachment,
  className = '',
  onOpenLightbox
}) => {
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  const attachmentId = attachment.id;
  const attachmentFileUrl = attachment.fileUrl;

  const handleIframeError = () => {
    setHasError(true);
    setErrorMessage('Impossible de charger le PDF');
  };

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  const handleOpenInNewTab = () => {
    window.open(attachmentFileUrl, '_blank');
  };

  return (
    <div
      className={`flex flex-col gap-2 p-3 bg-gradient-to-br from-red-50 to-orange-50 dark:from-gray-800 dark:to-gray-900 rounded-lg border ${
        hasError
          ? 'border-red-300 dark:border-red-700'
          : 'border-red-200 dark:border-gray-700'
      } shadow-md hover:shadow-lg transition-all duration-200 w-full sm:max-w-2xl ${className}`}
    >
      {/* Iframe PDF */}
      <div className={`relative w-full bg-white dark:bg-gray-900 rounded-lg overflow-hidden transition-all duration-300 ${
        isExpanded ? 'h-[600px]' : 'h-[400px]'
      }`}>
        {!hasError ? (
          <iframe
            src={`${attachmentFileUrl}#toolbar=0&navpanes=0`}
            className="w-full h-full border-0"
            onError={handleIframeError}
            title={attachment.originalName}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800">
            <div className="flex flex-col items-center gap-2 text-gray-600 dark:text-gray-400">
              <AlertTriangle className="w-12 h-12" />
              <span className="text-sm">{errorMessage}</span>
              <Button
                onClick={handleOpenInNewTab}
                size="sm"
                className="mt-2 bg-red-600 hover:bg-red-700 text-white"
              >
                <FileText className="w-4 h-4 mr-2" />
                Ouvrir dans un nouvel onglet
              </Button>
            </div>
          </div>
        )}

        {/* Overlay info */}
        {!hasError && (
          <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
            {attachment.originalName}
          </div>
        )}
      </div>

      {/* Contrôles */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {/* Bouton expand/collapse */}
          <Button
            onClick={toggleExpanded}
            size="sm"
            variant="ghost"
            className="w-8 h-8 p-0"
            title={isExpanded ? 'Réduire' : 'Agrandir'}
          >
            {isExpanded ? (
              <ZoomOut className="w-4 h-4" />
            ) : (
              <ZoomIn className="w-4 h-4" />
            )}
          </Button>

          {/* Info fichier */}
          <div className="text-xs text-gray-600 dark:text-gray-300">
            <span className="font-medium">{attachment.originalName}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Bouton plein écran / lightbox */}
          {onOpenLightbox && (
            <Button
              onClick={onOpenLightbox}
              size="sm"
              variant="ghost"
              className="w-8 h-8 p-0"
              title="Ouvrir en plein écran"
            >
              <Maximize className="w-4 h-4" />
            </Button>
          )}

          {/* Bouton télécharger */}
          <a
            href={attachment.fileUrl}
            download={attachment.originalName}
            className="flex-shrink-0 p-1.5 hover:bg-white/50 dark:hover:bg-gray-700/50 rounded-full transition-all duration-200"
            title="Télécharger"
            onClick={(e) => e.stopPropagation()}
          >
            <Download className="w-4 h-4 text-gray-600 dark:text-gray-300" />
          </a>
        </div>
      </div>
    </div>
  );
};
