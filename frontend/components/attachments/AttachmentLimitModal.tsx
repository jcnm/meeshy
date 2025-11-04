'use client';

import { AlertTriangle } from 'lucide-react';
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
    <div className="absolute inset-0 z-50 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-2 border-orange-500 dark:border-orange-600 rounded-lg animate-in fade-in duration-200 min-h-[120px]">
      <div className="h-full flex items-stretch min-h-[120px]">
        {/* Contenu défilable à gauche */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400 flex-shrink-0" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              {t('attachmentLimit.title')}
            </h2>
          </div>

          {/* Compteur */}
          <div className="text-center py-3 mb-3">
            <div className="text-3xl font-bold mb-2">
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

          {/* Suggestion */}
          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-3">
            <p className="text-sm text-orange-800 dark:text-orange-200">
              {t('attachmentLimit.suggestion')}
            </p>
          </div>
        </div>

        {/* Bouton fixe à droite */}
        <div className="flex items-center justify-center px-4 border-l border-orange-300 dark:border-orange-700">
          <Button
            onClick={onClose}
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 whitespace-nowrap"
          >
            {tCommon('understood')}
          </Button>
        </div>
      </div>
    </div>
  );
}
