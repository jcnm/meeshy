'use client';

import { X, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/hooks/useI18n';

interface AttachmentLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCount: number;
  maxCount: number;
  remainingSlots: number;
}

export function AttachmentLimitModal({
  isOpen,
  onClose,
  currentCount,
  maxCount,
  remainingSlots,
}: AttachmentLimitModalProps) {
  const { t } = useI18n('conversations');
  const { t: tCommon } = useI18n('common');

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9998] animate-in fade-in duration-200 flex items-center justify-center"
        onClick={onClose}
      >
        {/* Modal - Version compacte */}
        <div
          className="relative z-[9999] w-full max-w-sm animate-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 p-4 m-4">
          {/* Header compact */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                {t('attachmentLimit.title')}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Content compact */}
          <div className="space-y-3">
            <div className="text-center py-2">
              <div className="text-2xl font-bold mb-1">
                <span className={currentCount >= maxCount ? 'text-red-600 dark:text-red-400' : 'text-orange-600 dark:text-orange-400'}>
                  {currentCount}
                </span>
                <span className="text-gray-400 dark:text-gray-500"> / {maxCount}</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {remainingSlots > 0
                  ? t('attachmentLimit.partialMessage', { current: currentCount, max: maxCount, remaining: remainingSlots })
                  : t('attachmentLimit.fullMessage', { max: maxCount })
                }
              </p>
            </div>

            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded p-3">
              <p className="text-xs text-orange-800 dark:text-orange-200 text-center">
                {t('attachmentLimit.suggestion')}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-4 flex justify-center">
            <Button
              onClick={onClose}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white px-6"
            >
              {tCommon('understood')}
            </Button>
          </div>
          </div>
        </div>
      </div>
    </>
  );
}
