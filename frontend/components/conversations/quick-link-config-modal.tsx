'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Link2,
  Shield,
  CheckCircle,
  Info
} from 'lucide-react';
import { useI18n } from '@/hooks/useI18n';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface QuickLinkConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (config: QuickLinkConfig) => void;
  defaultTitle?: string;
  isCreating?: boolean;
}

export interface QuickLinkConfig {
  title: string;
  description: string;
}

export function QuickLinkConfigModal({
  isOpen,
  onClose,
  onConfirm,
  defaultTitle,
  isCreating = false
}: QuickLinkConfigModalProps) {
  const { t } = useI18n('modals');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  // Initialiser le titre quand la modale s'ouvre
  useEffect(() => {
    if (isOpen && defaultTitle) {
      setTitle(defaultTitle);
    }
  }, [isOpen, defaultTitle]);

  const handleConfirm = () => {
    onConfirm({
      title: title.trim() || defaultTitle || 'Lien de partage',
      description: description.trim()
    });
  };

  const handleClose = () => {
    setTitle('');
    setDescription('');
    onClose();
  };

  const canConfirm = title.trim().length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md w-[95vw]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            {t('quickLinkModal.title')}
          </DialogTitle>
          <DialogDescription>
            {t('quickLinkModal.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Configuration sécurisée par défaut */}
          <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border-2 border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                    {t('quickLinkModal.secureConfig.title')}
                  </h4>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-blue-600 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-sm">{t('quickLinkModal.secureConfig.tooltip')}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  {t('quickLinkModal.secureConfig.description')}
                </p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    {t('quickLinkModal.secureConfig.accountRequired')}
                  </Badge>
                  <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    {t('quickLinkModal.secureConfig.emailRequired')}
                  </Badge>
                  <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    {t('quickLinkModal.secureConfig.birthdayRequired')}
                  </Badge>
                  <Badge variant="secondary" className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    {t('quickLinkModal.secureConfig.allPermissions')}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          {/* Titre du lien */}
          <div className="space-y-2">
            <Label htmlFor="linkTitle">
              {t('quickLinkModal.linkTitle.label')} <span className="text-red-500">*</span>
            </Label>
            <Input
              id="linkTitle"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('quickLinkModal.linkTitle.placeholder')}
              className="text-base"
            />
            <p className="text-xs text-muted-foreground">
              {t('quickLinkModal.linkTitle.hint')}
            </p>
          </div>

          {/* Message de bienvenue */}
          <div className="space-y-2">
            <Label htmlFor="welcomeMessage">
              {t('quickLinkModal.welcomeMessage.label')}
            </Label>
            <Textarea
              id="welcomeMessage"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('quickLinkModal.welcomeMessage.placeholder')}
              className="min-h-[100px] resize-none"
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">
              {t('quickLinkModal.welcomeMessage.hint')}
            </p>
          </div>

          {/* Note sur la durée */}
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground">
              ℹ️ {t('quickLinkModal.expirationNote')}
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isCreating}
            className="w-full sm:w-auto"
          >
            {t('quickLinkModal.actions.cancel')}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!canConfirm || isCreating}
            className="w-full sm:w-auto"
          >
            {isCreating ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                {t('quickLinkModal.actions.creating')}
              </>
            ) : (
              <>
                <Link2 className="h-4 w-4 mr-2" />
                {t('quickLinkModal.actions.create')}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
