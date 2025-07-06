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
  ChevronRight,
  Loader2
} from 'lucide-react';
import { 
  usersService, 
  groupsService, 
  type Message
} from '@/services';
import { type Group, type User } from '@/types';

interface SearchResults {
  users: User[];
  groups: Group[];
  messages: Message[];
}

export default function SearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);
  
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults>({ users: [], groups: [], messages: [] });
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Charger les recherches récentes
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
    saveRecentSearch(searchQuery);

    try {
      // Recherches parallèles
      const [usersResponse, groupsResponse] = await Promise.allSettled([
        usersService.searchUsers(searchQuery),
        groupsService.getGroups({ search: searchQuery, isPrivate: false }),
      ]);

      const users = usersResponse.status === 'fulfilled' ? usersResponse.value.data : [];
      const groupsData = groupsResponse.status === 'fulfilled' ? groupsResponse.value.data : null;
      const groups = Array.isArray(groupsData) ? groupsData : groupsData?.groups || [];

      setResults({
        users,
        groups,
        messages: [], // Messages search sera implémenté quand on aura une conversation sélectionnée
      });

      // Mise à jour de l'URL
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('q', searchQuery);
      window.history.replaceState({}, '', newUrl.toString());
      
    } catch (error) {
      console.error('Erreur lors de la recherche:', error);
      toast.error('Erreur lors de la recherche');
    } finally {
      setLoading(false);
    }
  }, [saveRecentSearch]);

  // Initialisation
  useEffect(() => {
    loadRecentSearches();
    
    // Focus automatique sur l'input
    if (inputRef.current) {
      inputRef.current.focus();
    }

    // Recherche automatique si query dans URL
    const urlQuery = searchParams.get('q');
    if (urlQuery) {
      setQuery(urlQuery);
      handleSearch(urlQuery);
    }
  }, [searchParams, handleSearch]);

  // Gestion des ancrages URL pour les tabs
  useEffect(() => {
    // Lire l'ancrage depuis l'URL au chargement
    const hash = window.location.hash.slice(1); // Enlever le #
    if (hash && ['all', 'users', 'groups'].includes(hash)) {
      setActiveTab(hash);
    }
  }, []);

  // Mettre à jour l'URL quand l'onglet change
  useEffect(() => {
    if (activeTab !== 'all') {
      window.history.replaceState({}, '', `${window.location.pathname}${window.location.search}#${activeTab}`);
    } else {
      // Supprimer l'ancrage pour l'onglet "all"
      window.history.replaceState({}, '', `${window.location.pathname}${window.location.search}`);
    }
  }, [activeTab]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(query);
  };

  const getUserDisplayName = (user: User): string => {
    if (user.displayName) return user.displayName;
    return `${user.firstName} ${user.lastName}`.trim() || user.username;
  };

  const getResultsCount = (): number => {
    return results.users.length + results.groups.length + results.messages.length;
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem('meeshy_recent_searches');
    toast.success('Historique effacé');
  };

  return (
    <DashboardLayout title="Recherche" hideSearch={true}>
      <div className="max-w-4xl mx-auto">
        {/* Search Form */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  ref={inputRef}
                  type="text"
                  placeholder="Rechercher des utilisateurs, groupes..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-10 pr-4 py-3 text-lg"
                />
                {loading && (
                  <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
                )}
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  {query && (
                    <p className="text-sm text-gray-600">
                      {getResultsCount()} résultat{getResultsCount() !== 1 ? 's' : ''} pour &ldquo;{query}&rdquo;
                    </p>
                  )}
                </div>
                
                <Button type="submit" disabled={loading || !query.trim()}>
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Recherche...
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4 mr-2" />
                      Rechercher
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Recent Searches */}
        {!query && recentSearches.length > 0 && (
          <Card className="mb-6">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900 flex items-center">
                  <Clock className="h-4 w-4 mr-2" />
                  Recherches récentes
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearRecentSearches}
                  className="text-gray-500 hover:text-gray-700"
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
                    }}
                  >
                    {search}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {query && (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="all" className="flex items-center space-x-2">
                <Hash className="h-4 w-4" />
                <span>Tout ({getResultsCount()})</span>
              </TabsTrigger>
              <TabsTrigger value="users" className="flex items-center space-x-2">
                <Users className="h-4 w-4" />
                <span>Utilisateurs ({results.users.length})</span>
              </TabsTrigger>
              <TabsTrigger value="groups" className="flex items-center space-x-2">
                <MessageSquare className="h-4 w-4" />
                <span>Groupes ({results.groups.length})</span>
              </TabsTrigger>
            </TabsList>

            {/* All Results */}
            <TabsContent value="all" className="space-y-6">
              {getResultsCount() === 0 && !loading && (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Search className="h-12 w-12 text-gray-400 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Aucun résultat trouvé
                    </h3>
                    <p className="text-gray-600 text-center max-w-sm">
                      Essayez d&apos;autres mots-clés ou vérifiez l&apos;orthographe.
                    </p>
                  </CardContent>
                </Card>
              )}

              {results.users.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                    <Users className="h-4 w-4 mr-2" />
                    Utilisateurs ({results.users.length})
                  </h3>
                  <div className="space-y-2">
                    {results.users.slice(0, 5).map((user) => (
                      <Card key={user.id} className="hover:shadow-md transition-shadow cursor-pointer">
                        <CardContent 
                          className="p-4"
                          onClick={() => router.push(`/profile/${user.id}`)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <Avatar>
                                <AvatarImage src={user.avatar} />
                                <AvatarFallback>
                                  {getUserDisplayName(user).slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              
                              <div>
                                <h4 className="font-semibold text-gray-900">
                                  {getUserDisplayName(user)}
                                </h4>
                                <p className="text-sm text-gray-600">@{user.username}</p>
                                <div className="flex items-center space-x-1 mt-1">
                                  <div className={`w-2 h-2 rounded-full ${user.isOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
                                  <span className="text-xs text-gray-500">
                                    {user.isOnline ? 'En ligne' : 'Hors ligne'}
                                  </span>
                                </div>
                              </div>
                            </div>
                            
                            <ChevronRight className="h-4 w-4 text-gray-400" />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {results.groups.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Groupes ({results.groups.length})
                  </h3>
                  <div className="space-y-2">
                    {results.groups.slice(0, 5).map((group) => (
                      <Card key={group.id} className="hover:shadow-md transition-shadow cursor-pointer">
                        <CardContent 
                          className="p-4"
                          onClick={() => router.push(`/groups/${group.id}`)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                                <Hash className="h-5 w-5 text-white" />
                              </div>
                              
                              <div>
                                <div className="flex items-center space-x-2">
                                  <h4 className="font-semibold text-gray-900">{group.name}</h4>
                                  {!group.isPrivate ? (
                                    <Globe className="h-3 w-3 text-green-600" />
                                  ) : (
                                    <Lock className="h-3 w-3 text-gray-500" />
                                  )}
                                </div>
                                {group.description && (
                                  <p className="text-sm text-gray-600 mt-1">
                                    {group.description.length > 60 
                                      ? `${group.description.substring(0, 60)}...` 
                                      : group.description
                                    }
                                  </p>
                                )}
                                <p className="text-xs text-gray-500 mt-1">
                                  {group.members?.length || 0} membre{(group.members?.length || 0) !== 1 ? 's' : ''}
                                </p>
                              </div>
                            </div>
                            
                            <ChevronRight className="h-4 w-4 text-gray-400" />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Users Only */}
            <TabsContent value="users">
              {results.users.length === 0 && !loading ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Users className="h-12 w-12 text-gray-400 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Aucun utilisateur trouvé
                    </h3>
                    <p className="text-gray-600 text-center max-w-sm">
                      Aucun utilisateur ne correspond à votre recherche.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {results.users.map((user) => (
                    <Card key={user.id} className="hover:shadow-md transition-shadow cursor-pointer">
                      <CardContent 
                        className="p-4"
                        onClick={() => router.push(`/profile/${user.id}`)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <Avatar className="h-12 w-12">
                              <AvatarImage src={user.avatar} />
                              <AvatarFallback>
                                {getUserDisplayName(user).slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            
                            <div>
                              <h4 className="font-semibold text-gray-900">
                                {getUserDisplayName(user)}
                              </h4>
                              <p className="text-sm text-gray-600">@{user.username}</p>
                              <p className="text-sm text-gray-500">{user.email}</p>
                              <div className="flex items-center space-x-1 mt-1">
                                <div className={`w-2 h-2 rounded-full ${user.isOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
                                <span className="text-xs text-gray-500">
                                  {user.isOnline ? 'En ligne' : 'Hors ligne'}
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          <ChevronRight className="h-4 w-4 text-gray-400" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Groups Only */}
            <TabsContent value="groups">
              {results.groups.length === 0 && !loading ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <MessageSquare className="h-12 w-12 text-gray-400 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Aucun groupe trouvé
                    </h3>
                    <p className="text-gray-600 text-center max-w-sm">
                      Aucun groupe public ne correspond à votre recherche.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {results.groups.map((group) => (
                    <Card key={group.id} className="hover:shadow-md transition-shadow cursor-pointer">
                      <CardContent 
                        className="p-4"
                        onClick={() => router.push(`/groups/${group.id}`)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                              <Hash className="h-6 w-6 text-white" />
                            </div>
                            
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-1">
                                <h4 className="font-semibold text-gray-900">{group.name}</h4>
                                {!group.isPrivate ? (
                                  <Badge variant="secondary" className="text-xs">
                                    <Globe className="h-3 w-3 mr-1" />
                                    Public
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-xs">
                                    <Lock className="h-3 w-3 mr-1" />
                                    Privé
                                  </Badge>
                                )}
                              </div>
                              
                              {group.description && (
                                <p className="text-sm text-gray-600 mb-2">
                                  {group.description}
                                </p>
                              )}
                              
                              <div className="flex items-center space-x-4 text-xs text-gray-500">
                                <span>{group.members?.length || 0} membre{(group.members?.length || 0) !== 1 ? 's' : ''}</span>
                                {group.createdAt && (
                                  <span>Créé le {new Date(group.createdAt).toLocaleDateString('fr-FR')}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          <ChevronRight className="h-4 w-4 text-gray-400" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
}
