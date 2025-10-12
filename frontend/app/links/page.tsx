'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
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
  Plus
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { buildApiUrl, API_ENDPOINTS } from '@/lib/config';
import { ConversationLink } from '@/types';
import { useI18n } from '@/hooks/useI18n';
import { LinkDetailsModal } from '@/components/links/link-details-modal';
import { LinkEditModal } from '@/components/links/link-edit-modal';
import { CreateLinkButton } from '@/components/links/create-link-button';
import { CreateConversationModal } from '@/components/conversations/create-conversation-modal';
import { copyToClipboard } from '@/lib/clipboard';
import { useUser } from '@/stores';
import { useRouter } from 'next/navigation';

export default function LinksPage() {
  const { t } = useI18n('links');
  const { t: tConversations } = useI18n('conversations');
  const user = useUser();
  const router = useRouter();
  const [links, setLinks] = useState<ConversationLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState('active');
  const [selectedLink, setSelectedLink] = useState<ConversationLink | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCreateConversationModal, setShowCreateConversationModal] = useState(false);

  // Charger les liens
  const loadLinks = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('auth_token');
      const response = await fetch(buildApiUrl('/api/links/my-links'), {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setLinks(data.data || []);
      } else {
        toast.error(t('errors.loadFailed'));
      }
    } catch (error) {
      console.error('Erreur lors du chargement des liens:', error);
      toast.error(t('errors.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLinks();
  }, []);

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
      const token = localStorage.getItem('auth_token');
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
      const token = localStorage.getItem('auth_token');
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
      const token = localStorage.getItem('auth_token');
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
    <DashboardLayout title={t('title')}>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header avec recherche */}
        <Card>
          <CardContent className="p-6">
            <form className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder={t('searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <p className="text-sm text-gray-600">
                    {filteredLinks.length} lien{filteredLinks.length !== 1 ? 's' : ''} trouvé{filteredLinks.length !== 1 ? 's' : ''}
                  </p>
                </div>
                
                <CreateLinkButton
                  onLinkCreated={handleLinkCreated}
                  variant="outline"
                  className="rounded-2xl px-6 py-3 border-2 border-primary/20 hover:border-primary/40 font-semibold shadow-md hover:shadow-lg transition-all"
                >
                  <Link2 className="h-5 w-5 mr-2" />
                  <span>{t('createLink')}</span>
                </CreateLinkButton>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Onglets */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList>
            <TabsTrigger value="active">{t('tabs.active')}</TabsTrigger>
            <TabsTrigger value="expired">{t('tabs.expired')}</TabsTrigger>
            <TabsTrigger value="disabled">{t('tabs.disabled')}</TabsTrigger>
          </TabsList>

          <TabsContent value={selectedTab} className="space-y-4 mt-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : filteredLinks.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <div className="mb-6">
                    <Link2 className="h-12 w-12 text-primary mx-auto mb-4" />
                  </div>
                  
                  <h3 className="text-xl font-bold text-foreground mb-2 text-center">{tConversations('chooseConversation')}</h3>
                  <p className="text-muted-foreground text-base mb-6 text-center">
                    {tConversations('chooseConversationDescription')}
                  </p>
                  
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button
                      onClick={() => setShowCreateConversationModal(true)}
                      className="rounded-2xl px-6 py-3 bg-primary hover:bg-primary/90 text-white font-semibold shadow-md hover:shadow-lg transition-all"
                    >
                      <MessageSquare className="h-5 w-5 mr-2" />
                      {tConversations('createConversation')}
                    </Button>
                    <CreateLinkButton
                      onLinkCreated={handleLinkCreated}
                      variant="outline"
                      className="rounded-2xl px-6 py-3 border-2 border-primary/20 hover:border-primary/40 font-semibold shadow-md hover:shadow-lg transition-all text-primary hover:text-primary-foreground hover:bg-primary"
                    >
                      <Link2 className="h-5 w-5 mr-2" />
                      {t('createLink')}
                    </CreateLinkButton>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {filteredLinks.map((link) => (
                  <Card key={link.id} className="hover:shadow-md transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="text-lg flex items-center gap-2">
                            <Link2 className="h-4 w-4" />
                            {link.name || t('unnamedLink')}
                          </CardTitle>
                          <CardDescription>
                            {t('conversation')}: 
                            <a 
                              href={link.conversation.conversationUrl} 
                              className="text-primary hover:underline ml-1"
                              onClick={(e) => {
                                e.preventDefault();
                                window.location.href = link.conversation.conversationUrl;
                              }}
                            >
                              {link.conversation.title}
                            </a>
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={link.isActive ? 'default' : 'secondary'}>
                            {link.isActive ? t('status.active') : t('status.inactive')}
                          </Badge>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleCopyLink(link.linkId)}>
                                <Copy className="h-4 w-4 mr-2" />
                                {t('actions.copy')}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                setSelectedLink(link);
                                setShowDetailsModal(true);
                              }}>
                                <Eye className="h-4 w-4 mr-2" />
                                {t('actions.viewDetails')}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                setSelectedLink(link);
                                setShowEditModal(true);
                              }}>
                                <Edit className="h-4 w-4 mr-2" />
                                {t('actions.edit')}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleToggleActive(link)}>
                                {link.isActive ? (
                                  <>
                                    <XCircle className="h-4 w-4 mr-2" />
                                    {t('actions.disable')}
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                    {t('actions.enable')}
                                  </>
                                )}
                              </DropdownMenuItem>
                              {link.expiresAt && (
                                <DropdownMenuItem onClick={() => handleExtendDuration(link, 7)}>
                                  <RefreshCw className="h-4 w-4 mr-2" />
                                  {t('actions.extend7Days')}
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem 
                                onClick={() => handleDeleteLink(link)}
                                className="text-red-600"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                {t('actions.delete')}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <div className="flex items-center gap-1 text-muted-foreground mb-1">
                            <Users className="h-3 w-3" />
                            {t('stats.uses')}
                          </div>
                          <p className="font-medium">
                            {link.currentUses} / {link.maxUses || '∞'}
                          </p>
                        </div>
                        <div>
                          <div className="flex items-center gap-1 text-muted-foreground mb-1">
                            <Activity className="h-3 w-3" />
                            {t('stats.active')}
                          </div>
                          <p className="font-medium">{link.currentConcurrentUsers}</p>
                        </div>
                        <div>
                          <div className="flex items-center gap-1 text-muted-foreground mb-1">
                            <Calendar className="h-3 w-3" />
                            {t('stats.created')}
                          </div>
                          <p className="font-medium">{formatDate(link.createdAt)}</p>
                        </div>
                        <div>
                          <div className="flex items-center gap-1 text-muted-foreground mb-1">
                            <Clock className="h-3 w-3" />
                            {t('stats.expires')}
                          </div>
                          <p className="font-medium">
                            {link.expiresAt ? getTimeRemaining(link.expiresAt) : t('status.never')}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

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

        {/* Modales de création */}

        {user && (
          <CreateConversationModal
            isOpen={showCreateConversationModal}
            onClose={() => setShowCreateConversationModal(false)}
            currentUser={user}
            onConversationCreated={handleConversationCreated}
          />
        )}
      </div>
    </DashboardLayout>
  );
}