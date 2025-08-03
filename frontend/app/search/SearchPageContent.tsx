'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { toast } from 'sonner';
import { 
  Search,
  Users,
  MessageSquare,
  Clock,
  Hash,
  Globe,
  Lock,
  UserPlus,
  Star,
  Filter
} from 'lucide-react';
import { User, Group, Message } from '@/types';

interface SearchResults {
  users: User[];
  groups: Group[];
  messages: Message[];
}

interface SearchFilters {
  type: 'all' | 'users' | 'groups' | 'messages';
  dateRange: string;
  category: string;
}

export function SearchPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);
  
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults>({ users: [], groups: [], messages: [] });
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({
    type: 'all',
    dateRange: 'all',
    category: 'all'
  });

  // Charger les recherches récentes depuis localStorage
  const loadRecentSearches = () => {
    try {
      const saved = localStorage.getItem('meeshy_recent_searches');
      if (saved) {
        setRecentSearches(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Erreur lors du chargement des recherches récentes:', error);
    }
  };

  // Sauvegarder une recherche récente
  const saveRecentSearch = useCallback((searchQuery: string) => {
    if (!searchQuery.trim()) return;
    
    try {
      setRecentSearches(prev => {
        const updated = [searchQuery, ...prev.filter(s => s !== searchQuery)].slice(0, 10);
        localStorage.setItem('meeshy_recent_searches', JSON.stringify(updated));
        return updated;
      });
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
    }
  }, []);

  // Effectuer la recherche
  const handleSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults({ users: [], groups: [], messages: [] });
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        toast.error('Vous devez être connecté pour effectuer une recherche');
        return;
      }

      // Rechercher les utilisateurs
      const usersResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000'}/users/search?q=${encodeURIComponent(searchQuery)}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      // Rechercher les groupes
      const groupsResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000'}/groups/search?q=${encodeURIComponent(searchQuery)}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      let users: User[] = [];
      let groups: Group[] = [];
      
      if (usersResponse.ok) {
        const usersData = await usersResponse.json();
        users = usersData.data || [];
      }

      if (groupsResponse.ok) {
        const groupsData = await groupsResponse.json();
        groups = groupsData.data || [];
      }

      setResults({ users, groups, messages: [] });
      saveRecentSearch(searchQuery);
      
    } catch (error) {
      console.error('Erreur lors de la recherche:', error);
      toast.error('Erreur lors de la recherche');
    } finally {
      setLoading(false);
    }
  }, [saveRecentSearch]);

  // Charger les recherches récentes au montage
  useEffect(() => {
    loadRecentSearches();
  }, []);

  // Initialiser la recherche depuis l'URL
  useEffect(() => {
    const urlQuery = searchParams.get('q');
    if (urlQuery) {
      setQuery(urlQuery);
      handleSearch(urlQuery);
    }
  }, [searchParams, handleSearch]);

  // Gérer les tabs depuis l'URL
  useEffect(() => {
    const tab = searchParams.get('tab') || 'all';
    setActiveTab(tab);
  }, [searchParams]);

  // Focus sur l'input au montage
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Mettre à jour l'URL lors des changements
  const updateURL = useCallback((newQuery?: string, newTab?: string) => {
    const params = new URLSearchParams();
    if (newQuery) params.set('q', newQuery);
    if (newTab && newTab !== 'all') params.set('tab', newTab);
    
    const queryString = params.toString();
    const newUrl = `/search${queryString ? `?${queryString}` : ''}`;
    router.push(newUrl);
  }, [router]);

  // Gérer la soumission du formulaire
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      handleSearch(query);
      updateURL(query, activeTab);
    }
  };

  // Gérer le changement d'onglet
  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab);
    updateURL(query, newTab);
  };

  // Effacer les recherches récentes
  const clearRecentSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem('meeshy_recent_searches');
  };

  // Rejoindre un groupe
  const handleJoinGroup = async (groupId: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000'}/groups/${groupId}/join`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        toast.success('Vous avez rejoint le groupe !');
        // Rafraîchir les résultats
        handleSearch(query);
      } else {
        toast.error('Impossible de rejoindre le groupe');
      }
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors de la tentative de rejoindre le groupe');
    }
  };

  // Démarrer une conversation
  const handleStartConversation = async (userId: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000'}/conversation`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          participantIds: [userId],
          type: 'DIRECT'
        })
      });

      if (response.ok) {
        const data = await response.json();
        router.push(`/conversations/${data.data.id}`);
      } else {
        toast.error('Impossible de créer la conversation');
      }
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors de la création de la conversation');
    }
  };

  const getTotalResults = () => {
    return results.users.length + results.groups.length + results.messages.length;
  };

  const getInitials = (user: User) => {
    const displayName = user.displayName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username;
    return displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getUserDisplayName = (user: User) => {
    return user.displayName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username;
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        {/* En-tête et formulaire de recherche */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-6">Recherche</h1>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  ref={inputRef}
                  type="text"
                  placeholder="Rechercher des utilisateurs, groupes..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button type="submit" disabled={loading}>
                {loading ? 'Recherche...' : 'Rechercher'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="h-4 w-4" />
              </Button>
            </div>

            {/* Filtres avancés */}
            {showFilters && (
              <Card>
                <CardContent className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Type</label>
                      <select
                        value={filters.type}
                        onChange={(e) => setFilters({...filters, type: e.target.value as any})}
                        className="w-full border rounded-md px-3 py-2"
                      >
                        <option value="all">Tout</option>
                        <option value="users">Utilisateurs</option>
                        <option value="groups">Groupes</option>
                        <option value="messages">Messages</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Période</label>
                      <select
                        value={filters.dateRange}
                        onChange={(e) => setFilters({...filters, dateRange: e.target.value})}
                        className="w-full border rounded-md px-3 py-2"
                      >
                        <option value="all">Toute période</option>
                        <option value="day">Aujourd'hui</option>
                        <option value="week">Cette semaine</option>
                        <option value="month">Ce mois</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Catégorie</label>
                      <select
                        value={filters.category}
                        onChange={(e) => setFilters({...filters, category: e.target.value})}
                        className="w-full border rounded-md px-3 py-2"
                      >
                        <option value="all">Toutes</option>
                        <option value="public">Public</option>
                        <option value="private">Privé</option>
                      </select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </form>
        </div>

        {/* Recherches récentes */}
        {!query && recentSearches.length > 0 && (
          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Recherches récentes
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearRecentSearches}
                >
                  Effacer
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {recentSearches.map((search, index) => (
                  <Badge
                    key={index}
                    variant="secondary"
                    className="cursor-pointer hover:bg-gray-200"
                    onClick={() => {
                      setQuery(search);
                      handleSearch(search);
                      updateURL(search, activeTab);
                    }}
                  >
                    {search}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Résultats */}
        {query && (
          <div>
            {/* Statistiques des résultats */}
            <div className="mb-4">
              <p className="text-gray-600">
                {loading ? 'Recherche en cours...' : 
                 getTotalResults() > 0 ? 
                   `${getTotalResults()} résultat${getTotalResults() > 1 ? 's' : ''} pour "${query}"` :
                   `Aucun résultat pour "${query}"`
                }
              </p>
            </div>

            {/* Onglets de résultats */}
            <Tabs value={activeTab} onValueChange={handleTabChange}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="all">
                  Tout ({getTotalResults()})
                </TabsTrigger>
                <TabsTrigger value="users">
                  <Users className="h-4 w-4 mr-1" />
                  Utilisateurs ({results.users.length})
                </TabsTrigger>
                <TabsTrigger value="groups">
                  <Hash className="h-4 w-4 mr-1" />
                  Groupes ({results.groups.length})
                </TabsTrigger>
                <TabsTrigger value="messages">
                  <MessageSquare className="h-4 w-4 mr-1" />
                  Messages ({results.messages.length})
                </TabsTrigger>
              </TabsList>

              {/* Contenu des onglets */}
              <TabsContent value="all" className="space-y-6">
                {/* Utilisateurs */}
                {results.users.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Utilisateurs
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {results.users.slice(0, 4).map((user) => (
                        <Card key={user.id} className="hover:shadow-md transition-shadow">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <Avatar>
                                  <AvatarImage src={user.avatar} />
                                  <AvatarFallback>{getInitials(user)}</AvatarFallback>
                                </Avatar>
                                <div>
                                  <h4 className="font-medium">{getUserDisplayName(user)}</h4>
                                  <p className="text-sm text-gray-500">@{user.username}</p>
                                  {/* Pas de bio dans le type User actuellement */}
                                </div>
                              </div>
                              <Button
                                size="sm"
                                onClick={() => handleStartConversation(user.id)}
                              >
                                <MessageSquare className="h-4 w-4 mr-1" />
                                Message
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Groupes */}
                {results.groups.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <Hash className="h-5 w-5" />
                      Groupes
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {results.groups.slice(0, 4).map((group) => (
                        <Card key={group.id} className="hover:shadow-md transition-shadow">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <h4 className="font-medium">{group.name}</h4>
                                  {group.isPrivate ? (
                                    <Lock className="h-4 w-4 text-gray-500" />
                                  ) : (
                                    <Globe className="h-4 w-4 text-gray-500" />
                                  )}
                                </div>
                                {group.description && (
                                  <p className="text-sm text-gray-600 mb-2">{group.description}</p>
                                )}
                                <div className="flex items-center gap-4 text-sm text-gray-500">
                                  <span className="flex items-center gap-1">
                                    <Users className="h-3 w-3" />
                                    {group.members?.length || 0} membres
                                  </span>
                                </div>
                              </div>
                              <Button
                                size="sm"
                                onClick={() => handleJoinGroup(group.id)}
                              >
                                <UserPlus className="h-4 w-4 mr-1" />
                                Rejoindre
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="users">
                {results.users.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {results.users.map((user) => (
                      <Card key={user.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <Avatar>
                                <AvatarImage src={user.avatar} />
                                <AvatarFallback>{getInitials(user)}</AvatarFallback>
                              </Avatar>
                              <div>
                                <h4 className="font-medium">{getUserDisplayName(user)}</h4>
                                <p className="text-sm text-gray-500">@{user.username}</p>
                                {/* Pas de bio dans le type User actuellement */}
                              </div>
                            </div>
                            <Button
                              size="sm"
                              onClick={() => handleStartConversation(user.id)}
                            >
                              <MessageSquare className="h-4 w-4 mr-1" />
                              Message
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">Aucun utilisateur trouvé</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="groups">
                {results.groups.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {results.groups.map((group) => (
                      <Card key={group.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h4 className="font-medium">{group.name}</h4>
                                {group.isPrivate ? (
                                  <Lock className="h-4 w-4 text-gray-500" />
                                ) : (
                                  <Globe className="h-4 w-4 text-gray-500" />
                                )}
                              </div>
                              {group.description && (
                                <p className="text-sm text-gray-600 mb-2">{group.description}</p>
                              )}
                              <div className="flex items-center gap-4 text-sm text-gray-500">
                                <span className="flex items-center gap-1">
                                  <Users className="h-3 w-3" />
                                  {group.members?.length || 0} membres
                                </span>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              onClick={() => handleJoinGroup(group.id)}
                            >
                              <UserPlus className="h-4 w-4 mr-1" />
                              Rejoindre
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Hash className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">Aucun groupe trouvé</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="messages">
                <div className="text-center py-8">
                  <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">Recherche de messages à venir</p>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
