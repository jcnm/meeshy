'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { 
  ArrowLeft,
  Plus, 
  Users, 
  Settings,
  Crown,
  Search
} from 'lucide-react';
import { User, Group } from '@/types';
import { toast } from 'sonner';

export default function GroupsPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();

  const [newGroup, setNewGroup] = useState({
    name: '',
    description: '',
    isPrivate: false,
    maxMembers: undefined as number | undefined,
  });

  useEffect(() => {
    const checkAuthAndLoadData = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        if (!token) {
          router.push('/');
          return;
        }

        // Vérifier l'auth
        const authResponse = await fetch('http://localhost:3002/auth/me', {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!authResponse.ok) {
          localStorage.removeItem('auth_token');
          router.push('/');
          return;
        }

        const userData = await authResponse.json();
        setCurrentUser(userData);

        // Charger les groupes
        await loadGroups(token);
      } catch (error) {
        console.error('Erreur initialisation:', error);
        router.push('/');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuthAndLoadData();
  }, [router]);

  const loadGroups = async (token: string) => {
    try {
      const response = await fetch('http://localhost:3002/groups/search', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const groupsData = await response.json();
        setGroups(groupsData);
      }
    } catch (error) {
      console.error('Erreur chargement groupes:', error);
    }
  };

  const createGroup = async () => {
    if (!newGroup.name.trim()) {
      toast.error('Le nom du groupe est requis');
      return;
    }

    setIsCreating(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('http://localhost:3002/groups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newGroup.name.trim(),
          description: newGroup.description.trim() || undefined,
          isPrivate: newGroup.isPrivate,
          maxMembers: newGroup.maxMembers || undefined,
        }),
      });

      if (response.ok) {
        const createdGroup = await response.json();
        setGroups(prev => [createdGroup, ...prev]);
        setIsCreateOpen(false);
        setNewGroup({ name: '', description: '', isPrivate: false, maxMembers: undefined });
        toast.success('Groupe créé avec succès !');
      } else {
        const error = await response.json();
        toast.error(error.message || 'Erreur lors de la création du groupe');
      }
    } catch (error) {
      console.error('Erreur création groupe:', error);
      toast.error('Erreur de connexion');
    } finally {
      setIsCreating(false);
    }
  };

  const filteredGroups = groups.filter(group => 
    group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (group.description && group.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!currentUser) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => router.back()}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Groupes</h1>
              <p className="text-sm text-gray-600">Gérez vos groupes de conversation</p>
            </div>
          </div>
          
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center space-x-2">
                <Plus className="h-4 w-4" />
                <span>Nouveau groupe</span>
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
                <div className="space-y-2">
                  <Label htmlFor="groupName">Nom du groupe *</Label>
                  <Input
                    id="groupName"
                    placeholder="Nom de votre groupe"
                    value={newGroup.name}
                    onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="groupDescription">Description</Label>
                  <Textarea
                    id="groupDescription"
                    placeholder="Description du groupe (optionnel)"
                    value={newGroup.description}
                    onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="maxMembers">Nombre maximum de membres</Label>
                  <Input
                    id="maxMembers"
                    type="number"
                    placeholder="Illimité"
                    value={newGroup.maxMembers || ''}
                    onChange={(e) => setNewGroup({ 
                      ...newGroup, 
                      maxMembers: e.target.value ? parseInt(e.target.value) : undefined 
                    })}
                  />
                </div>
                
                <Button 
                  onClick={createGroup}
                  disabled={isCreating || !newGroup.name.trim()}
                  className="w-full"
                >
                  {isCreating ? 'Création...' : 'Créer le groupe'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Rechercher un groupe..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Groups List */}
        {filteredGroups.length > 0 ? (
          <div className="grid gap-4">
            {filteredGroups.map((group) => (
              <Card key={group.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                        <Users className="h-6 w-6 text-blue-600" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{group.name}</CardTitle>
                        <CardDescription>
                          {group.description || 'Aucune description'}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {group.isPrivate && (
                        <Badge variant="outline">Privé</Badge>
                      )}
                      <Badge variant="secondary">
                        {group.members?.length || 0} membre(s)
                        {group.maxMembers && ` / ${group.maxMembers}`}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 text-sm text-gray-600">
                      <span>Créé le {new Date(group.createdAt).toLocaleDateString()}</span>
                      {group.conversations?.length > 0 && (
                        <span>{group.conversations.length} conversation(s)</span>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => router.push(`/groups/${group.id}`)}
                      >
                        <Settings className="h-4 w-4 mr-1" />
                        Gérer
                      </Button>
                      
                      {group.members?.some(m => m.user.id === currentUser.id && m.role === 'ADMIN') && (
                        <Crown className="h-4 w-4 text-yellow-500" />
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {searchQuery ? 'Aucun groupe trouvé' : 'Aucun groupe'}
              </h3>
              <p className="text-gray-600 mb-6">
                {searchQuery 
                  ? 'Essayez avec des termes différents' 
                  : 'Créez votre premier groupe pour organiser vos conversations'
                }
              </p>
              {!searchQuery && (
                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Créer un groupe
                    </Button>
                  </DialogTrigger>
                </Dialog>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
