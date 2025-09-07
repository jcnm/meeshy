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
  AlertTriangle, 
  ArrowLeft, 
  Search, 
  Filter,
  Calendar,
  User,
  MessageSquare,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  Shield,
  Flag
} from 'lucide-react';
import { adminService } from '@/services/admin.service';
import { toast } from 'sonner';

interface Report {
  id: string;
  messageId: string;
  reporterId: string;
  reason: string;
  description?: string;
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  createdAt: string;
  updatedAt: string;
  message: {
    id: string;
    content: string;
    messageType: string;
    createdAt: string;
    sender?: {
      id: string;
      username: string;
      displayName?: string;
    };
    conversation: {
      id: string;
      identifier?: string;
      title?: string;
    };
  };
  reporter: {
    id: string;
    username: string;
    displayName?: string;
  };
}

export default function AdminReportsPage() {
  const router = useRouter();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Pour cette démo, nous simulons des données de signalements
  // car nous n'avons pas encore implémenté le système de signalements dans le backend
  useEffect(() => {
    loadReports();
  }, [currentPage, searchTerm, statusFilter, priorityFilter]);

  const loadReports = async () => {
    try {
      setLoading(true);
      
      // Simulation de données pour la démo
      // Dans un vrai système, ceci serait un appel API
      const mockReports: Report[] = [
        {
          id: '1',
          messageId: 'msg1',
          reporterId: 'user1',
          reason: 'spam',
          description: 'Message répétitif et non pertinent',
          status: 'pending',
          priority: 'medium',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          message: {
            id: 'msg1',
            content: 'Ceci est un message de spam répétitif...',
            messageType: 'text',
            createdAt: new Date(Date.now() - 3600000).toISOString(),
            sender: {
              id: 'spammer1',
              username: 'spammer_user',
              displayName: 'Utilisateur Spam'
            },
            conversation: {
              id: 'conv1',
              identifier: 'general',
              title: 'Général'
            }
          },
          reporter: {
            id: 'user1',
            username: 'reporter_user',
            displayName: 'Utilisateur Signalant'
          }
        },
        {
          id: '2',
          messageId: 'msg2',
          reporterId: 'user2',
          reason: 'inappropriate_content',
          description: 'Contenu inapproprié et offensant',
          status: 'reviewed',
          priority: 'high',
          createdAt: new Date(Date.now() - 7200000).toISOString(),
          updatedAt: new Date(Date.now() - 1800000).toISOString(),
          message: {
            id: 'msg2',
            content: 'Contenu inapproprié signalé...',
            messageType: 'text',
            createdAt: new Date(Date.now() - 7200000).toISOString(),
            sender: {
              id: 'offender1',
              username: 'offensive_user',
              displayName: 'Utilisateur Offensant'
            },
            conversation: {
              id: 'conv2',
              identifier: 'support',
              title: 'Support'
            }
          },
          reporter: {
            id: 'user2',
            username: 'moderator_user',
            displayName: 'Modérateur'
          }
        }
      ];

      // Filtrage simulé
      let filteredReports = mockReports;
      
      if (searchTerm) {
        filteredReports = filteredReports.filter(report => 
          report.message.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
          report.reason.toLowerCase().includes(searchTerm.toLowerCase()) ||
          report.description?.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }
      
      if (statusFilter) {
        filteredReports = filteredReports.filter(report => report.status === statusFilter);
      }
      
      if (priorityFilter) {
        filteredReports = filteredReports.filter(report => report.priority === priorityFilter);
      }

      setReports(filteredReports);
      setTotalCount(filteredReports.length);
      setTotalPages(Math.ceil(filteredReports.length / 20));
      
    } catch (error) {
      console.error('Erreur lors du chargement des signalements:', error);
      toast.error('Erreur lors du chargement des signalements');
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
    } else if (filterType === 'priority') {
      setPriorityFilter(value === 'all' ? '' : value);
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
      reviewed: 'bg-blue-100 text-blue-800',
      resolved: 'bg-green-100 text-green-800',
      dismissed: 'bg-gray-100 text-gray-800'
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getStatusLabel = (status: string) => {
    const labels = {
      pending: 'En attente',
      reviewed: 'Examiné',
      resolved: 'Résolu',
      dismissed: 'Rejeté'
    };
    return labels[status as keyof typeof labels] || status;
  };

  const getPriorityColor = (priority: string) => {
    const colors = {
      low: 'bg-gray-100 text-gray-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-orange-100 text-orange-800',
      urgent: 'bg-red-100 text-red-800'
    };
    return colors[priority as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getPriorityLabel = (priority: string) => {
    const labels = {
      low: 'Faible',
      medium: 'Moyenne',
      high: 'Élevée',
      urgent: 'Urgente'
    };
    return labels[priority as keyof typeof labels] || priority;
  };

  const getReasonLabel = (reason: string) => {
    const labels = {
      spam: 'Spam',
      inappropriate_content: 'Contenu inapproprié',
      harassment: 'Harcèlement',
      hate_speech: 'Discours de haine',
      violence: 'Violence',
      misinformation: 'Désinformation',
      copyright: 'Violation de droits d\'auteur',
      other: 'Autre'
    };
    return labels[reason as keyof typeof labels] || reason;
  };

  if (loading) {
    return (
      <AdminLayout currentPage="/admin/reports">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2">Chargement des signalements...</span>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout currentPage="/admin/reports">
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
              <h1 className="text-2xl font-bold text-gray-900">Gestion des signalements</h1>
              <p className="text-gray-600">Modération et traitement des signalements</p>
            </div>
          </div>
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
                    placeholder="Contenu, raison, description..."
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
                    <SelectItem value="reviewed">Examiné</SelectItem>
                    <SelectItem value="resolved">Résolu</SelectItem>
                    <SelectItem value="dismissed">Rejeté</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Priorité</label>
                <Select value={priorityFilter || 'all'} onValueChange={(value) => handleFilterChange('priority', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Toutes les priorités" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les priorités</SelectItem>
                    <SelectItem value="low">Faible</SelectItem>
                    <SelectItem value="medium">Moyenne</SelectItem>
                    <SelectItem value="high">Élevée</SelectItem>
                    <SelectItem value="urgent">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Actions</label>
                <Button 
                  variant="outline" 
                  onClick={loadReports}
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
              <CardTitle className="text-sm font-medium text-gray-600">Total signalements</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalCount}</div>
              <Badge variant="outline" className="mt-1">Signalements trouvés</Badge>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">En attente</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                {reports?.filter(r => r.status === 'pending').length || 0}
              </div>
              <Badge variant="outline" className="mt-1">À traiter</Badge>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Résolus</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {reports?.filter(r => r.status === 'resolved').length || 0}
              </div>
              <Badge variant="outline" className="mt-1">Traités</Badge>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Urgents</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {reports?.filter(r => r.priority === 'urgent').length || 0}
              </div>
              <Badge variant="outline" className="mt-1">Priorité urgente</Badge>
            </CardContent>
          </Card>
        </div>

        {/* Liste des signalements */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5" />
              <span>Signalements ({totalCount})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!reports || reports.length === 0 ? (
              <div className="text-center py-12">
                <AlertTriangle className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Aucun signalement trouvé
                </h3>
                <p className="text-gray-600">
                  Aucun signalement ne correspond aux critères de recherche actuels.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {reports.map((report) => (
                  <div key={report.id} className="border rounded-lg p-6 hover:bg-gray-50">
                    <div className="space-y-4">
                      {/* En-tête avec statut et priorité */}
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <Badge className={getStatusColor(report.status)}>
                              {getStatusLabel(report.status)}
                            </Badge>
                            <Badge className={getPriorityColor(report.priority)}>
                              {getPriorityLabel(report.priority)}
                            </Badge>
                            <Badge variant="outline">
                              {getReasonLabel(report.reason)}
                            </Badge>
                          </div>

                          {report.description && (
                            <p className="text-gray-700 mb-3">{report.description}</p>
                          )}

                          <div className="flex items-center space-x-4 text-sm text-gray-600">
                            <div className="flex items-center space-x-1">
                              <Flag className="h-4 w-4" />
                              <span>Signalé par {report.reporter.displayName || report.reporter.username}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Calendar className="h-4 w-4" />
                              <span>Signalé le {formatDate(report.createdAt)}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Clock className="h-4 w-4" />
                              <span>Mis à jour le {formatDate(report.updatedAt)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex space-x-2 ml-4">
                          <Button variant="outline" size="sm">
                            <Eye className="h-4 w-4 mr-1" />
                            Voir
                          </Button>
                          <Button variant="outline" size="sm" className="text-green-600">
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Résoudre
                          </Button>
                          <Button variant="outline" size="sm" className="text-red-600">
                            <XCircle className="h-4 w-4 mr-1" />
                            Rejeter
                          </Button>
                        </div>
                      </div>

                      {/* Message signalé */}
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <div className="flex items-center space-x-2 mb-2">
                          <MessageSquare className="h-4 w-4 text-red-600" />
                          <span className="font-medium text-red-900">Message signalé</span>
                        </div>
                        <div className="text-sm text-gray-700 mb-2">
                          {report.message.content}
                        </div>
                        <div className="flex items-center space-x-4 text-xs text-gray-600">
                          <div className="flex items-center space-x-1">
                            <User className="h-3 w-3" />
                            <span>
                              {report.message.sender 
                                ? (report.message.sender.displayName || report.message.sender.username)
                                : 'Utilisateur anonyme'
                              }
                            </span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Calendar className="h-3 w-3" />
                            <span>{formatDate(report.message.createdAt)}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <MessageSquare className="h-3 w-3" />
                            <span>
                              {report.message.conversation.title || 
                               report.message.conversation.identifier || 
                               'Conversation'}
                            </span>
                          </div>
                        </div>
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
                  Page {currentPage} sur {totalPages} ({totalCount} signalements)
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
