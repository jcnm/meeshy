'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Download,
  AlertTriangle,
  ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import type { UploadedAttachmentResponse } from '@/shared/types/attachment';
import { formatFileSize } from '@/shared/types/attachment';

interface PDFLightboxWrapperProps {
  attachment: UploadedAttachmentResponse | null;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * PDF Lightbox avec iframe (sans react-pdf pour éviter les erreurs SSR)
 * - Affichage plein écran
 * - Navigation native du navigateur
 * - Pas de dépendance problématique
 */
export const PDFLightboxWrapper: React.FC<PDFLightboxWrapperProps> = ({
  attachment,
  isOpen,
  onClose
}) => {
  const [hasError, setHasError] = useState(false);

  // Reset state when opening new PDF
  useEffect(() => {
    if (isOpen && attachment) {
      setHasError(false);
    }
  }, [isOpen, attachment]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent body scroll when lightbox is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleIframeError = () => {
    setHasError(true);
  };

  const handleDownload = () => {
    if (!attachment) return;

    const link = document.createElement('a');
    link.href = attachment.fileUrl;
    link.download = attachment.originalName;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenInNewTab = () => {
    if (!attachment) return;
    window.open(attachment.fileUrl, '_blank');
  };

  if (!isOpen || !attachment) return null;

  // SSR safety
  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] bg-black/95 dark:bg-black/98 backdrop-blur-sm"
        onClick={onClose}
      >
        {/* Header toolbar */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/50 to-transparent">
          <div className="flex flex-col text-white">
            <span className="font-medium text-sm md:text-base truncate max-w-xs md:max-w-md">
              {attachment.originalName}
            </span>
            <span className="text-xs text-gray-300">
              {formatFileSize(attachment.fileSize)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenInNewTab();
              }}
              className="text-white hover:bg-white/10"
              aria-label="Ouvrir dans un nouvel onglet"
            >
              <ExternalLink className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                handleDownload();
              }}
              className="text-white hover:bg-white/10"
              aria-label="Télécharger le PDF"
            >
              <Download className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="text-white hover:bg-white/10"
              aria-label="Fermer"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* PDF display area */}
        <div
          className="absolute inset-0 pt-20 pb-4 px-4"
          onClick={(e) => e.stopPropagation()}
        >
          {hasError ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-white">
              <AlertTriangle className="w-16 h-16 text-red-400" />
              <p className="text-lg">Impossible de charger le PDF</p>
              <p className="text-sm text-gray-400">{attachment.originalName}</p>
              <div className="flex gap-2 mt-4">
                <Button
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownload();
                  }}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Télécharger
                </Button>
                <Button
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenInNewTab();
                  }}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Ouvrir dans un nouvel onglet
                </Button>
              </div>
            </div>
          ) : (
            <iframe
              src={`${attachment.fileUrl}#toolbar=1&navpanes=1&view=Fit`}
              className="w-full h-full border-0 rounded-lg shadow-2xl"
              title={attachment.originalName}
              onError={handleIframeError}
              style={{
                backgroundColor: 'white'
              }}
            />
          )}
        </div>

        {/* Keyboard instructions */}
        <div className="hidden md:block absolute bottom-4 left-1/2 -translate-x-1/2 text-white/60 text-xs text-center">
          <p>
            Utilisez les contrôles natifs du PDF pour naviguer • Échap pour fermer
          </p>
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
};
