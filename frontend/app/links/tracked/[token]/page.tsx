'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Footer } from '@/components/layout/Footer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  Link2,
  ExternalLink,
  Copy,
  Calendar,
  MousePointerClick,
  Users,
  TrendingUp,
  Globe,
  Smartphone,
  Monitor,
  Activity,
  Clock,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '@/hooks/useI18n';
import { getTrackingLinkStats } from '@/services/tracking-links';
import { copyToClipboard } from '@/lib/clipboard';
import type { TrackingLink } from '@shared/types/tracking-link';

interface TrackingLinkStats {
  trackingLink: TrackingLink;
  clicksByDate: Array<{ date: string; clicks: number; uniqueClicks: number }>;
  clicksByCountry: Array<{ country: string; clicks: number }>;
  clicksByDevice: Array<{ device: string; clicks: number }>;
  clicksByBrowser: Array<{ browser: string; clicks: number }>;
  topReferrers: Array<{ referrer: string; clicks: number }>;
}

export default function TrackingLinkDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const { t } = useI18n('links');
  const token = params.token as string;

  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<TrackingLinkStats | null>(null);

  useEffect(() => {
    loadStats();
  }, [token]);

  const loadStats = async () => {
    try {
      setIsLoading(true);
      const data = await getTrackingLinkStats(token);

      // Transformer les données du format API vers le format attendu par le composant
      const transformedStats: TrackingLinkStats = {
        trackingLink: data.trackingLink,
        clicksByDate: Object.entries(data.clicksByDate || {})
          .map(([date, clicks]) => ({
            date,
            clicks: clicks as number,
            uniqueClicks: clicks as number // Approximation, en attendant que le backend renvoie les données détaillées
          }))
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
        clicksByCountry: Object.entries(data.clicksByCountry || {})
          .map(([country, clicks]) => ({ country, clicks: clicks as number }))
          .sort((a, b) => b.clicks - a.clicks),
        clicksByDevice: Object.entries(data.clicksByDevice || {})
          .map(([device, clicks]) => ({ device, clicks: clicks as number }))
          .sort((a, b) => b.clicks - a.clicks),
        clicksByBrowser: Object.entries(data.clicksByBrowser || {})
          .map(([browser, clicks]) => ({ browser, clicks: clicks as number }))
          .sort((a, b) => b.clicks - a.clicks),
        topReferrers: (data.topReferrers || []).map(r => ({
          referrer: r.referrer,
          clicks: r.count
        }))
      };

      setStats(transformedStats);
    } catch (error) {
      console.error('Erreur lors du chargement des statistiques:', error);
      toast.error(t('tracking.errors.statsFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyLink = async (url: string) => {
    const result = await copyToClipboard(url);
    if (result.success) {
      toast.success(t('tracking.success.copied'));
    } else {
      toast.error(result.message);
    }
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex flex-col min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <DashboardLayout title={t('tracking.details.title')} className="!bg-none !bg-transparent !h-auto">
          <div className="relative z-10 space-y-6 pb-8">
            <Card className="border-2 bg-white dark:bg-gray-950">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <XCircle className="h-16 w-16 text-red-600 mb-4" />
                <h3 className="text-2xl font-bold text-foreground mb-3">{t('tracking.details.linkNotFound')}</h3>
                <p className="text-muted-foreground mb-6">{t('tracking.details.linkNotFoundDescription')}</p>
                <Button onClick={() => router.push('/links#tracked')} variant="default">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  {t('tracking.details.backToLinks')}
                </Button>
              </CardContent>
            </Card>
          </div>
        </DashboardLayout>
      </div>
    );
  }

  const { trackingLink } = stats;

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <DashboardLayout title={t('tracking.details.title')} className="!bg-none !bg-transparent !h-auto">
        <div className="relative z-10 space-y-8 pb-8 py-8">

          {/* Header avec retour */}
          <div className="flex items-center gap-4">
            <Button
              onClick={() => router.push('/links#tracked')}
              variant="outline"
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              {t('tracking.details.backToLinks')}
            </Button>
          </div>

          {/* Hero Section - Info du lien */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-700 p-8 md:p-12 text-white shadow-2xl">
            <div className="absolute inset-0 bg-black/10"></div>
            <div className="relative z-10 space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-white/20 backdrop-blur-sm rounded-2xl">
                      <Link2 className="h-8 w-8" />
                    </div>
                    <div>
                      <h1 className="text-3xl md:text-4xl font-bold">{trackingLink.shortUrl}</h1>
                      <p className="text-blue-100 mt-1">Token: {trackingLink.token}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-lg">
                    <ExternalLink className="h-5 w-5" />
                    <a
                      href={trackingLink.originalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline break-all"
                    >
                      {trackingLink.originalUrl}
                    </a>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <Badge
                    className={`px-3 py-1.5 text-sm font-semibold ${
                      trackingLink.isActive
                        ? 'bg-green-500 hover:bg-green-600'
                        : 'bg-gray-400 hover:bg-gray-500'
                    }`}
                  >
                    {trackingLink.isActive ? (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        {t('status.active')}
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4 mr-2" />
                        {t('status.inactive')}
                      </>
                    )}
                  </Badge>
                  <Button
                    onClick={() => handleCopyLink(trackingLink.shortUrl)}
                    variant="secondary"
                    size="sm"
                    className="gap-2"
                  >
                    <Copy className="h-4 w-4" />
                    {t('tracking.details.copy')}
                  </Button>
                </div>
              </div>
            </div>
            {/* Decorative elements */}
            <div className="absolute -right-12 -bottom-12 w-48 h-48 bg-white/10 rounded-full blur-3xl"></div>
            <div className="absolute -left-12 -top-12 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl"></div>
          </div>

          {/* Stats principales */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="border-2 hover:border-primary/50 transition-all hover:shadow-lg bg-white dark:bg-gray-950">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">{t('tracking.stats.totalClicks')}</p>
                    <p className="text-3xl font-bold text-foreground">{trackingLink.totalClicks}</p>
                  </div>
                  <div className="p-4 bg-blue-100 dark:bg-blue-900/30 rounded-2xl">
                    <MousePointerClick className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-green-500/50 transition-all hover:shadow-lg bg-white dark:bg-gray-950">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">{t('tracking.stats.uniqueClicks')}</p>
                    <p className="text-3xl font-bold text-green-600 dark:text-green-400">{trackingLink.uniqueClicks}</p>
                  </div>
                  <div className="p-4 bg-green-100 dark:bg-green-900/30 rounded-2xl">
                    <Users className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-purple-500/50 transition-all hover:shadow-lg bg-white dark:bg-gray-950">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">{t('tracking.stats.conversionRate')}</p>
                    <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                      {trackingLink.totalClicks > 0
                        ? Math.round((trackingLink.uniqueClicks / trackingLink.totalClicks) * 100)
                        : 0}%
                    </p>
                  </div>
                  <div className="p-4 bg-purple-100 dark:bg-purple-900/30 rounded-2xl">
                    <TrendingUp className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-orange-500/50 transition-all hover:shadow-lg bg-white dark:bg-gray-950">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">{t('tracking.stats.lastClick')}</p>
                    <p className="text-lg font-bold text-orange-600 dark:text-orange-400">
                      {trackingLink.lastClickedAt ? formatDate(trackingLink.lastClickedAt) : t('tracking.stats.never')}
                    </p>
                  </div>
                  <div className="p-4 bg-orange-100 dark:bg-orange-900/30 rounded-2xl">
                    <Clock className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Graphes et données détaillées */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Clics par pays */}
            {stats.clicksByCountry && stats.clicksByCountry.length > 0 && (
              <Card className="border-2 bg-white dark:bg-gray-950">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    {t('tracking.details.clicksByCountry')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {stats.clicksByCountry.slice(0, 5).map((item, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <span className="text-sm font-medium">{item.country || t('tracking.details.unknown')}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-32 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-600"
                              style={{
                                width: `${(item.clicks / trackingLink.totalClicks) * 100}%`
                              }}
                            />
                          </div>
                          <span className="text-sm font-bold w-12 text-right">{item.clicks}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Clics par appareil */}
            {stats.clicksByDevice && stats.clicksByDevice.length > 0 && (
              <Card className="border-2 bg-white dark:bg-gray-950">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Smartphone className="h-5 w-5" />
                    {t('tracking.details.clicksByDevice')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {stats.clicksByDevice.map((item, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <span className="text-sm font-medium flex items-center gap-2">
                          {item.device === 'mobile' && <Smartphone className="h-4 w-4" />}
                          {item.device === 'desktop' && <Monitor className="h-4 w-4" />}
                          {item.device === 'tablet' && <Monitor className="h-4 w-4" />}
                          {item.device || t('tracking.details.unknown')}
                        </span>
                        <div className="flex items-center gap-2">
                          <div className="w-32 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-green-600"
                              style={{
                                width: `${(item.clicks / trackingLink.totalClicks) * 100}%`
                              }}
                            />
                          </div>
                          <span className="text-sm font-bold w-12 text-right">{item.clicks}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Top référents */}
            {stats.topReferrers && stats.topReferrers.length > 0 && (
              <Card className="border-2 bg-white dark:bg-gray-950">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    {t('tracking.details.topReferrers')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {stats.topReferrers.slice(0, 5).map((item, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <span className="text-sm font-medium truncate flex-1">{item.referrer || t('tracking.details.direct')}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-purple-600"
                              style={{
                                width: `${(item.clicks / trackingLink.totalClicks) * 100}%`
                              }}
                            />
                          </div>
                          <span className="text-sm font-bold w-12 text-right">{item.clicks}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Clics par navigateur */}
            {stats.clicksByBrowser && stats.clicksByBrowser.length > 0 && (
              <Card className="border-2 bg-white dark:bg-gray-950">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    {t('tracking.details.clicksByBrowser')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {stats.clicksByBrowser.slice(0, 5).map((item, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <span className="text-sm font-medium">{item.browser || t('tracking.details.unknown')}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-32 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-orange-600"
                              style={{
                                width: `${(item.clicks / trackingLink.totalClicks) * 100}%`
                              }}
                            />
                          </div>
                          <span className="text-sm font-bold w-12 text-right">{item.clicks}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Histogramme des clics */}
          {stats.clicksByDate && stats.clicksByDate.length > 0 && (
            <Card className="border-2 bg-white dark:bg-gray-950">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  {t('tracking.details.clicksByDate')}
                </CardTitle>
                <CardDescription>{t('tracking.details.evolutionOverTime')}</CardDescription>
              </CardHeader>
              <CardContent>
                {/* Histogramme */}
                <div className="space-y-6">
                  {/* Légende */}
                  <div className="flex items-center gap-6 justify-center">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-blue-600 rounded"></div>
                      <span className="text-sm font-medium">{t('tracking.stats.totalClicks')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-green-600 rounded"></div>
                      <span className="text-sm font-medium">{t('tracking.stats.uniqueClicks')}</span>
                    </div>
                  </div>

                  {/* Graphe */}
                  <div className="relative">
                    {/* Grille horizontale */}
                    <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="border-t border-gray-200 dark:border-gray-700"></div>
                      ))}
                    </div>

                    {/* Barres */}
                    <div className="relative flex items-end justify-between gap-2 h-64 pt-4">
                      {stats.clicksByDate.slice(-14).map((item, index) => {
                        const maxClicks = Math.max(...stats.clicksByDate.slice(-14).map(d => d.clicks));
                        const totalHeight = (item.clicks / (maxClicks || 1)) * 100;
                        const uniqueHeight = (item.uniqueClicks / (maxClicks || 1)) * 100;

                        return (
                          <div key={index} className="flex-1 flex flex-col items-center gap-2">
                            {/* Barres empilées */}
                            <div className="w-full flex flex-col items-center justify-end h-full gap-1 group relative">
                              <div
                                className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-md transition-all hover:from-blue-700 hover:to-blue-500 cursor-pointer"
                                style={{ height: `${totalHeight}%`, minHeight: item.clicks > 0 ? '4px' : '0' }}
                              >
                                {/* Tooltip au survol */}
                                <div className="hidden group-hover:block absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-10">
                                  <div className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-3 py-2 rounded-lg shadow-lg text-xs whitespace-nowrap">
                                    <div className="font-bold">{formatDate(item.date)}</div>
                                    <div className="text-blue-400 dark:text-blue-600">{item.clicks} clics</div>
                                    <div className="text-green-400 dark:text-green-600">{item.uniqueClicks} uniques</div>
                                  </div>
                                </div>
                              </div>
                              {item.uniqueClicks > 0 && (
                                <div
                                  className="w-3/4 bg-gradient-to-t from-green-600 to-green-400 rounded-t-md transition-all hover:from-green-700 hover:to-green-500"
                                  style={{ height: `${uniqueHeight}%`, minHeight: '4px', position: 'absolute', bottom: 0 }}
                                ></div>
                              )}
                            </div>

                            {/* Date */}
                            <span className="text-xs font-medium text-muted-foreground rotate-45 origin-top-left mt-2 whitespace-nowrap">
                              {new Date(item.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Tableau récapitulatif */}
                  <div className="mt-6 pt-6 border-t">
                    <div className="grid grid-cols-1 gap-2">
                      {stats.clicksByDate.slice(-5).reverse().map((item, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-900 rounded">
                          <span className="text-sm font-medium">{formatDate(item.date)}</span>
                          <div className="flex items-center gap-4">
                            <span className="text-sm text-blue-600 font-bold">{item.clicks} clics</span>
                            <span className="text-sm text-green-600 font-bold">{item.uniqueClicks} uniques</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Informations du lien */}
          <Card className="border-2 bg-white dark:bg-gray-950">
            <CardHeader>
              <CardTitle>{t('tracking.details.linkInformation')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">{t('tracking.details.token')}</p>
                  <p className="text-lg font-bold">{trackingLink.token}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">{t('tracking.details.createdOn')}</p>
                  <p className="text-lg font-bold">{formatDate(trackingLink.createdAt)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">{t('tracking.details.shortUrl')}</p>
                  <p className="text-lg font-bold break-all">{trackingLink.shortUrl}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">{t('tracking.details.originalUrl')}</p>
                  <p className="text-lg font-bold break-all">{trackingLink.originalUrl}</p>
                </div>
              </div>
            </CardContent>
          </Card>

        </div>
      </DashboardLayout>

      {/* Footer */}
      <div className="relative z-20 mt-auto">
        <Footer />
      </div>
    </div>
  );
}
