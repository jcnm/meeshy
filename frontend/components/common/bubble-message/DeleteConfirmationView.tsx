'use client';

import { memo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { X, Trash2, AlertTriangle, FileText, Heart, Paperclip } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Message } from '@shared/types';
import type { BubbleMessage } from './types';
import { useI18n } from '@/hooks/useI18n';

interface DeleteConfirmationViewProps {
  message: BubbleMessage;
  isOwnMessage: boolean;
  onConfirm: (messageId: string) => Promise<void> | void;
  onCancel: () => void;
  isDeleting?: boolean;
  deleteError?: string;
}

export const DeleteConfirmationView = memo(function DeleteConfirmationView({
  message,
  isOwnMessage,
  onConfirm,
  onCancel,
  isDeleting = false,
  deleteError
}: DeleteConfirmationViewProps) {
  const { t } = useI18n('deleteMessage');

  const handleConfirm = useCallback(async () => {
    try {
      await onConfirm(message.id);
    } catch (error) {
      // Error handled by parent component
      console.error('Failed to delete message:', error);
    }
  }, [onConfirm, message.id]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    } else if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      handleConfirm();
    }
  }, [onCancel, handleConfirm]);

  // Calculer les éléments qui seront supprimés
  const translationCount = message.translations?.length || 0;
  const attachmentCount = message.attachments?.length || 0;
  const reactionCount = message.reactions?.length || 0;

  // Tronquer le contenu pour l'aperçu
  const previewContent = message.content.length > 100 
    ? `${message.content.substring(0, 100)}...`
    : message.content;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: -10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 10 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className={cn(
        "relative w-full max-w-md mx-auto rounded-lg border shadow-lg overflow-hidden",
        isOwnMessage 
          ? "bg-gradient-to-br from-red-400/95 to-red-500/95 border-red-400 backdrop-blur-sm" 
          : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
      )}
      onKeyDown={handleKeyDown}
    >
      {/* Header */}
      <div className={cn(
        "flex items-center justify-between px-4 py-3 border-b",
        isOwnMessage 
          ? "border-white/20 bg-white/10" 
          : "border-gray-200 dark:border-gray-700 bg-red-50 dark:bg-red-900/20"
      )}>
        <div className="flex items-center gap-2">
          <AlertTriangle className={cn(
            "h-4 w-4",
            isOwnMessage ? "text-red-900" : "text-red-600 dark:text-red-400"
          )} />
          <h3 className={cn(
            "text-sm font-semibold",
            isOwnMessage ? "text-red-900" : "text-red-800 dark:text-red-200"
          )}>
            {t('deleteMessage')}?
          </h3>
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={isDeleting}
          className={cn(
            "h-6 w-6 p-0 rounded-full",
            isOwnMessage 
              ? "text-red-900 hover:text-red-950 hover:bg-red-900/20" 
              : "text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:bg-gray-700"
          )}
          aria-label={t('cancel')}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Message Preview */}
      <div className="p-4">
        <div className="space-y-4">
          {/* Message Content Preview */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <FileText className={cn(
                "h-4 w-4",
                isOwnMessage ? "text-red-800" : "text-gray-600 dark:text-gray-400"
              )} />
              <span className={cn(
                "text-xs font-medium",
                isOwnMessage ? "text-red-900" : "text-gray-700 dark:text-gray-300"
              )}>
                {t('messagePreview')}:
              </span>
            </div>
            <div className={cn(
              "p-3 rounded-md border",
              isOwnMessage 
                ? "bg-white/50 border-red-700" 
                : "bg-gray-50 border-gray-200 dark:bg-gray-900/50 dark:border-gray-700"
            )}>
              <p className={cn(
                "text-sm leading-relaxed",
                isOwnMessage ? "text-gray-900" : "text-gray-700 dark:text-gray-300"
              )}>
                "{previewContent}"
              </p>
              
              {/* Additional Content Summary */}
              <div className="flex items-center gap-3 mt-2 pt-2 border-t border-current/10">
                {attachmentCount > 0 && (
                  <div className="flex items-center gap-1">
                    <Paperclip className="h-3 w-3" />
                    <span className="text-xs">{attachmentCount} {t('attachments')}</span>
                  </div>
                )}
                {reactionCount > 0 && (
                  <div className="flex items-center gap-1">
                    <Heart className="h-3 w-3" />
                    <span className="text-xs">{reactionCount} {t('reactions')}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Warning */}
          <div className={cn(
            "flex items-start gap-2 p-3 rounded-md border",
            isOwnMessage 
              ? "bg-white/50 border-red-700" 
              : "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800"
          )}>
            <AlertTriangle className={cn(
              "h-4 w-4 mt-0.5 flex-shrink-0",
              isOwnMessage ? "text-red-700" : "text-red-600 dark:text-red-400"
            )} />
            <div>
              <p className={cn(
                "text-xs font-medium mb-1",
                isOwnMessage ? "text-red-900" : "text-red-800 dark:text-red-200"
              )}>
                {t('irreversibleAction')}!
              </p>
              <p className={cn(
                "text-xs",
                isOwnMessage ? "text-red-800" : "text-red-700 dark:text-red-300"
              )}>
                {t('deleteMessageWarning')}
              </p>
            </div>
          </div>

          {/* Items to Delete */}
          <div>
            <p className={cn(
              "text-xs font-medium mb-2",
              isOwnMessage ? "text-red-900" : "text-gray-700 dark:text-gray-300"
            )}>
              {t('itemsToDelete')}:
            </p>
            <ul className={cn(
              "space-y-1 text-xs",
              isOwnMessage ? "text-red-800" : "text-gray-600 dark:text-gray-400"
            )}>
              <li className="flex items-center gap-2">
                <div className="w-1 h-1 rounded-full bg-current" />
                {t('messageAndContent')}
              </li>
              {translationCount > 0 && (
                <li className="flex items-center gap-2">
                  <div className="w-1 h-1 rounded-full bg-current" />
                  {t('allTranslations')} ({translationCount})
                </li>
              )}
              {attachmentCount > 0 && (
                <li className="flex items-center gap-2">
                  <div className="w-1 h-1 rounded-full bg-current" />
                  {t('allAttachments')} ({attachmentCount})
                </li>
              )}
              {reactionCount > 0 && (
                <li className="flex items-center gap-2">
                  <div className="w-1 h-1 rounded-full bg-current" />
                  {t('allReactions')} ({reactionCount})
                </li>
              )}
            </ul>
          </div>

          {/* Delete Error */}
          {deleteError && (
            <div className={cn(
              "flex items-start gap-2 p-3 rounded-md border",
              isOwnMessage 
                ? "bg-red-900/30 border-red-700" 
                : "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800"
            )}>
              <AlertTriangle className={cn(
                "h-4 w-4 mt-0.5 flex-shrink-0",
                isOwnMessage ? "text-red-200" : "text-red-600 dark:text-red-400"
              )} />
              <p className={cn(
                "text-xs",
                isOwnMessage ? "text-red-200" : "text-red-700 dark:text-red-300"
              )}>
                {deleteError}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Footer Actions */}
      <div className={cn(
        "flex items-center justify-between px-4 py-3 border-t",
        isOwnMessage 
          ? "border-white/20 bg-white/5" 
          : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50"
      )}>
        <div className="flex items-center gap-2">
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={isDeleting}
            className={cn(
              "h-8 px-3 text-xs",
              isOwnMessage 
                ? "border-red-700 bg-white text-red-900 hover:bg-red-50" 
                : "border-gray-300 text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700"
            )}
          >
            {t('cancel')}
          </Button>
          
          <Button
            size="sm"
            onClick={handleConfirm}
            disabled={isDeleting}
            className={cn(
              "h-8 px-3 text-xs",
              isOwnMessage 
                ? "bg-red-700 hover:bg-red-800 text-white border-red-800" 
                : "bg-red-600 hover:bg-red-700 text-white"
            )}
          >
            {isDeleting ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="mr-1"
                >
                  <Trash2 className="h-3 w-3" />
                </motion.div>
                {t('deleting')}...
              </>
            ) : (
              <>
                <Trash2 className="h-3 w-3 mr-1" />
                {t('deleteForever')}
              </>
            )}
          </Button>
        </div>
      </div>
    </motion.div>
  );
});