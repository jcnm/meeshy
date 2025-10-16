/**
 * Galerie modale pour visualiser les images et autres attachments
 */

'use client';

import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Download, MessageSquare } from 'lucide-react';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogTitle } from '../ui/dialog';
import { Attachment } from '../../shared/types/attachment';
import { AttachmentService } from '../../services/attachmentService';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { useI18n } from '@/hooks/useI18n';

interface AttachmentGalleryProps {
  conversationId: string;
  initialAttachmentId?: string;
  open: boolean;
  onClose: () => void;
  onNavigateToMessage?: (messageId: string) => void;
  token?: string;
  // Nouvelle prop pour passer les attachments directement (évite un appel API)
  attachments?: Attachment[];
}

export function AttachmentGallery({
  conversationId,
  initialAttachmentId,
  open,
  onClose,
  onNavigateToMessage,
  token,
  attachments: providedAttachments,
}: AttachmentGalleryProps) {
  const { t } = useI18n('attachments');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  // Charger les attachments de la conversation
  useEffect(() => {
    if (!open || !conversationId) return;

    const loadAttachments = async () => {
      setLoading(true);
      try {
        // Si des attachments sont fournis en props, les utiliser directement
        if (providedAttachments && providedAttachments.length > 0) {
          console.log('[AttachmentGallery] Utilisation des attachments fournis:', {
            count: providedAttachments.length
          });
          setAttachments(providedAttachments);

          // Si un attachment initial est spécifié, trouver son index
          if (initialAttachmentId) {
            const index = providedAttachments.findIndex(
              (att) => att.id === initialAttachmentId
            );
            if (index !== -1) {
              setCurrentIndex(index);
            }
          }
        } else {
          // Sinon, charger via l'API (mode legacy)
          console.log('[AttachmentGallery] Chargement via API...');
          const response = await AttachmentService.getConversationAttachments(
            conversationId,
            { type: 'image', limit: 100 },
            token
          );

          if (response.success && response.attachments) {
            setAttachments(response.attachments);

            // Si un attachment initial est spécifié, trouver son index
            if (initialAttachmentId) {
              const index = response.attachments.findIndex(
                (att) => att.id === initialAttachmentId
              );
              if (index !== -1) {
                setCurrentIndex(index);
              }
            }
          }
        }
      } catch (error) {
        console.error('Erreur chargement attachments:', error);
      } finally {
        setLoading(false);
      }
    };

    loadAttachments();
  }, [open, conversationId, initialAttachmentId, token, providedAttachments]);

  const currentAttachment = attachments[currentIndex];

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : attachments.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < attachments.length - 1 ? prev + 1 : 0));
  };

  const handleDownload = () => {
    if (currentAttachment) {
      window.open(currentAttachment.fileUrl, '_blank');
    }
  };

  const handleGoToMessage = () => {
    if (currentAttachment && onNavigateToMessage) {
      onNavigateToMessage(currentAttachment.messageId);
      onClose();
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl h-[90vh] p-0 bg-black/95 dark:bg-black border-none" showCloseButton={false}>
        <DialogTitle className="sr-only">
          {t('gallery.titleWithCounter', { current: currentIndex + 1, total: attachments.length })}
        </DialogTitle>
        <div className="relative w-full h-full flex flex-col">
          {/* Header */}
          <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-transparent p-4">
            <div className="flex items-center justify-between">
              <div className="text-white">
                <div className="text-sm font-medium">
                  {currentIndex + 1} / {attachments.length}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDownload}
                  className="text-white hover:bg-white/10"
                  title={t('gallery.download')}
                >
                  <Download className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="text-white hover:bg-white/10"
                  title={t('gallery.close')}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Image principale */}
          <div className="flex-1 flex items-center justify-center p-4">
            {loading ? (
              <div className="text-white">{t('gallery.loading')}</div>
            ) : currentAttachment ? (
              <img
                src={currentAttachment.fileUrl}
                alt={currentAttachment.originalName}
                className="max-w-full max-h-full object-contain"
              />
            ) : (
              <div className="text-white">{t('gallery.noImage')}</div>
            )}
          </div>

          {/* Navigation */}
          {attachments.length > 1 && (
            <>
              <button
                onClick={handlePrevious}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-colors"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                onClick={handleNext}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-colors"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}

          {/* Footer avec info */}
          {currentAttachment && (
            <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/80 to-transparent p-4">
              <div className="flex items-center justify-between text-white">
                <div className="flex items-center gap-3">
                  <div className="text-sm">
                    <div className="font-medium">{currentAttachment.originalName}</div>
                    <div className="text-xs text-gray-300">
                      {formatDate(currentAttachment.createdAt)}
                      {currentAttachment.width && currentAttachment.height && (
                        <> • {currentAttachment.width}x{currentAttachment.height}</>
                      )}
                    </div>
                  </div>
                </div>

                {onNavigateToMessage && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleGoToMessage}
                    className="text-white hover:bg-white/10"
                  >
                    <MessageSquare className="w-4 h-4 mr-2" />
                    {t('gallery.goToMessage')}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

