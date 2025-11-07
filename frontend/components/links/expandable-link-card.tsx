'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Link2,
  Users,
  Activity,
  MoreVertical,
  Copy,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  RefreshCw,
  MessageSquare,
  Calendar,
  Shield,
  Image,
  FileText,
  Eye,
  Mail,
  Cake,
  Hash,
  Clock,
  Globe,
  BarChart,
  ChevronDown,
  ChevronUp,
  ExternalLink as ExternalLinkIcon
} from 'lucide-react';
import { useI18n } from '@/hooks/useI18n';
import { copyToClipboard } from '@/lib/clipboard';
import { toast } from 'sonner';

interface ConversationLink {
  id: string;
  linkId: string;
  name?: string;
  description?: string;
  conversationId: string;
  isActive: boolean;
  currentUses: number;
  maxUses?: number;
  currentConcurrentUsers: number;
  maxConcurrentUsers?: number;
  expiresAt?: string;
  createdAt: string;
  allowAnonymousMessages: boolean;
  allowAnonymousImages: boolean;
  allowAnonymousFiles: boolean;
  allowViewHistory?: boolean;
  requireAccount?: boolean;  // Ajouter ce champ
  requireEmail?: boolean;
  requireName?: boolean;
  requireBirthday?: boolean;
  conversation: {
    id: string;
    title?: string;
    type: string;
    conversationUrl?: string;
  };
  stats?: {
    totalParticipants: number;
    languageCount: number;
  };
}

interface ExpandableLinkCardProps {
  link: ConversationLink;
  onCopy: (linkId: string) => void;
  onEdit: (link: ConversationLink) => void;
  onToggle: (link: ConversationLink) => void;
  onExtend: (link: ConversationLink, days: number) => void;
  onDelete: (link: ConversationLink) => void;
}

export function ExpandableLinkCard({
  link,
  onCopy,
  onEdit,
  onToggle,
  onExtend,
  onDelete
}: ExpandableLinkCardProps) {
  const { t } = useI18n('links');
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(false);

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleCopyLink = async () => {
    const linkUrl = `${window.location.origin}/join/${link.linkId}`;
    const result = await copyToClipboard(linkUrl);
    if (result.success) {
      toast.success(t('success.linkCopied'));
    } else {
      toast.error(result.message);
    }
  };

  return (
    <Card className="relative border-2 hover:border-primary/50 hover:shadow-xl transition-all duration-200 overflow-hidden group bg-white dark:bg-gray-950">
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-0"></div>

      <CardContent className="relative z-10 p-4 sm:p-6">
        {/* Header */}
        <div className="flex items-start space-x-3 sm:space-x-4 mb-4">
          <div className="p-2 sm:p-2.5 bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-xl flex-shrink-0">
            <Link2 className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400" />
          </div>

          <div className="flex-1 min-w-0">
            {/* Titre avec Badge et Menu */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <h3 className="text-base sm:text-xl font-bold text-gray-900 dark:text-white break-words flex-1">
                <a
                  href={`/join/${link.linkId}`}
                  className="text-foreground hover:text-primary transition-colors"
                  onClick={(e) => {
                    e.preventDefault();
                    router.push(`/join/${link.linkId}`);
                  }}
                >
                  {link.name || t('unnamedLink')}
                </a>
              </h3>

              <div className="flex flex-row items-center gap-2 flex-shrink-0">
                <Badge
                  variant={link.isActive ? 'default' : 'secondary'}
                  className={`px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-semibold ${
                    link.isActive ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-400 hover:bg-gray-500'
                  }`}
                >
                  {link.isActive ? t('status.active') : t('status.inactive')}
                </Badge>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 sm:h-10 sm:w-10 p-0">
                      <MoreVertical className="h-4 w-4 sm:h-5 sm:w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem onClick={handleCopyLink} className="py-3">
                      <Copy className="h-4 w-4 mr-3" />
                      {t('actions.copy')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onEdit(link)} className="py-3">
                      <Edit className="h-4 w-4 mr-3" />
                      {t('actions.edit')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onToggle(link)} className="py-3">
                      {link.isActive ? (
                        <>
                          <XCircle className="h-4 w-4 mr-3" />
                          {t('actions.disable')}
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4 mr-3" />
                          {t('actions.enable')}
                        </>
                      )}
                    </DropdownMenuItem>
                    {link.expiresAt && (
                      <DropdownMenuItem onClick={() => onExtend(link, 7)} className="py-3">
                        <RefreshCw className="h-4 w-4 mr-3" />
                        {t('actions.extend7Days')}
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onClick={() => onDelete(link)}
                      className="text-red-600 py-3"
                    >
                      <Trash2 className="h-4 w-4 mr-3" />
                      {t('actions.delete')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Conversation */}
            <div className="flex items-start gap-2 text-xs sm:text-sm mb-3">
              <MessageSquare className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <a
                href={`/conversations/${link.conversationId}`}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline transition-colors cursor-pointer text-left break-all"
                onClick={(e) => {
                  e.preventDefault();
                  router.push(`/conversations/${link.conversationId}`);
                }}
              >
                {link.conversation.title}
              </a>
            </div>

            {/* Bloc unifié: Stats + Dates - AVANT l'accordéon */}
            <div className="space-y-3 mb-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              {/* Stats */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <div className="flex items-center space-x-2">
                  <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-400" />
                  <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 font-medium">
                    {link.currentUses} / {link.maxUses || '∞'} {t('stats.uses')}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <Activity className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-400" />
                  <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 font-medium">
                    {link.currentConcurrentUsers} {t('stats.active')}
                  </span>
                </div>
              </div>

              {/* Séparateur */}
              <div className="border-t border-gray-200 dark:border-gray-700"></div>

              {/* Dates */}
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {t('details.createdAt')}
                  </div>
                  <p className="text-sm font-medium">{formatDate(link.createdAt)}</p>
                </div>
                {link.expiresAt && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {t('details.expiresAt')}
                    </div>
                    <p className="text-sm font-medium">{formatDate(link.expiresAt)}</p>
                  </div>
                )}
              </div>
            </div>

            {/* URL du lien */}
            <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 px-3 py-2 rounded-lg">
              <input
                type="text"
                value={`${typeof window !== 'undefined' ? window.location.origin : ''}/join/${link.linkId}`}
                readOnly
                className="bg-transparent text-xs flex-1 min-w-0 border-0 focus:ring-0 focus:outline-none text-gray-700 dark:text-gray-300"
                onClick={(e) => e.currentTarget.select()}
              />
              <Button size="sm" variant="ghost" onClick={handleCopyLink} className="h-7 px-2">
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>

        {/* Accordion pour détails supplémentaires */}
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="details" className="border-0">
            <AccordionTrigger className="py-3 hover:no-underline">
              <div className="flex items-center gap-2 text-sm font-medium">
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                {t('details.viewMore')}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-2">
                {/* Message d'invitation si présent */}
                {link.description && (
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <h4 className="text-sm font-semibold mb-2 text-blue-900 dark:text-blue-100">
                      {t('details.invitationMessage')}
                    </h4>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{link.description}</p>
                  </div>
                )}

                {/* Permissions */}
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    {t('details.permissions')}
                  </h4>
                  <div className="grid gap-2">
                    <div className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-800/50 rounded">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{t('permissions.messages')}</span>
                      </div>
                      <Badge variant={link.allowAnonymousMessages ? 'default' : 'secondary'} className="text-xs">
                        {link.allowAnonymousMessages ? t('permissions.allowed') : t('permissions.denied')}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-800/50 rounded">
                      <div className="flex items-center gap-2">
                        <Image className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{t('permissions.images')}</span>
                      </div>
                      <Badge variant={link.allowAnonymousImages ? 'default' : 'secondary'} className="text-xs">
                        {link.allowAnonymousImages ? t('permissions.allowed') : t('permissions.denied')}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-800/50 rounded">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{t('permissions.files')}</span>
                      </div>
                      <Badge variant={link.allowAnonymousFiles ? 'default' : 'secondary'} className="text-xs">
                        {link.allowAnonymousFiles ? t('permissions.allowed') : t('permissions.denied')}
                      </Badge>
                    </div>
                    {link.allowViewHistory !== undefined && (
                      <div className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-800/50 rounded">
                        <div className="flex items-center gap-2">
                          <Eye className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{t('permissions.viewHistory')}</span>
                        </div>
                        <Badge variant={link.allowViewHistory ? 'default' : 'secondary'} className="text-xs">
                          {link.allowViewHistory ? t('permissions.allowed') : t('permissions.denied')}
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>

                {/* Exigences */}
                {(link.requireAccount || link.requireEmail || link.requireName || link.requireBirthday) && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                      <Hash className="h-4 w-4" />
                      {t('details.requirements')}
                    </h4>
                    <div className="grid gap-2">
                      {link.requireAccount && (
                        <div className="flex items-center gap-2 py-2 px-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                          <Shield className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          <span className="text-sm font-medium text-blue-700 dark:text-blue-300">{t('requirements.account')}</span>
                          <Badge variant="secondary" className="ml-auto text-xs">
                            {t('requirements.noAnonymous')}
                          </Badge>
                        </div>
                      )}
                      {link.requireEmail && (
                        <div className="flex items-center gap-2 py-2 px-3 bg-gray-50 dark:bg-gray-800/50 rounded">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{t('requirements.email')}</span>
                        </div>
                      )}
                      {link.requireName && (
                        <div className="flex items-center gap-2 py-2 px-3 bg-gray-50 dark:bg-gray-800/50 rounded">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{t('requirements.name')}</span>
                        </div>
                      )}
                      {link.requireBirthday && (
                        <div className="flex items-center gap-2 py-2 px-3 bg-gray-50 dark:bg-gray-800/50 rounded">
                          <Cake className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{t('requirements.birthday')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}
