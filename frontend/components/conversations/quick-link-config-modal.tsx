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
  Info,
  ChevronRight,
  ChevronLeft,
  Calendar,
  Check,
  X,
  MessageSquare,
  FileText,
  Image as ImageIcon,
  Video,
  Volume2,
  File,
  Link as LinkIcon,
  MapPin,
  Phone,
  User,
  Mail,
  Users
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

// Configuration par défaut pour les liens rapides
const DEFAULT_LINK_CONFIG = {
  expirationDays: 7,
  requireAccount: true,
  requireNickname: true,
  requireEmail: true,
  requireBirthday: true,
  allowAnonymousMessages: true,
  allowAnonymousFiles: true,
  allowAnonymousImages: true,
  allowViewHistory: true,
  allowedLanguages: [] // Toutes les langues
};

export function QuickLinkConfigModal({
  isOpen,
  onClose,
  onConfirm,
  defaultTitle,
  isCreating = false
}: QuickLinkConfigModalProps) {
  const { t } = useI18n('modals');
  const [currentStep, setCurrentStep] = useState(1);
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
    setCurrentStep(1);
    onClose();
  };

  const canProceedToStep2 = title.trim().length > 0;

  const nextStep = () => {
    if (currentStep === 1 && canProceedToStep2) {
      setCurrentStep(2);
    }
  };

  const prevStep = () => {
    if (currentStep === 2) {
      setCurrentStep(1);
    }
  };

  const formatExpirationDate = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg w-[90vw] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            {t('quickLinkModal.title')}
          </DialogTitle>
          <DialogDescription>
            {currentStep === 1
              ? t('quickLinkModal.description')
              : t('linkSummaryModal.description')
            }
          </DialogDescription>
        </DialogHeader>

        {/* Indicateur d'étapes */}
        <div className="flex items-center justify-center gap-2 py-1">
          <div className={`flex items-center gap-2 ${currentStep === 1 ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              currentStep === 1 ? 'bg-primary text-primary-foreground' : 'bg-muted'
            }`}>
              1
            </div>
            <span className="text-sm font-medium hidden sm:inline">{t('quickLinkModal.steps.config')}</span>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <div className={`flex items-center gap-2 ${currentStep === 2 ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              currentStep === 2 ? 'bg-primary text-primary-foreground' : 'bg-muted'
            }`}>
              2
            </div>
            <span className="text-sm font-medium hidden sm:inline">{t('quickLinkModal.steps.summary')}</span>
          </div>
        </div>

        {/* ÉTAPE 1 : Configuration */}
        {currentStep === 1 && (
          <div className="space-y-2 py-2">
            {/* Configuration sécurisée par défaut */}
            <div className="p-2 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-start gap-2">
                <Shield className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-1">
                    <h4 className="text-xs font-semibold text-blue-900 dark:text-blue-100">
                      {t('quickLinkModal.secureConfig.title')}
                    </h4>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 text-blue-600 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs text-xs">
                          <p>{t('quickLinkModal.secureConfig.tooltip')}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <p className="text-[11px] text-blue-700 dark:text-blue-300">
                    {t('quickLinkModal.secureConfig.description')}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-1">
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
                className="min-h-[60px] resize-none"
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground">
                {t('quickLinkModal.welcomeMessage.hint')}
              </p>
            </div>

            {/* Note sur la durée */}
            <div className="p-2 bg-muted/50 rounded-lg text-xs">
              <p className="text-xs text-muted-foreground">
                ℹ️ {t('quickLinkModal.expirationNote')}
              </p>
            </div>
          </div>
        )}

        {/* ÉTAPE 2 : Résumé */}
        {currentStep === 2 && (
          <div className="space-y-2 py-2">
            {/* Informations du lien */}
            <div className="space-y-2">
              <div className="p-2 bg-muted/50 rounded-lg">
                <h4 className="text-sm font-semibold mb-2">{t('quickLinkModal.linkTitle.label')}</h4>
                <p className="text-sm">{title}</p>
              </div>

              {description && (
                <div className="p-2 bg-muted/50 rounded-lg text-sm">
                  <h4 className="text-sm font-semibold mb-2">{t('quickLinkModal.welcomeMessage.label')}</h4>
                  <p className="text-sm whitespace-pre-wrap">{description}</p>
                </div>
              )}
            </div>

            {/* Résumé de la configuration */}
            <div className="space-y-2">
              {/* Expiration et limites */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div className="p-2 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-1 text-xs mb-1">
                    <Calendar className="h-3 w-3 text-muted-foreground" />
                    <span className="font-medium">{t('linkSummaryModal.expires')}</span>
                  </div>
                  <p className="text-xs ml-4">{formatExpirationDate(DEFAULT_LINK_CONFIG.expirationDays)}</p>
                </div>

                <div className="p-2 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-1 text-xs mb-1">
                    <Users className="h-3 w-3 text-muted-foreground" />
                    <span className="font-medium">{t('linkSummaryModal.userLimits')}</span>
                  </div>
                  <p className="text-xs ml-4">{t('linkSummaryModal.unlimitedUsage')}</p>
                </div>
              </div>

              {/* Exigences d'authentification */}
              <div className="p-2 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <h4 className="text-xs font-semibold mb-1 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-blue-600" />
                  {t('linkSummaryModal.authRequirements')}
                </h4>
                <div className="space-y-1 ml-4 text-xs">
                  <div className="flex items-center gap-1">
                    <Shield className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs font-medium">{t('linkSummaryModal.accountRequired')}</span>
                    <Check className="h-3 w-3 text-green-600" />
                  </div>
                  <div className="flex items-center gap-1">
                    <User className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs">{t('linkSummaryModal.nickname')}</span>
                    <Check className="h-3 w-3 text-green-600" />
                  </div>
                  <div className="flex items-center gap-1">
                    <Mail className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs">{t('linkSummaryModal.email')}</span>
                    <Check className="h-3 w-3 text-green-600" />
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs">{t('linkSummaryModal.birthday')}</span>
                    <Check className="h-3 w-3 text-green-600" />
                  </div>
                </div>
              </div>

              {/* Permissions d'envoi */}
              <div className="p-2 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                <h4 className="text-xs font-semibold mb-1 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  {t('linkSummaryModal.sendPermissions')}
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-1 ml-4 text-xs">
                  <div className="flex items-center gap-1">
                    <MessageSquare className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs">{t('linkSummaryModal.messages')}</span>
                    <Check className="h-3 w-3 text-green-600" />
                  </div>
                  <div className="flex items-center gap-1">
                    <ImageIcon className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs">{t('linkSummaryModal.images')}</span>
                    <Check className="h-3 w-3 text-green-600" />
                  </div>
                  <div className="flex items-center gap-1">
                    <FileText className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs">{t('linkSummaryModal.files')}</span>
                    <Check className="h-3 w-3 text-green-600" />
                  </div>
                  <div className="flex items-center gap-1">
                    <Video className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs">{t('linkSummaryModal.videos')}</span>
                    <Check className="h-3 w-3 text-green-600" />
                  </div>
                  <div className="flex items-center gap-1">
                    <Volume2 className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs">{t('linkSummaryModal.audio')}</span>
                    <Check className="h-3 w-3 text-green-600" />
                  </div>
                  <div className="flex items-center gap-1">
                    <File className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs">{t('linkSummaryModal.documents')}</span>
                    <Check className="h-3 w-3 text-green-600" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {currentStep === 1 ? (
            <>
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={isCreating}
                className="w-full sm:w-auto"
              >
                {t('quickLinkModal.actions.cancel')}
              </Button>
              <Button
                onClick={nextStep}
                disabled={!canProceedToStep2}
                className="w-full sm:w-auto"
              >
                {t('quickLinkModal.actions.next')}
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={prevStep}
                disabled={isCreating}
                className="w-full sm:w-auto"
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                {t('quickLinkModal.actions.back')}
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={isCreating}
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
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
