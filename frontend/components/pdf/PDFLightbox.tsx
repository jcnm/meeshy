'use client';

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import type { UploadedAttachmentResponse } from '@/shared/types/attachment';

interface PDFLightboxProps {
  attachment: UploadedAttachmentResponse | null;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * PDF Lightbox - Fullscreen PDF viewer matching ImageLightbox pattern
 */
export const PDFLightbox: React.FC<PDFLightboxProps> = ({
  attachment,
  isOpen,
  onClose
}) => {
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

  if (!isOpen || !attachment) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] bg-black/95 dark:bg-black/98 backdrop-blur-sm"
        onClick={onClose}
      >
        {/* Header bar */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-3 sm:p-4 bg-gradient-to-b from-black/50 to-transparent">
          <div className="flex flex-col text-white min-w-0 flex-1 mr-4">
            <span className="font-medium text-xs sm:text-sm md:text-base truncate">
              {attachment.originalName}
            </span>
            <span className="text-[10px] sm:text-xs text-gray-300">
              PDF Document
            </span>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                const link = document.createElement('a');
                link.href = attachment.fileUrl;
                link.download = attachment.originalName;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
              className="text-white hover:bg-white/10 w-8 h-8 sm:w-10 sm:h-10"
              aria-label="Télécharger le PDF"
            >
              <Download className="w-4 h-4 sm:w-5 sm:h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="text-white hover:bg-white/10 w-8 h-8 sm:w-10 sm:h-10"
              aria-label="Fermer"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </Button>
          </div>
        </div>

        {/* PDF Viewer */}
        <div
          className="absolute inset-0 flex items-center justify-center pt-14 sm:pt-16 pb-2 sm:pb-4 px-2 sm:px-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-full h-full bg-white dark:bg-gray-900 overflow-hidden shadow-2xl">
            <iframe
              src={`${attachment.fileUrl}#toolbar=1&navpanes=1&view=FitH`}
              className="w-full h-full border-0"
              title={attachment.originalName}
            />
          </div>
        </div>

        {/* Instructions (desktop only) */}
        <div className="hidden md:block absolute bottom-4 left-1/2 -translate-x-1/2 text-white/60 text-xs text-center">
          <p>Appuyez sur Échap pour fermer</p>
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
};
