'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import {
  X,
  Download,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import type { UploadedAttachmentResponse } from '@/shared/types/attachment';
import { formatFileSize } from '@/shared/types/attachment';

// Chargement dynamique pour éviter les erreurs SSR
const Document = dynamic(
  () => import('react-pdf').then((mod) => mod.Document),
  { ssr: false }
);

const Page = dynamic(
  () => import('react-pdf').then((mod) => mod.Page),
  { ssr: false }
);

// Configuration du worker PDF.js
if (typeof window !== 'undefined') {
  import('react-pdf').then((reactPdf) => {
    reactPdf.pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${reactPdf.pdfjs.version}/pdf.worker.min.js`;
  });
}

interface PDFLightboxProps {
  attachment: UploadedAttachmentResponse | null;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * PDF Lightbox avec react-pdf
 * - Navigation entre pages
 * - Zoom, rotation
 * - Responsive et tactile
 */
export const PDFLightbox: React.FC<PDFLightboxProps> = ({
  attachment,
  isOpen,
  onClose
}) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.2);
  const [rotation, setRotation] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Reset state when opening new PDF
  useEffect(() => {
    if (isOpen && attachment) {
      setPageNumber(1);
      setScale(1.2);
      setRotation(0);
      setIsLoading(true);
      setHasError(false);
    }
  }, [isOpen, attachment]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          goToPreviousPage();
          break;
        case 'ArrowRight':
          goToNextPage();
          break;
        case '+':
        case '=':
          handleZoomIn();
          break;
        case '-':
          handleZoomOut();
          break;
        case 'r':
        case 'R':
          handleRotate();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, pageNumber, numPages, scale, rotation]);

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

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setIsLoading(false);
    setHasError(false);
  };

  const onDocumentLoadError = (error: Error) => {
    console.error('[PDFLightbox] Erreur chargement PDF:', error, attachment?.fileUrl);
    setHasError(true);
    setIsLoading(false);
  };

  const goToPreviousPage = useCallback(() => {
    setPageNumber((prev) => Math.max(prev - 1, 1));
  }, []);

  const goToNextPage = useCallback(() => {
    setPageNumber((prev) => Math.min(prev + 1, numPages));
  }, [numPages]);

  const handleZoomIn = useCallback(() => {
    setScale((prev) => Math.min(prev + 0.3, 3.0));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale((prev) => Math.max(prev - 0.3, 0.5));
  }, []);

  const handleRotate = useCallback(() => {
    setRotation((prev) => (prev + 90) % 360);
  }, []);

  const handleDownload = useCallback(() => {
    if (!attachment) return;

    const link = document.createElement('a');
    link.href = attachment.fileUrl;
    link.download = attachment.originalName;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [attachment]);

  if (!isOpen || !attachment) return null;

  // SSR safety
  if (typeof document === 'undefined') return null;

  const canGoPrevious = pageNumber > 1;
  const canGoNext = pageNumber < numPages;

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
              {numPages > 0 && ` • Page ${pageNumber} / ${numPages}`}
            </span>
          </div>

          <div className="flex items-center gap-2">
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
        <div className="absolute inset-0 flex items-center justify-center p-4 md:p-8 pt-20 pb-24">
          {hasError ? (
            <div className="flex flex-col items-center gap-4 text-white">
              <AlertTriangle className="w-16 h-16 text-red-400" />
              <p className="text-lg">Impossible de charger le PDF</p>
              <p className="text-sm text-gray-400">{attachment.originalName}</p>
              <Button
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownload();
                }}
                className="mt-4"
              >
                <Download className="w-4 h-4 mr-2" />
                Télécharger quand même
              </Button>
            </div>
          ) : (
            <motion.div
              key={`${pageNumber}-${rotation}`}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
              className="flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
              style={{
                transform: `rotate(${rotation}deg)`,
                maxWidth: '100%',
                maxHeight: '100%'
              }}
            >
              <Document
                file={attachment.fileUrl}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={onDocumentLoadError}
                loading={
                  <div className="flex items-center justify-center py-20">
                    <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
                  </div>
                }
              >
                <Page
                  pageNumber={pageNumber}
                  scale={scale}
                  rotate={rotation}
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                  className="shadow-2xl"
                />
              </Document>
            </motion.div>
          )}
        </div>

        {/* Page navigation - Left */}
        {canGoPrevious && !hasError && (
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              goToPreviousPage();
            }}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 text-white hover:bg-white/10 bg-black/30"
            aria-label="Page précédente"
          >
            <ChevronLeft className="w-8 h-8" />
          </Button>
        )}

        {/* Page navigation - Right */}
        {canGoNext && !hasError && (
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              goToNextPage();
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 text-white hover:bg-white/10 bg-black/30"
            aria-label="Page suivante"
          >
            <ChevronRight className="w-8 h-8" />
          </Button>
        )}

        {/* Bottom toolbar */}
        {!hasError && (
          <div className="absolute bottom-0 left-0 right-0 z-10 flex items-center justify-center p-4 bg-gradient-to-t from-black/50 to-transparent">
            <div className="flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-full px-4 py-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  handleZoomOut();
                }}
                disabled={scale <= 0.5}
                className="text-white hover:bg-white/10 w-8 h-8"
                aria-label="Dézoomer"
              >
                <ZoomOut className="w-4 h-4" />
              </Button>

              <span className="text-white text-sm font-medium min-w-[3rem] text-center">
                {Math.round(scale * 100)}%
              </span>

              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  handleZoomIn();
                }}
                disabled={scale >= 3.0}
                className="text-white hover:bg-white/10 w-8 h-8"
                aria-label="Zoomer"
              >
                <ZoomIn className="w-4 h-4" />
              </Button>

              <div className="w-px h-6 bg-white/20 mx-2" />

              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRotate();
                }}
                className="text-white hover:bg-white/10 w-8 h-8"
                aria-label="Pivoter le PDF"
              >
                <RotateCw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Keyboard instructions */}
        <div className="hidden md:block absolute bottom-20 left-1/2 -translate-x-1/2 text-white/60 text-xs text-center">
          <p>
            Utilisez les flèches ← → pour naviguer • +/- pour zoomer • R pour pivoter • Échap pour fermer
          </p>
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
};
