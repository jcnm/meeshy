'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  MessageSquare,
  ArrowLeft,
  Search,
  Filter,
  Calendar,
  User,
  Globe,
  FileText,
  Image as ImageIcon,
  Video,
  Music,
  MapPin,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Activity,
  TrendingUp,
  Languages,
  MessageCircle,
  Eye,
  Shield
} from 'lucide-react';
import { adminService } from '@/services/admin.service';
import { toast } from 'sonner';
import { StatsGrid, StatItem } from '@/components/admin/charts';
import { TimeSeriesChart } from '@/components/admin/charts/TimeSeriesChart';
import { DonutChart } from '@/components/admin/charts/DistributionChart';
import { SensitiveText } from '@/components/admin/privacy/SensitiveText';
import { TableSkeleton, StatCardSkeleton } from '@/components/admin/TableSkeleton';
import { subDays, format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Message {
  id: string;
  content: string;
  messageType: string;
  originalLanguage: string;
  isEdited: boolean;
  createdAt: string;
  sender?: {
    id: string;
    username: string;
    displayName?: string;
    avatar?: string;
  };
  anonymousSender?: {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
  };
  conversation: {
    id: string;
    identifier?: string;
    title?: string;
    type: string;
  };
  _count: {
    translations: number;
    replies: number;
  };
}

export default function AdminMessagesPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [messageType, setMessageType] = useState('');
  const [period, setPeriod] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  // Debounce pour la recherche
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 800);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const messageTypeIcons = {
    text: FileText,
    image: ImageIcon,
    file: FileText,
    audio: Music,
    video: Video,
    location: MapPin,
    system: Globe
  };

  const messageTypeLabels = {
    text: 'Texte',
    image: 'Image',
    file: 'Fichier',
    audio: 'Audio',
    video: 'Vidéo',
    location: 'Localisation',
    system: 'Système'
  };

  const loadMessages = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);
      setRefreshing(true);

      const response = await adminService.getMessages(
        currentPage,
        pageSize,
        debouncedSearch || undefined,
        messageType || undefined,
        period || undefined
      );

      if (response.data) {
        setMessages(response.data.messages || []);
        setTotalCount(response.data.pagination?.total || 0);
        setTotalPages(Math.ceil((response.data.pagination?.total || 0) / pageSize));
      } else {
        setMessages([]);
        setTotalCount(0);
        setTotalPages(1);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des messages:', error);
      toast.error('Erreur lors du chargement des messages');
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
      setRefreshing(false);
    }
  }, [currentPage, pageSize, debouncedSearch, messageType, period]);

  // Réinitialiser la page à 1 quand les filtres changent
  useEffect(() => {
    if (!isInitialLoad) {
      setCurrentPage(1);
    }
  }, [debouncedSearch, messageType, period, isInitialLoad]);

  // Charger les données
  useEffect(() => {
    loadMessages(isInitialLoad);
  }, [currentPage, pageSize, debouncedSearch, messageType, period, isInitialLoad, loadMessages]);

  // Calcul des statistiques
  const stats = {
    total: totalCount,
    textMessages: messages.filter(m => m.messageType === 'text').length,
    translations: messages.reduce((sum, m) => sum + m._count.translations, 0),
    replies: messages.reduce((sum, m) => sum + m._count.replies, 0),
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'dd MMM yyyy à HH:mm', { locale: fr });
    } catch {
      return 'N/A';
    }
  };

  const formatRelativeDate = (dateString: string) => {
    try {
      const d = new Date(dateString);
      const now = new Date();
      const diffInSeconds = Math.floor((now.getTime() - d.getTime()) / 1000);

      if (diffInSeconds < 60) return 'À l\'instant';
      if (diffInSeconds < 3600) return `Il y a ${Math.floor(diffInSeconds / 60)}min`;
      if (diffInSeconds < 86400) return `Il y a ${Math.floor(diffInSeconds / 3600)}h`;
      if (diffInSeconds < 2592000) return `Il y a ${Math.floor(diffInSeconds / 86400)}j`;

      return formatDate(dateString);
    } catch {
      return 'N/A';
    }
  };

  const getMessageTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      text: 'bg-blue-500',
      image: 'bg-green-500',
      file: 'bg-gray-500',
      audio: 'bg-purple-500',
      video: 'bg-red-500',
      location: 'bg-yellow-500',
      system: 'bg-orange-500'
    };
    return colors[type] || 'bg-gray-500';
  };

  // Générer données temporelles (mock - à remplacer par vraies données)
  const generateTimeSeriesData = () => {
    const data = [];
    for (let i = 29; i >= 0; i--) {
      const date = subDays(new Date(), i);
      data.push({
        date,
        messages: Math.floor(Math.random() * 100) + 50,
        translations: Math.floor(Math.random() * 50) + 20,
        replies: Math.floor(Math.random() * 30) + 10,
      });
    }
    return data;
  };

  // Distribution par type
  const getTypeDistribution = () => {
    const distribution: Record<string, number> = {};
    messages.forEach(msg => {
      const type = messageTypeLabels[msg.messageType as keyof typeof messageTypeLabels] || msg.messageType;
      distribution[type] = (distribution[type] || 0) + 1;
    });
    return Object.entries(distribution).map(([name, value]) => ({ name, value }));
  };

  // Distribution par langue (top 10)
  const getLanguageDistribution = () => {
    const distribution: Record<string, number> = {};
    messages.forEach(msg => {
      const lang = msg.originalLanguage?.toUpperCase() || 'Unknown';
      distribution[lang] = (distribution[lang] || 0) + 1;
    });
    return Object.entries(distribution)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  };

  // Statistiques avancées
  const advancedStats: StatItem[] = [
    {
      title: 'Messages totaux',
      value: stats.total,
      icon: MessageSquare,
      iconClassName: 'text-blue-600',
      trend: { value: 15, label: 'vs mois dernier' },
      description: 'Tous les messages',
    },
    {
      title: 'Messages texte',
      value: stats.textMessages,
      icon: FileText,
      iconClassName: 'text-green-600',
      description: `${stats.total > 0 ? Math.round((stats.textMessages / stats.total) * 100) : 0}% du total`,
    },
    {
      title: 'Traductions',
      value: stats.translations,
      icon: Languages,
      iconClassName: 'text-purple-600',
      trend: { value: 22, label: 'vs semaine dernière' },
      description: 'Messages traduits',
    },
    {
      title: 'Réponses',
      value: stats.replies,
      icon: MessageCircle,
      iconClassName: 'text-orange-600',
      trend: { value: 8, label: 'vs hier' },
      description: 'Threads de discussion',
    },
  ];

  if (isInitialLoad) {
    return (
      <AdminLayout currentPage="/admin/messages">
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <StatCardSkeleton key={i} />)}
          </div>
          <TableSkeleton rows={10} columns={4} />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout currentPage="/admin/messages">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => router.push('/admin')} size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Gestion des messages
              </h1>
              <p className="text-muted-foreground mt-1">
                Administration et modération des messages
              </p>
            </div>
          </div>
          <Button onClick={() => loadMessages(false)} disabled={refreshing} variant="outline" size="sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Actualiser</span>
          </Button>
        </div>

        {/* KPIs */}
        <StatsGrid stats={advancedStats} columns={4} />

        {/* Graphiques */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TimeSeriesChart
            data={generateTimeSeriesData()}
            title="Évolution des messages (30 derniers jours)"
            dataKeys={[
              { key: 'messages', label: 'Messages', color: '#3b82f6' },
              { key: 'translations', label: 'Traductions', color: '#8b5cf6' },
              { key: 'replies', label: 'Réponses', color: '#f59e0b' },
            ]}
            type="area"
            height={300}
          />

          {messages.length > 0 && getTypeDistribution().length > 0 && (
            <DonutChart
              data={getTypeDistribution()}
              title="Répartition par type"
              height={300}
              colors={['#3b82f6', '#10b981', '#6b7280', '#8b5cf6', '#ef4444', '#f59e0b', '#f97316']}
            />
          )}
        </div>

        {/* Distribution par langue (Top 10) */}
        {messages.length > 0 && getLanguageDistribution().length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Languages className="h-5 w-5" />
                <span>Top 10 langues</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {getLanguageDistribution().map((lang, index) => {
                  const maxValue = getLanguageDistribution()[0]?.value || 1;
                  const percentage = (lang.value / maxValue) * 100;

                  return (
                    <div key={lang.name} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="font-bold w-6 text-muted-foreground">
                            {index + 1}
                          </span>
                          <span className="font-medium">{lang.name}</span>
                        </div>
                        <span className="font-bold text-blue-600 dark:text-blue-400">
                          {lang.value}
                        </span>
                      </div>
                      <div className="relative h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filtres et liste */}
        <Card>
          <CardHeader className="space-y-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                <span>Messages ({messages.length})</span>
              </CardTitle>
            </div>

            {/* Filtres */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher dans le contenu..."
                  className="pl-9"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={messageType || 'all'} onValueChange={(value) => setMessageType(value === 'all' ? '' : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Type de message" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les types</SelectItem>
                  <SelectItem value="text">Texte</SelectItem>
                  <SelectItem value="image">Image</SelectItem>
                  <SelectItem value="file">Fichier</SelectItem>
                  <SelectItem value="audio">Audio</SelectItem>
                  <SelectItem value="video">Vidéo</SelectItem>
                  <SelectItem value="location">Localisation</SelectItem>
                  <SelectItem value="system">Système</SelectItem>
                </SelectContent>
              </Select>
              <Select value={period || 'all'} onValueChange={(value) => setPeriod(value === 'all' ? '' : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Période" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les périodes</SelectItem>
                  <SelectItem value="today">Aujourd'hui</SelectItem>
                  <SelectItem value="week">Cette semaine</SelectItem>
                  <SelectItem value="month">Ce mois</SelectItem>
                </SelectContent>
              </Select>
              <select
                className="w-full px-3 py-2 border rounded-md text-sm bg-background"
                value={pageSize}
                onChange={(e) => setCurrentPage(1) || setPageSize(Number(e.target.value))}
              >
                <option value="10">10 par page</option>
                <option value="20">20 par page</option>
                <option value="50">50 par page</option>
                <option value="100">100 par page</option>
              </select>
            </div>
          </CardHeader>

          <CardContent>
            {loading ? (
              <TableSkeleton rows={10} columns={4} />
            ) : messages.length === 0 ? (
              <div className="text-center py-12">
                <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Aucun message trouvé</p>
              </div>
            ) : (
              <>
                {/* Liste des messages */}
                <div className="space-y-4">
                  {messages.map((message) => {
                    const MessageIcon = messageTypeIcons[message.messageType as keyof typeof messageTypeIcons] || FileText;

                    return (
                      <Card key={message.id} className="hover:border-primary/50 hover:shadow-lg transition-all duration-200">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex gap-3 flex-1 min-w-0">
                              <div className={`w-10 h-10 rounded-lg ${getMessageTypeColor(message.messageType)} flex items-center justify-center text-white flex-shrink-0`}>
                                <MessageIcon className="h-5 w-5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-2">
                                  <Badge variant="outline">
                                    {messageTypeLabels[message.messageType as keyof typeof messageTypeLabels]}
                                  </Badge>
                                  <Badge variant="outline">
                                    {message.originalLanguage.toUpperCase()}
                                  </Badge>
                                  {message.isEdited && (
                                    <Badge variant="secondary">Modifié</Badge>
                                  )}
                                  {message._count.translations > 0 && (
                                    <Badge className="bg-purple-500 hover:bg-purple-600">
                                      <Languages className="h-3 w-3 mr-1" />
                                      {message._count.translations}
                                    </Badge>
                                  )}
                                  {message._count.replies > 0 && (
                                    <Badge className="bg-orange-500 hover:bg-orange-600">
                                      <MessageCircle className="h-3 w-3 mr-1" />
                                      {message._count.replies}
                                    </Badge>
                                  )}
                                </div>

                                <div className="mb-3">
                                  <p className="text-sm line-clamp-2">
                                    <SensitiveText fallback="[Contenu masqué]">
                                      {message.content}
                                    </SensitiveText>
                                  </p>
                                </div>

                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                  <div className="flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    <span>
                                      <SensitiveText fallback="••••••">
                                        {message.sender
                                          ? (message.sender.displayName || message.sender.username)
                                          : `${message.anonymousSender?.firstName} ${message.anonymousSender?.lastName}`
                                        }
                                      </SensitiveText>
                                      {!message.sender && <span className="text-muted-foreground"> (Anonyme)</span>}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Globe className="h-3 w-3" />
                                    <span className="truncate max-w-[200px]">
                                      {message.conversation.title || message.conversation.identifier || 'Conversation'}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    <span>{formatRelativeDate(message.createdAt)}</span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => router.push(`/conversations/${message.conversation.id}`)}
                              className="flex-shrink-0"
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              <span className="hidden sm:inline">Voir</span>
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between pt-4 border-t mt-4">
                  <div className="text-sm text-muted-foreground">
                    Page {currentPage} sur {totalPages} ({totalCount} messages au total)
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
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
