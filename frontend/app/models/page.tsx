'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Download, 
  Trash2, 
  HardDrive,
  Cpu,
  Globe,
  Brain
} from 'lucide-react';
import { toast } from 'sonner';

interface ModelInfo {
  id: string;
  name: string;
  type: 'MT5' | 'NLLB';
  size: number;
  sizeFormatted: string;
  downloadProgress?: number;
  isDownloaded: boolean;
  isActive: boolean;
  description: string;
  languages?: string[];
}

export default function ModelsPage() {
  const [activeTab, setActiveTab] = useState('available');
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [downloadingModels, setDownloadingModels] = useState<Set<string>>(new Set());
  const [systemInfo, setSystemInfo] = useState({
    totalSpace: 0,
    usedSpace: 0,
    availableSpace: 0,
    memoryUsage: 0
  });

  // Gestion des ancrages URL pour les tabs
  useEffect(() => {
    // Lire l'ancrage depuis l'URL au chargement
    const hash = window.location.hash.slice(1); // Enlever le #
    if (hash && ['available', 'downloaded'].includes(hash)) {
      setActiveTab(hash);
    }
  }, []);

  // Mettre à jour l'URL quand l'onglet change
  useEffect(() => {
    if (activeTab !== 'available') {
      window.history.replaceState({}, '', `${window.location.pathname}#${activeTab}`);
    } else {
      // Supprimer l'ancrage pour l'onglet par défaut
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [activeTab]);

  // Charger les données des modèles
  useEffect(() => {
    const loadModels = () => {
      // Simulation des modèles disponibles
      const mockModels: ModelInfo[] = [
        {
          id: 'mt5-small',
          name: 'MT5 Small',
          type: 'MT5',
          size: 242000000,
          sizeFormatted: '242 MB',
          isDownloaded: true,
          isActive: true,
          description: 'Modèle compact pour traductions courtes et rapides',
          languages: ['fr', 'en', 'es', 'de', 'it']
        },
        {
          id: 'nllb-200-600m',
          name: 'NLLB-200 (600M)',
          type: 'NLLB',
          size: 600000000,
          sizeFormatted: '600 MB',
          isDownloaded: false,
          isActive: false,
          description: 'Modèle polyglotte pour 200+ langues',
          languages: ['200+ langues supportées']
        },
        {
          id: 'mt5-base',
          name: 'MT5 Base',
          type: 'MT5',
          size: 850000000,
          sizeFormatted: '850 MB',
          isDownloaded: false,
          isActive: false,
          description: 'Modèle plus performant avec meilleure qualité',
          languages: ['fr', 'en', 'es', 'de', 'it', 'pt', 'ru', 'zh']
        },
        {
          id: 'nllb-200-1.3b',
          name: 'NLLB-200 (1.3B)',
          type: 'NLLB',
          size: 1300000000,
          sizeFormatted: '1.3 GB',
          isDownloaded: false,
          isActive: false,
          description: 'Modèle haute qualité pour traductions complexes',
          languages: ['200+ langues supportées']
        }
      ];

      setModels(mockModels);
    };

    const loadSystemInfo = () => {
      // Simulation des informations système
      setSystemInfo({
        totalSpace: 2000000000, // 2 GB
        usedSpace: 242000000,   // 242 MB
        availableSpace: 1758000000, // ~1.76 GB
        memoryUsage: 45 // 45%
      });
    };

    loadModels();
    loadSystemInfo();
  }, []);

  const handleDownloadModel = async (modelId: string) => {
    setDownloadingModels(prev => new Set(prev).add(modelId));
    
    try {
      // Simulation du téléchargement
      const model = models.find(m => m.id === modelId);
      if (!model) return;

      // Simulation du progrès de téléchargement
      for (let progress = 0; progress <= 100; progress += 10) {
        await new Promise(resolve => setTimeout(resolve, 200));
        setModels(prev => prev.map(m => 
          m.id === modelId ? { ...m, downloadProgress: progress } : m
        ));
      }

      // Marquer comme téléchargé
      setModels(prev => prev.map(m => 
        m.id === modelId ? { ...m, isDownloaded: true, downloadProgress: undefined } : m
      ));

      toast.success(`Modèle ${model.name} téléchargé avec succès`);
    } catch {
      toast.error('Erreur lors du téléchargement');
    } finally {
      setDownloadingModels(prev => {
        const newSet = new Set(prev);
        newSet.delete(modelId);
        return newSet;
      });
    }
  };

  const handleDeleteModel = async (modelId: string) => {
    const model = models.find(m => m.id === modelId);
    if (!model) return;

    try {
      setModels(prev => prev.map(m => 
        m.id === modelId ? { ...m, isDownloaded: false, isActive: false } : m
      ));
      toast.success(`Modèle ${model.name} supprimé`);
    } catch {
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleActivateModel = (modelId: string) => {
    setModels(prev => prev.map(m => ({
      ...m,
      isActive: m.id === modelId ? true : false
    })));
    
    const model = models.find(m => m.id === modelId);
    toast.success(`Modèle ${model?.name} activé`);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const downloadedModels = models.filter(m => m.isDownloaded);
  const availableModels = models.filter(m => !m.isDownloaded);

  return (
    <DashboardLayout title="Modèles de traduction">
      <div className="space-y-6">
        {/* En-tête avec informations système */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Espace utilisé</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatBytes(systemInfo.usedSpace)}</div>
              <Progress value={(systemInfo.usedSpace / systemInfo.totalSpace) * 100} className="mt-2" />
              <p className="text-sm text-gray-500 mt-1">
                {formatBytes(systemInfo.availableSpace)} disponibles
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Modèles téléchargés</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{downloadedModels.length}</div>
              <p className="text-sm text-gray-500">sur {models.length} disponibles</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Utilisation mémoire</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{systemInfo.memoryUsage}%</div>
              <Progress value={systemInfo.memoryUsage} className="mt-2" />
              <p className="text-sm text-gray-500 mt-1">Mémoire TensorFlow.js</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs avec gestion d'ancrages */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="available" className="flex items-center space-x-2">
              <Download className="h-4 w-4" />
              <span>Disponibles ({availableModels.length})</span>
            </TabsTrigger>
            <TabsTrigger value="downloaded" className="flex items-center space-x-2">
              <HardDrive className="h-4 w-4" />
              <span>Téléchargés ({downloadedModels.length})</span>
            </TabsTrigger>
          </TabsList>

          {/* Modèles disponibles */}
          <TabsContent value="available" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Modèles disponibles au téléchargement</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {availableModels.map((model) => (
                    <div key={model.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg">
                          {model.type === 'MT5' ? <Brain className="h-6 w-6 text-blue-600" /> : <Globe className="h-6 w-6 text-green-600" />}
                        </div>
                        <div>
                          <h3 className="font-medium">{model.name}</h3>
                          <p className="text-sm text-gray-600">{model.description}</p>
                          <div className="flex items-center space-x-2 mt-1">
                            <Badge variant="outline">{model.type}</Badge>
                            <Badge variant="secondary">{model.sizeFormatted}</Badge>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {model.downloadProgress !== undefined ? (
                          <div className="flex items-center space-x-2">
                            <Progress value={model.downloadProgress} className="w-24" />
                            <span className="text-sm">{model.downloadProgress}%</span>
                          </div>
                        ) : (
                          <Button 
                            onClick={() => handleDownloadModel(model.id)}
                            disabled={downloadingModels.has(model.id)}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Télécharger
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Modèles téléchargés */}
          <TabsContent value="downloaded" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Modèles téléchargés</CardTitle>
              </CardHeader>
              <CardContent>
                {downloadedModels.length > 0 ? (
                  <div className="space-y-4">
                    {downloadedModels.map((model) => (
                      <div key={model.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-lg">
                            {model.type === 'MT5' ? <Brain className="h-6 w-6 text-green-600" /> : <Globe className="h-6 w-6 text-green-600" />}
                          </div>
                          <div>
                            <h3 className="font-medium">{model.name}</h3>
                            <p className="text-sm text-gray-600">{model.description}</p>
                            <div className="flex items-center space-x-2 mt-1">
                              <Badge variant="outline">{model.type}</Badge>
                              <Badge variant="secondary">{model.sizeFormatted}</Badge>
                              {model.isActive && <Badge className="bg-green-600">Actif</Badge>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {!model.isActive && (
                            <Button 
                              onClick={() => handleActivateModel(model.id)}
                              variant="outline"
                            >
                              <Cpu className="h-4 w-4 mr-2" />
                              Activer
                            </Button>
                          )}
                          <Button 
                            onClick={() => handleDeleteModel(model.id)}
                            variant="outline"
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Brain className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Aucun modèle téléchargé</h3>
                    <p className="text-gray-600 mb-4">Téléchargez des modèles pour activer la traduction</p>
                    <Button onClick={() => setActiveTab('available')}>
                      <Download className="h-4 w-4 mr-2" />
                      Voir les modèles disponibles
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
