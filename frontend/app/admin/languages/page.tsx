'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Globe, 
  ArrowLeft, 
  TrendingUp,
  Calendar,
  MessageSquare,
  Users,
  BarChart3,
  PieChart,
  Activity
} from 'lucide-react';
import { adminService } from '@/services/admin.service';
import { toast } from 'sonner';

interface LanguageStats {
  language: string;
  count: number;
  percentage: number;
  trend: 'up' | 'down' | 'stable';
  messages: number;
  users: number;
  translations: number;
}

interface LanguageData {
  topLanguages: Array<{
    language: string;
    count: number;
  }>;
  totalMessages: number;
  totalUsers: number;
  totalTranslations: number;
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

export default function AdminLanguagesPage() {
  const router = useRouter();
  const [languageData, setLanguageData] = useState<LanguageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('all');

  useEffect(() => {
    loadLanguageStats();
  }, [selectedPeriod]);

  const loadLanguageStats = async () => {
    try {
      setLoading(true);
      const response = await adminService.getDashboardStats();
      
      if (response.data) {
        const stats = response.data.statistics;
        setLanguageData({
          topLanguages: stats.topLanguages || [],
          totalMessages: stats.totalMessages || 0,
          totalUsers: stats.totalUsers || 0,
          totalTranslations: stats.totalTranslations || 0
        });
      }
    } catch (error) {
      console.error('Erreur lors du chargement des statistiques de langues:', error);
      toast.error('Erreur lors du chargement des statistiques de langues');
    } finally {
      setLoading(false);
    }
  };

  const getLanguageName = (code: string) => {
    return languageNames[code] || code.toUpperCase();
  };

  const getLanguageFlag = (code: string) => {
    // Emojis de drapeaux pour les langues principales
    const flags: Record<string, string> = {
      'fr': '🇫🇷',
      'en': '🇺🇸',
      'es': '🇪🇸',
      'de': '🇩🇪',
      'it': '🇮🇹',
      'pt': '🇵🇹',
      'ru': '🇷🇺',
      'zh': '🇨🇳',
      'ja': '🇯🇵',
      'ko': '🇰🇷',
      'ar': '🇸🇦',
      'hi': '🇮🇳',
      'nl': '🇳🇱',
      'sv': '🇸🇪',
      'da': '🇩🇰',
      'no': '🇳🇴',
      'fi': '🇫🇮',
      'pl': '🇵🇱',
      'tr': '🇹🇷',
      'th': '🇹🇭',
      'vi': '🇻🇳',
      'id': '🇮🇩',
      'he': '🇮🇱',
      'uk': '🇺🇦',
      'cs': '🇨🇿',
      'hu': '🇭🇺',
      'ro': '🇷🇴',
      'bg': '🇧🇬',
      'hr': '🇭🇷',
      'sk': '🇸🇰',
      'sl': '🇸🇮',
      'et': '🇪🇪',
      'lv': '🇱🇻',
      'lt': '🇱🇹',
      'mt': '🇲🇹',
      'cy': '🇬🇧',
      'ga': '🇮🇪',
      'is': '🇮🇸',
      'eu': '🇪🇸',
      'ca': '🇪🇸',
      'gl': '🇪🇸'
    };
    return flags[code] || '🌐';
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'down':
        return <TrendingUp className="h-4 w-4 text-red-600 rotate-180" />;
      default:
        return <Activity className="h-4 w-4 text-gray-600" />;
    }
  };

  if (loading) {
    return (
      <AdminLayout currentPage="/admin/languages">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2">Chargement des statistiques de langues...</span>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout currentPage="/admin/languages">
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
              <h1 className="text-2xl font-bold text-gray-900">Statistiques des langues</h1>
              <p className="text-gray-600">Analyse de l'utilisation des langues sur la plateforme</p>
            </div>
          </div>
        </div>

        {/* Statistiques générales */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Langues détectées</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{languageData?.topLanguages.length || 0}</div>
              <Badge variant="outline" className="mt-1">Langues uniques</Badge>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Messages analysés</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{languageData?.totalMessages || 0}</div>
              <Badge variant="outline" className="mt-1">Total messages</Badge>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Utilisateurs multilingues</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{languageData?.totalUsers || 0}</div>
              <Badge variant="outline" className="mt-1">Utilisateurs actifs</Badge>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Traductions effectuées</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{languageData?.totalTranslations || 0}</div>
              <Badge variant="outline" className="mt-1">Traductions totales</Badge>
            </CardContent>
          </Card>
        </div>

        {/* Classement des langues */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BarChart3 className="h-5 w-5" />
              <span>Classement des langues les plus utilisées</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {languageData?.topLanguages.length === 0 ? (
              <div className="text-center py-12">
                <Globe className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Aucune donnée de langue disponible
                </h3>
                <p className="text-gray-600">
                  Les statistiques de langues seront disponibles une fois que des messages auront été analysés.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {languageData?.topLanguages.map((lang, index) => {
                  const percentage = languageData.totalMessages > 0 
                    ? (lang.count / languageData.totalMessages) * 100 
                    : 0;
                  
                  return (
                    <div key={lang.language} className="flex items-center space-x-4 p-4 border rounded-lg hover:bg-gray-50">
                      {/* Position */}
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                        {index + 1}
                      </div>

                      {/* Drapeau et nom */}
                      <div className="flex items-center space-x-3 flex-shrink-0">
                        <span className="text-2xl">{getLanguageFlag(lang.language)}</span>
                        <div>
                          <div className="font-semibold text-gray-900">
                            {getLanguageName(lang.language)}
                          </div>
                          <div className="text-sm text-gray-500">
                            {lang.language.toUpperCase()}
                          </div>
                        </div>
                      </div>

                      {/* Barre de progression */}
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-700">
                            {lang.count.toLocaleString()} messages
                          </span>
                          <span className="text-sm text-gray-500">
                            {percentage.toFixed(1)}%
                          </span>
                        </div>
                        <Progress value={percentage} className="h-2" />
                      </div>

                      {/* Statistiques supplémentaires */}
                      <div className="flex items-center space-x-4 text-sm text-gray-600 flex-shrink-0">
                        <div className="flex items-center space-x-1">
                          <MessageSquare className="h-4 w-4" />
                          <span>{lang.count}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          {getTrendIcon('stable')}
                          <span>Stable</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Répartition par langues */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <PieChart className="h-5 w-5" />
                <span>Répartition des langues</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {languageData?.topLanguages.length === 0 ? (
                <div className="text-center py-8">
                  <PieChart className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-600">Aucune donnée disponible</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {languageData?.topLanguages.slice(0, 8).map((lang, index) => {
                    const percentage = languageData.totalMessages > 0 
                      ? (lang.count / languageData.totalMessages) * 100 
                      : 0;
                    
                    const colors = [
                      'bg-blue-500',
                      'bg-green-500',
                      'bg-purple-500',
                      'bg-orange-500',
                      'bg-red-500',
                      'bg-yellow-500',
                      'bg-pink-500',
                      'bg-indigo-500'
                    ];
                    
                    return (
                      <div key={lang.language} className="flex items-center space-x-3">
                        <div className={`w-4 h-4 rounded-full ${colors[index % colors.length]}`}></div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">
                              {getLanguageFlag(lang.language)} {getLanguageName(lang.language)}
                            </span>
                            <span className="text-sm text-gray-500">
                              {percentage.toFixed(1)}%
                            </span>
                          </div>
                          <Progress value={percentage} className="h-1 mt-1" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5" />
                <span>Tendances d'utilisation</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-center py-8">
                  <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-600">Les tendances seront disponibles prochainement</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Analyse des évolutions d'utilisation des langues dans le temps
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Informations sur la détection de langues */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Globe className="h-5 w-5" />
              <span>À propos de la détection de langues</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Comment ça marche ?</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Analyse automatique du contenu des messages</li>
                  <li>• Détection basée sur des modèles de langage avancés</li>
                  <li>• Support de plus de 40 langues</li>
                  <li>• Mise à jour en temps réel des statistiques</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Langues supportées</h4>
                <div className="text-sm text-gray-600">
                  <p className="mb-2">
                    Notre système détecte automatiquement les langues suivantes :
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(languageNames).slice(0, 12).map(([code, name]) => (
                      <Badge key={code} variant="outline" className="text-xs">
                        {getLanguageFlag(code)} {name}
                      </Badge>
                    ))}
                    <Badge variant="outline" className="text-xs">
                      +{Object.keys(languageNames).length - 12} autres
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
