'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  UserPlus, 
  ArrowLeft, 
  Search, 
  Filter,
  Calendar,
  User,
  Users,
  CheckCircle,
  XCircle,
  Clock,
  Mail,
  Send
} from 'lucide-react';
import { adminService } from '@/services/admin.service';
import { toast } from 'sonner';

interface Invitation {
  id: string;
  senderId: string;
  receiverId: string;
  communityId?: string;
  conversationId?: string;
  type: 'friend' | 'community' | 'conversation';
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  message?: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
  sender: {
    id: string;
    username: string;
    displayName?: string;
    avatar?: string;
  };
  receiver: {
    id: string;
    username: string;
    displayName?: string;
    avatar?: string;
  };
  community?: {
    id: string;
    name: string;
    identifier?: string;
    avatar?: string;
  };
  conversation?: {
    id: string;
    title?: string;
    identifier?: string;
    type: string;
  };
}

export default function AdminInvitationsPage() {
  const router = useRouter();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Pour cette démo, nous simulons des données d'invitations
  // car nous utilisons les demandes d'amitié comme proxy dans le backend
  useEffect(() => {
    loadInvitations();
  }, [currentPage, searchTerm, statusFilter, typeFilter]);

  const loadInvitations = async () => {
    try {
      setLoading(true);
      
      // Simulation de données pour la démo
      const mockInvitations: Invitation[] = [
        {
          id: '1',
          senderId: 'user1',
          receiverId: 'user2',
          type: 'friend',
          status: 'pending',
          message: 'Salut ! J\'aimerais être ton ami sur Meeshy.',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          sender: {
            id: 'user1',
            username: 'alice_user',
            displayName: 'Alice Martin',
            avatar: undefined
          },
          receiver: {
            id: 'user2',
            username: 'bob_user',
            displayName: 'Bob Dupont',
            avatar: undefined
          }
        },
        {
          id: '2',
          senderId: 'user3',
          receiverId: 'user4',
          communityId: 'comm1',
          type: 'community',
          status: 'accepted',
          message: 'Rejoins notre communauté de développeurs !',
          createdAt: new Date(Date.now() - 3600000).toISOString(),
          updatedAt: new Date(Date.now() - 1800000).toISOString(),
          sender: {
            id: 'user3',
            username: 'charlie_user',
            displayName: 'Charlie Dev',
            avatar: undefined
          },
          receiver: {
            id: 'user4',
            username: 'diana_user',
            displayName: 'Diana Code',
            avatar: undefined
          },
          community: {
            id: 'comm1',
            name: 'Développeurs Meeshy',
            identifier: 'dev-community',
            avatar: undefined
          }
        },
        {
          id: '3',
          senderId: 'user5',
          receiverId: 'user6',
          conversationId: 'conv1',
          type: 'conversation',
          status: 'rejected',
          message: 'Viens participer à notre discussion sur les nouvelles fonctionnalités.',
          createdAt: new Date(Date.now() - 7200000).toISOString(),
          updatedAt: new Date(Date.now() - 3600000).toISOString(),
          sender: {
            id: 'user5',
            username: 'eve_user',
            displayName: 'Eve Manager',
            avatar: undefined
          },
          receiver: {
            id: 'user6',
            username: 'frank_user',
            displayName: 'Frank User',
            avatar: undefined
          },
          conversation: {
            id: 'conv1',
            title: 'Discussion Nouvelles Fonctionnalités',
            identifier: 'features-discussion',
            type: 'group'
          }
        }
      ];

      // Filtrage simulé
      let filteredInvitations = mockInvitations;
      
      if (searchTerm) {
        filteredInvitations = filteredInvitations.filter(invitation => 
          invitation.sender.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          invitation.sender.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
          invitation.receiver.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          invitation.receiver.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
          invitation.message?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          invitation.community?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          invitation.conversation?.title?.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }
      
      if (statusFilter) {
        filteredInvitations = filteredInvitations.filter(invitation => invitation.status === statusFilter);
      }
      
      if (typeFilter) {
        filteredInvitations = filteredInvitations.filter(invitation => invitation.type === typeFilter);
      }

      setInvitations(filteredInvitations);
      setTotalCount(filteredInvitations.length);
      setTotalPages(Math.ceil(filteredInvitations.length / 20));
      
    } catch (error) {
      console.error('Erreur lors du chargement des invitations:', error);
      toast.error('Erreur lors du chargement des invitations');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handleFilterChange = (filterType: string, value: string) => {
    if (filterType === 'status') {
      setStatusFilter(value === 'all' ? '' : value);
    } else if (filterType === 'type') {
      setTypeFilter(value === 'all' ? '' : value);
    }
    setCurrentPage(1);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      accepted: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      expired: 'bg-gray-100 text-gray-800'
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getStatusLabel = (status: string) => {
    const labels = {
      pending: 'En attente',
      accepted: 'Acceptée',
      rejected: 'Refusée',
      expired: 'Expirée'
    };
    return labels[status as keyof typeof labels] || status;
  };

  const getTypeColor = (type: string) => {
    const colors = {
      friend: 'bg-blue-100 text-blue-800',
      community: 'bg-purple-100 text-purple-800',
      conversation: 'bg-orange-100 text-orange-800'
    };
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getTypeLabel = (type: string) => {
    const labels = {
      friend: 'Amitié',
      community: 'Communauté',
      conversation: 'Conversation'
    };
    return labels[type as keyof typeof labels] || type;
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'friend':
        return <User className="h-4 w-4" />;
      case 'community':
        return <Users className="h-4 w-4" />;
      case 'conversation':
        return <Mail className="h-4 w-4" />;
      default:
        return <UserPlus className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <AdminLayout currentPage="/admin/invitations">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2">Chargement des invitations...</span>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout currentPage="/admin/invitations">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button 
              variant="outline" 
              onClick={() => router.push('/admin')}
              className="flex items-center space-x-2"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Retour</span>
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Gestion des invitations</h1>
              <p className="text-gray-600">Administration des invitations et demandes</p>
            </div>
          </div>
          <Button className="flex items-center space-x-2">
            <Send className="h-4 w-4" />
            <span>Nouvelle invitation</span>
          </Button>
        </div>

        {/* Filtres */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Filter className="h-5 w-5" />
              <span>Filtres et recherche</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Recherche</label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Expéditeur, destinataire, message..."
                    value={searchTerm}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Statut</label>
                <Select value={statusFilter || 'all'} onValueChange={(value) => handleFilterChange('status', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tous les statuts" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les statuts</SelectItem>
                    <SelectItem value="pending">En attente</SelectItem>
                    <SelectItem value="accepted">Acceptées</SelectItem>
                    <SelectItem value="rejected">Refusées</SelectItem>
                    <SelectItem value="expired">Expirées</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Type</label>
                <Select value={typeFilter || 'all'} onValueChange={(value) => handleFilterChange('type', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tous les types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les types</SelectItem>
                    <SelectItem value="friend">Amitié</SelectItem>
                    <SelectItem value="community">Communauté</SelectItem>
                    <SelectItem value="conversation">Conversation</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Actions</label>
                <Button 
                  variant="outline" 
                  onClick={loadInvitations}
                  className="w-full"
                >
                  Actualiser
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Statistiques */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total invitations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalCount}</div>
              <Badge variant="outline" className="mt-1">Invitations trouvées</Badge>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">En attente</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                {invitations?.filter(i => i.status === 'pending').length || 0}
              </div>
              <Badge variant="outline" className="mt-1">À traiter</Badge>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Acceptées</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {invitations?.filter(i => i.status === 'accepted').length || 0}
              </div>
              <Badge variant="outline" className="mt-1">Confirmées</Badge>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Refusées</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {invitations?.filter(i => i.status === 'rejected').length || 0}
              </div>
              <Badge variant="outline" className="mt-1">Déclinées</Badge>
            </CardContent>
          </Card>
        </div>

        {/* Liste des invitations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <UserPlus className="h-5 w-5" />
              <span>Invitations ({totalCount})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!invitations || invitations.length === 0 ? (
              <div className="text-center py-12">
                <UserPlus className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Aucune invitation trouvée
                </h3>
                <p className="text-gray-600">
                  Aucune invitation ne correspond aux critères de recherche actuels.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {invitations.map((invitation) => (
                  <div key={invitation.id} className="border rounded-lg p-6 hover:bg-gray-50">
                    <div className="space-y-4">
                      {/* En-tête avec statut et type */}
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <Badge className={getTypeColor(invitation.type)}>
                              {getTypeIcon(invitation.type)}
                              <span className="ml-1">{getTypeLabel(invitation.type)}</span>
                            </Badge>
                            <Badge className={getStatusColor(invitation.status)}>
                              {getStatusLabel(invitation.status)}
                            </Badge>
                          </div>

                          {invitation.message && (
                            <p className="text-gray-700 mb-3 italic">"{invitation.message}"</p>
                          )}

                          <div className="flex items-center space-x-4 text-sm text-gray-600">
                            <div className="flex items-center space-x-1">
                              <User className="h-4 w-4" />
                              <span>
                                {invitation.sender.displayName || invitation.sender.username} → {invitation.receiver.displayName || invitation.receiver.username}
                              </span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Calendar className="h-4 w-4" />
                              <span>Envoyée le {formatDate(invitation.createdAt)}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Clock className="h-4 w-4" />
                              <span>Mise à jour le {formatDate(invitation.updatedAt)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex space-x-2 ml-4">
                          {invitation.status === 'pending' && (
                            <>
                              <Button variant="outline" size="sm" className="text-green-600">
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Accepter
                              </Button>
                              <Button variant="outline" size="sm" className="text-red-600">
                                <XCircle className="h-4 w-4 mr-1" />
                                Refuser
                              </Button>
                            </>
                          )}
                          <Button variant="outline" size="sm">
                            Voir détails
                          </Button>
                        </div>
                      </div>

                      {/* Informations contextuelles */}
                      {(invitation.community || invitation.conversation) && (
                        <div className="bg-gray-50 rounded-lg p-4">
                          <div className="flex items-center space-x-2 mb-2">
                            {invitation.community ? (
                              <>
                                <Users className="h-4 w-4 text-gray-600" />
                                <span className="font-medium text-gray-900">Communauté</span>
                              </>
                            ) : (
                              <>
                                <Mail className="h-4 w-4 text-gray-600" />
                                <span className="font-medium text-gray-900">Conversation</span>
                              </>
                            )}
                          </div>
                          <div className="text-sm text-gray-600">
                            {invitation.community ? (
                              <div>
                                <div className="font-medium">{invitation.community.name}</div>
                                {invitation.community.identifier && (
                                  <div className="text-xs text-gray-500">
                                    ID: {invitation.community.identifier}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div>
                                <div className="font-medium">
                                  {invitation.conversation?.title || 'Conversation sans nom'}
                                </div>
                                {invitation.conversation?.identifier && (
                                  <div className="text-xs text-gray-500">
                                    ID: {invitation.conversation.identifier}
                                  </div>
                                )}
                                <div className="text-xs text-gray-500">
                                  Type: {invitation.conversation?.type}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <div className="text-sm text-gray-600">
                  Page {currentPage} sur {totalPages} ({totalCount} invitations)
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                  >
                    Précédent
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Suivant
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
