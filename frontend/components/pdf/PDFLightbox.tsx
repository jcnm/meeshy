'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { X, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { UploadedAttachmentResponse } from '@/shared/types/attachment';

interface PDFLightboxProps {
  attachment: UploadedAttachmentResponse | null;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * PDF Lightbox - Full screen PDF viewer
 */
export const PDFLightbox: React.FC<PDFLightboxProps> = ({
  attachment,
  isOpen,
  onClose
}) => {
  if (!attachment) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-7xl w-full h-[90vh] p-0 gap-0">
        <DialogTitle className="sr-only">{attachment.originalName}</DialogTitle>

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-700 bg-white dark:bg-gray-900">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <h3 className="text-lg font-semibold truncate">{attachment.originalName}</h3>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <a
              href={attachment.fileUrl}
              download={attachment.originalName}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
              title="Télécharger"
            >
              <Download className="w-5 h-5" />
            </a>
            <Button
              onClick={onClose}
              variant="ghost"
              size="sm"
              className="w-8 h-8 p-0"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* PDF Viewer */}
        <div className="flex-1 bg-gray-100 dark:bg-gray-800">
          <iframe
            src={`${attachment.fileUrl}#toolbar=1&navpanes=1`}
            className="w-full h-full border-0"
            title={attachment.originalName}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
