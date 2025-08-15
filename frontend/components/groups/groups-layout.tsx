'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { 
  Plus, 
  Users, 
  Settings,
  Crown,
  Search,
  UserPlus,
  Shield
} from 'lucide-react';
import { User, Group, GroupMember, Conversation } from '@/types';
import { toast } from 'sonner';
import { buildApiUrl, API_ENDPOINTS } from '@/lib/config';

interface GroupsLayoutProps {
  currentUser: User;
  initialGroupId?: string;
}

export function GroupsLayout({ currentUser, initialGroupId }: GroupsLayoutProps) {
  const router = useRouter();
  
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
  
  const [newGroup, setNewGroup] = useState({
    name: '',
    description: '',
    isPrivate: false,
    maxMembers: undefined as number | undefined,
  });

  // Charger les groupes
  const loadGroups = useCallback(async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;
      
      const response = await fetch(buildApiUrl(API_ENDPOINTS.GROUP.LIST), {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setGroups(Array.isArray(data) ? data : []);
      } else if (response.status === 401) {
        localStorage.removeItem('auth_token');
        router.push('/');
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
      if (!token) return;
      
      // Charger les membres
      const membersResponse = await fetch(buildApiUrl(API_ENDPOINTS.GROUP.DETAILS(groupId)), {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (membersResponse.ok) {
        const groupDetails = await membersResponse.json();
        setGroupMembers(groupDetails.members || []);
      }
      
      // Charger les conversations du groupe
      const conversationsResponse = await fetch(buildApiUrl(API_ENDPOINTS.CONVERSATION.GET_GROUP_CONVERSATIONS(groupId)), {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (conversationsResponse.ok) {
        const conversations = await conversationsResponse.json();
        setGroupConversations(conversations);
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
          description: newGroup.description.trim() || undefined,
          isPrivate: newGroup.isPrivate,
          maxMembers: newGroup.maxMembers
        })
      });

      if (response.ok) {
        const group = await response.json();
        setGroups(prev => [group, ...prev]);
        setNewGroup({ name: '', description: '', isPrivate: false, maxMembers: undefined });
        setIsCreateOpen(false);
        toast.success('Groupe créé avec succès');
        
        // Sélectionner le nouveau groupe
        setSelectedGroup(group);
        loadGroupDetails(group.id);
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

  // Filtrer les groupes
  const filteredGroups = Array.isArray(groups) ? groups.filter(group =>
    group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    group.description?.toLowerCase().includes(searchQuery.toLowerCase())
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
              <Label htmlFor="groupDesc">Description (optionnel)</Label>
              <Textarea
                id="groupDesc"
                placeholder="Description du groupe"
                value={newGroup.description}
                onChange={(e) => setNewGroup(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
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
              onClick={() => setIsSettingsOpen(true)}
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
    <DashboardLayout title="Groupes">
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
                      <CardTitle className="text-2xl">{selectedGroup.name}</CardTitle>
                      <CardDescription>{selectedGroup.description}</CardDescription>
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
                    {member.role === 'ADMIN' && (
                      <Crown className="w-4 h-4 text-yellow-500" />
                    )}
                    <Badge variant={member.role === 'ADMIN' ? 'default' : 'secondary'}>
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
          </DialogHeader>
          <div className="text-center text-gray-500 py-8">
            Paramètres du groupe à implémenter
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
