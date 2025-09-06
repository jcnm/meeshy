'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, Users, Settings, UserPlus } from 'lucide-react';
import { Group } from '@/types/frontend';
import { UserRoleEnum } from '@shared/types';
import { useUser } from '@/context/AppContext';
import { ResponsiveLayout } from '@/components/layout/ResponsiveLayout';
import { groupsService } from '@/services/groups.service';
import { toast } from 'sonner';

export default function GroupPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useUser();
  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);

  const groupId = params?.id as string;

  const loadGroup = useCallback(async () => {
    try {
      setLoading(true);
      
      // Appel API réel via le service
      const response = await groupsService.getGroupById(groupId);
      setGroup(response.data);
      
    } catch (error) {
      console.error('Erreur lors du chargement du groupe:', error);
      toast.error('Erreur lors du chargement du groupe');
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    if (groupId) {
      loadGroup();
    }
  }, [groupId, loadGroup]);

  const handleBack = () => {
    router.push('/groups');
  };

  if (loading) {
    return (
      <ResponsiveLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p>Chargement du groupe...</p>
          </div>
        </div>
      </ResponsiveLayout>
    );
  }

  if (!group) {
    return (
      <ResponsiveLayout>
        <div className="flex items-center justify-center h-full">
          <Card>
            <CardContent className="text-center py-8">
              <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">Groupe non trouvé</h3>
              <p className="text-muted-foreground mb-4">
                Le groupe demandé n&apos;existe pas ou vous n&apos;y avez pas accès.
              </p>
              <Button onClick={handleBack}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Retour aux groupes
              </Button>
            </CardContent>
          </Card>
        </div>
      </ResponsiveLayout>
    );
  }

  const currentMember = group.members.find(m => m.userId === user?.id);
  const isAdmin = currentMember?.role === UserRoleEnum.ADMIN;

  return (
    <ResponsiveLayout>
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{group.name}</h1>
            {group.description && (
              <p className="text-muted-foreground">{group.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={group.isPrivate ? 'destructive' : 'secondary'}>
              {group.isPrivate ? 'Privé' : 'Public'}
            </Badge>
            {isAdmin && (
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Gérer
              </Button>
            )}
          </div>
        </div>

        {/* Membres */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Membres ({group.members.length})
              </span>
              {isAdmin && (
                <Button variant="outline" size="sm">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Inviter
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {group.members.map((member) => (
                <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={member.user.avatar} />
                      <AvatarFallback>
                        {member.user.firstName?.[0]}{member.user.lastName?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">
                        {member.user.firstName} {member.user.lastName}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        @{member.user.username}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={member.role === UserRoleEnum.ADMIN ? 'default' : 'secondary'}>
                      {member.role === UserRoleEnum.ADMIN ? 'Admin' : 'Membre'}
                    </Badge>
                    <div className={`h-2 w-2 rounded-full ${member.user.isOnline ? 'bg-green-500' : 'bg-gray-300'}`} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Conversations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Conversations du groupe
            </CardTitle>
          </CardHeader>
          <CardContent>
            {group.conversations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Aucune conversation dans ce groupe</p>
                <p className="text-sm">Les conversations apparaîtront ici une fois créées</p>
              </div>
            ) : (
              <div className="space-y-2">
                {group.conversations.map((conversation) => (
                  <div key={conversation.id} className="p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                    <p className="font-medium">Conversation {conversation.id}</p>
                    <p className="text-sm text-muted-foreground">
                      {conversation.participants?.length || 0} participants
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ResponsiveLayout>
  );
}
