'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Copy, Check, ExternalLink, Settings } from 'lucide-react';
import { useI18n } from '@/hooks/useI18n';

interface LinkCopyModalProps {
  isOpen: boolean;
  onClose: () => void;
  linkUrl: string;
  linkDetails?: {
    name?: string;
    description?: string;
    maxUses?: number;
    expiresAt?: string;
    allowAnonymousMessages?: boolean;
    allowAnonymousFiles?: boolean;
    allowAnonymousImages?: boolean;
    allowViewHistory?: boolean;
    requireNickname?: boolean;
    requireEmail?: boolean;
    participantCount?: number;
    maxParticipants?: number;
    isActive?: boolean;
    createdAt?: string;
    createdBy?: string;
    permissions?: {
      canSendMessages?: boolean;
      canSendFiles?: boolean;
      canSendImages?: boolean;
      canViewHistory?: boolean;
      canInviteOthers?: boolean;
    };
  };
  onOpenAdvancedSettings?: () => void;
}

export function LinkCopyModal({
  isOpen,
  onClose,
  linkUrl,
  linkDetails,
  onOpenAdvancedSettings
}: LinkCopyModalProps) {
  const [copied, setCopied] = useState(false);
  const { t } = useI18n('modals');

  const copyToClipboard = async (text: string): Promise<boolean> => {
    // Méthode moderne avec navigator.clipboard
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (error) {
        console.warn('Modern clipboard API failed:', error);
      }
    }

    // Fallback avec document.execCommand
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      
      if (successful) {
        return true;
      } else {
        throw new Error('execCommand copy failed');
      }
    } catch (error) {
      console.error('Fallback copy method failed:', error);
      return false;
    }
  };

  const handleCopyLink = async () => {
    const success = await copyToClipboard(linkUrl);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return t('createLinkButton.noExpiration');
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatBoolean = (value?: boolean) => {
    return value ? t('createLinkButton.enabled') : t('createLinkButton.disabled');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-h-[80vh] p-0 overflow-hidden sm:max-w-[320px] sm:w-[90vw] sm:max-h-[75vh]">
        {/* Header avec statut */}
        <div className="bg-gradient-to-r from-green-50 to-blue-50 p-4 border-b">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-full bg-green-100 flex items-center justify-center">
              <ExternalLink className="h-3 w-3 text-green-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">{t('createLinkButton.linkCreated')}</h3>
              <p className="text-xs text-gray-600">{t('createLinkButton.copyManually')}</p>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-3">
          {/* Lien généré */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-gray-700">{t('createLinkButton.generatedLink')}</Label>
            <div className="flex gap-2">
              <Input
                value={linkUrl}
                readOnly
                className="text-xs font-mono bg-gray-50 border-gray-200 h-8 flex-1"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyLink}
                className="h-8 px-3 text-xs shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="h-3 w-3 text-green-600 mr-1" />
                    {t('createLinkButton.copied')}
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3 mr-1" />
                    {t('createLinkButton.copy')}
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Stats rapides */}
          {linkDetails && (
            <div className="grid grid-cols-2 gap-3">
              {/* Participants */}
              <div className="bg-blue-50 rounded-lg p-2">
                <div className="flex items-center gap-1 mb-1">
                  <div className="h-2 w-2 rounded-full bg-blue-500" />
                  <span className="text-xs font-medium text-blue-900">{t('createLinkButton.participants')}</span>
                </div>
                <div className="text-xs text-blue-700">
                  {linkDetails.participantCount || 0}
                  {linkDetails.maxParticipants && `/${linkDetails.maxParticipants}`}
                </div>
              </div>

              {/* Utilisations */}
              <div className="bg-orange-50 rounded-lg p-2">
                <div className="flex items-center gap-1 mb-1">
                  <div className="h-2 w-2 rounded-full bg-orange-500" />
                  <span className="text-xs font-medium text-orange-900">{t('createLinkButton.uses')}</span>
                </div>
                <div className="text-xs text-orange-700">
                  {linkDetails.maxUses ? `0/${linkDetails.maxUses}` : t('createLinkButton.unlimited')}
                </div>
              </div>
            </div>
          )}

          {/* Permissions et détails en colonnes */}
          {linkDetails && (
            <div className="grid grid-cols-2 gap-4">
              {/* Colonne 1: Permissions */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-gray-700">{t('createLinkButton.permissions')}</Label>
                <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    <div className={`h-2 w-2 rounded-full ${linkDetails.allowAnonymousMessages ? 'bg-green-500' : 'bg-gray-300'}`} />
                    <span className="text-xs text-gray-600">{t('createLinkButton.messages')}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className={`h-2 w-2 rounded-full ${linkDetails.allowAnonymousFiles ? 'bg-green-500' : 'bg-gray-300'}`} />
                    <span className="text-xs text-gray-600">{t('createLinkButton.files')}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className={`h-2 w-2 rounded-full ${linkDetails.allowAnonymousImages ? 'bg-green-500' : 'bg-gray-300'}`} />
                    <span className="text-xs text-gray-600">{t('images')}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className={`h-2 w-2 rounded-full ${linkDetails.allowViewHistory ? 'bg-green-500' : 'bg-gray-300'}`} />
                    <span className="text-xs text-gray-600">{t('history')}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className={`h-2 w-2 rounded-full ${linkDetails.requireNickname ? 'bg-blue-500' : 'bg-gray-300'}`} />
                    <span className="text-xs text-gray-600">{t('nickname')}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className={`h-2 w-2 rounded-full ${linkDetails.requireEmail ? 'bg-blue-500' : 'bg-gray-300'}`} />
                    <span className="text-xs text-gray-600">{t('email')}</span>
                  </div>
                </div>
              </div>

              {/* Colonne 2: Détails */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-gray-700">{t('linkDetails')}</Label>
                <div className="space-y-1 text-xs text-gray-600">
                  {linkDetails.name && (
                    <div className="flex justify-between">
                      <span>{t('name')}:</span>
                      <span className="font-medium truncate ml-2">{linkDetails.name}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>{t('expiresAt')}:</span>
                    <span className="font-medium">{formatDate(linkDetails.expiresAt)}</span>
                  </div>
                  {linkDetails.createdAt && (
                    <div className="flex justify-between">
                      <span>{t('createdAt')}:</span>
                      <span className="font-medium">{formatDate(linkDetails.createdAt)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Message d'information compact */}
          <div className="bg-blue-50/50 border border-blue-200/50 rounded-md p-2">
            <p className="text-xs text-blue-700 leading-relaxed">
              {t('advancedSettingsInfo')}
            </p>
          </div>
        </div>

        {/* Footer compact */}
        {onOpenAdvancedSettings && (
          <div className="bg-gray-50 px-4 py-3 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenAdvancedSettings}
              className="flex items-center gap-1 text-xs h-7 px-2 w-full"
            >
              <Settings className="h-3 w-3" />
              {t('advancedSettings')}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
