'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Link2,
  MoreVertical,
  Copy,
  Trash2,
  XCircle,
  CheckCircle,
  ExternalLink,
  MousePointerClick,
  Users,
  Calendar,
  Clock,
  BarChart
} from 'lucide-react';
import type { TrackingLink } from '@shared/types/tracking-link';
import { useI18n } from '@/hooks/useI18n';
import { useRouter } from 'next/navigation';

interface ExpandableTrackingLinkCardProps {
  link: TrackingLink;
  onCopy: () => void;
  onToggle: () => void;
  onDelete: () => void;
}

export function ExpandableTrackingLinkCard({
  link,
  onCopy,
  onToggle,
  onDelete
}: ExpandableTrackingLinkCardProps) {
  const { t } = useI18n('links');
  const router = useRouter();

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Card className="relative border-2 hover:border-primary/50 hover:shadow-xl transition-all duration-200 overflow-hidden group bg-white dark:bg-gray-950">
      <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-0"></div>

      <CardContent className="relative z-10 p-4 sm:p-6">
        {/* Main Content */}
        <div className="flex items-start space-x-3 sm:space-x-4">
          <div className="p-2 sm:p-2.5 bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 rounded-xl flex-shrink-0">
            <Link2 className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600 dark:text-purple-400" />
          </div>

          <div className="flex-1 min-w-0">
            {/* Title with Badge and Menu */}
            <div className="flex items-start justify-between gap-2 mb-1">
              <h3 className="text-base sm:text-xl font-bold text-gray-900 dark:text-white break-words flex-1">
                {link.shortUrl}
              </h3>

              <div className="flex flex-row items-center gap-2 flex-shrink-0">
                <Badge
                  variant={link.isActive ? 'default' : 'secondary'}
                  className={`px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-semibold flex-shrink-0 whitespace-nowrap ${
                    link.isActive
                      ? 'bg-green-500 hover:bg-green-600'
                      : 'bg-gray-400 hover:bg-gray-500'
                  }`}
                >
                  {link.isActive ? t('status.active') : t('status.inactive')}
                </Badge>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 sm:h-10 sm:w-10 p-0 hover:bg-gray-200 dark:hover:bg-gray-700 flex-shrink-0">
                      <MoreVertical className="h-4 w-4 sm:h-5 sm:w-5" />
                      <span className="sr-only">{t('actions.menu')}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 z-[100]">
                    <DropdownMenuItem onClick={onCopy} className="py-3">
                      <Copy className="h-4 w-4 mr-3" />
                      <span className="font-medium">{t('tracking.actions.copyShortUrl')}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push(`/links/tracked/${link.token}`)} className="py-3">
                      <BarChart className="h-4 w-4 mr-3" />
                      <span className="font-medium">{t('tracking.actions.viewStats')}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={onToggle} className="py-3">
                      {link.isActive ? (
                        <>
                          <XCircle className="h-4 w-4 mr-3" />
                          <span className="font-medium">{t('tracking.actions.deactivate')}</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4 mr-3" />
                          <span className="font-medium">{t('tracking.actions.activate')}</span>
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={onDelete}
                      className="text-red-600 py-3 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-900/20"
                    >
                      <Trash2 className="h-4 w-4 mr-3" />
                      <span className="font-medium">{t('actions.delete')}</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Original URL */}
            <div className="flex items-start gap-2 text-xs sm:text-sm mb-2 sm:mb-3">
              <ExternalLink className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />
              <a
                href={link.originalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 hover:underline transition-colors cursor-pointer text-left break-all"
              >
                {link.originalUrl}
              </a>
            </div>

            {/* Quick Stats */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-3">
              <div className="flex items-center space-x-2 flex-shrink-0">
                <MousePointerClick className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-400 flex-shrink-0" />
                <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 font-medium">
                  {link.totalClicks} {t('tracking.stats.totalClicks')}
                </span>
              </div>

              <div className="flex items-center space-x-2 flex-shrink-0">
                <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-400 flex-shrink-0" />
                <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 font-medium">
                  {link.uniqueClicks} {t('tracking.stats.uniqueClicks')}
                </span>
              </div>
            </div>

            {/* Dates - AVANT l'accordéon */}
            <div className="grid sm:grid-cols-2 gap-3 mb-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
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
              {link.lastClickedAt && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <MousePointerClick className="h-3 w-3" />
                    {t('tracking.stats.lastClick')}
                  </div>
                  <p className="text-sm font-medium">{formatDate(link.lastClickedAt)}</p>
                </div>
              )}
            </div>

            {/* Expandable Details */}
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="details" className="border-0">
                <AccordionTrigger className="py-2 hover:no-underline">
                  <span className="text-sm font-medium text-primary">{t('actions.viewDetails')}</span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4 pt-2">
                    {/* Link Information */}
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 space-y-3">
                      <h4 className="font-semibold text-sm text-gray-900 dark:text-white mb-3">
                        {t('tracking.details.linkInformation')}
                      </h4>

                      <div className="space-y-2">
                        <div className="flex justify-between items-start text-sm">
                          <span className="text-gray-600 dark:text-gray-400">{t('tracking.details.token')}:</span>
                          <span className="font-mono text-xs bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">
                            {link.token}
                          </span>
                        </div>

                        <div className="flex justify-between items-start text-sm">
                          <span className="text-gray-600 dark:text-gray-400">{t('tracking.details.shortUrl')}:</span>
                          <a
                            href={link.shortUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-purple-600 dark:text-purple-400 hover:underline text-right break-all max-w-[60%]"
                          >
                            {link.shortUrl}
                          </a>
                        </div>

                        <div className="flex justify-between items-start text-sm">
                          <span className="text-gray-600 dark:text-gray-400">{t('tracking.details.originalUrl')}:</span>
                          <a
                            href={link.originalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-purple-600 dark:text-purple-400 hover:underline text-right break-all max-w-[60%]"
                          >
                            {link.originalUrl.length > 50
                              ? `${link.originalUrl.substring(0, 50)}...`
                              : link.originalUrl}
                          </a>
                        </div>
                      </div>
                    </div>

                    {/* Full Stats Link */}
                    <Button
                      onClick={() => router.push(`/links/tracked/${link.token}`)}
                      className="w-full"
                      variant="outline"
                    >
                      <BarChart className="h-4 w-4 mr-2" />
                      {t('tracking.actions.viewStats')}
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
