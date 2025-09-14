'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser } from '@/context/AppContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ResponsiveLayout } from '@/components/layout/ResponsiveLayout';
import { useTranslations } from '@/hooks/useTranslations';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Users,
  Plus,
  ArrowLeft,
  Settings,
  Copy,
  CheckCircle2,
  UserPlus,
  MessageSquare,
  Lock,
  Globe,
  Search
} from 'lucide-react';
import { toast } from 'sonner';
import type { Group } from '@/types/frontend';
import { buildApiUrl, API_ENDPOINTS } from '@/lib/config';
import { cn } from '@/lib/utils';
import { isValidJWTFormat } from '@/utils/auth';
import { communitiesService } from '@/services/communities.service';
import { conversationsService } from '@/services/conversations.service';
import type { Conversation } from '@shared/types';

interface GroupsLayoutProps {
  selectedGroupIdentifier?: string;
}

export function GroupsLayout({ selectedGroupIdentifier }: GroupsLayoutProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthChecking } = useUser();
  const { t } = useTranslations();
  const { t: tUI } = useTranslations('conversationUI');

  // États principaux - TOUJOURS appelés avant tout return conditionnel
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // États pour les conversations de la communauté
  const [communityConversations, setCommunityConversations] = useState<Conversation[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);

  // États UI responsive
  const [showGroupsList, setShowGroupsList] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  // États modaux et formulaires
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  
  // États pour les tabs
  const [activeTab, setActiveTab] = useState('public');

  // États formulaire
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [newGroupIdentifier, setNewGroupIdentifier] = useState('');
  const [newGroupIsPrivate, setNewGroupIsPrivate] = useState(false);

  // État pour la copie d'identifiant
  const [copiedIdentifier, setCopiedIdentifier] = useState<string | null>(null);

  // État pour le filtre de recherche
  const [searchFilter, setSearchFilter] = useState('');

  // Détecter si on est sur mobile - HOOK AVANT TOUT RETURN
  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  // Gérer la responsivité : masquer/afficher la liste selon la sélection
  useEffect(() => {
    if (isMobile) {
      // Sur mobile, montrer la liste si aucun groupe sélectionné
      setShowGroupsList(!selectedGroup);
    } else {
      // Sur desktop, toujours montrer la liste
      setShowGroupsList(true);
    }
  }, [isMobile, selectedGroup]);

  // Charger les conversations d'une communauté
  const loadCommunityConversations = useCallback(async (communityId: string) => {
    console.log('[DEBUG] 🚀 loadCommunityConversations called with communityId:', communityId);
    
    try {
      setIsLoadingConversations(true);
      console.log('[DEBUG] Loading conversations for community:', communityId);
      
      const response = await communitiesService.getCommunityConversations(communityId);
      console.log('[DEBUG] Community conversations response:', response);
      
      // L'API retourne {success: true, data: [...]} donc nous devons extraire response.data.data
      if (response.data && typeof response.data === 'object' && 'data' in response.data) {
        const rawConversations = (response.data as any).data;
        console.log('[DEBUG] Raw conversations from API:', rawConversations);
        
        // Mapper les conversations pour corriger les incohérences de format
        const mappedConversations = rawConversations.map((conv: any) => ({
          ...conv,
          // Mapper 'members' vers 'participants' pour compatibilité avec le type Conversation
          participants: conv.members || [],
          // Les conversations héritent du caractère privé de leur communauté
          isPrivate: selectedGroup?.isPrivate || false,
          // Garder 'members' pour l'affichage direct
          members: conv.members || []
        }));
        
        console.log('[DEBUG] ✅ Setting mapped conversations:', mappedConversations);
        setCommunityConversations(mappedConversations || []);
      } else if (Array.isArray(response.data)) {
        // Fallback si la réponse est directement un array
        console.log('[DEBUG] Setting community conversations (direct array):', response.data);
        const mappedConversations = response.data.map((conv: any) => ({
          ...conv,
          participants: conv.members || [],
          isPrivate: selectedGroup?.isPrivate || false,
          members: conv.members || []
        }));
        setCommunityConversations(mappedConversations);
      } else {
        console.log('[DEBUG] No conversations data in response');
        setCommunityConversations([]);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des conversations de la communauté:', error);
      toast.error('Erreur lors du chargement des conversations');
      setCommunityConversations([]);
    } finally {
      setIsLoadingConversations(false);
    }
  }, [selectedGroup]);

  // Charger les groupes
  const loadGroups = useCallback(async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        console.log('No auth token found');
        return;
      }
      
      console.log('Loading groups with token:', token.substring(0, 20) + '...');
      const response = await fetch(buildApiUrl(API_ENDPOINTS.GROUP.LIST), {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('Groups API response:', response.status, response.statusText);
      
      if (response.ok) {
        const result = await response.json();
        console.log('Groups API result:', result);
        // L'API retourne {success: true, data: [...]}
        const data = result.success ? result.data : result;
        console.log('Groups data:', data);
        setGroups(Array.isArray(data) ? data : []);
      } else if (response.status === 401) {
        console.log('Unauthorized, removing token');
        localStorage.removeItem('auth_token');
        router.push('/');
      } else {
        console.error('Groups API error:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Erreur chargement groupes:', error);
      toast.error('Erreur lors du chargement des groupes');
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  // Charger les détails d'un groupe
  const loadGroupDetails = useCallback(async (identifier: string) => {
    console.log('[DEBUG] loadGroupDetails called with identifier:', identifier);
    
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        console.log('[DEBUG] No auth token found');
        toast.error('Token d\'authentification manquant. Veuillez vous reconnecter.');
        return;
      }

      // Vérifier que le token n'est pas corrompu
      if (!isValidJWTFormat(token)) {
        console.error('[DEBUG] Invalid JWT token format:', token);
        toast.error('Token d\'authentification invalide. Veuillez vous reconnecter.');
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
        return;
      }

      console.log('[DEBUG] Fetching group details from API:', `/communities/${identifier}`);
      const response = await fetch(buildApiUrl(`/communities/${identifier}`), {
        headers: { Authorization: `Bearer ${token}` }
      });

      console.log('[DEBUG] API response status:', response.status);
      
      if (response.ok) {
        const result = await response.json();
        console.log('[DEBUG] API response data:', result);
        const data = result.success ? result.data : result;
        setSelectedGroup(data);
        
        // Sur mobile, masquer la liste pour afficher les détails
        if (isMobile) {
          setShowGroupsList(false);
        }
      } else {
        console.error('Erreur chargement détails groupe:', response.status, response.statusText);
        
        // Gérer les erreurs d'authentification spécifiquement
        if (response.status === 401 || response.status === 403) {
          console.log('[DEBUG] Authentication error, clearing auth data');
          localStorage.removeItem('auth_token');
          localStorage.removeItem('user');
          toast.error('Session expirée. Veuillez vous reconnecter.');
          // Rediriger vers la page de connexion
          window.location.href = '/login';
          return;
        }
        
        // Autres erreurs
        const errorText = await response.text();
        console.error('[DEBUG] Error response body:', errorText);
        toast.error(`Erreur lors du chargement du groupe (${response.status})`);
      }
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur de connexion lors du chargement du groupe');
    }
  }, [isMobile]);

  // Générer l'identifiant depuis le nom
  const generateIdentifier = useCallback((name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-zA-Z0-9-_@]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }, []);

  // Sélectionner un groupe depuis la liste
  const handleSelectGroup = useCallback((group: Group) => {
    console.log('[DEBUG] handleSelectGroup called with:', group);
    
    try {
      setSelectedGroup(group);
      
      // Charger les conversations de la communauté
      if (group.id) {
        loadCommunityConversations(group.id);
      }
      
      // S'assurer que l'identifiant commence par mshy_
      let identifier = group.identifier || `mshy_${generateIdentifier(group.name)}`;
      if (!identifier.startsWith('mshy_')) {
        identifier = `mshy_${identifier}`;
      }
      
      console.log('[DEBUG] Navigating to:', `/groups/${identifier}`);
      router.push(`/groups/${identifier}`);
    } catch (error) {
      console.error('[ERROR] handleSelectGroup failed:', error);
    }
  }, [router, generateIdentifier, loadCommunityConversations]);

  // Retour à la liste (mobile uniquement)
  const handleBackToList = useCallback(() => {
    if (isMobile) {
      setShowGroupsList(true);
      setSelectedGroup(null);
      router.push('/groups');
    }
  }, [isMobile, router]);

  // Copier l'identifiant au presse-papier
  const copyIdentifier = useCallback(async (identifier: string) => {
    try {
      await navigator.clipboard.writeText(identifier);
      setCopiedIdentifier(identifier);
      toast.success('Identifiant copié !');
      
      // Réinitialiser l'état de copie après 2 secondes
      setTimeout(() => {
        setCopiedIdentifier(null);
      }, 2000);
    } catch (error) {
      console.error('Erreur copie:', error);
      toast.error('Erreur lors de la copie');
    }
  }, []);

  // Créer un groupe
  const createGroup = useCallback(async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      const response = await fetch(buildApiUrl(API_ENDPOINTS.GROUP.CREATE), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newGroupName,
          description: newGroupDescription,
          identifier: newGroupIdentifier,
          isPrivate: newGroupIsPrivate
        })
      });

      if (response.ok) {
        const result = await response.json();
        const data = result.success ? result.data : result;
        
        // Ajouter le nouveau groupe à la liste
        setGroups(prev => [data, ...prev]);
        
        // Réinitialiser le formulaire
        setNewGroupName('');
        setNewGroupDescription('');
        setNewGroupIdentifier('');
        setNewGroupIsPrivate(false);
        setIsCreateModalOpen(false);
        
        toast.success('Groupe créé avec succès !');
      } else {
        const error = await response.json();
        toast.error(error.message || 'Erreur lors de la création');
      }
    } catch (error) {
      console.error('Erreur création groupe:', error);
      toast.error('Erreur lors de la création du groupe');
    }
  }, [newGroupName, newGroupDescription, newGroupIdentifier, newGroupIsPrivate]);

  // Charger les données initiales
  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  // Gérer la sélection depuis l'URL
  useEffect(() => {
    console.log('[DEBUG] Selection useEffect triggered:', { selectedGroupIdentifier, groupsLength: groups.length });
    
    if (selectedGroupIdentifier && groups.length > 0) {
      console.log('[DEBUG] Looking for group with identifier:', selectedGroupIdentifier);
      
      // Chercher d'abord par identifiant exact (avec ou sans mshy_)
      let group = groups.find(g => g.identifier === selectedGroupIdentifier);
      console.log('[DEBUG] Found group with exact identifier:', group?.name);
      
      // Si pas trouvé et que l'identifiant ne commence pas par mshy_, essayer avec le préfixe
      if (!group && !selectedGroupIdentifier.startsWith('mshy_')) {
        group = groups.find(g => g.identifier === `mshy_${selectedGroupIdentifier}`);
        console.log('[DEBUG] Found group with mshy_ prefix:', group?.name);
      }
      
      // Si pas trouvé et que l'identifiant commence par mshy_, essayer sans le préfixe
      if (!group && selectedGroupIdentifier.startsWith('mshy_')) {
        const cleanIdentifier = selectedGroupIdentifier.replace(/^mshy_/, '');
        group = groups.find(g => g.identifier === cleanIdentifier);
        console.log('[DEBUG] Found group with clean identifier:', group?.name);
      }
      
      if (group) {
        console.log('[DEBUG] Setting selected group:', group.name);
        setSelectedGroup(group);
        if (isMobile) {
          setShowGroupsList(false);
        }
      } else {
        console.log('[DEBUG] Group not found in list, loading from API');
        // Essayer de charger depuis l'API avec l'identifiant tel quel
        loadGroupDetails(selectedGroupIdentifier);
      }
    }
  }, [selectedGroupIdentifier, groups, isMobile, loadGroupDetails]);

  // Mettre à jour l'identifiant automatiquement basé sur le nom
  useEffect(() => {
    if (newGroupName && !newGroupIdentifier) {
      setNewGroupIdentifier(generateIdentifier(newGroupName));
    }
  }, [newGroupName, newGroupIdentifier, generateIdentifier]);

  // Filtrer les groupes basé sur la recherche
  // Filtrer les groupes par tab et recherche
  const filteredGroups = useMemo(() => {
    let filtered = groups;
    
    // Filtrer par tab (seulement PUBLIC et PRIVÉE)
    if (activeTab === 'private') {
      filtered = filtered.filter(group => group.isPrivate);
    } else {
      // Par défaut, afficher les communautés publiques
      filtered = filtered.filter(group => !group.isPrivate);
    }
    
    // Filtrer par recherche
    if (searchFilter.trim()) {
      filtered = filtered.filter(group => 
        group.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
        (group.identifier && group.identifier.toLowerCase().includes(searchFilter.toLowerCase())) ||
        (group.description && group.description.toLowerCase().includes(searchFilter.toLowerCase()))
      );
    }
    
    return filtered;
  }, [groups, activeTab, searchFilter]);

  // Si on est en train de vérifier l'authentification, afficher un loader
  if (isAuthChecking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">{t('authChecking')}</p>
        </div>
      </div>
    );
  }

  // Si pas d'utilisateur après vérification, ne rien afficher
  if (!user) {
    return null;
  }

  return (
    <DashboardLayout title={tUI('communities')}>
      {isLoading ? (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">{tUI('loading')}</p>
          </div>
        </div>
      ) : (
        <div className="h-[calc(100vh-6rem)] flex bg-transparent">
          {/* Liste des groupes */}
          <div className={cn(
            "flex flex-col bg-white/80 backdrop-blur-sm rounded-l-2xl border border-border/50 shadow-lg",
            isMobile ? (showGroupsList ? "w-full" : "hidden") : "w-96"
          )}>
            {/* Header fixe */}
            <div className="flex-shrink-0 p-4 border-b border-border/30">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-foreground">Communautés</h2>
                </div>
                <div className="relative">
                  <Users className="h-6 w-6 text-primary" />
                </div>
              </div>

              {/* Tabs pour classer les communautés */}
              <div className="mb-4">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="public" className="flex items-center space-x-2">
                      <Globe className="h-4 w-4" />
                      <span>Publiques</span>
                      <Badge variant="secondary">{groups.filter(g => !g.isPrivate).length}</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="private" className="flex items-center space-x-2">
                      <Lock className="h-4 w-4" />
                      <span>Privées</span>
                      <Badge variant="secondary">{groups.filter(g => g.isPrivate).length}</Badge>
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {/* Champ de filtrage des groupes */}
              <div className="mb-2">
                <label className="text-sm font-medium text-muted-foreground mb-2 block">
                  Filtrer les communautés
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Rechercher par nom, description..."
                    className="w-full h-8 text-sm px-3 py-2 border border-border/30 rounded-lg bg-background/50 
                             placeholder:text-muted-foreground/50 focus:ring-2 focus:ring-primary/20 focus:border-primary/30 
                             transition-all outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Liste scrollable */}
            <div className="flex-1 overflow-y-auto">              
              {groups.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                  <Users className="h-16 w-16 text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    {isLoading ? 'Chargement des communautés' : 'Aucune communauté'}
                  </h3>
                  <p className="text-muted-foreground mb-6">
                    {isLoading 
                      ? 'Chargement des communautés en cours...'
                      : 'Créez votre première communauté pour commencer'
                    }
                  </p>
                </div>
              ) : filteredGroups.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                  <Users className="h-16 w-16 text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    Aucune communauté {activeTab === 'private' ? 'privée' : 'publique'}
                  </h3>
                  <p className="text-muted-foreground mb-6">
                    {searchFilter.trim() 
                      ? 'Aucune communauté trouvée pour cette recherche'
                      : `Aucune communauté ${activeTab === 'private' ? 'privée' : 'publique'} trouvée`
                    }
                  </p>
                </div>
              ) : (
                <div className="p-2">
                  <div className="space-y-2">
                    {filteredGroups.map((group) => (
                      <div
                        key={group.id}
                        onClick={() => handleSelectGroup(group)}
                        className={cn(
                          "flex items-center p-4 rounded-2xl cursor-pointer transition-all border-2",
                          selectedGroup?.id === group.id
                            ? "bg-primary/20 border-primary/40 shadow-md"
                            : "hover:bg-accent/50 border-transparent hover:border-border/30"
                        )}
                      >
                        <div className="relative">
                          <Avatar className="h-12 w-12 ring-2 ring-primary/20">
                            <AvatarImage src={group.avatar || undefined} />
                            <AvatarFallback className="bg-primary/20 text-primary font-bold">
                              {group.name.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className={cn(
                            "absolute -bottom-0 -right-0 h-4 w-4 rounded-full border-2 border-background",
                            group.isPrivate ? "bg-orange-500" : "bg-green-500"
                          )}></div>
                        </div>

                        <div className="ml-4 flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-foreground truncate">
                                {group.name}
                              </h3>
                              {group.isPrivate && (
                                <Lock className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground ml-2 flex-shrink-0">
                              {group._count?.members || 0} membres
                            </span>
                          </div>
                          {group.description && (
                            <p className="text-sm text-muted-foreground truncate">
                              {group.description}
                            </p>
                          )}
                          <div className="flex items-center gap-1 mt-1 group/identifier">
                            <span 
                              className="text-xs text-primary font-mono cursor-pointer hover:text-primary/80 transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                copyIdentifier(group.identifier || `mshy_${generateIdentifier(group.name)}`);
                              }}
                            >
                              {group.identifier || `mshy_${generateIdentifier(group.name)}`}
                            </span>
                            {copiedIdentifier === (group.identifier || `mshy_${generateIdentifier(group.name)}`) ? (
                              <CheckCircle2 className="h-3 w-3 text-green-500" />
                            ) : (
                              <Copy className="h-3 w-3 text-muted-foreground opacity-0 group-hover/identifier:opacity-100 transition-opacity" />
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer fixe avec boutons */}
            <div className="flex-shrink-0 p-4 border-t border-border/30 bg-background/50">
              <div className="flex flex-col gap-3">
                <Button
                  className="w-full rounded-2xl h-12 bg-primary/10 hover:bg-primary/20 border-0 text-primary font-semibold"
                  onClick={() => setIsCreateModalOpen(true)}
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Nouvelle communauté
                </Button>
              </div>
            </div>
          </div>

          {/* Zone de détails du groupe */}
          <div className={cn(
            "flex flex-col",
            isMobile ? (showGroupsList ? "hidden" : "w-full") : "flex-1"
          )}>
            {selectedGroup ? (
              <>
                {/* En-tête du groupe */}
                <div className="flex-shrink-0 p-4 border-b border-border/30 bg-white/90 backdrop-blur-sm rounded-tr-2xl">
                  <div className="flex items-center gap-3">
                    {isMobile && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleBackToList}
                        className="rounded-full h-10 w-10 p-0 hover:bg-accent/50"
                      >
                        <ArrowLeft className="h-5 w-5" />
                      </Button>
                    )}
                    <div className="relative">
                      <Avatar className="h-10 w-10 ring-2 ring-primary/20">
                        <AvatarImage src={selectedGroup.avatar || undefined} />
                        <AvatarFallback className="bg-primary/20 text-primary font-bold">
                          {selectedGroup.name.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h1 className="text-lg font-bold text-foreground">{selectedGroup.name}</h1>
                        {selectedGroup.isPrivate && (
                          <Lock className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex items-center gap-1 group/identifier">
                        <span 
                          className="text-sm text-primary font-mono cursor-pointer hover:text-primary/80 transition-colors"
                          onClick={() => copyIdentifier(selectedGroup.identifier || `mshy_${generateIdentifier(selectedGroup.name)}`)}
                        >
                          {selectedGroup.identifier || `mshy_${generateIdentifier(selectedGroup.name)}`}
                        </span>
                        {copiedIdentifier === (selectedGroup.identifier || `mshy_${generateIdentifier(selectedGroup.name)}`) ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4 text-muted-foreground opacity-0 group-hover/identifier:opacity-100 transition-opacity" />
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className="rounded-2xl">
                        <UserPlus className="h-4 w-4 mr-1" />
                        Inviter
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="rounded-2xl"
                        onClick={() => setIsSettingsModalOpen(true)}
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Contenu principal du groupe */}
                <div className="flex-1 overflow-y-auto bg-white/50 backdrop-blur-sm rounded-br-2xl p-6">
                  <div className="max-w-4xl mx-auto space-y-6">
                    {/* Section À propos */}
                    <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-border/30 p-6 shadow-sm">
                      <div className="flex items-center gap-3 mb-4">
                        <MessageSquare className="h-6 w-6 text-primary" />
                        <h2 className="text-xl font-bold text-foreground">À propos</h2>
                      </div>
                      
                      <p className="text-muted-foreground leading-relaxed mb-6">
                        {selectedGroup.description || 'Aucune description disponible pour cette communauté.'}
                      </p>
                      
                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          <span>{selectedGroup._count?.members || 0} membres</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {selectedGroup.isPrivate ? (
                            <>
                              <Lock className="h-4 w-4" />
                              <span>Communauté privée</span>
                            </>
                          ) : (
                            <>
                              <Globe className="h-4 w-4" />
                              <span>Communauté publique</span>
                            </>
                          )}
                        </div>
                        {selectedGroup.createdAt && (
                          <div>
                            Créée le {new Date(selectedGroup.createdAt).toLocaleDateString('fr-FR')}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Section Conversations */}
                    <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-border/30 p-6 shadow-sm">
                      <div className="flex items-center gap-3 mb-4">
                        <MessageSquare className="h-6 w-6 text-primary" />
                        <h2 className="text-xl font-bold text-foreground">Conversations</h2>
                      </div>
                      
                      {isLoadingConversations ? (
                        <div className="flex items-center justify-center py-8">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                          <span className="ml-2 text-muted-foreground">Chargement des conversations...</span>
                        </div>
                      ) : communityConversations.length > 0 ? (
                        <div className="space-y-3">
                          {communityConversations.map((conversation) => (
                            <div
                              key={conversation.id}
                              className="flex items-center gap-3 p-3 rounded-xl border border-border/20 hover:bg-accent/50 transition-colors cursor-pointer"
                              onClick={() => router.push(`/conversations/${conversation.id}`)}
                            >
                              <div className="flex-shrink-0">
                                <Avatar className="h-10 w-10">
                                  <AvatarImage src={conversation.avatar || undefined} />
                                  <AvatarFallback className="bg-primary/20 text-primary font-bold">
                                    {conversation.title?.substring(0, 2).toUpperCase() || 'C'}
                                  </AvatarFallback>
                                </Avatar>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <h3 className="font-semibold text-foreground truncate">
                                    {conversation.title || `Conversation ${conversation.id.slice(-4)}`}
                                  </h3>
                                  {conversation.isPrivate && (
                                    <Lock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground truncate">
                                  {conversation.description || 'Aucune description'}
                                </p>
                                <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                                  <span>{(conversation as any)._count?.members || 0} membres</span>
                                  <span>{(conversation as any)._count?.messages || 0} messages</span>
                                  {conversation.lastMessageAt && (
                                    <span>
                                      Dernière activité: {new Date(conversation.lastMessageAt).toLocaleDateString('fr-FR')}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex-shrink-0">
                                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                          <h3 className="text-lg font-semibold text-foreground mb-2">Aucune conversation</h3>
                          <p className="text-muted-foreground">
                            Cette communauté n'a pas encore de conversations.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

              </>
            ) : (
              <div className="flex-1 flex items-center justify-center bg-white/30 backdrop-blur-sm rounded-r-2xl">
                <div className="text-center p-8">
                  <Users className="h-16 w-16 mx-auto mb-6 text-muted-foreground/50" />
                  <h3 className="text-xl font-bold text-foreground mb-3">Sélectionnez une communauté</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Choisissez une communauté dans la liste pour voir ses détails et commencer à explorer.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de création de groupe */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="max-w-md w-[95vw] sm:max-w-md sm:w-[90vw]">
          <DialogHeader>
            <DialogTitle>Créer une communauté</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nom</label>
              <Input
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Nom de la communauté"
                className="mt-1"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">Description (optionnel)</label>
              <Input
                value={newGroupDescription}
                onChange={(e) => setNewGroupDescription(e.target.value)}
                placeholder="Description de la communauté"
                className="mt-1"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">Identifiant</label>
              <div className="flex items-center mt-1">
                <span className="text-sm text-muted-foreground bg-muted px-3 py-2 rounded-l-md border border-r-0">
                  mshy_
                </span>
                <Input
                  value={newGroupIdentifier}
                  onChange={(e) => setNewGroupIdentifier(e.target.value.replace(/[^a-zA-Z0-9-_@]/g, ''))}
                  placeholder="identifiant-unique"
                  className="rounded-l-none"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Lettres, chiffres, tirets, underscores et @ uniquement
              </p>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium">Communauté privée</label>
                <p className="text-xs text-muted-foreground">
                  Seuls les membres invités peuvent rejoindre
                </p>
              </div>
              <Switch
                checked={newGroupIsPrivate}
                onCheckedChange={setNewGroupIsPrivate}
              />
            </div>
            
            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setIsCreateModalOpen(false)}
                className="flex-1"
              >
                Annuler
              </Button>
              <Button
                onClick={createGroup}
                disabled={!newGroupName.trim() || !newGroupIdentifier.trim()}
                className="flex-1"
              >
                Créer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
