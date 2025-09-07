'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser } from '@/context/AppContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useTranslations } from '@/hooks/useTranslations';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  Globe
} from 'lucide-react';
import { toast } from 'sonner';
import type { Group } from '@/types/frontend';
import { buildApiUrl, API_ENDPOINTS } from '@/lib/config';
import { cn } from '@/lib/utils';

interface GroupsLayoutProps {
  selectedGroupIdentifier?: string;
}

export function GroupsLayout({ selectedGroupIdentifier }: GroupsLayoutProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthChecking } = useUser();
  const { t } = useTranslations();
  const { t: tUI } = useTranslations('conversationUI');

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
  
  // États principaux
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [groupConversations, setGroupConversations] = useState<Conversation[]>([]);
  const [selectedGroupConversation, setSelectedGroupConversation] = useState<Conversation | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  
  // États modales
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isMembersOpen, setIsMembersOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editGroup, setEditGroup] = useState({
    name: '',
    identifier: '',
    description: '',
    isPrivate: false,
  });
  const [isUpdating, setIsUpdating] = useState(false);
  
  const [newGroup, setNewGroup] = useState({
    name: '',
    identifier: '',
    description: '',
    isPrivate: false,
    maxMembers: undefined as number | undefined,
  });

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
  const loadGroupDetails = useCallback(async (groupId: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token || !groupId) return;
      
      // Charger les membres
      const membersResponse = await fetch(buildApiUrl(API_ENDPOINTS.GROUP.MEMBERS(groupId)), {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (membersResponse.ok) {
        const result = await membersResponse.json();
        const members = result.success ? result.data : result;
        setGroupMembers(Array.isArray(members) ? members : []);
      }
      
      // Charger les conversations du groupe (si l'endpoint existe)
      try {
        const conversationsResponse = await fetch(buildApiUrl(API_ENDPOINTS.CONVERSATION.GET_GROUP_CONVERSATIONS(groupId)), {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (conversationsResponse.ok) {
          const result = await conversationsResponse.json();
          const conversations = result.success ? result.data : result;
          setGroupConversations(Array.isArray(conversations) ? conversations : []);
        }
      } catch (convError) {
        console.log('Group conversations endpoint not available:', convError);
        setGroupConversations([]);
      }
    } catch (error) {
      console.error('Erreur chargement détails groupe:', error);
      toast.error('Erreur lors du chargement des détails');
    }
  }, []);

  // Créer un groupe
  const createGroup = async () => {
    if (!newGroup.name.trim()) {
      toast.error('Le nom du groupe est requis');
      return;
    }

    setIsCreating(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(buildApiUrl(API_ENDPOINTS.GROUP.CREATE), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newGroup.name.trim(),
          identifier: newGroup.identifier.trim() || undefined,
          description: newGroup.description.trim() || undefined,
          isPrivate: newGroup.isPrivate,
          maxMembers: newGroup.maxMembers
        })
      });

      if (response.ok) {
        const result = await response.json();
        const group = result.success ? result.data : result;
        setGroups(prev => [group, ...prev]);
        setNewGroup({ name: '', identifier: '', description: '', isPrivate: false, maxMembers: undefined });
        setIsCreateOpen(false);
        toast.success('Groupe créé avec succès');
        
        // Sélectionner le nouveau groupe
        setSelectedGroup(group);
        if (group?.id) {
          loadGroupDetails(group.id);
        }
      } else {
        const error = await response.text();
        toast.error(error || 'Erreur lors de la création');
      }
    } catch (error) {
      console.error('Erreur création groupe:', error);
      toast.error('Erreur lors de la création');
    } finally {
      setIsCreating(false);
    }
  };

  // Mettre à jour un groupe
  const updateGroup = async () => {
    if (!selectedGroup || !editGroup.name.trim()) {
      toast.error('Le nom du groupe est requis');
      return;
    }

    setIsUpdating(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(buildApiUrl(`${API_ENDPOINTS.GROUP.DETAILS}/${selectedGroup.id}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: editGroup.name.trim(),
          identifier: editGroup.identifier.trim() || undefined,
          description: editGroup.description.trim() || undefined,
          isPrivate: editGroup.isPrivate
        })
      });

      if (response.ok) {
        const result = await response.json();
        const updatedGroup = result.success ? result.data : result;
        setGroups(prev => prev.map(g => g.id === selectedGroup.id ? updatedGroup : g));
        setSelectedGroup(updatedGroup);
        setIsSettingsOpen(false);
        toast.success('Groupe mis à jour avec succès');
      } else {
        const error = await response.text();
        toast.error(error || 'Erreur lors de la mise à jour');
      }
    } catch (error) {
      console.error('Erreur mise à jour groupe:', error);
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setIsUpdating(false);
    }
  };

  // Ouvrir les paramètres avec les données actuelles
  const openSettings = () => {
    if (selectedGroup) {
      setEditGroup({
        name: selectedGroup.name || '',
        identifier: selectedGroup.identifier?.replace('mshy_', '') || '',
        description: selectedGroup.description || '',
        isPrivate: selectedGroup.isPrivate || false,
      });
      setIsSettingsOpen(true);
    }
  };

  // Filtrer les groupes
  const filteredGroups = Array.isArray(groups) ? groups.filter(group =>
    group?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    group?.description?.toLowerCase().includes(searchQuery.toLowerCase())
  ) : [];

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  // Effet pour sélectionner automatiquement un groupe s'il est spécifié
  useEffect(() => {
    if (initialGroupId && groups.length > 0) {
      const targetGroup = groups.find(g => g.id === initialGroupId);
      if (targetGroup) {
        setSelectedGroup(targetGroup);
        loadGroupDetails(targetGroup.id);
      }
    }
  }, [initialGroupId, groups, loadGroupDetails]);

  // Contenu de la sidebar
  const sidebarContent = (
    <div className="space-y-4">
      {/* Barre de recherche */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <Input
          placeholder="Rechercher un groupe..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Bouton créer */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogTrigger asChild>
          <Button className="w-full">
            <Plus className="w-4 h-4 mr-2" />
            Créer un groupe
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Créer un nouveau groupe</DialogTitle>
            <DialogDescription>
              Créez un groupe pour organiser vos conversations
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="groupName">Nom du groupe</Label>
              <Input
                id="groupName"
                placeholder="Nom du groupe"
                value={newGroup.name}
                onChange={(e) => setNewGroup(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="groupIdentifier">Identifiant personnalisé (optionnel)</Label>
              <Input
                id="groupIdentifier"
                placeholder="mon-identifiant"
                value={newGroup.identifier}
                onChange={(e) => setNewGroup(prev => ({ ...prev, identifier: e.target.value.replace(/[^a-zA-Z0-9\-_@]/g, '') }))}
                pattern="[a-zA-Z0-9\-_@]*"
              />
              <p className="text-sm text-gray-500 mt-1">
                Lettres, chiffres, tirets, underscores et @ uniquement.
              </p>
            </div>
            <div>
              <Label htmlFor="groupDesc">Description (optionnel)</Label>
              <Textarea
                id="groupDesc"
                placeholder="Description du groupe"
                value={newGroup.description}
                onChange={(e) => setNewGroup(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="isPrivate"
                checked={newGroup.isPrivate}
                onCheckedChange={(checked) => setNewGroup(prev => ({ ...prev, isPrivate: checked }))}
              />
              <Label htmlFor="isPrivate">Groupe privé</Label>
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Annuler
              </Button>
              <Button onClick={createGroup} disabled={isCreating}>
                {isCreating ? 'Création...' : 'Créer'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Liste des groupes */}
      <ScrollArea className="flex-1">
        <div className="space-y-2">
          {isLoading ? (
            <div className="text-center text-gray-500 py-8">
              Chargement des groupes...
            </div>
          ) : filteredGroups.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              {searchQuery ? 'Aucun groupe trouvé' : 'Aucun groupe'}
            </div>
          ) : (
            filteredGroups.map((group) => (
              <Card 
                key={group.id}
                className={`cursor-pointer transition-colors hover:bg-gray-50 ${
                  selectedGroup?.id === group.id ? 'ring-2 ring-blue-500' : ''
                }`}
                onClick={() => {
                  setSelectedGroup(group);
                  loadGroupDetails(group.id);
                }}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium flex items-center">
                      <Users className="w-4 h-4 mr-2" />
                      {group.name}
                    </CardTitle>
                    <div className="flex items-center space-x-1">
                      {group.isPrivate && (
                        <Shield className="w-3 h-3 text-gray-500" />
                      )}
                      <Badge variant="secondary" className="text-xs">
                        {group.members?.length || 0}
                      </Badge>
                    </div>
                  </div>
                  {group.description && (
                    <CardDescription className="text-xs line-clamp-2">
                      {group.description}
                    </CardDescription>
                  )}
                  {group.identifier && (
                    <div className="text-xs text-gray-400 font-mono">
                      {group.identifier}
                    </div>
                  )}
                </CardHeader>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );

  // Contenu principal
  const mainContent = selectedGroup ? (
    <div className="h-full flex flex-col">
      {/* En-tête du groupe */}
      <div className="border-b p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold flex items-center">
              <Users className="w-5 h-5 mr-2" />
              {selectedGroup.name}
            </h2>
            {selectedGroup.description && (
              <p className="text-gray-600 mt-1">{selectedGroup.description}</p>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsMembersOpen(true)}
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Membres ({groupMembers.length})
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={openSettings}
            >
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Conversations du groupe */}
      <div className="flex-1 p-4">
        <h3 className="text-lg font-medium mb-4">Conversations</h3>
        <div className="space-y-2">
          {groupConversations.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              Aucune conversation dans ce groupe
            </div>
          ) : (
            groupConversations.map((conversation) => (
              <Card 
                key={conversation.id}
                className={`cursor-pointer transition-colors hover:bg-gray-50 ${
                  selectedGroupConversation?.id === conversation.id ? 'ring-2 ring-blue-500' : ''
                }`}
                onClick={() => setSelectedGroupConversation(conversation)}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    {conversation.title || 'Conversation générale'}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {conversation.lastMessage 
                      ? `Dernier message: ${new Date(conversation.lastMessage.createdAt).toLocaleString()}`
                      : 'Pas de messages'
                    }
                  </CardDescription>
                </CardHeader>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  ) : (
    <div className="h-full flex items-center justify-center text-gray-500">
      <div className="text-center">
        <Users className="w-16 h-16 mx-auto mb-4 text-gray-300" />
        <p>Sélectionnez un groupe pour voir ses détails</p>
      </div>
    </div>
  );

  return (
    <DashboardLayout title={tUI('groups')}>
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-semibold">Mes Groupes</CardTitle>
              </CardHeader>
              <div className="px-6 pb-6">
                {sidebarContent}
              </div>
            </Card>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-2">
            {selectedGroup ? (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedGroup(null)}
                        className="mb-2"
                      >
                        ← Retour aux groupes
                      </Button>
                      <CardTitle className="text-2xl flex items-center">
                        {selectedGroup.name}
                        {selectedGroup.isPrivate && (
                          <Shield className="w-5 h-5 ml-2 text-gray-500" />
                        )}
                      </CardTitle>
                      <CardDescription>{selectedGroup.description}</CardDescription>
                      {selectedGroup.identifier && (
                        <div className="text-sm text-gray-500 font-mono">
                          {selectedGroup.identifier}
                        </div>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {mainContent}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="flex items-center justify-center py-12">
                  <div className="text-center text-muted-foreground">
                    <Users className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <h3 className="text-lg font-medium mb-2">Sélectionnez un groupe</h3>
                    <p>Choisissez un groupe dans la liste pour voir ses détails</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Modales */}
      
      {/* Modale membres */}
      <Dialog open={isMembersOpen} onOpenChange={setIsMembersOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Membres du groupe</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-80">
            <div className="space-y-2">
              {groupMembers.map((member) => (
                <div key={member.id} className="flex items-center justify-between p-2 rounded-lg border">
                  <div className="flex items-center space-x-3">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={member.user?.avatar} />
                      <AvatarFallback>
                        {member.user?.username?.[0]?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{member.user?.username}</p>
                      <p className="text-xs text-gray-500">{member.user?.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {member.role === UserRoleEnum.ADMIN && (
                      <Crown className="w-4 h-4 text-yellow-500" />
                    )}
                    <Badge variant={member.role === UserRoleEnum.ADMIN ? 'default' : 'secondary'}>
                      {member.role}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Modale paramètres (placeholder) */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Paramètres du groupe</DialogTitle>
            <DialogDescription>
              Modifiez les paramètres de votre groupe
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="editGroupName">Nom du groupe</Label>
              <Input
                id="editGroupName"
                placeholder="Nom du groupe"
                value={editGroup.name}
                onChange={(e) => setEditGroup(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="editGroupIdentifier">Identifiant personnalisé</Label>
              <Input
                id="editGroupIdentifier"
                placeholder="mon-identifiant (sera mshy_mon-identifiant)"
                value={editGroup.identifier}
                onChange={(e) => setEditGroup(prev => ({ ...prev, identifier: e.target.value.replace(/[^a-zA-Z0-9\-_@]/g, '') }))}
                pattern="[a-zA-Z0-9\-_@]*"
              />
              <p className="text-sm text-gray-500 mt-1">
                Lettres, chiffres, tirets, underscores et @ uniquement. Sera préfixé par "mshy_"
              </p>
            </div>
            <div>
              <Label htmlFor="editGroupDesc">Description</Label>
              <Textarea
                id="editGroupDesc"
                placeholder="Description du groupe"
                value={editGroup.description}
                onChange={(e) => setEditGroup(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="editIsPrivate"
                checked={editGroup.isPrivate}
                onCheckedChange={(checked) => setEditGroup(prev => ({ ...prev, isPrivate: checked }))}
              />
              <Label htmlFor="editIsPrivate">Groupe privé</Label>
            </div>
            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={() => setIsSettingsOpen(false)}>
                Annuler
              </Button>
              <Button onClick={updateGroup} disabled={isUpdating}>
                {isUpdating ? 'Mise à jour...' : 'Sauvegarder'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
