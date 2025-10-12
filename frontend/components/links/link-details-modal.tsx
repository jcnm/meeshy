'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { 
  Link2, 
  Users, 
  Calendar, 
  Clock, 
  Shield, 
  Globe, 
  Copy,
  Activity,
  BarChart,
  MessageSquare,
  Image,
  FileText,
  Eye,
  ExternalLink
} from 'lucide-react';
import { ConversationLink } from '@/types';
import { useI18n } from '@/hooks/useI18n';
import { copyToClipboard } from '@/lib/clipboard';
import { toast } from 'sonner';

interface LinkDetailsModalProps {
  link: ConversationLink;
  isOpen: boolean;
  onClose: () => void;
}

export function LinkDetailsModal({ link, isOpen, onClose }: LinkDetailsModalProps) {
  const { t } = useI18n('links');

  const handleCopyLink = async () => {
    const linkUrl = `${window.location.origin}/join/${link.linkId}`;
    const result = await copyToClipboard(linkUrl);
    if (result.success) {
      toast.success(t('success.linkCopied'));
    } else {
      toast.error(result.message);
    }
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleOpenConversation = () => {
    if (link.conversation.conversationUrl) {
      window.open(link.conversation.conversationUrl, '_blank');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg w-[95vw] max-h-[80vh] overflow-y-auto sm:max-w-lg sm:w-[90vw] sm:max-h-[75vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            {t('details.title')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Informations de base - toujours visibles */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('details.linkName')}</p>
                <p className="font-medium">{link.name || t('unnamedLink')}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={link.isActive ? 'default' : 'secondary'}>
                  {link.isActive ? t('status.active') : t('status.inactive')}
                </Badge>
                {link.expiresAt && new Date(link.expiresAt) <= new Date() && (
                  <Badge variant="destructive">{t('status.expired')}</Badge>
                )}
              </div>
            </div>

            {link.description && (
              <div>
                <p className="text-sm text-muted-foreground">{t('details.description')}</p>
                <p className="font-medium text-sm">{link.description}</p>
              </div>
            )}

            <div>
              <p className="text-sm text-muted-foreground">{t('details.conversation')}</p>
              <div className="flex items-center gap-2 mt-1">
                <p className="font-medium flex-1">{link.conversation.title}</p>
                {link.conversation.conversationUrl && (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={handleOpenConversation}
                    className="h-8 px-2"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">{t('details.linkUrl')}</p>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="text"
                  value={`${window.location.origin}/join/${link.linkId}`}
                  readOnly
                  className="bg-muted px-2 py-1 rounded text-xs flex-1 min-w-0 max-w-[300px] border-0 focus:ring-0 focus:outline-none"
                  onClick={(e) => e.currentTarget.select()}
                />
                <Button size="sm" variant="outline" onClick={handleCopyLink} className="h-8 px-2 shrink-0">
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>

          {/* Accordéons pour les informations détaillées */}
          <Accordion type="multiple" className="w-full">
            {/* Statistiques d'utilisation */}
            <AccordionItem value="usage">
              <AccordionTrigger className="text-sm">
                <div className="flex items-center gap-2">
                  <BarChart className="h-4 w-4" />
                  {t('details.usage')}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Users className="h-3 w-3" />
                      {t('details.totalUses')}
                    </div>
                    <p className="text-lg font-bold">
                      {link.currentUses} / {link.maxUses || '∞'}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Activity className="h-3 w-3" />
                      {t('details.activeUsers')}
                    </div>
                    <p className="text-lg font-bold">
                      {link.currentConcurrentUsers}
                    </p>
                  </div>

                  {link.stats && (
                    <>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Users className="h-3 w-3" />
                          {t('details.totalParticipants')}
                        </div>
                        <p className="text-lg font-bold">{link.stats.totalParticipants}</p>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Globe className="h-3 w-3" />
                          {t('details.languages')}
                        </div>
                        <p className="text-lg font-bold">{link.stats.languageCount}</p>
                      </div>
                    </>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Permissions */}
            <AccordionItem value="permissions">
              <AccordionTrigger className="text-sm">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  {t('details.permissions')}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{t('permissions.messages')}</span>
                    </div>
                    <Badge variant={link.allowAnonymousMessages ? 'default' : 'secondary'} className="text-xs">
                      {link.allowAnonymousMessages ? t('permissions.allowed') : t('permissions.denied')}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Image className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{t('permissions.images')}</span>
                    </div>
                    <Badge variant={link.allowAnonymousImages ? 'default' : 'secondary'} className="text-xs">
                      {link.allowAnonymousImages ? t('permissions.allowed') : t('permissions.denied')}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{t('permissions.files')}</span>
                    </div>
                    <Badge variant={link.allowAnonymousFiles ? 'default' : 'secondary'} className="text-xs">
                      {link.allowAnonymousFiles ? t('permissions.allowed') : t('permissions.denied')}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Eye className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{t('permissions.viewHistory')}</span>
                    </div>
                    <Badge variant={link.allowViewHistory ? 'default' : 'secondary'} className="text-xs">
                      {link.allowViewHistory ? t('permissions.allowed') : t('permissions.denied')}
                    </Badge>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Dates importantes */}
            <AccordionItem value="dates">
              <AccordionTrigger className="text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {t('details.dates')}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 pt-2">
                  <div>
                    <p className="text-xs text-muted-foreground">{t('details.created')}</p>
                    <p className="text-sm font-medium">{formatDate(link.createdAt)}</p>
                  </div>

                  {link.expiresAt && (
                    <div>
                      <p className="text-xs text-muted-foreground">{t('details.expires')}</p>
                      <p className="text-sm font-medium">{formatDate(link.expiresAt)}</p>
                    </div>
                  )}

                  <div>
                    <p className="text-xs text-muted-foreground">{t('details.lastUpdated')}</p>
                    <p className="text-sm font-medium">{formatDate(link.updatedAt)}</p>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Créateur */}
            {link.creator && (
              <AccordionItem value="creator">
                <AccordionTrigger className="text-sm">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    {t('details.creator')}
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="flex items-center gap-3 pt-2">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-xs font-medium">
                        {link.creator.displayName?.[0] || link.creator.username[0].toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {link.creator.displayName || `${link.creator.firstName} ${link.creator.lastName}`.trim() || link.creator.username}
                      </p>
                      <p className="text-xs text-muted-foreground">@{link.creator.username}</p>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}
          </Accordion>
        </div>
      </DialogContent>
    </Dialog>
  );
}
