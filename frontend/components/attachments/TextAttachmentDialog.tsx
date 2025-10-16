/**
 * Dialog pour confirmer la création d'un attachment à partir de texte collé
 */

'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { FileText } from 'lucide-react';
import { useI18n } from '../../hooks/useI18n';

interface TextAttachmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  text: string;
  onCreateAttachment: () => void;
  onKeepInline: () => void;
}

export function TextAttachmentDialog({
  open,
  onOpenChange,
  text,
  onCreateAttachment,
  onKeepInline,
}: TextAttachmentDialogProps) {
  const { t } = useI18n('attachments');

  const handleCreate = () => {
    onCreateAttachment();
    onOpenChange(false);
  };

  const handleKeep = () => {
    onKeepInline();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <DialogTitle>{t('textDetection.title')}</DialogTitle>
              <DialogDescription>
                {t('textDetection.message', { length: text.length })}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="my-4">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 max-h-40 overflow-y-auto">
            <pre className="text-sm text-gray-700 whitespace-pre-wrap break-words font-mono">
              {text.substring(0, 200)}
              {text.length > 200 && '...'}
            </pre>
          </div>
          <div className="text-xs text-gray-500 mt-2">
            Aperçu des premiers 200 caractères
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleKeep}
          >
            {t('textDetection.keepInline')}
          </Button>
          <Button
            onClick={handleCreate}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <FileText className="w-4 h-4 mr-2" />
            {t('textDetection.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

