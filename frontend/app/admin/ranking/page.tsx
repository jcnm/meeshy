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
  Clock
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

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
}

const USER_CRITERIA = [
  { value: 'messages_sent', label: 'Messages envoyés', icon: MessageSquare },
  { value: 'reactions_given', label: 'Réactions données', icon: Smile },
  { value: 'mentions_received', label: 'Mentions reçues', icon: AtSign },
  { value: 'conversations_joined', label: 'Conversations rejointes', icon: UserPlus },
  { value: 'communities_created', label: 'Communautés créées', icon: Building2 },
  { value: 'share_links_created', label: 'Liens de partage créés', icon: LinkIcon }
];

const CONVERSATION_CRITERIA = [
  { value: 'message_count', label: 'Nombre de messages', icon: MessageSquare },
  { value: 'member_count', label: 'Nombre de membres', icon: Users },
  { value: 'reaction_count', label: 'Nombre de réactions', icon: Smile },
  { value: 'recent_activity', label: 'Activité récente', icon: Activity }
];

const PERIODS = [
  { value: '24h', label: '24 heures' },
  { value: '7d', label: '7 jours' },
  { value: '30d', label: '30 jours' },
  { value: '90d', label: '90 jours' },
  { value: 'all', label: 'Tous les temps' }
];

const MEDAL_COLORS = [
  'text-yellow-500', // 1st place - Gold
  'text-gray-400',   // 2nd place - Silver
  'text-amber-600'   // 3rd place - Bronze
];

export default function AdminRankingPage() {
  const router = useRouter();
  const [entityType, setEntityType] = useState<'users' | 'conversations'>('users');
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
    } else {
      setCriterion('message_count');
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
    return entityType === 'users' ? USER_CRITERIA : CONVERSATION_CRITERIA;
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
        {/* Header with gradient */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg p-6 text-white shadow-lg">
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
                  <span>Classements</span>
                </h1>
                <p className="text-purple-100 mt-1">
                  Classez les utilisateurs et conversations selon différents critères
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Star className="h-5 w-5 text-purple-600" />
              <span>Filtres de classement</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Entity Type */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Type d'entité
                </label>
                <Select value={entityType} onValueChange={(value: 'users' | 'conversations') => setEntityType(value)}>
                  <SelectTrigger>
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
                  </SelectContent>
                </Select>
              </div>

              {/* Criterion */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Critère
                </label>
                <Select value={criterion} onValueChange={setCriterion}>
                  <SelectTrigger>
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
                  <SelectTrigger>
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
                  <SelectTrigger>
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

        {/* Rankings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Award className="h-5 w-5 text-purple-600" />
                <span>
                  {entityType === 'users' ? 'Classement des utilisateurs' : 'Classement des conversations'}
                </span>
              </div>
              <Badge variant="outline" className="text-purple-600">
                {rankings.length} résultats
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <p className="text-red-600 dark:text-red-400">{error}</p>
                <Button onClick={fetchRankings} className="mt-4">
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
                        ? 'bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/10 dark:to-orange-900/10 border border-yellow-200 dark:border-yellow-900/30'
                        : 'bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    {/* Rank and Avatar/Icon */}
                    <div className="flex items-center space-x-4 flex-1">
                      <div className="flex items-center justify-center w-12">
                        {item.rank && getRankBadge(item.rank)}
                      </div>

                      {entityType === 'users' ? (
                        <>
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={item.avatar} alt={item.displayName || item.username} />
                            <AvatarFallback>
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
                      ) : (
                        <>
                          <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-2xl">
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
                              <Badge variant="outline" className="text-xs">
                                {getTypeLabel(item.type)}
                              </Badge>
                              <span className="text-sm text-gray-500 dark:text-gray-400">
                                {item.identifier}
                              </span>
                            </div>
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
                              className: 'h-5 w-5 text-purple-600'
                            })}
                            <span className="text-2xl font-bold text-purple-600">
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

        {/* Top 3 Podium (if applicable) */}
        {!loading && rankings.length >= 3 && criterion !== 'recent_activity' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Trophy className="h-5 w-5 text-yellow-500" />
                <span>Podium</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                {/* 2nd Place */}
                {rankings[1] && (
                  <div className="text-center pt-8">
                    <div className="relative inline-block">
                      {entityType === 'users' ? (
                        <Avatar className="h-20 w-20 ring-4 ring-gray-300 dark:ring-gray-600">
                          <AvatarImage src={rankings[1].avatar} alt={rankings[1].displayName || rankings[1].username} />
                          <AvatarFallback className="text-2xl">
                            {(rankings[1].displayName || rankings[1].username || 'U').charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      ) : (
                        <div className="h-20 w-20 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-3xl ring-4 ring-gray-300 dark:ring-gray-600">
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
                          <AvatarFallback className="text-3xl">
                            {(rankings[0].displayName || rankings[0].username || 'U').charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      ) : (
                        <div className="h-24 w-24 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-4xl ring-4 ring-yellow-400 dark:ring-yellow-500">
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
                  </div>
                )}

                {/* 3rd Place */}
                {rankings[2] && (
                  <div className="text-center pt-12">
                    <div className="relative inline-block">
                      {entityType === 'users' ? (
                        <Avatar className="h-16 w-16 ring-4 ring-amber-600 dark:ring-amber-700">
                          <AvatarImage src={rankings[2].avatar} alt={rankings[2].displayName || rankings[2].username} />
                          <AvatarFallback className="text-xl">
                            {(rankings[2].displayName || rankings[2].username || 'U').charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      ) : (
                        <div className="h-16 w-16 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-2xl ring-4 ring-amber-600 dark:ring-amber-700">
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
