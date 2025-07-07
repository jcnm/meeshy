'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ResponsiveTabs } from '@/components/ui/responsive-tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Database, 
  Trash2, 
  Download, 
  Upload, 
  BarChart3, 
  Search,
  Clock,
  Target,
  TrendingUp
} from 'lucide-react';
import { useTranslationCache } from '@/hooks/use-translation-cache';
import { formatLanguageName } from '@/utils/language-detection';

interface CacheManagerProps {
  className?: string;
}

export function CacheManager({ className }: CacheManagerProps) {
  const {
    stats,
    hitCount,
    missCount,
    getEntriesByLanguage,
    clear,
    exportCache,
    importCache,
    config,
  } = useTranslationCache();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('');
  const [importData, setImportData] = useState('');

  // Calculer les métriques
  const totalRequests = hitCount + missCount;
  const hitRatePercentage = totalRequests > 0 ? (hitCount / totalRequests) * 100 : 0;
  const sizeInKB = Math.round(stats.totalSize / 1024);
  const maxSizeInKB = Math.round(config.maxSize / 1024);
  const usagePercentage = (stats.totalSize / config.maxSize) * 100;

  // Obtenir les entrées filtrées
  const filteredEntries = getEntriesByLanguage()
    .filter(entry => {
      const matchesSearch = !searchTerm || 
        entry.value.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.sourceLanguage.includes(searchTerm) ||
        entry.targetLanguage.includes(searchTerm);
      
      const matchesLanguage = !selectedLanguage ||
        entry.sourceLanguage === selectedLanguage ||
        entry.targetLanguage === selectedLanguage;
      
      return matchesSearch && matchesLanguage;
    })
    .sort((a, b) => b.lastAccessed - a.lastAccessed);

  // Obtenir les langues uniques
  const allLanguages = Array.from(new Set([
    ...getEntriesByLanguage().map(entry => entry.sourceLanguage),
    ...getEntriesByLanguage().map(entry => entry.targetLanguage),
  ])).sort();

  const handleExport = () => {
    const data = exportCache();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meeshy-cache-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    if (importData.trim()) {
      const success = importCache(importData);
      if (success) {
        setImportData('');
        alert('Cache importé avec succès !');
      } else {
        alert('Erreur lors de l\'importation du cache');
      }
    }
  };

  const formatAge = (timestamp: number) => {
    const age = Date.now() - timestamp;
    const hours = Math.floor(age / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      return `${days}j ${hours % 24}h`;
    } else if (hours > 0) {
      return `${hours}h`;
    } else {
      return 'Récent';
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Database className="h-4 w-4 sm:h-5 sm:w-5" />
              Gestionnaire de Cache
            </CardTitle>
            <CardDescription className="text-sm sm:text-base">
              Gestion et statistiques du cache de traduction
            </CardDescription>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" size="sm" onClick={handleExport} className="w-full sm:w-auto">
              <Download className="h-4 w-4 mr-1" />
              <span className="text-xs sm:text-sm">Exporter</span>
            </Button>
            <Button variant="outline" size="sm" onClick={clear} className="w-full sm:w-auto">
              <Trash2 className="h-4 w-4 mr-1" />
              <span className="text-xs sm:text-sm">Vider</span>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="stats" className="space-y-4">
          <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 h-auto">
            <TabsTrigger value="stats" className="text-xs sm:text-sm">Statistiques</TabsTrigger>
            <TabsTrigger value="entries" className="text-xs sm:text-sm">Entrées</TabsTrigger>
            <TabsTrigger value="management" className="text-xs sm:text-sm">Gestion</TabsTrigger>
          </TabsList>

          <TabsContent value="stats" className="space-y-4">
            {/* Métriques principales */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <Card className="p-3 sm:p-4">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-blue-600" />
                  <div>
                    <p className="text-xs sm:text-sm text-muted-foreground">Entrées</p>
                    <p className="text-lg sm:text-2xl font-bold">{stats.totalEntries}</p>
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  <div>
                    <p className="text-sm text-muted-foreground">Taux de réussite</p>
                    <p className="text-2xl font-bold">{hitRatePercentage.toFixed(1)}%</p>
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-purple-600" />
                  <div>
                    <p className="text-sm text-muted-foreground">Taille</p>
                    <p className="text-2xl font-bold">{sizeInKB}KB</p>
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-orange-600" />
                  <div>
                    <p className="text-sm text-muted-foreground">Requêtes</p>
                    <p className="text-2xl font-bold">{totalRequests}</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Utilisation de l'espace */}
            <Card className="p-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Utilisation de l&apos;espace</span>
                  <span>{sizeInKB}KB / {maxSizeInKB}KB</span>
                </div>
                <Progress value={usagePercentage} className="h-2" />
              </div>
            </Card>

            {/* Détails des performances */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="p-4">
                <h4 className="font-medium mb-2">Performance du cache</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Hits:</span>
                    <Badge variant="default">{hitCount}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Miss:</span>
                    <Badge variant="secondary">{missCount}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Efficacité:</span>
                    <Badge variant={hitRatePercentage > 70 ? "default" : "destructive"}>
                      {hitRatePercentage.toFixed(1)}%
                    </Badge>
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <h4 className="font-medium mb-2">Configuration</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Max entrées:</span>
                    <span>{config.maxEntries}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Taille max:</span>
                    <span>{Math.round(config.maxSize / 1024)}KB</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Expiration:</span>
                    <span>{config.maxAge / (24 * 60 * 60 * 1000)}j</span>
                  </div>
                </div>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="entries" className="space-y-4">
            {/* Filtres */}
            <div className="flex gap-2">
              <div className="flex-1">
                <Label htmlFor="search">Rechercher</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search"
                    placeholder="Rechercher dans les traductions..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="language">Langue</Label>
                <select
                  id="language"
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Toutes les langues</option>
                  {allLanguages.map(lang => (
                    <option key={lang} value={lang}>
                      {formatLanguageName(lang, 'both')}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Liste des entrées */}
            <ScrollArea className="h-96">
              <div className="space-y-2">
                {filteredEntries.map((entry, index) => (
                  <Card key={index} className="p-3">
                    <div className="space-y-2">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="text-sm font-medium truncate">
                            {entry.value}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {formatLanguageName(entry.sourceLanguage, 'native')} → {formatLanguageName(entry.targetLanguage, 'native')}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              {entry.accessCount} accès
                            </Badge>
                          </div>
                        </div>
                        <div className="text-right text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatAge(entry.lastAccessed)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
                {filteredEntries.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    Aucune entrée trouvée
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="management" className="space-y-4">
            {/* Import/Export */}
            <Card className="p-4">
              <h4 className="font-medium mb-4">Import/Export du cache</h4>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="import-data">Importer des données</Label>
                  <textarea
                    id="import-data"
                    placeholder="Collez ici les données JSON du cache..."
                    value={importData}
                    onChange={(e) => setImportData(e.target.value)}
                    className="w-full h-32 p-2 border rounded-md text-sm"
                  />
                  <Button onClick={handleImport} className="mt-2" disabled={!importData.trim()}>
                    <Upload className="h-4 w-4 mr-1" />
                    Importer
                  </Button>
                </div>
              </div>
            </Card>

            {/* Actions de maintenance */}
            <Card className="p-4">
              <h4 className="font-medium mb-4">Maintenance</h4>
              <div className="space-y-2">
                <Button variant="destructive" onClick={clear} className="w-full">
                  <Trash2 className="h-4 w-4 mr-1" />
                  Vider complètement le cache
                </Button>
                <p className="text-xs text-muted-foreground">
                  Cette action supprimera définitivement toutes les traductions mises en cache.
                </p>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
