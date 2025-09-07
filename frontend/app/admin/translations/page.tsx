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
  Languages, 
  ArrowLeft, 
  Search, 
  Filter,
  Calendar,
  User,
  Globe,
  Brain,
  TrendingUp,
  Eye,
  RefreshCw
} from 'lucide-react';
import { adminService } from '@/services/admin.service';
import { toast } from 'sonner';

interface Translation {
  id: string;
  sourceLanguage: string;
  targetLanguage: string;
  translatedContent: string;
  translationModel: string;
  confidenceScore?: number;
  createdAt: string;
  message: {
    id: string;
    content: string;
    originalContent?: string; // Ajout du champ pour le contenu original explicite
    originalLanguage: string;
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
}

const languageNames: Record<string, string> = {
  'fr': 'Français',
  'en': 'Anglais',
  'es': 'Espagnol',
  'de': 'Allemand',
  'it': 'Italien',
  'pt': 'Portugais',
  'ru': 'Russe',
  'zh': 'Chinois',
  'ja': 'Japonais',
  'ko': 'Coréen',
  'ar': 'Arabe',
  'hi': 'Hindi',
  'nl': 'Néerlandais',
  'sv': 'Suédois',
  'da': 'Danois',
  'no': 'Norvégien',
  'fi': 'Finnois',
  'pl': 'Polonais',
  'tr': 'Turc',
  'th': 'Thaï',
  'vi': 'Vietnamien',
  'id': 'Indonésien',
  'ms': 'Malais',
  'tl': 'Tagalog',
  'sw': 'Swahili',
  'he': 'Hébreu',
  'uk': 'Ukrainien',
  'cs': 'Tchèque',
  'hu': 'Hongrois',
  'ro': 'Roumain',
  'bg': 'Bulgare',
  'hr': 'Croate',
  'sk': 'Slovaque',
  'sl': 'Slovène',
  'et': 'Estonien',
  'lv': 'Letton',
  'lt': 'Lituanien',
  'mt': 'Maltais',
  'cy': 'Gallois',
  'ga': 'Irlandais',
  'is': 'Islandais',
  'eu': 'Basque',
  'ca': 'Catalan',
  'gl': 'Galicien'
};

export default function AdminTranslationsPage() {
  const router = useRouter();
  const [translations, setTranslations] = useState<Translation[]>([]);
  const [loading, setLoading] = useState(true);
  const [sourceLanguage, setSourceLanguage] = useState('');
  const [targetLanguage, setTargetLanguage] = useState('');
  const [period, setPeriod] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    loadTranslations();
  }, [currentPage, sourceLanguage, targetLanguage, period]);

  // Fonction pour obtenir le contenu original d'un message
  const getOriginalContent = (translation: Translation): string => {
    // Si originalContent est disponible (depuis le backend), l'utiliser
    if (translation.message.originalContent) {
      return translation.message.originalContent;
    }
    
    // Sinon, utiliser le content du message
    return translation.message.content;
  };

  const loadTranslations = async () => {
    try {
      setLoading(true);
      const response = await adminService.getTranslations(
        currentPage, 
        20, 
        sourceLanguage || undefined, 
        targetLanguage || undefined, 
        period || undefined
      );

      if (response.data) {
        setTranslations(response.data.translations || []);
        setTotalCount(response.data.pagination?.total || 0);
        setTotalPages(Math.ceil((response.data.pagination?.total || 0) / 20));
      } else {
        setTranslations([]);
        setTotalCount(0);
        setTotalPages(1);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des traductions:', error);
      toast.error('Erreur lors du chargement des traductions');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (filterType: string, value: string) => {
    if (filterType === 'source') {
      setSourceLanguage(value === 'all' ? '' : value);
    } else if (filterType === 'target') {
      setTargetLanguage(value === 'all' ? '' : value);
    } else if (filterType === 'period') {
      setPeriod(value === 'all' ? '' : value);
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

  const getConfidenceColor = (score?: number) => {
    if (!score) return 'bg-gray-100 text-gray-800';
    if (score >= 0.9) return 'bg-green-100 text-green-800';
    if (score >= 0.7) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const getConfidenceLabel = (score?: number) => {
    if (!score) return 'Inconnu';
    if (score >= 0.9) return 'Excellent';
    if (score >= 0.7) return 'Bon';
    return 'Faible';
  };

  const getLanguageName = (code: string) => {
    return languageNames[code] || code.toUpperCase();
  };

  if (loading) {
    return (
      <AdminLayout currentPage="/admin/translations">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2">Chargement des traductions...</span>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout currentPage="/admin/translations">
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
              <h1 className="text-2xl font-bold text-gray-900">Gestion des traductions</h1>
              <p className="text-gray-600">Administration et statistiques des traductions</p>
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
                <label className="text-sm font-medium">Langue source</label>
                <Select value={sourceLanguage || 'all'} onValueChange={(value) => handleFilterChange('source', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Toutes les langues" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les langues</SelectItem>
                    {Object.entries(languageNames).map(([code, name]) => (
                      <SelectItem key={code} value={code}>
                        {name} ({code.toUpperCase()})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Langue cible</label>
                <Select value={targetLanguage || 'all'} onValueChange={(value) => handleFilterChange('target', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Toutes les langues" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les langues</SelectItem>
                    {Object.entries(languageNames).map(([code, name]) => (
                      <SelectItem key={code} value={code}>
                        {name} ({code.toUpperCase()})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Période</label>
                <Select value={period || 'all'} onValueChange={(value) => handleFilterChange('period', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Toutes les périodes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les périodes</SelectItem>
                    <SelectItem value="today">Aujourd'hui</SelectItem>
                    <SelectItem value="week">Cette semaine</SelectItem>
                    <SelectItem value="month">Ce mois</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Actions</label>
                <Button 
                  variant="outline" 
                  onClick={loadTranslations}
                  className="w-full"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
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
              <CardTitle className="text-sm font-medium text-gray-600">Total traductions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalCount}</div>
              <Badge variant="outline" className="mt-1">Traductions trouvées</Badge>
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
              <CardTitle className="text-sm font-medium text-gray-600">Langues uniques</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {translations ? new Set(translations.map(t => t.sourceLanguage).concat(translations.map(t => t.targetLanguage))).size : 0}
              </div>
              <Badge variant="outline" className="mt-1">Langues détectées</Badge>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Score moyen</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                {translations.length > 0 
                  ? Math.round(translations.reduce((acc, t) => acc + (t.confidenceScore || 0), 0) / translations.length * 100) / 100
                  : 0
                }
              </div>
              <Badge variant="outline" className="mt-1">Confiance moyenne</Badge>
            </CardContent>
          </Card>
        </div>

        {/* Liste des traductions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Languages className="h-5 w-5" />
              <span>Traductions ({totalCount})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!translations || translations.length === 0 ? (
              <div className="text-center py-12">
                <Languages className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Aucune traduction trouvée
                </h3>
                <p className="text-gray-600">
                  Aucune traduction ne correspond aux critères de recherche actuels.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {translations.map((translation) => (
                  <div key={translation.id} className="border rounded-lg p-6 hover:bg-gray-50">
                    <div className="space-y-4">
                      {/* En-tête avec informations de traduction */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center space-x-2">
                            <Badge variant="outline" className="flex items-center space-x-1">
                              <Globe className="h-3 w-3" />
                              <span>{getLanguageName(translation.sourceLanguage)}</span>
                            </Badge>
                            <span className="text-gray-400">→</span>
                            <Badge variant="outline" className="flex items-center space-x-1">
                              <Globe className="h-3 w-3" />
                              <span>{getLanguageName(translation.targetLanguage)}</span>
                            </Badge>
                          </div>
                          <Badge className={getConfidenceColor(translation.confidenceScore)}>
                            {getConfidenceLabel(translation.confidenceScore)}
                            {translation.confidenceScore && (
                              <span className="ml-1">({Math.round(translation.confidenceScore * 100)}%)</span>
                            )}
                          </Badge>
                        </div>
                        <div className="text-sm text-gray-600">
                          {formatDate(translation.createdAt)}
                        </div>
                      </div>

                      {/* Contenu original et traduit */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-2">
                            Message original ({getLanguageName(translation.message.originalLanguage)})
                          </h4>
                          <div className="bg-gray-50 rounded-lg p-3">
                            <p className="text-gray-900">{getOriginalContent(translation)}</p>
                          </div>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-2">
                            Traduction ({getLanguageName(translation.targetLanguage)})
                          </h4>
                          <div className="bg-blue-50 rounded-lg p-3">
                            <p className="text-gray-900">{translation.translatedContent}</p>
                          </div>
                        </div>
                      </div>

                      {/* Métadonnées */}
                      <div className="flex items-center justify-between text-sm text-gray-600">
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center space-x-1">
                            <Brain className="h-4 w-4" />
                            <span>Modèle: {translation.translationModel}</span>
                          </div>
                          {translation.message.sender && (
                            <div className="flex items-center space-x-1">
                              <User className="h-4 w-4" />
                              <span>{translation.message.sender.displayName || translation.message.sender.username}</span>
                            </div>
                          )}
                          <div className="flex items-center space-x-1">
                            <Globe className="h-4 w-4" />
                            <span>
                              {translation.message.conversation.title || 
                               translation.message.conversation.identifier || 
                               'Conversation'}
                            </span>
                          </div>
                        </div>
                        <Button variant="outline" size="sm">
                          <Eye className="h-4 w-4 mr-1" />
                          Voir détails
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
                  Page {currentPage} sur {totalPages} ({totalCount} traductions)
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
