'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ArrowLeft,
  Trophy,
  Users,
  MessageSquare,
  Medal,
  Award,
  Star,
  TrendingUp,
  Calendar,
  Hash,
  Link as LinkIcon,
  Smile,
  AtSign,
  UserPlus,
  Building2,
  Activity,
  Clock,
  Reply,
  FileText,
  Shield,
  UserCheck,
  Phone,
  Paperclip,
  Send,
  BarChart2,
  MousePointerClick,
  Eye,
  Share2,
  Target,
  Users2
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, Area, AreaChart } from 'recharts';

interface RankingItem {
  id: string;
  username?: string;
  displayName?: string;
  avatar?: string;
  identifier?: string;
  title?: string;
  type?: string;
  image?: string;
  count?: number;
  lastActivity?: string;
  rank?: number;
  // For messages
  content?: string;
  contentPreview?: string;
  createdAt?: string;
  messageType?: string;
  sender?: {
    id: string;
    username: string;
    displayName: string;
    avatar?: string;
  };
  conversation?: {
    id: string;
    identifier: string;
    title?: string;
    type: string;
  };
  // For links
  shortCode?: string;
  originalUrl?: string;
  totalClicks?: number;
  uniqueClicks?: number;
  currentUses?: number;
  maxUses?: number;
  currentUniqueSessions?: number;
  expiresAt?: string;
  creator?: {
    id: string;
    username: string;
    displayName: string;
    avatar?: string;
  };
}

const USER_CRITERIA = [
  { value: 'messages_sent', label: 'Messages envoyés', icon: MessageSquare },
  { value: 'reactions_given', label: 'Réactions données', icon: Smile },
  { value: 'reactions_received', label: 'Réactions reçues', icon: TrendingUp },
  { value: 'replies_received', label: 'Réponses reçues', icon: Reply },
  { value: 'mentions_received', label: 'Mentions reçues', icon: AtSign },
  { value: 'mentions_sent', label: 'Mentions envoyées', icon: Send },
  { value: 'conversations_joined', label: 'Conversations rejointes', icon: UserPlus },
  { value: 'communities_created', label: 'Communautés créées', icon: Building2 },
  { value: 'share_links_created', label: 'Liens de partage créés', icon: LinkIcon },
  { value: 'files_shared', label: 'Fichiers partagés', icon: Paperclip },
  { value: 'reports_sent', label: 'Signalements envoyés', icon: Shield },
  { value: 'reports_received', label: 'Signalements reçus', icon: Shield },
  { value: 'friend_requests_sent', label: 'Demandes d\'amitié envoyées', icon: UserCheck },
  { value: 'friend_requests_received', label: 'Demandes d\'amitié reçues', icon: UserCheck },
  { value: 'calls_initiated', label: 'Appels initiés', icon: Phone },
  { value: 'call_participations', label: 'Participations appels', icon: Phone },
  { value: 'most_referrals_via_affiliate', label: 'Parrainages (affiliation)', icon: Target },
  { value: 'most_referrals_via_sharelinks', label: 'Parrainages (liens partagés)', icon: Share2 },
  { value: 'most_contacts', label: 'Nombre de contacts', icon: Users2 },
  { value: 'most_tracking_links_created', label: 'Liens trackés créés', icon: LinkIcon },
  { value: 'most_tracking_link_clicks', label: 'Clics sur liens trackés', icon: MousePointerClick }
];

const CONVERSATION_CRITERIA = [
  { value: 'message_count', label: 'Nombre de messages', icon: MessageSquare },
  { value: 'member_count', label: 'Nombre de membres', icon: Users },
  { value: 'reaction_count', label: 'Nombre de réactions', icon: Smile },
  { value: 'files_shared', label: 'Fichiers partagés', icon: Paperclip },
  { value: 'call_count', label: 'Nombre d\'appels', icon: Phone },
  { value: 'recent_activity', label: 'Activité récente', icon: Activity }
];

const MESSAGE_CRITERIA = [
  { value: 'most_reactions', label: 'Plus de réactions', icon: Smile },
  { value: 'most_replies', label: 'Plus répondu', icon: Reply },
  { value: 'most_mentions', label: 'Plus de mentions', icon: AtSign }
];

const LINK_CRITERIA = [
  { value: 'tracking_links_most_visited', label: 'Liens trackés (visites totales)', icon: MousePointerClick },
  { value: 'tracking_links_most_unique', label: 'Liens trackés (visiteurs uniques)', icon: Eye },
  { value: 'share_links_most_used', label: 'Liens de partage (utilisations)', icon: Share2 },
  { value: 'share_links_most_unique_sessions', label: 'Liens de partage (sessions uniques)', icon: Users }
];

const PERIODS = [
  { value: '1d', label: 'Jour (24h)' },
  { value: '7d', label: 'Semaine (7j)' },
  { value: '30d', label: 'Mois (30j)' },
  { value: '60d', label: '2 mois (60j)' },
  { value: '90d', label: 'Trimestre (90j)' },
  { value: '180d', label: 'Semestre (180j)' },
  { value: '365d', label: 'Année (365j)' },
  { value: 'all', label: 'Tous les temps' }
];

const MEDAL_COLORS = [
  'text-yellow-500', // 1st place - Gold
  'text-gray-400',   // 2nd place - Silver
  'text-amber-700'   // 3rd place - Bronze
];

export default function AdminRankingPage() {
  const router = useRouter();
  const [entityType, setEntityType] = useState<'users' | 'conversations' | 'messages' | 'links'>('users');
  const [criterion, setCriterion] = useState('messages_sent');
  const [period, setPeriod] = useState('7d');
  const [limit, setLimit] = useState(50);
  const [rankings, setRankings] = useState<RankingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Update criterion when entity type changes
  useEffect(() => {
    if (entityType === 'users') {
      setCriterion('messages_sent');
    } else if (entityType === 'conversations') {
      setCriterion('message_count');
    } else if (entityType === 'messages') {
      setCriterion('most_reactions');
    } else if (entityType === 'links') {
      setCriterion('tracking_links_most_visited');
    }
  }, [entityType]);

  // Fetch rankings
  useEffect(() => {
    fetchRankings();
  }, [entityType, criterion, period, limit]);

  const fetchRankings = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/ranking?entityType=${entityType}&criterion=${criterion}&period=${period}&limit=${limit}`,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Erreur lors du chargement des classements');
      }

      const data = await response.json();

      if (data.success) {
        // Add rank to each item
        const rankedData = data.data.rankings.map((item: RankingItem, index: number) => ({
          ...item,
          rank: index + 1
        }));
        setRankings(rankedData);
      } else {
        setError(data.message || 'Erreur lors du chargement des classements');
      }
    } catch (err) {
      setError('Erreur lors du chargement des classements');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getCriteriaList = () => {
    if (entityType === 'users') return USER_CRITERIA;
    if (entityType === 'conversations') return CONVERSATION_CRITERIA;
    if (entityType === 'messages') return MESSAGE_CRITERIA;
    return LINK_CRITERIA;
  };

  const getCurrentCriterion = () => {
    return getCriteriaList().find(c => c.value === criterion);
  };

  const formatCount = (count: number | undefined) => {
    if (count === undefined) return '0';
    return count.toLocaleString('fr-FR');
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const getTypeIcon = (type: string | undefined) => {
    switch (type) {
      case 'direct': return '💬';
      case 'group': return '👥';
      case 'public': return '🌐';
      case 'broadcast': return '📢';
      default: return '💬';
    }
  };

  const getTypeLabel = (type: string | undefined) => {
    switch (type) {
      case 'direct': return 'Directe';
      case 'group': return 'Groupe';
      case 'public': return 'Publique';
      case 'broadcast': return 'Diffusion';
      default: return type;
    }
  };

  const getMessageTypeIcon = (type: string | undefined) => {
    switch (type) {
      case 'text': return '📝';
      case 'image': return '🖼️';
      case 'video': return '🎥';
      case 'audio': return '🎵';
      case 'file': return '📎';
      default: return '📝';
    }
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) {
      return <Medal className={`h-6 w-6 ${MEDAL_COLORS[0]}`} />;
    } else if (rank === 2) {
      return <Medal className={`h-6 w-6 ${MEDAL_COLORS[1]}`} />;
    } else if (rank === 3) {
      return <Medal className={`h-6 w-6 ${MEDAL_COLORS[2]}`} />;
    }
    return <span className="text-lg font-semibold text-gray-500">#{rank}</span>;
  };

  return (
    <AdminLayout currentPage="/admin/ranking">
      <div className="space-y-6">
        {/* Header with GOLDEN gradient */}
        <div className="bg-gradient-to-r from-yellow-500 via-amber-500 to-yellow-600 rounded-lg p-6 text-white shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                onClick={() => router.push('/admin')}
                className="text-white hover:bg-white/20"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Retour
              </Button>
              <div>
                <h1 className="text-2xl font-bold flex items-center space-x-2">
                  <Trophy className="h-7 w-7" />
                  <span>Classements 🏆</span>
                </h1>
                <p className="text-yellow-100 mt-1">
                  Classez les utilisateurs, conversations, messages et liens selon différents critères
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <Card className="border-yellow-200 dark:border-yellow-800">
          <CardHeader className="bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20">
            <CardTitle className="flex items-center space-x-2">
              <Star className="h-5 w-5 text-yellow-600" />
              <span>Filtres de classement</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Entity Type */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Type d'entité
                </label>
                <Select value={entityType} onValueChange={(value: 'users' | 'conversations' | 'messages' | 'links') => setEntityType(value)}>
                  <SelectTrigger className="border-yellow-300 focus:ring-yellow-500">
                    <SelectValue placeholder="Sélectionnez le type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="users">
                      <div className="flex items-center space-x-2">
                        <Users className="h-4 w-4" />
                        <span>Utilisateurs</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="conversations">
                      <div className="flex items-center space-x-2">
                        <MessageSquare className="h-4 w-4" />
                        <span>Conversations</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="messages">
                      <div className="flex items-center space-x-2">
                        <FileText className="h-4 w-4" />
                        <span>Messages</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="links">
                      <div className="flex items-center space-x-2">
                        <LinkIcon className="h-4 w-4" />
                        <span>Liens</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Criterion */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Critère
                </label>
                <Select value={criterion} onValueChange={setCriterion}>
                  <SelectTrigger className="border-yellow-300 focus:ring-yellow-500">
                    <SelectValue placeholder="Sélectionnez le critère" />
                  </SelectTrigger>
                  <SelectContent>
                    {getCriteriaList().map((c) => {
                      const Icon = c.icon;
                      return (
                        <SelectItem key={c.value} value={c.value}>
                          <div className="flex items-center space-x-2">
                            <Icon className="h-4 w-4" />
                            <span>{c.label}</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Period */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Période
                </label>
                <Select value={period} onValueChange={setPeriod}>
                  <SelectTrigger className="border-yellow-300 focus:ring-yellow-500">
                    <SelectValue placeholder="Sélectionnez la période" />
                  </SelectTrigger>
                  <SelectContent>
                    {PERIODS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        <div className="flex items-center space-x-2">
                          <Calendar className="h-4 w-4" />
                          <span>{p.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Limit */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Nombre de résultats
                </label>
                <Select value={limit.toString()} onValueChange={(value) => setLimit(parseInt(value))}>
                  <SelectTrigger className="border-yellow-300 focus:ring-yellow-500">
                    <SelectValue placeholder="Nombre de résultats" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">Top 10</SelectItem>
                    <SelectItem value="25">Top 25</SelectItem>
                    <SelectItem value="50">Top 50</SelectItem>
                    <SelectItem value="100">Top 100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Visual Chart - Top 10 */}
        {!loading && rankings.length > 0 && criterion !== 'recent_activity' && (
          <Card className="border-yellow-200 dark:border-yellow-800">
            <CardHeader className="bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20">
              <CardTitle className="flex items-center space-x-2">
                <BarChart2 className="h-5 w-5 text-yellow-600" />
                <span>Visualisation - Top {Math.min(10, rankings.length)}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <ResponsiveContainer width="100%" height={400}>
                <BarChart
                  data={rankings.slice(0, 10).map((item, index) => ({
                    name: entityType === 'users'
                      ? (item.displayName || item.username || 'Unknown')
                      : entityType === 'conversations'
                      ? (item.title || item.identifier || 'Unknown')
                      : entityType === 'links'
                      ? (item.title || item.shortCode || item.identifier || 'Unknown')
                      : `Message #${index + 1}`,
                    value: item.count || 0,
                    rank: index + 1
                  }))}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#fef3c7" />
                  <XAxis type="number" stroke="#d97706" />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={150}
                    stroke="#d97706"
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fffbeb',
                      border: '2px solid #fbbf24',
                      borderRadius: '8px',
                      color: '#92400e'
                    }}
                    formatter={(value: any) => [formatCount(value), getCurrentCriterion()?.label]}
                  />
                  <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                    {rankings.slice(0, 10).map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          index === 0
                            ? '#fbbf24' // Gold for 1st
                            : index === 1
                            ? '#d1d5db' // Silver for 2nd
                            : index === 2
                            ? '#d97706' // Bronze for 3rd
                            : '#fcd34d' // Light gold for others
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Evolution Chart - Trend Line */}
        {!loading && rankings.length > 0 && criterion !== 'recent_activity' && (
          <Card className="border-yellow-200 dark:border-yellow-800">
            <CardHeader className="bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20">
              <CardTitle className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5 text-yellow-600" />
                <span>Évolution et distribution des performances</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <ResponsiveContainer width="100%" height={350}>
                <AreaChart
                  data={rankings.slice(0, 20).map((item, index) => ({
                    position: `#${index + 1}`,
                    value: item.count || 0,
                    rank: index + 1
                  }))}
                  margin={{ top: 10, right: 30, left: 20, bottom: 5 }}
                >
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#fbbf24" stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#fef3c7" />
                  <XAxis
                    dataKey="position"
                    stroke="#d97706"
                    tick={{ fontSize: 11 }}
                    interval={rankings.length > 10 ? 1 : 0}
                  />
                  <YAxis
                    stroke="#d97706"
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fffbeb',
                      border: '2px solid #fbbf24',
                      borderRadius: '8px',
                      color: '#92400e'
                    }}
                    formatter={(value: any) => [formatCount(value), getCurrentCriterion()?.label]}
                    labelFormatter={(label) => `Position ${label}`}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#f59e0b"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorValue)"
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#d97706"
                    strokeWidth={2}
                    dot={{ fill: '#fbbf24', r: 4 }}
                    activeDot={{ r: 6, fill: '#f59e0b' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
              <div className="mt-4 text-center text-sm text-gray-600 dark:text-gray-400">
                <p>Ce graphique montre la distribution des performances du top {Math.min(20, rankings.length)} classé par rang.</p>
                <p className="text-xs mt-1">La courbe descendante indique comment les valeurs diminuent à travers les positions.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Rankings */}
        <Card className="border-yellow-200 dark:border-yellow-800">
          <CardHeader className="bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Award className="h-5 w-5 text-yellow-600" />
                <span>
                  {entityType === 'users' && 'Classement des utilisateurs'}
                  {entityType === 'conversations' && 'Classement des conversations'}
                  {entityType === 'messages' && 'Classement des messages'}
                  {entityType === 'links' && 'Classement des liens'}
                </span>
              </div>
              <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                {rankings.length} résultats
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-600"></div>
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <p className="text-red-600 dark:text-red-400">{error}</p>
                <Button onClick={fetchRankings} className="mt-4 bg-yellow-600 hover:bg-yellow-700">
                  Réessayer
                </Button>
              </div>
            ) : rankings.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                Aucun résultat trouvé
              </div>
            ) : (
              <div className="space-y-3">
                {rankings.map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between p-4 rounded-lg transition-all hover:shadow-md ${
                      item.rank && item.rank <= 3
                        ? 'bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/10 dark:to-amber-900/10 border-2 border-yellow-300 dark:border-yellow-700'
                        : 'bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    {/* Rank and Avatar/Icon */}
                    <div className="flex items-center space-x-4 flex-1">
                      <div className="flex items-center justify-center w-12">
                        {item.rank && getRankBadge(item.rank)}
                      </div>

                      {entityType === 'users' ? (
                        <>
                          <Avatar className="h-12 w-12 ring-2 ring-yellow-400">
                            <AvatarImage src={item.avatar} alt={item.displayName || item.username} />
                            <AvatarFallback className="bg-gradient-to-br from-yellow-400 to-amber-500 text-white">
                              {(item.displayName || item.username || 'U').charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <p className="font-semibold text-gray-900 dark:text-gray-100">
                              {item.displayName || item.username}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              @{item.username}
                            </p>
                          </div>
                        </>
                      ) : entityType === 'conversations' ? (
                        <>
                          <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center text-2xl ring-2 ring-yellow-400">
                            {item.image || item.avatar ? (
                              <img
                                src={item.image || item.avatar}
                                alt={item.title || item.identifier}
                                className="h-12 w-12 rounded-lg object-cover"
                              />
                            ) : (
                              getTypeIcon(item.type)
                            )}
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-gray-900 dark:text-gray-100">
                              {item.title || item.identifier}
                            </p>
                            <div className="flex items-center space-x-2">
                              <Badge variant="outline" className="text-xs border-yellow-400 text-yellow-700">
                                {getTypeLabel(item.type)}
                              </Badge>
                              <span className="text-sm text-gray-500 dark:text-gray-400">
                                {item.identifier}
                              </span>
                            </div>
                          </div>
                        </>
                      ) : entityType === 'links' ? (
                        <>
                          <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center text-2xl ring-2 ring-yellow-400">
                            🔗
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-1">
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={item.creator?.avatar} alt={item.creator?.displayName || item.creator?.username} />
                                <AvatarFallback className="text-xs">
                                  {(item.creator?.displayName || item.creator?.username || 'U').charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                {item.creator?.displayName || item.creator?.username}
                              </span>
                              <span className="text-xs text-gray-400">•</span>
                              <Badge variant="outline" className="text-xs">
                                {item.shortCode ? '🔍 Tracké' : '📤 Partage'}
                              </Badge>
                            </div>
                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                              {item.title || item.shortCode || item.identifier}
                            </p>
                            {item.originalUrl && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                {item.originalUrl}
                              </p>
                            )}
                            {item.conversation && (
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                Conversation: {item.conversation.title || item.conversation.identifier}
                              </p>
                            )}
                            <div className="flex items-center space-x-3 mt-1 text-xs text-gray-500">
                              {item.totalClicks !== undefined && (
                                <span>👁️ {formatCount(item.totalClicks)} visites</span>
                              )}
                              {item.uniqueClicks !== undefined && (
                                <span>👤 {formatCount(item.uniqueClicks)} uniques</span>
                              )}
                              {item.currentUses !== undefined && (
                                <span>✅ {formatCount(item.currentUses)} utilisations</span>
                              )}
                              {item.maxUses !== undefined && item.maxUses > 0 && (
                                <span>/ {formatCount(item.maxUses)} max</span>
                              )}
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center text-2xl ring-2 ring-yellow-400">
                            {getMessageTypeIcon(item.messageType)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-1">
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={item.sender?.avatar} alt={item.sender?.displayName || item.sender?.username} />
                                <AvatarFallback className="text-xs">
                                  {(item.sender?.displayName || item.sender?.username || 'U').charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                {item.sender?.displayName || item.sender?.username}
                              </span>
                              <span className="text-xs text-gray-400">•</span>
                              <span className="text-xs text-gray-500">
                                {item.conversation?.title || item.conversation?.identifier}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                              {item.contentPreview || item.content}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              {formatDate(item.createdAt)}
                            </p>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Stats */}
                    <div className="flex items-center space-x-6">
                      {criterion === 'recent_activity' && item.lastActivity ? (
                        <div className="text-right">
                          <div className="flex items-center space-x-2 text-gray-700 dark:text-gray-300">
                            <Clock className="h-4 w-4" />
                            <span className="text-sm">{formatDate(item.lastActivity)}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-right">
                          <div className="flex items-center space-x-2">
                            {getCurrentCriterion() && React.createElement(getCurrentCriterion()!.icon, {
                              className: 'h-5 w-5 text-yellow-600'
                            })}
                            <span className="text-2xl font-bold text-yellow-600">
                              {formatCount(item.count)}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {getCurrentCriterion()?.label}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top 3 Podium (if applicable and not messages/links) */}
        {!loading && rankings.length >= 3 && criterion !== 'recent_activity' && entityType !== 'messages' && entityType !== 'links' && (
          <Card className="border-yellow-200 dark:border-yellow-800">
            <CardHeader className="bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20">
              <CardTitle className="flex items-center space-x-2">
                <Trophy className="h-5 w-5 text-yellow-600" />
                <span>Podium des champions</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-8">
              <div className="grid grid-cols-3 gap-4">
                {/* 2nd Place */}
                {rankings[1] && (
                  <div className="text-center pt-8">
                    <div className="relative inline-block">
                      {entityType === 'users' ? (
                        <Avatar className="h-20 w-20 ring-4 ring-gray-300 dark:ring-gray-600">
                          <AvatarImage src={rankings[1].avatar} alt={rankings[1].displayName || rankings[1].username} />
                          <AvatarFallback className="text-2xl bg-gradient-to-br from-gray-300 to-gray-400 text-white">
                            {(rankings[1].displayName || rankings[1].username || 'U').charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      ) : (
                        <div className="h-20 w-20 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center text-3xl ring-4 ring-gray-300 dark:ring-gray-600">
                          {getTypeIcon(rankings[1].type)}
                        </div>
                      )}
                      <div className="absolute -bottom-2 -right-2 bg-gray-100 dark:bg-gray-700 rounded-full p-2">
                        <Medal className={`h-6 w-6 ${MEDAL_COLORS[1]}`} />
                      </div>
                    </div>
                    <p className="font-semibold mt-3 text-gray-900 dark:text-gray-100">
                      {entityType === 'users'
                        ? (rankings[1].displayName || rankings[1].username)
                        : (rankings[1].title || rankings[1].identifier)}
                    </p>
                    <p className="text-2xl font-bold text-gray-600 dark:text-gray-400 mt-1">
                      {formatCount(rankings[1].count)}
                    </p>
                  </div>
                )}

                {/* 1st Place */}
                {rankings[0] && (
                  <div className="text-center">
                    <div className="relative inline-block">
                      {entityType === 'users' ? (
                        <Avatar className="h-24 w-24 ring-4 ring-yellow-400 dark:ring-yellow-500">
                          <AvatarImage src={rankings[0].avatar} alt={rankings[0].displayName || rankings[0].username} />
                          <AvatarFallback className="text-3xl bg-gradient-to-br from-yellow-400 to-amber-500 text-white">
                            {(rankings[0].displayName || rankings[0].username || 'U').charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      ) : (
                        <div className="h-24 w-24 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center text-4xl ring-4 ring-yellow-400 dark:ring-yellow-500">
                          {getTypeIcon(rankings[0].type)}
                        </div>
                      )}
                      <div className="absolute -bottom-2 -right-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-full p-2">
                        <Medal className={`h-8 w-8 ${MEDAL_COLORS[0]}`} />
                      </div>
                    </div>
                    <p className="font-bold text-lg mt-3 text-gray-900 dark:text-gray-100">
                      {entityType === 'users'
                        ? (rankings[0].displayName || rankings[0].username)
                        : (rankings[0].title || rankings[0].identifier)}
                    </p>
                    <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-500 mt-1">
                      {formatCount(rankings[0].count)}
                    </p>
                    <Trophy className="h-6 w-6 text-yellow-600 mx-auto mt-2" />
                  </div>
                )}

                {/* 3rd Place */}
                {rankings[2] && (
                  <div className="text-center pt-12">
                    <div className="relative inline-block">
                      {entityType === 'users' ? (
                        <Avatar className="h-16 w-16 ring-4 ring-amber-600 dark:ring-amber-700">
                          <AvatarImage src={rankings[2].avatar} alt={rankings[2].displayName || rankings[2].username} />
                          <AvatarFallback className="text-xl bg-gradient-to-br from-amber-600 to-amber-700 text-white">
                            {(rankings[2].displayName || rankings[2].username || 'U').charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      ) : (
                        <div className="h-16 w-16 rounded-full bg-gradient-to-br from-amber-600 to-amber-700 flex items-center justify-center text-2xl ring-4 ring-amber-600 dark:ring-amber-700">
                          {getTypeIcon(rankings[2].type)}
                        </div>
                      )}
                      <div className="absolute -bottom-2 -right-2 bg-amber-100 dark:bg-amber-900/30 rounded-full p-2">
                        <Medal className={`h-5 w-5 ${MEDAL_COLORS[2]}`} />
                      </div>
                    </div>
                    <p className="font-semibold mt-3 text-gray-900 dark:text-gray-100">
                      {entityType === 'users'
                        ? (rankings[2].displayName || rankings[2].username)
                        : (rankings[2].title || rankings[2].identifier)}
                    </p>
                    <p className="text-xl font-bold text-amber-700 dark:text-amber-600 mt-1">
                      {formatCount(rankings[2].count)}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
