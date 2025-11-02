'use client';

import { useState, useEffect, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Footer } from '@/components/layout/Footer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Link2, 
  Search, 
  Calendar, 
  Users, 
  Activity,
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  Clock,
  Copy,
  BarChart,
  CheckCircle,
  XCircle,
  RefreshCw,
  MessageSquare,
  Plus,
  TrendingUp,
  AlertCircle,
  Zap,
  ExternalLink,
  MousePointerClick
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { buildApiUrl, API_ENDPOINTS } from '@/lib/config';
import type { TrackingLink } from '@shared/types/tracking-link';
import { useI18n } from '@/hooks/useI18n';

// Extended type for ConversationLink with all fields from Prisma
interface ConversationLink {
  id: string;
  linkId: string;
  identifier?: string;
  conversationId: string;
  name?: string;
  description?: string;
  maxUses?: number;
  currentUses: number;
  maxConcurrentUsers?: number;
  currentConcurrentUsers: number;
  expiresAt?: string;
  isActive: boolean;
  allowAnonymousMessages: boolean;
  allowAnonymousFiles: boolean;
  allowAnonymousImages: boolean;
  createdAt: string;
  conversation: {
    id: string;
    title?: string;
    type: string;
    description?: string;
  };
  creator?: {
    id: string;
    username: string;
    firstName?: string;
    lastName?: string;
    displayName?: string;
    avatar?: string;
  };
}
import { LinkDetailsModal } from '@/components/links/link-details-modal';
import { LinkEditModal } from '@/components/links/link-edit-modal';
import { TrackingLinkDetailsModal } from '@/components/links/tracking-link-details-modal';
import { CreateLinkButton } from '@/components/links/create-link-button';
import { CreateLinkModalV2 } from '@/components/conversations/create-link-modal';
import { CreateTrackingLinkModal } from '@/components/links/create-tracking-link-modal';
import { CreateConversationModal } from '@/components/conversations/create-conversation-modal';
import { copyToClipboard } from '@/lib/clipboard';
import { useUser } from '@/stores';
import { useRouter } from 'next/navigation';
import { getUserTrackingLinks, deleteTrackingLink, deactivateTrackingLink } from '@/services/tracking-links';
import { authManager } from '@/services/auth-manager.service';

export default function LinksPage() {
  const { t } = useI18n('links');
  const { t: tConversations } = useI18n('conversations');
  const user = useUser();
  const router = useRouter();
  const [links, setLinks] = useState<ConversationLink[]>([]);
  const [trackingLinks, setTrackingLinks] = useState<TrackingLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [mainTab, setMainTab] = useState<'shareLinks' | 'trackingLinks'>('shareLinks');
  const [selectedTab, setSelectedTab] = useState('active');
  const [selectedLink, setSelectedLink] = useState<ConversationLink | null>(null);
  const [selectedTrackingLink, setSelectedTrackingLink] = useState<TrackingLink | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showTrackingDetailsModal, setShowTrackingDetailsModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCreateConversationModal, setShowCreateConversationModal] = useState(false);
  const [showCreateLinkModal, setShowCreateLinkModal] = useState(false);
  const [showCreateTrackingLinkModal, setShowCreateTrackingLinkModal] = useState(false);

  // Synchroniser l'onglet avec le hash de l'URL
  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash === 'tracked') {
      setMainTab('trackingLinks');
    } else if (hash === 'shared') {
      setMainTab('shareLinks');
    }
  }, []);

  // Mettre à jour le hash quand l'onglet change
  const handleTabChange = (value: 'shareLinks' | 'trackingLinks') => {
    setMainTab(value);
    const hash = value === 'trackingLinks' ? 'tracked' : 'shared';
    window.history.pushState(null, '', `#${hash}`);
  };

  /**
   * Tronque le nom du lien à 32 caractères pour l'affichage dans la liste
   * Le nom complet est visible dans la modale de détails/édition
   */
  const truncateLinkName = (name: string, maxLength: number = 32): string => {
    if (name.length <= maxLength) {
      return name;
    }
    return name.substring(0, maxLength - 3) + '...';
  };

  // Charger les liens de partage
  const loadLinks = async () => {
    try {
      setIsLoading(true);
      const token = authManager.getAuthToken();

      // Charger les liens de partage
      const shareLinksResponse = await fetch(buildApiUrl('/api/links/my-links'), {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (shareLinksResponse.ok) {
        const data = await shareLinksResponse.json();
        setLinks(data.data || []);
      } else {
        toast.error(t('errors.loadFailed'));
      }

      // Charger aussi les liens trackés
      await loadTrackingLinks();
    } catch (error) {
      console.error('Erreur lors du chargement des liens:', error);
      toast.error(t('errors.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  // Charger uniquement les liens trackés
  const loadTrackingLinks = async () => {
    try {
      const trackingLinksData = await getUserTrackingLinks();
      console.log('[Links Page] Tracking links chargés:', trackingLinksData.length, trackingLinksData);
      setTrackingLinks(trackingLinksData);
    } catch (error) {
      console.error('[Links Page] Erreur lors du chargement des liens trackés:', error);
      // Ne pas afficher d'erreur si c'est juste les liens trackés qui échouent
      setTrackingLinks([]); // S'assurer que trackingLinks est un tableau vide en cas d'erreur
    }
  };

  useEffect(() => {
    loadLinks();
  }, []);

  // Calculer les statistiques
  const stats = useMemo(() => {
    if (mainTab === 'shareLinks') {
      const activeLinks = links.filter(link => 
        link.isActive && (!link.expiresAt || new Date(link.expiresAt) > new Date())
      );
      const expiredLinks = links.filter(link => 
        link.expiresAt && new Date(link.expiresAt) <= new Date()
      );
      const totalUses = links.reduce((sum, link) => sum + (link.currentUses || 0), 0);
      const totalActiveUsers = links.reduce((sum, link) => sum + (link.currentConcurrentUsers || 0), 0);
      
      return {
        total: links.length,
        active: activeLinks.length,
        expired: expiredLinks.length,
        totalUses,
        totalActiveUsers
      };
    } else {
      // Stats pour tracking links
      const activeLinks = trackingLinks.filter(link => link.isActive);
      const totalClicks = trackingLinks.reduce((sum, link) => sum + link.totalClicks, 0);
      const uniqueClicks = trackingLinks.reduce((sum, link) => sum + link.uniqueClicks, 0);
      
      return {
        total: trackingLinks.length,
        active: activeLinks.length,
        totalClicks,
        uniqueClicks
      };
    }
  }, [links, trackingLinks, mainTab]);

  // Filtrer les liens
  const filteredLinks = links.filter(link => {
    const matchesSearch = link.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         link.conversation.title?.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (selectedTab === 'active') {
      return matchesSearch && link.isActive && (!link.expiresAt || new Date(link.expiresAt) > new Date());
    } else if (selectedTab === 'expired') {
      return matchesSearch && link.expiresAt && new Date(link.expiresAt) <= new Date();
    } else if (selectedTab === 'disabled') {
      return matchesSearch && !link.isActive;
    }
    
    return matchesSearch;
  });

  // Copier le lien
  const handleCopyLink = async (linkId: string) => {
    const linkUrl = `${window.location.origin}/join/${linkId}`;
    const result = await copyToClipboard(linkUrl);
    if (result.success) {
      toast.success(t('success.linkCopied'));
    } else {
      toast.error(result.message);
    }
  };

  const handleConversationCreated = (conversationId: string) => {
    toast.success(tConversations('conversationCreated'));
    router.push(`/conversations/${conversationId}`);
  };

  const handleLinkCreated = () => {
    toast.success(t('success.linkCreated'));
    loadLinks(); // Recharger la liste des liens
  };

  // Basculer l'état actif/inactif
  const handleToggleActive = async (link: ConversationLink) => {
    try {
      const token = authManager.getAuthToken();
      const response = await fetch(buildApiUrl(`/api/links/${link.linkId}/toggle`), {
        method: 'PATCH',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isActive: !link.isActive })
      });

      if (response.ok) {
        toast.success(link.isActive ? t('success.linkDisabled') : t('success.linkEnabled'));
        loadLinks();
      } else {
        toast.error(t('errors.toggleFailed'));
      }
    } catch (error) {
      console.error('Erreur lors du basculement:', error);
      toast.error(t('errors.toggleFailed'));
    }
  };

  // Prolonger la durée
  const handleExtendDuration = async (link: ConversationLink, days: number) => {
    try {
      const token = authManager.getAuthToken();
      const newExpiresAt = new Date(link.expiresAt || new Date());
      newExpiresAt.setDate(newExpiresAt.getDate() + days);

      const response = await fetch(buildApiUrl(`/api/links/${link.linkId}/extend`), {
        method: 'PATCH',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ expiresAt: newExpiresAt.toISOString() })
      });

      if (response.ok) {
        toast.success(t('success.linkExtended', { days }));
        loadLinks();
      } else {
        toast.error(t('errors.extendFailed'));
      }
    } catch (error) {
      console.error('Erreur lors de la prolongation:', error);
      toast.error(t('errors.extendFailed'));
    }
  };

  // Supprimer un lien
  const handleDeleteLink = async (link: ConversationLink) => {
    if (!confirm(t('confirm.delete'))) return;

    try {
      const token = authManager.getAuthToken();
      const response = await fetch(buildApiUrl(`/api/links/${link.linkId}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        toast.success(t('success.linkDeleted'));
        loadLinks();
      } else {
        toast.error(t('errors.deleteFailed'));
      }
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      toast.error(t('errors.deleteFailed'));
    }
  };

  // Copier un lien tracké
  const handleCopyTrackingLink = async (shortUrl: string) => {
    // Ajouter le domaine complet si shortUrl commence par /
    const fullUrl = shortUrl.startsWith('/')
      ? `${window.location.origin}${shortUrl}`
      : shortUrl;

    const result = await copyToClipboard(fullUrl);
    if (result.success) {
      toast.success(t('tracking.success.copied'));
    } else {
      toast.error(result.message);
    }
  };

  // Désactiver/activer un lien tracké
  const handleToggleTrackingLink = async (link: TrackingLink) => {
    try {
      if (link.isActive) {
        await deactivateTrackingLink(link.token);
        toast.success(t('tracking.success.deactivated'));
      } else {
        // Pour réactiver, on devrait avoir une route activate, pour l'instant on peut juste désactiver
        toast.info(t('activationNotImplemented'));
      }
      loadLinks();
    } catch (error) {
      console.error('Erreur lors du basculement:', error);
      toast.error(t('tracking.errors.deactivateFailed'));
    }
  };

  // Supprimer un lien tracké
  const handleDeleteTrackingLink = async (link: TrackingLink) => {
    if (!confirm(t('confirm.delete'))) return;

    try {
      await deleteTrackingLink(link.token);
      toast.success(t('tracking.success.deleted'));
      loadLinks();
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      toast.error(t('tracking.errors.deleteFailed'));
    }
  };

  // Formater la date
  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Calculer le temps restant
  const getTimeRemaining = (expiresAt: string | Date) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diff = expiry.getTime() - now.getTime();
    
    if (diff <= 0) return t('status.expired');
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return t('status.daysRemaining', { days });
    return t('status.hoursRemaining', { hours });
  };

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Main content area - scrollable */}
      <DashboardLayout title={t('title')} className="!bg-none !bg-transparent !h-auto">
        <div className="relative z-10 space-y-8 pb-8 py-8">

        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 p-8 md:p-12 text-white shadow-2xl">
          <div className="absolute inset-0 bg-black/10"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-white/20 backdrop-blur-sm rounded-2xl">
                <Link2 className="h-8 w-8" />
              </div>
              <h1 className="text-4xl md:text-5xl font-bold">{t('title')}</h1>
            </div>
            <p className="text-lg md:text-xl text-blue-100 max-w-2xl">
              {t('subtitle')}
            </p>
          </div>
          {/* Decorative elements */}
          <div className="absolute -right-12 -bottom-12 w-48 h-48 bg-white/10 rounded-full blur-3xl"></div>
          <div className="absolute -left-12 -top-12 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl"></div>
        </div>

        {/* Section 1: Main Tab Selector + Stats + Search */}
        <Card className="border-2 shadow-lg bg-white dark:bg-gray-950">
          <CardContent className="p-6 space-y-6">
            {/* Tabs */}
            <Tabs value={mainTab} onValueChange={(value) => handleTabChange(value as 'shareLinks' | 'trackingLinks')}>
              <TabsList className="w-full grid grid-cols-2 h-auto p-1.5 bg-gray-100 dark:bg-gray-800">
                <TabsTrigger
                  value="shareLinks"
                  id="shared"
                  className="data-[state=active]:bg-blue-500 data-[state=active]:text-white py-3 px-6 rounded-lg font-medium transition-all"
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  {t('tabs.shareLinks')}
                </TabsTrigger>
                <TabsTrigger
                  value="trackingLinks"
                  id="tracked"
                  className="data-[state=active]:bg-purple-500 data-[state=active]:text-white py-3 px-6 rounded-lg font-medium transition-all"
                >
                  <BarChart className="h-4 w-4 mr-2" />
                  {t('tabs.trackingLinks')}
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Stats in 2x2 grid */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">{t('stats.totalLinks')}</p>
                <p className="text-2xl font-bold text-foreground">{stats.total}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">{t('tracking.stats.activeLinks')}</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.active}</p>
              </div>
              {mainTab === 'shareLinks' ? (
                <>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">{t('stats.uses')}</p>
                    <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{stats.totalUses}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">{t('details.activeUsers')}</p>
                    <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{stats.totalActiveUsers}</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">{t('tracking.stats.totalClicks')}</p>
                    <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{stats.totalClicks}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">{t('tracking.stats.uniqueClicks')}</p>
                    <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{stats.uniqueClicks}</p>
                  </div>
                </>
              )}
            </div>

            {/* Search and Actions */}
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  type="text"
                  placeholder={t('searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-12 text-base border-2 focus:border-primary"
                />
              </div>

              <Button
                onClick={() => mainTab === 'shareLinks' ? setShowCreateLinkModal(true) : setShowCreateTrackingLinkModal(true)}
                variant="default"
                className="h-12 rounded-xl px-6 font-semibold shadow-md hover:shadow-lg transition-all bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
              >
                <Plus className="h-5 w-5 mr-2" />
                <span>{t('createLink')}</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Section 2: List of links */}
        {mainTab === 'shareLinks' ? (
          <div className="space-y-6">
            {isLoading ? (
              <Card className="border-2 bg-white dark:bg-gray-950">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <div className="relative">
                    <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-200 border-t-primary"></div>
                    <Zap className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 h-6 w-6 text-primary" />
                  </div>
                  <p className="mt-4 text-muted-foreground font-medium">{t('loadingLinks')}</p>
                </CardContent>
              </Card>
            ) : filteredLinks.length === 0 ? (
              <Card className="border-2 border-dashed border-gray-300 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
                <CardContent className="flex flex-col items-center justify-center py-16 px-6">
                  <div className="relative mb-6">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 blur-3xl rounded-full"></div>
                    <div className="relative p-6 bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-3xl">
                      <Link2 className="h-16 w-16 text-blue-600 dark:text-blue-400" />
                    </div>
                  </div>
                  
                  <h3 className="text-2xl font-bold text-foreground mb-3 text-center">
                    {searchQuery ? t('noLinksFound') : t('tracking.noLinks')}
                  </h3>
                  <p className="text-muted-foreground text-base text-center max-w-md">
                    {searchQuery
                      ? t('noLinksFoundTryAnother')
                      : t('noLinksFoundCreateFirst')
                    }
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6">
                {filteredLinks.map((link) => (
                  <Card key={link.id} className="relative border-2 hover:border-primary/50 hover:shadow-xl transition-all duration-200 overflow-hidden group bg-white dark:bg-gray-950">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-0"></div>

                    <CardContent className="relative z-10 p-4 sm:p-6">
                      {/* Contenu principal */}
                      <div className="flex items-start space-x-3 sm:space-x-4">
                        <div className="p-2 sm:p-2.5 bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-xl flex-shrink-0">
                          <Link2 className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400" />
                        </div>

                        <div className="flex-1 min-w-0">
                          {/* Titre avec Badge et Menu alignés */}
                          <div className="flex items-start justify-between gap-2 mb-1">
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

                            {/* Badge et Menu alignés avec le titre */}
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
                                  <DropdownMenuItem onClick={() => handleCopyLink(link.linkId)} className="py-3">
                                    <Copy className="h-4 w-4 mr-3" />
                                    <span className="font-medium">{t('actions.copy')}</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => {
                                    setSelectedLink(link);
                                    setShowDetailsModal(true);
                                  }} className="py-3">
                                    <Eye className="h-4 w-4 mr-3" />
                                    <span className="font-medium">{t('actions.viewDetails')}</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => {
                                    setSelectedLink(link);
                                    setShowEditModal(true);
                                  }} className="py-3">
                                    <Edit className="h-4 w-4 mr-3" />
                                    <span className="font-medium">{t('actions.edit')}</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleToggleActive(link)} className="py-3">
                                    {link.isActive ? (
                                      <>
                                        <XCircle className="h-4 w-4 mr-3" />
                                        <span className="font-medium">{t('actions.disable')}</span>
                                      </>
                                    ) : (
                                      <>
                                        <CheckCircle className="h-4 w-4 mr-3" />
                                        <span className="font-medium">{t('actions.enable')}</span>
                                      </>
                                    )}
                                  </DropdownMenuItem>
                                  {link.expiresAt && (
                                    <DropdownMenuItem onClick={() => handleExtendDuration(link, 7)} className="py-3">
                                      <RefreshCw className="h-4 w-4 mr-3" />
                                      <span className="font-medium">{t('actions.extend7Days')}</span>
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem
                                    onClick={() => handleDeleteLink(link)}
                                    className="text-red-600 py-3 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-900/20"
                                  >
                                    <Trash2 className="h-4 w-4 mr-3" />
                                    <span className="font-medium">{t('actions.delete')}</span>
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                          <div className="flex items-start gap-2 text-xs sm:text-sm mb-2 sm:mb-3">
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

                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                            <div className="flex items-center space-x-2 flex-shrink-0">
                              <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-400 flex-shrink-0" />
                              <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 font-medium">
                                {link.currentUses} / {link.maxUses || '∞'} {t('stats.uses')}
                              </span>
                            </div>

                            <div className="flex items-center space-x-2 flex-shrink-0">
                              <Activity className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-400 flex-shrink-0" />
                              <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 font-medium">
                                {link.currentConcurrentUsers} {t('stats.active')}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Tracking Links Content */
          <div className="space-y-6">
            {(() => {
              console.log('[Links Page] Render tracking links:', { isLoading, trackingLinksCount: trackingLinks.length });
              return null;
            })()}
            {isLoading ? (
              <Card className="border-2 bg-white dark:bg-gray-950">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <div className="relative">
                    <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-200 border-t-primary"></div>
                    <Zap className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 h-6 w-6 text-primary" />
                  </div>
                  <p className="mt-4 text-muted-foreground font-medium">{t('loadingTrackingLinks')}</p>
                </CardContent>
              </Card>
            ) : trackingLinks.length === 0 ? (
              <Card className="border-2 border-dashed border-gray-300 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
                <CardContent className="flex flex-col items-center justify-center py-16 px-6">
                  <div className="relative mb-6">
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-blue-500/20 blur-3xl rounded-full"></div>
                    <div className="relative p-6 bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900/30 dark:to-blue-900/30 rounded-3xl">
                      <BarChart className="h-16 w-16 text-purple-600 dark:text-purple-400" />
                    </div>
                  </div>
                  
                  <h3 className="text-2xl font-bold text-foreground mb-3 text-center">
                    {t('tracking.noLinks')}
                  </h3>
                  <p className="text-muted-foreground text-base text-center max-w-md">
                    {t('tracking.noLinksDescription')}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6">
                {trackingLinks
                  .filter(link =>
                    link.originalUrl.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    link.shortUrl.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map((link) => (
                    <Card key={link.id} className="relative border-2 hover:border-purple-500/50 hover:shadow-xl transition-all duration-200 overflow-hidden group bg-white dark:bg-gray-950">
                      <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-0"></div>

                      <CardContent className="relative z-10 p-4 sm:p-6">
                        {/* Contenu principal */}
                        <div className="flex items-start space-x-3 sm:space-x-4">
                          <div className="p-2 sm:p-2.5 bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900/30 dark:to-blue-900/30 rounded-xl flex-shrink-0">
                            <BarChart className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600 dark:text-purple-400" />
                          </div>

                          <div className="flex-1 min-w-0">
                            {/* Titre avec Badge et Menu alignés */}
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <h3 className="text-base sm:text-xl font-bold text-gray-900 dark:text-white break-words flex-1">
                                <button
                                  onClick={() => router.push(`/links/tracked/${link.token}`)}
                                  className="text-foreground hover:text-primary transition-colors cursor-pointer text-left"
                                >
                                  {link.shortUrl.startsWith('/')
                                    ? `${typeof window !== 'undefined' ? window.location.origin : ''}${link.shortUrl}`
                                    : link.shortUrl}
                                </button>
                              </h3>

                              {/* Badge et Menu alignés avec le titre */}
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
                                    <DropdownMenuItem onClick={() => handleCopyTrackingLink(link.shortUrl)} className="py-3">
                                      <Copy className="h-4 w-4 mr-3" />
                                      <span className="font-medium">{t('tracking.actions.copyShortUrl')}</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => {
                                      setSelectedTrackingLink(link);
                                      setShowTrackingDetailsModal(true);
                                    }} className="py-3">
                                      <BarChart className="h-4 w-4 mr-3" />
                                      <span className="font-medium">{t('tracking.actions.viewStats')}</span>
                                    </DropdownMenuItem>
                                    {link.isActive && (
                                      <DropdownMenuItem onClick={() => handleToggleTrackingLink(link)} className="py-3">
                                        <XCircle className="h-4 w-4 mr-3" />
                                        <span className="font-medium">{t('tracking.actions.deactivate')}</span>
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem
                                      onClick={() => handleDeleteTrackingLink(link)}
                                      className="text-red-600 py-3 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-900/20"
                                    >
                                      <Trash2 className="h-4 w-4 mr-3" />
                                      <span className="font-medium">{t('actions.delete')}</span>
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
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

                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
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
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* Modales */}
        {selectedLink && (
          <>
            <LinkDetailsModal
              link={selectedLink}
              isOpen={showDetailsModal}
              onClose={() => {
                setShowDetailsModal(false);
                setSelectedLink(null);
              }}
            />
            <LinkEditModal
              link={selectedLink}
              isOpen={showEditModal}
              onClose={() => {
                setShowEditModal(false);
                setSelectedLink(null);
              }}
              onUpdate={() => {
                loadLinks();
                setShowEditModal(false);
                setSelectedLink(null);
              }}
            />
          </>
        )}

        {/* Tracking Link Details Modal */}
        {selectedTrackingLink && (
          <TrackingLinkDetailsModal
            link={selectedTrackingLink}
            isOpen={showTrackingDetailsModal}
            onClose={() => {
              setShowTrackingDetailsModal(false);
              setSelectedTrackingLink(null);
            }}
          />
        )}

        {/* Modales de création */}
        {user && (
          <CreateConversationModal
            isOpen={showCreateConversationModal}
            onClose={() => setShowCreateConversationModal(false)}
            currentUser={user}
            onConversationCreated={handleConversationCreated}
          />
        )}

        {/* Modal de création de share link */}
        <CreateLinkModalV2
          isOpen={showCreateLinkModal}
          onClose={() => setShowCreateLinkModal(false)}
          onLinkCreated={loadLinks}
        />

        {/* Modal de création de tracking link */}
        <CreateTrackingLinkModal
          isOpen={showCreateTrackingLinkModal}
          onClose={() => setShowCreateTrackingLinkModal(false)}
          onLinkCreated={loadTrackingLinks}
        />
        </div>
      </DashboardLayout>

      {/* Footer - En bas de la page, prend toute la largeur */}
      <div className="relative z-20 mt-auto">
        <Footer />
      </div>
    </div>
  );
}