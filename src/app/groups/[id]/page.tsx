'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft,
  Users, 
  Settings,
  Crown,
  UserMinus,
  MessageSquare,
  Plus
} from 'lucide-react';
import { User, Group } from '@/types';
import { toast } from 'sonner';

export default function GroupDetailPage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params?.id as string;
  
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [group, setGroup] = useState<Group | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadGroupDetails = async () => {
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

        // Charger les détails du groupe
        const groupResponse = await fetch(`http://localhost:3002/groups/${groupId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (groupResponse.ok) {
          const groupData = await groupResponse.json();
          setGroup(groupData);
        } else {
          toast.error('Groupe non trouvé');
          router.push('/groups');
        }
      } catch (error) {
        console.error('Erreur chargement groupe:', error);
        router.push('/groups');
      } finally {
        setIsLoading(false);
      }
    };

    if (groupId) {
      loadGroupDetails();
    }
  }, [groupId, router]);

  const isAdmin = currentUser && group?.members?.some(m => 
    m.user.id === currentUser.id && m.role === 'ADMIN'
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!group || !currentUser) {
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
            <div className="flex items-center space-x-3">
              <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">{group.name}</h1>
                <p className="text-sm text-gray-600">
                  {group.members?.length || 0} membre(s)
                  {isAdmin && <span className="ml-2">• Administrateur</span>}
                </p>
              </div>
            </div>
          </div>
          
          {isAdmin && (
            <Button variant="outline">
              <Settings className="h-4 w-4 mr-2" />
              Paramètres
            </Button>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Informations du groupe */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Informations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium text-gray-900 mb-1">Description</h4>
                  <p className="text-sm text-gray-600">
                    {group.description || 'Aucune description'}
                  </p>
                </div>
                
                <div>
                  <h4 className="font-medium text-gray-900 mb-1">Type</h4>
                  <Badge variant={group.isPrivate ? "default" : "secondary"}>
                    {group.isPrivate ? 'Privé' : 'Public'}
                  </Badge>
                </div>
                
                <div>
                  <h4 className="font-medium text-gray-900 mb-1">Limite de membres</h4>
                  <p className="text-sm text-gray-600">
                    {group.maxMembers ? `${group.maxMembers} maximum` : 'Illimité'}
                  </p>
                </div>
                
                <div>
                  <h4 className="font-medium text-gray-900 mb-1">Créé le</h4>
                  <p className="text-sm text-gray-600">
                    {new Date(group.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Membres et conversations */}
          <div className="lg:col-span-2 space-y-8">
            {/* Membres */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Membres ({group.members?.length || 0})</CardTitle>
                  {isAdmin && (
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Inviter
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {group.members?.map((member) => (
                    <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="h-10 w-10 bg-gray-200 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium">
                            {member.user.firstName[0]}{member.user.lastName[0]}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium">{member.user.firstName} {member.user.lastName}</p>
                          <p className="text-sm text-gray-500">@{member.user.username}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant={member.role === 'ADMIN' ? 'default' : 'secondary'}>
                          {member.role === 'ADMIN' ? (
                            <>
                              <Crown className="h-3 w-3 mr-1" />
                              Admin
                            </>
                          ) : 'Membre'}
                        </Badge>
                        {isAdmin && member.user.id !== currentUser.id && (
                          <Button variant="ghost" size="sm">
                            <UserMinus className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  )) || (
                    <p className="text-center text-gray-500 py-4">Aucun membre</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Conversations */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Conversations ({group.conversations?.length || 0})</CardTitle>
                  {isAdmin && (
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Nouvelle conversation
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {group.conversations?.length > 0 ? (
                  <div className="space-y-3">
                    {group.conversations.map((conversation) => (
                      <div 
                        key={conversation.id} 
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                        onClick={() => router.push(`/chat/${conversation.id}`)}
                      >
                        <div className="flex items-center space-x-3">
                          <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <MessageSquare className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium">{conversation.name || 'Conversation sans nom'}</p>
                            <p className="text-sm text-gray-500">
                              {conversation.members?.length || 0} participant(s)
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {conversation.isPrivate && (
                            <Badge variant="outline">Privé</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Aucune conversation
                    </h3>
                    <p className="text-gray-600 mb-4">
                      Créez la première conversation de ce groupe
                    </p>
                    {isAdmin && (
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Créer une conversation
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
