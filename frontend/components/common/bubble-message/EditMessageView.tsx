'use client';

import { memo, useState, useCallback, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { X, Save, AlertTriangle, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getLanguageInfo } from '@shared/types';
import type { Message } from '@shared/types';
import { useI18n } from '@/hooks/useI18n';

interface EditMessageViewProps {
  message: Message & {
    originalLanguage: string;
    translations?: any[];
    originalContent: string;
  };
  isOwnMessage: boolean;
  onSave: (messageId: string, newContent: string) => Promise<void> | void;
  onCancel: () => void;
  isSaving?: boolean;
  saveError?: string;
}

export const EditMessageView = memo(function EditMessageView({
  message,
  isOwnMessage,
  onSave,
  onCancel,
  isSaving = false,
  saveError
}: EditMessageViewProps) {
  const { t } = useI18n('editMessage');
  const [content, setContent] = useState(message.originalContent || message.content);
  const [hasChanges, setHasChanges] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus sur le textarea au mount
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
      // Placer le curseur à la fin
      textareaRef.current.setSelectionRange(content.length, content.length);
    }
  }, []);

  // Détection des changements
  useEffect(() => {
    const originalContent = message.originalContent || message.content;
    setHasChanges(content.trim() !== originalContent.trim());
  }, [content, message.originalContent, message.content]);

  const handleContentChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
  }, []);

  const handleSave = useCallback(async () => {
    if (!hasChanges || !content.trim()) return;
    
    try {
      await onSave(message.id, content.trim());
    } catch (error) {
      // Error handled by parent component
      console.error('Failed to save message:', error);
    }
  }, [hasChanges, content, onSave, message.id]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSave();
    }
  }, [onCancel, handleSave]);

  const originalLanguageInfo = getLanguageInfo(message.originalLanguage || 'fr');
  const hasTranslations = message.translations && message.translations.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: -10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 10 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className={cn(
        "relative w-full max-w-2xl mx-auto rounded-lg border shadow-lg overflow-hidden",
        isOwnMessage 
          ? "bg-gradient-to-br from-blue-400/95 to-blue-500/95 border-blue-400 backdrop-blur-sm" 
          : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
      )}
      onKeyDown={handleKeyDown}
    >
      {/* Header */}
      <div className={cn(
        "flex items-center justify-between px-4 py-3 border-b",
        isOwnMessage 
          ? "border-white/20 bg-white/10" 
          : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50"
      )}>
        <div className="flex items-center gap-2">
          <h3 className={cn(
            "text-sm font-semibold",
            isOwnMessage ? "text-blue-900" : "text-gray-800 dark:text-gray-100"
          )}>
            {t('editMessage')}
          </h3>
          <Badge variant="outline" className={cn(
            "text-xs h-5",
            isOwnMessage 
              ? "border-blue-700 text-blue-900 bg-white/50" 
              : "border-gray-300 text-gray-600 dark:border-gray-600 dark:text-gray-400"
          )}>
            <span className="mr-1">{originalLanguageInfo.flag}</span>
            {originalLanguageInfo.code.toUpperCase()}
          </Badge>
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={isSaving}
          className={cn(
            "h-6 w-6 p-0 rounded-full",
            isOwnMessage 
              ? "text-blue-900 hover:text-blue-950 hover:bg-blue-900/20" 
              : "text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:bg-gray-700"
          )}
          aria-label={t('cancel')}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content Editor */}
      <div className="p-4">
        <div className="space-y-3">
          <div>
            <label className={cn(
              "block text-sm font-medium mb-2",
              isOwnMessage ? "text-blue-900" : "text-gray-700 dark:text-gray-300"
            )}>
              {t('messageContent')}:
            </label>
            <Textarea
              ref={textareaRef}
              value={content}
              onChange={handleContentChange}
              placeholder={t('enterMessageContent')}
              className={cn(
                "min-h-[120px] resize-none text-sm leading-relaxed",
                isOwnMessage 
                  ? "bg-white border-blue-300 text-gray-900 placeholder:text-gray-500 focus:bg-white focus:border-blue-500" 
                  : "bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600"
              )}
              disabled={isSaving}
            />
          </div>

          {/* Translation Warning */}
          {hasTranslations && (
            <div className={cn(
              "flex items-start gap-2 p-3 rounded-md border",
              isOwnMessage 
                ? "bg-white/10 border-white/20" 
                : "bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800"
            )}>
              <AlertTriangle className={cn(
                "h-4 w-4 mt-0.5 flex-shrink-0",
                isOwnMessage ? "text-amber-700" : "text-amber-600 dark:text-amber-400"
              )} />
              <div>
                <p className={cn(
                  "text-xs font-medium mb-1",
                  isOwnMessage ? "text-amber-900" : "text-amber-800 dark:text-amber-200"
                )}>
                  {t('translationWarning')}
                </p>
                <p className={cn(
                  "text-xs",
                  isOwnMessage ? "text-amber-800" : "text-amber-700 dark:text-amber-300"
                )}>
                  {t('translationWillBeRegenerated')}
                </p>
              </div>
            </div>
          )}

          {/* Save Error */}
          {saveError && (
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
                {saveError}
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
            disabled={isSaving}
            className={cn(
              "h-8 px-3 text-xs",
              isOwnMessage 
                ? "border-blue-700 bg-white text-blue-900 hover:bg-blue-50" 
                : "border-gray-300 text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700"
            )}
          >
            {t('cancel')}
          </Button>
          
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!hasChanges || !content.trim() || isSaving}
            className={cn(
              "h-8 px-3 text-xs",
              isOwnMessage 
                ? "bg-blue-700 hover:bg-blue-800 text-white border-blue-800" 
                : "bg-blue-600 hover:bg-blue-700 text-white"
            )}
          >
            {isSaving ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="mr-1"
                >
                  <Save className="h-3 w-3" />
                </motion.div>
                {t('saving')}...
              </>
            ) : (
              <>
                <Save className="h-3 w-3 mr-1" />
                {t('save')}
              </>
            )}
          </Button>
        </div>
      </div>
    </motion.div>
  );
});