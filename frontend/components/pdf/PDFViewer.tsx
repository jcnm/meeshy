'use client';

import React, { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import {
  Download,
  AlertTriangle,
  Maximize,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { UploadedAttachmentResponse } from '@/shared/types/attachment';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

// Import react-pdf styles
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

interface PDFViewerProps {
  attachment: UploadedAttachmentResponse;
  className?: string;
  onOpenLightbox?: () => void;
}

/**
 * Lecteur PDF MODERNE avec react-pdf
 * - Navigation par pages
 * - Zoom controls
 * - Rotation
 * - Sélection de texte
 * - Gestion d'erreurs
 */
export const PDFViewer: React.FC<PDFViewerProps> = ({
  attachment,
  className = '',
  onOpenLightbox
}) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [rotation, setRotation] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setIsLoading(false);
    setHasError(false);
  };

  const onDocumentLoadError = (error: Error) => {
    console.error('Error loading PDF:', error);
    setHasError(true);
    setErrorMessage('Impossible de charger le PDF');
    setIsLoading(false);
  };

  const goToPrevPage = () => {
    setPageNumber((prev) => Math.max(prev - 1, 1));
  };

  const goToNextPage = () => {
    setPageNumber((prev) => Math.min(prev + 1, numPages || 1));
  };

  const zoomIn = () => {
    setScale((prev) => Math.min(prev + 0.25, 3.0));
  };

  const zoomOut = () => {
    setScale((prev) => Math.max(prev - 0.25, 0.5));
  };

  const rotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  return (
    <div
      className={`flex flex-col gap-2 p-3 bg-gradient-to-br from-red-50 to-orange-50 dark:from-gray-800 dark:to-gray-900 rounded-lg border ${
        hasError
          ? 'border-red-300 dark:border-red-700'
          : 'border-red-200 dark:border-gray-700'
      } shadow-md hover:shadow-lg transition-all duration-200 w-full sm:max-w-2xl ${className}`}
    >
      {/* Document info header */}
      <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-300">
        <span className="font-medium truncate flex-1">{attachment.originalName}</span>
        {numPages && (
          <span className="ml-2 text-gray-500 dark:text-gray-400">
            {numPages} page{numPages > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* PDF Document */}
      <div className="relative w-full bg-gray-100 dark:bg-gray-900 rounded-lg overflow-hidden">
        <div className="max-h-[500px] overflow-auto flex justify-center items-start p-4">
          {hasError ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-gray-600 dark:text-gray-400">
              <AlertTriangle className="w-12 h-12 text-red-500" />
              <span className="text-sm">{errorMessage}</span>
              <Button
                onClick={() => window.open(attachment.fileUrl, '_blank')}
                size="sm"
                className="mt-2 bg-red-600 hover:bg-red-700 text-white"
              >
                Ouvrir dans un nouvel onglet
              </Button>
            </div>
          ) : (
            <Document
              file={attachment.fileUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              loading={
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
                </div>
              }
              error={
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-gray-600 dark:text-gray-400">
                  <AlertTriangle className="w-12 h-12 text-red-500" />
                  <span className="text-sm">Erreur de chargement</span>
                </div>
              }
              className="pdf-document"
            >
              <Page
                pageNumber={pageNumber}
                scale={scale}
                rotate={rotation}
                renderTextLayer={true}
                renderAnnotationLayer={true}
                className="pdf-page shadow-lg"
              />
            </Document>
          )}
        </div>
      </div>

      {/* Controls */}
      {!hasError && numPages && (
        <div className="flex flex-col gap-2">
          {/* Page navigation */}
          <div className="flex items-center justify-center gap-2">
            <Button
              onClick={goToPrevPage}
              disabled={pageNumber <= 1}
              size="sm"
              variant="outline"
              className="h-8 px-2"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>

            <div className="flex items-center gap-2 min-w-[100px] justify-center">
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
                className="w-12 text-center text-sm border border-gray-300 dark:border-gray-600 rounded px-1 py-0.5 bg-white dark:bg-gray-800"
              />
              <span className="text-xs text-gray-500 dark:text-gray-400">
                / {numPages}
              </span>
            </div>

            <Button
              onClick={goToNextPage}
              disabled={pageNumber >= numPages}
              size="sm"
              variant="outline"
              className="h-8 px-2"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {/* Zoom and rotation controls */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <Button
                onClick={zoomOut}
                disabled={scale <= 0.5}
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0"
                title="Zoom arrière"
              >
                <ZoomOut className="w-4 h-4" />
              </Button>

              <span className="text-xs text-gray-600 dark:text-gray-300 min-w-[50px] text-center">
                {Math.round(scale * 100)}%
              </span>

              <Button
                onClick={zoomIn}
                disabled={scale >= 3.0}
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0"
                title="Zoom avant"
              >
                <ZoomIn className="w-4 h-4" />
              </Button>

              <Button
                onClick={rotate}
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 ml-1"
                title="Rotation 90°"
              >
                <RotateCw className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex items-center gap-2">
              {/* Fullscreen/Lightbox button */}
              {onOpenLightbox && (
                <Button
                  onClick={onOpenLightbox}
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0"
                  title="Ouvrir en plein écran"
                >
                  <Maximize className="w-4 h-4" />
                </Button>
              )}

              {/* Download button */}
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
      )}
    </div>
  );
};
