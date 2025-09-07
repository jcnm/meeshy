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
  Users, 
  ArrowLeft, 
  Search, 
  Filter,
  Calendar,
  User,
  Lock,
  Globe,
  Settings,
  Eye,
  Edit,
  Trash2
} from 'lucide-react';
import { adminService } from '@/services/admin.service';
import { toast } from 'sonner';

interface Community {
  id: string;
  identifier?: string;
  name: string;
  description?: string;
  avatar?: string;
  isPrivate: boolean;
  createdAt: string;
  creator: {
    id: string;
    username: string;
    displayName?: string;
    avatar?: string;
  };
  _count: {
    members: number;
    Conversation: number;
  };
}

export default function AdminCommunitiesPage() {
  const router = useRouter();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [privacyFilter, setPrivacyFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    loadCommunities();
  }, [currentPage, searchTerm, privacyFilter]);

  const loadCommunities = async () => {
    try {
      setLoading(true);
      const response = await adminService.getCommunities(
        currentPage, 
        20, 
        searchTerm || undefined, 
        privacyFilter === 'private' ? true : privacyFilter === 'public' ? false : undefined
      );

      if (response.data) {
        setCommunities(response.data.communities || []);
        setTotalCount(response.data.pagination?.total || 0);
        setTotalPages(Math.ceil((response.data.pagination?.total || 0) / 20));
      } else {
        setCommunities([]);
        setTotalCount(0);
        setTotalPages(1);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des communautés:', error);
      toast.error('Erreur lors du chargement des communautés');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handleFilterChange = (value: string) => {
    setPrivacyFilter(value === 'all' ? '' : value);
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

  if (loading) {
    return (
      <AdminLayout currentPage="/admin/communities">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2">Chargement des communautés...</span>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout currentPage="/admin/communities">
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
              <h1 className="text-2xl font-bold text-gray-900">Gestion des communautés</h1>
              <p className="text-gray-600">Administration des communautés et groupes</p>
            </div>
          </div>
          <Button className="flex items-center space-x-2">
            <Users className="h-4 w-4" />
            <span>Nouvelle communauté</span>
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
                    placeholder="Nom, identifiant, description..."
                    value={searchTerm}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Visibilité</label>
                <Select value={privacyFilter || 'all'} onValueChange={handleFilterChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Toutes les communautés" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les communautés</SelectItem>
                    <SelectItem value="public">Publiques</SelectItem>
                    <SelectItem value="private">Privées</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Actions</label>
                <Button 
                  variant="outline" 
                  onClick={loadCommunities}
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
              <CardTitle className="text-sm font-medium text-gray-600">Total communautés</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalCount}</div>
              <Badge variant="outline" className="mt-1">Communautés trouvées</Badge>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Page actuelle</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{currentPage}</div>
              <Badge variant="outline" className="mt-1">sur {totalPages}</Badge>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Communautés publiques</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {communities?.filter(c => !c.isPrivate).length || 0}
              </div>
              <Badge variant="outline" className="mt-1">Visibles par tous</Badge>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Communautés privées</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {communities?.filter(c => c.isPrivate).length || 0}
              </div>
              <Badge variant="outline" className="mt-1">Accès restreint</Badge>
            </CardContent>
          </Card>
        </div>

        {/* Liste des communautés */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Users className="h-5 w-5" />
              <span>Communautés ({totalCount})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!communities || communities.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Aucune communauté trouvée
                </h3>
                <p className="text-gray-600">
                  Aucune communauté ne correspond aux critères de recherche actuels.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {communities.map((community) => (
                  <div key={community.id} className="border rounded-lg p-6 hover:bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-4">
                        {/* Avatar */}
                        <div className="flex-shrink-0">
                          {community.avatar ? (
                            <img
                              src={community.avatar}
                              alt={community.name}
                              className="h-12 w-12 rounded-full object-cover"
                            />
                          ) : (
                            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                              <Users className="h-6 w-6 text-white" />
                            </div>
                          )}
                        </div>

                        {/* Informations */}
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h3 className="text-lg font-semibold text-gray-900">
                              {community.name}
                            </h3>
                            {community.isPrivate ? (
                              <Badge variant="secondary" className="flex items-center space-x-1">
                                <Lock className="h-3 w-3" />
                                <span>Privée</span>
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="flex items-center space-x-1">
                                <Globe className="h-3 w-3" />
                                <span>Publique</span>
                              </Badge>
                            )}
                          </div>

                          {community.identifier && (
                            <p className="text-sm text-gray-600 mb-2">
                              <span className="font-medium">Identifiant:</span> {community.identifier}
                            </p>
                          )}

                          {community.description && (
                            <p className="text-gray-700 mb-3 line-clamp-2">
                              {community.description}
                            </p>
                          )}

                          <div className="flex items-center space-x-6 text-sm text-gray-600">
                            <div className="flex items-center space-x-1">
                              <Users className="h-4 w-4" />
                              <span>{community._count.members} membre(s)</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Calendar className="h-4 w-4" />
                              <span>{community._count.Conversation} conversation(s)</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <User className="h-4 w-4" />
                              <span>Créé par {community.creator.displayName || community.creator.username}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Calendar className="h-4 w-4" />
                              <span>{formatDate(community.createdAt)}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex space-x-2 ml-4">
                        <Button variant="outline" size="sm">
                          <Eye className="h-4 w-4 mr-1" />
                          Voir
                        </Button>
                        <Button variant="outline" size="sm">
                          <Edit className="h-4 w-4 mr-1" />
                          Modifier
                        </Button>
                        <Button variant="outline" size="sm">
                          <Settings className="h-4 w-4 mr-1" />
                          Gérer
                        </Button>
                        <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                          <Trash2 className="h-4 w-4 mr-1" />
                          Supprimer
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <div className="text-sm text-gray-600">
                  Page {currentPage} sur {totalPages} ({totalCount} communautés)
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
