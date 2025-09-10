'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Link2, 
  Copy, 
  Calendar, 
  Clock, 
  MessageSquare, 
  FileText, 
  Image,
  Check,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import { copyToClipboard } from '@/lib/clipboard';
import { useTranslations } from '@/hooks/useTranslations';

interface LinkSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  linkData: {
    url: string;
    token: string;
    title: string;
    description: string;
    expirationDays: number;
    allowAnonymousMessages: boolean;
    allowAnonymousFiles: boolean;
    allowAnonymousImages: boolean;
    allowViewHistory: boolean;
    requireNickname: boolean;
    requireEmail: boolean;
    allowedLanguages: string[];
  };
}

export function LinkSummaryModal({
  isOpen,
  onClose,
  linkData
}: LinkSummaryModalProps) {
  const [copied, setCopied] = useState(false);
  const { t } = useTranslations('linkSummaryModal');

  const handleCopyLink = async () => {
    try {
      await copyToClipboard(linkData.url);
      setCopied(true);
      toast.success('Lien copié dans le presse-papier !');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Erreur lors de la copie:', error);
      toast.error('Erreur lors de la copie du lien');
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

  const getLanguageName = (code: string) => {
    const languages: Record<string, string> = {
      'fr': 'Français',
      'en': 'English',
      'es': 'Español',
      'de': 'Deutsch',
      'it': 'Italiano',
      'pt': 'Português',
      'zh': '中文',
      'ja': '日本語',
      'ar': 'العربية'
    };
    return languages[code] || code;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            {t('title')}
          </DialogTitle>
          <DialogDescription>
            {t('description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Lien de partage */}
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-2 block">{t('shareLink')}</label>
            <div className="flex items-center gap-2">
              <code className="flex-1 p-2 bg-muted rounded text-xs break-all">
                {linkData.url}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyLink}
                className="flex items-center gap-2"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                {copied ? t('copied') : t('copy')}
              </Button>
            </div>
          </div>

          {/* Paramètres condensés */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            {/* Expiration */}
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">{t('expires')}</span>
              <span>{formatExpirationDate(linkData.expirationDays)}</span>
            </div>

            {/* Langues */}
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">{t('languages')}</span>
              <div className="flex gap-1">
                {linkData.allowedLanguages.slice(0, 2).map((lang) => (
                  <Badge key={lang} variant="secondary" className="text-xs">
                    {lang.toUpperCase()}
                  </Badge>
                ))}
                {linkData.allowedLanguages.length > 2 && (
                  <Badge variant="secondary" className="text-xs">
                    +{linkData.allowedLanguages.length - 2}
                  </Badge>
                )}
              </div>
            </div>

            {/* Permissions */}
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">{t('messages')}</span>
              {linkData.allowAnonymousMessages ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <X className="h-4 w-4 text-red-600" />
              )}
            </div>

            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">{t('files')}</span>
              {linkData.allowAnonymousFiles ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <X className="h-4 w-4 text-red-600" />
              )}
            </div>

            <div className="flex items-center gap-2">
              <Image className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">{t('images')}</span>
              {linkData.allowAnonymousImages ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <X className="h-4 w-4 text-red-600" />
              )}
            </div>

            {/* Authentification */}
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">{t('auth')}</span>
              <div className="flex gap-1">
                {!linkData.requireNickname && !linkData.requireEmail ? (
                  <Badge variant="secondary" className="text-xs">{t('none')}</Badge>
                ) : (
                  <>
                    {linkData.requireNickname && (
                      <Badge variant="secondary" className="text-xs">{t('nickname')}</Badge>
                    )}
                    {linkData.requireEmail && (
                      <Badge variant="secondary" className="text-xs">{t('email')}</Badge>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={onClose}>
            {t('close')}
          </Button>
          <Button onClick={handleCopyLink} className="flex items-center gap-2">
            <Copy className="h-4 w-4" />
            {t('copyLink')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
