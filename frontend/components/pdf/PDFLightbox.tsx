'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Download,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  Minimize2,
  FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Attachment } from '@/shared/types/attachment';
import { formatFileSize } from '@/shared/types/attachment';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

// Import react-pdf styles
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

interface PDFLightboxProps {
  pdfs: Attachment[];
  initialIndex?: number;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Lightbox plein écran pour PDFs avec navigation
 * - Navigation multi-PDFs
 * - Zoom et rotation
 * - Pagination
 * - Keyboard shortcuts
 * - Responsive
 */
export const PDFLightbox: React.FC<PDFLightboxProps> = ({
  pdfs,
  initialIndex = 0,
  isOpen,
  onClose
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [rotation, setRotation] = useState(0);
  const [fitToWidth, setFitToWidth] = useState(false);

  const currentPdf = pdfs[currentIndex];

  // Reset page when PDF changes
  useEffect(() => {
    if (isOpen) {
      setPageNumber(1);
      setScale(1.2);
      setRotation(0);
      setNumPages(null);
    }
  }, [currentIndex, isOpen]);

  // Reset index when opening
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
    }
  }, [isOpen, initialIndex]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  const goToPrevPdf = useCallback(() => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : pdfs.length - 1));
  }, [pdfs.length]);

  const goToNextPdf = useCallback(() => {
    setCurrentIndex((prev) => (prev < pdfs.length - 1 ? prev + 1 : 0));
  }, [pdfs.length]);

  const goToPrevPage = () => {
    setPageNumber((prev) => Math.max(prev - 1, 1));
  };

  const goToNextPage = () => {
    setPageNumber((prev) => Math.min(prev + 1, numPages || 1));
  };

  const zoomIn = () => {
    setScale((prev) => Math.min(prev + 0.25, 3.0));
    setFitToWidth(false);
  };

  const zoomOut = () => {
    setScale((prev) => Math.max(prev - 0.25, 0.5));
    setFitToWidth(false);
  };

  const rotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const toggleFitToWidth = () => {
    setFitToWidth((prev) => !prev);
    if (!fitToWidth) {
      setScale(1.0);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          if (e.shiftKey) {
            goToPrevPdf();
          } else {
            goToPrevPage();
          }
          break;
        case 'ArrowRight':
          if (e.shiftKey) {
            goToNextPdf();
          } else {
            goToNextPage();
          }
          break;
        case 'ArrowUp':
          goToPrevPage();
          break;
        case 'ArrowDown':
          goToNextPage();
          break;
        case '+':
        case '=':
          e.preventDefault();
          zoomIn();
          break;
        case '-':
        case '_':
          e.preventDefault();
          zoomOut();
          break;
        case 'r':
        case 'R':
          rotate();
          break;
        case 'f':
        case 'F':
          toggleFitToWidth();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, goToPrevPdf, goToNextPdf, numPages]);

  if (!isOpen || !currentPdf) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] bg-black/95 flex flex-col"
        onClick={onClose}
      >
        {/* Top toolbar */}
        <div
          className="flex items-center justify-between px-4 py-3 bg-black/50 backdrop-blur-sm"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <FileText className="w-5 h-5 text-white flex-shrink-0" />
            <div className="flex flex-col min-w-0">
              <h3 className="text-white font-medium text-sm truncate">
                {currentPdf.originalName}
              </h3>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span>{formatFileSize(currentPdf.fileSize)}</span>
                {numPages && (
                  <>
                    <span>•</span>
                    <span>
                      {numPages} page{numPages > 1 ? 's' : ''}
                    </span>
                  </>
                )}
                {pdfs.length > 1 && (
                  <>
                    <span>•</span>
                    <span>
                      PDF {currentIndex + 1}/{pdfs.length}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Download */}
            <a
              href={currentPdf.fileUrl}
              download={currentPdf.originalName}
              onClick={(e) => e.stopPropagation()}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <Download className="w-5 h-5 text-white" />
            </a>

            {/* Close */}
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* PDF display area */}
        <div
          className="flex-1 flex items-center justify-center overflow-auto p-4"
          onClick={(e) => e.stopPropagation()}
        >
          <Document
            file={currentPdf.fileUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={
              <div className="flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin" />
              </div>
            }
            error={
              <div className="flex flex-col items-center gap-2 text-white">
                <FileText className="w-16 h-16 opacity-50" />
                <span>Erreur de chargement</span>
              </div>
            }
            className="pdf-document-lightbox"
          >
            <Page
              pageNumber={pageNumber}
              scale={scale}
              rotate={rotation}
              renderTextLayer={true}
              renderAnnotationLayer={true}
              className="pdf-page-lightbox shadow-2xl"
              width={fitToWidth ? window.innerWidth - 100 : undefined}
            />
          </Document>
        </div>

        {/* Bottom controls */}
        <div
          className="flex flex-col gap-2 px-4 py-3 bg-black/50 backdrop-blur-sm"
          onClick={(e) => e.stopPropagation()}
        >
          {/* PDF navigation (if multiple PDFs) */}
          {pdfs.length > 1 && (
            <div className="flex items-center justify-center gap-2 pb-2 border-b border-white/10">
              <Button
                onClick={goToPrevPdf}
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/10"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                PDF précédent
              </Button>

              <span className="text-white text-sm px-4">
                {currentIndex + 1} / {pdfs.length}
              </span>

              <Button
                onClick={goToNextPdf}
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/10"
              >
                PDF suivant
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          )}

          {/* Main controls */}
          <div className="flex items-center justify-between gap-4">
            {/* Page navigation */}
            {numPages && (
              <div className="flex items-center gap-2">
                <Button
                  onClick={goToPrevPage}
                  disabled={pageNumber <= 1}
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-white/10 h-9 px-2"
                >
                  <ChevronLeft className="w-5 h-5" />
                </Button>

                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={numPages}
                    value={pageNumber}
                    onChange={(e) => {
                      const page = parseInt(e.target.value);
                      if (page >= 1 && page <= numPages) {
                        setPageNumber(page);
                      }
                    }}
                    className="w-14 text-center text-sm border border-white/20 rounded px-2 py-1 bg-white/10 text-white"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span className="text-white text-sm">/ {numPages}</span>
                </div>

                <Button
                  onClick={goToNextPage}
                  disabled={pageNumber >= numPages}
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-white/10 h-9 px-2"
                >
                  <ChevronRight className="w-5 h-5" />
                </Button>
              </div>
            )}

            {/* Zoom and rotation controls */}
            <div className="flex items-center gap-2">
              <Button
                onClick={zoomOut}
                disabled={scale <= 0.5}
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/10 h-9 w-9 p-0"
                title="Zoom arrière (-)"
              >
                <ZoomOut className="w-5 h-5" />
              </Button>

              <span className="text-white text-sm min-w-[60px] text-center">
                {Math.round(scale * 100)}%
              </span>

              <Button
                onClick={zoomIn}
                disabled={scale >= 3.0}
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/10 h-9 w-9 p-0"
                title="Zoom avant (+)"
              >
                <ZoomIn className="w-5 h-5" />
              </Button>

              <Button
                onClick={rotate}
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/10 h-9 w-9 p-0 ml-2"
                title="Rotation 90° (R)"
              >
                <RotateCw className="w-5 h-5" />
              </Button>

              <Button
                onClick={toggleFitToWidth}
                variant="ghost"
                size="sm"
                className={`text-white hover:bg-white/10 h-9 w-9 p-0 ${
                  fitToWidth ? 'bg-white/20' : ''
                }`}
                title="Ajuster à la largeur (F)"
              >
                {fitToWidth ? (
                  <Minimize2 className="w-5 h-5" />
                ) : (
                  <Maximize2 className="w-5 h-5" />
                )}
              </Button>
            </div>
          </div>

          {/* Keyboard shortcuts hint */}
          <div className="text-center text-xs text-gray-400 pt-2 border-t border-white/10">
            <span className="hidden sm:inline">
              Raccourcis: ← → (pages) • Shift+← → (PDFs) • +/- (zoom) • R
              (rotation) • F (ajuster) • Esc (fermer)
            </span>
            <span className="sm:hidden">Appuyez sur Esc pour fermer</span>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
