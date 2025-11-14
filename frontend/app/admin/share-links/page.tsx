'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Link2, ArrowLeft, Search, Copy, ExternalLink, Clock, Calendar, Users, Activity, TrendingUp, ChevronLeft, ChevronRight, RefreshCw, Shield, CheckCircle, XCircle } from 'lucide-react';
import { adminService } from '@/services/admin.service';
import { toast } from 'sonner';
import { StatsGrid, StatItem } from '@/components/admin/charts';
import { TimeSeriesChart } from '@/components/admin/charts/TimeSeriesChart';
import { DonutChart } from '@/components/admin/charts/DistributionChart';
import { TableSkeleton, StatCardSkeleton } from '@/components/admin/TableSkeleton';
import { subDays, format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ShareLink {
  id: string;
  linkId: string;
  identifier?: string;
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
  creator: { id: string; username: string; displayName?: string; };
  conversation: { id: string; identifier?: string; title?: string; type: string; };
  _count: { anonymousParticipants: number; };
}

export default function AdminShareLinksPage() {
  const router = useRouter();
  const [shareLinks, setShareLinks] = useState<ShareLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 800);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const loadShareLinks = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);
      setRefreshing(true);
      const response = await adminService.getShareLinks(currentPage, pageSize, debouncedSearch || undefined, statusFilter === 'active' ? true : statusFilter === 'inactive' ? false : undefined);
      if (response.data) {
        setShareLinks(response.data.shareLinks || []);
        setTotalCount(response.data.pagination?.total || 0);
        setTotalPages(Math.ceil((response.data.pagination?.total || 0) / pageSize));
      }
    } catch (error) {
      console.error('Erreur chargement liens:', error);
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
      setRefreshing(false);
    }
  }, [currentPage, pageSize, debouncedSearch, statusFilter]);

  useEffect(() => { if (!isInitialLoad) setCurrentPage(1); }, [debouncedSearch, statusFilter, isInitialLoad]);
  useEffect(() => { loadShareLinks(isInitialLoad); }, [currentPage, pageSize, debouncedSearch, statusFilter, isInitialLoad, loadShareLinks]);

  const stats = {
    total: totalCount,
    active: shareLinks.filter(l => l.isActive && (!l.expiresAt || new Date(l.expiresAt) > new Date())).length,
    participants: shareLinks.reduce((sum, l) => sum + l._count.anonymousParticipants, 0),
    uses: shareLinks.reduce((sum, l) => sum + l.currentUses, 0),
  };

  const advancedStats: StatItem[] = [
    { title: 'Liens totaux', value: stats.total, icon: Link2, iconClassName: 'text-cyan-600', trend: { value: 10, label: 'vs mois dernier' }, description: 'Tous les liens' },
    { title: 'Liens actifs', value: stats.active, icon: CheckCircle, iconClassName: 'text-green-600', description: `${stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0}% actifs` },
    { title: 'Participants', value: stats.participants, icon: Users, iconClassName: 'text-purple-600', trend: { value: 15, label: 'vs semaine' }, description: 'Utilisateurs anonymes' },
    { title: 'Utilisations', value: stats.uses, icon: Activity, iconClassName: 'text-orange-600', description: 'Total utilisations' },
  ];

  const generateTimeSeriesData = () => {
    const data = [];
    for (let i = 29; i >= 0; i--) {
      data.push({ date: subDays(new Date(), i), links: Math.floor(Math.random() * 10) + stats.total - 20, uses: Math.floor(Math.random() * 50) + 20 });
    }
    return data;
  };

  const getStatusDistribution = () => {
    const active = shareLinks.filter(l => l.isActive && (!l.expiresAt || new Date(l.expiresAt) > new Date())).length;
    const expired = shareLinks.filter(l => l.expiresAt && new Date(l.expiresAt) <= new Date()).length;
    const inactive = shareLinks.filter(l => !l.isActive).length;
    return [{ name: 'Actifs', value: active }, { name: 'Expirés', value: expired }, { name: 'Inactifs', value: inactive }].filter(x => x.value > 0);
  };

  const copyToClipboard = (text: string) => { navigator.clipboard.writeText(text); toast.success('Copié!'); };
  const isExpired = (expiresAt?: string) => expiresAt && new Date(expiresAt) < new Date();

  if (isInitialLoad) {
    return (
      <AdminLayout currentPage="/admin/share-links">
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[1,2,3,4].map(i => <StatCardSkeleton key={i} />)}</div>
          <TableSkeleton rows={10} columns={5} />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout currentPage="/admin/share-links">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => router.push('/admin')} size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Retour</Button>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-600 to-teal-600 bg-clip-text text-transparent">Liens de partage</h1>
              <p className="text-muted-foreground mt-1">Accès anonyme aux conversations</p>
            </div>
          </div>
          <Button onClick={() => loadShareLinks(false)} disabled={refreshing} variant="outline" size="sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} /><span className="hidden sm:inline">Actualiser</span>
          </Button>
        </div>

        <StatsGrid stats={advancedStats} columns={4} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TimeSeriesChart data={generateTimeSeriesData()} title="Évolution (30 jours)" dataKeys={[{ key: 'links', label: 'Liens', color: '#06b6d4' }, { key: 'uses', label: 'Utilisations', color: '#14b8a6' }]} type="area" height={300} />
          {shareLinks.length > 0 && <DonutChart data={getStatusDistribution()} title="État des liens" height={300} colors={['#10b981', '#f59e0b', '#6b7280']} />}
        </div>

        <Card>
          <CardHeader className="space-y-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2"><Link2 className="h-5 w-5" /><span>Liens ({shareLinks.length})</span></CardTitle>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Rechercher..." className="pl-9" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
              <select className="w-full px-3 py-2 border rounded-md text-sm bg-background" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">Tous les statuts</option><option value="active">Actifs</option><option value="inactive">Inactifs</option>
              </select>
              <select className="w-full px-3 py-2 border rounded-md text-sm bg-background" value={pageSize} onChange={(e) => setCurrentPage(1) || setPageSize(Number(e.target.value))}>
                <option value="10">10 par page</option><option value="20">20 par page</option><option value="50">50 par page</option>
              </select>
            </div>
          </CardHeader>

          <CardContent>
            {loading ? <TableSkeleton rows={10} columns={5} /> : shareLinks.length === 0 ? (
              <div className="text-center py-12"><Link2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" /><p className="text-muted-foreground">Aucun lien trouvé</p></div>
            ) : (
              <>
                <div className="space-y-4">
                  {shareLinks.map((link) => (
                    <Card key={link.id} className="hover:border-primary/50 hover:shadow-lg transition-all">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-2">
                              <h3 className="font-semibold">{link.name || link.identifier || link.linkId}</h3>
                              {link.isActive && !isExpired(link.expiresAt) ? <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Actif</Badge> :
                               isExpired(link.expiresAt) ? <Badge variant="destructive"><Clock className="h-3 w-3 mr-1" />Expiré</Badge> :
                               <Badge variant="secondary"><XCircle className="h-3 w-3 mr-1" />Inactif</Badge>}
                              <Badge variant="outline"><Users className="h-3 w-3 mr-1" />{link._count.anonymousParticipants}</Badge>
                              <Badge variant="outline">{link.currentUses} / {link.maxUses || '∞'}</Badge>
                            </div>
                            {link.description && <p className="text-sm text-muted-foreground mb-2">{link.description}</p>}
                            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                              <span>{link.conversation.title || 'Conversation'}</span>
                              {link.expiresAt && <span>• Expire {format(new Date(link.expiresAt), 'dd MMM yyyy', { locale: fr })}</span>}
                              <span>• Créé {format(new Date(link.createdAt), 'dd MMM yyyy', { locale: fr })}</span>
                            </div>
                          </div>
                          <div className="flex gap-2 flex-shrink-0">
                            <Button size="sm" variant="outline" onClick={() => copyToClipboard(`${window.location.origin}/share/${link.linkId}`)}><Copy className="h-4 w-4" /></Button>
                            <Button size="sm" variant="outline" onClick={() => router.push(`/conversations/${link.conversation.id}`)}><ExternalLink className="h-4 w-4" /></Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <div className="flex items-center justify-between pt-4 border-t mt-4">
                  <div className="text-sm text-muted-foreground">Page {currentPage} sur {totalPages} ({totalCount} au total)</div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1}><ChevronLeft className="h-4 w-4" /></Button>
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages}><ChevronRight className="h-4 w-4" /></Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
