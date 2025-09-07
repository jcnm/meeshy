'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser } from '@/context/AppContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useTranslations } from '@/hooks/useTranslations';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Users,
  Plus,
  ArrowLeft,
  Settings,
  Copy,
  CheckCircle2,
  UserPlus,
  MessageSquare,
  Lock,
  Globe
} from 'lucide-react';
import { toast } from 'sonner';
import type { Group } from '@/types/frontend';
import { buildApiUrl, API_ENDPOINTS } from '@/lib/config';
import { cn } from '@/lib/utils';

interface GroupsLayoutResponsiveProps {
  selectedGroupIdentifier?: string;
}

export function GroupsLayoutResponsive({ selectedGroupIdentifier }: GroupsLayoutResponsiveProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthChecking } = useUser();
  const { t } = useTranslations();

  // Si on est en train de vérifier l'authentification, afficher un loader
  if (isAuthChecking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">{t('authChecking')}</p>
        </div>
      </div>
    );
  }

  // Si pas d'utilisateur après vérification, ne rien afficher
  if (!user) {
    return null;
  }

  // États principaux
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // États UI responsive
  const [showGroupsList, setShowGroupsList] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  // États modaux et formulaires
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);

  // États formulaire
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [newGroupIdentifier, setNewGroupIdentifier] = useState('');
  const [newGroupIsPrivate, setNewGroupIsPrivate] = useState(false);

  // État pour la copie d'identifiant
  const [copiedIdentifier, setCopiedIdentifier] = useState<string | null>(null);

  // Détecter si on est sur mobile
  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  // Gérer la responsivité : masquer/afficher la liste selon la sélection
  useEffect(() => {
    if (isMobile) {
      // Sur mobile, montrer la liste si aucun groupe sélectionné
      setShowGroupsList(!selectedGroup);
    } else {
      // Sur desktop, toujours montrer la liste
      setShowGroupsList(true);
    }
  }, [isMobile, selectedGroup]);

  // Charger les groupes
  const loadGroups = useCallback(async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        console.log('No auth token found');
        return;
      }
      
      console.log('Loading groups with token:', token.substring(0, 20) + '...');
      const response = await fetch(buildApiUrl(API_ENDPOINTS.GROUP.LIST), {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('Groups API response:', response.status, response.statusText);
      
      if (response.ok) {
        const result = await response.json();
        console.log('Groups API result:', result);
        // L'API retourne {success: true, data: [...]}
        const data = result.success ? result.data : result;
        console.log('Groups data:', data);
        setGroups(Array.isArray(data) ? data : []);
      } else if (response.status === 401) {
        console.log('Unauthorized, removing token');
        localStorage.removeItem('auth_token');
        router.push('/');
      } else {
        console.error('Groups API error:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Erreur chargement groupes:', error);
      toast.error('Erreur lors du chargement des groupes');
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  // Charger les détails d'un groupe
  const loadGroupDetails = useCallback(async (identifier: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      const response = await fetch(buildApiUrl(`/communities/${identifier}`), {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const result = await response.json();
        const data = result.success ? result.data : result;
        setSelectedGroup(data);
        
        // Sur mobile, masquer la liste pour afficher les détails
        if (isMobile) {
          setShowGroupsList(false);
        }
      } else {
        console.error('Erreur chargement détails groupe');
        toast.error('Erreur lors du chargement du groupe');
      }
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors du chargement du groupe');
    }
  }, [isMobile]);

  // Sélectionner un groupe depuis la liste
  const handleSelectGroup = useCallback((group: Group) => {
    setSelectedGroup(group);
    router.push(`/groups/mshy_${group.identifier || group.name.toLowerCase().replace(/\s+/g, '-')}`);
  }, [router]);

  // Retour à la liste (mobile uniquement)
  const handleBackToList = useCallback(() => {
    if (isMobile) {
      setShowGroupsList(true);
      setSelectedGroup(null);
      router.push('/groups');
    }
  }, [isMobile, router]);

  // Générer l'identifiant depuis le nom
  const generateIdentifier = useCallback((name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-zA-Z0-9-_@]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }, []);

  // Copier l'identifiant au presse-papier
  const copyIdentifier = useCallback(async (identifier: string) => {
    try {
      await navigator.clipboard.writeText(`mshy_${identifier}`);
      setCopiedIdentifier(identifier);
      toast.success('Identifiant copié !');
      
      // Réinitialiser l'état de copie après 2 secondes
      setTimeout(() => {
        setCopiedIdentifier(null);
      }, 2000);
    } catch (error) {
      console.error('Erreur copie:', error);
      toast.error('Erreur lors de la copie');
    }
  }, []);

  // Créer un groupe
  const createGroup = useCallback(async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      const response = await fetch(buildApiUrl(API_ENDPOINTS.GROUP.CREATE), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newGroupName,
          description: newGroupDescription,
          identifier: newGroupIdentifier,
          isPrivate: newGroupIsPrivate
        })
      });

      if (response.ok) {
        const result = await response.json();
        const data = result.success ? result.data : result;
        
        // Ajouter le nouveau groupe à la liste
        setGroups(prev => [data, ...prev]);
        
        // Réinitialiser le formulaire
        setNewGroupName('');
        setNewGroupDescription('');
        setNewGroupIdentifier('');
        setNewGroupIsPrivate(false);
        setIsCreateModalOpen(false);
        
        toast.success('Groupe créé avec succès !');
      } else {
        const error = await response.json();
        toast.error(error.message || 'Erreur lors de la création');
      }
    } catch (error) {
      console.error('Erreur création groupe:', error);
      toast.error('Erreur lors de la création du groupe');
    }
  }, [newGroupName, newGroupDescription, newGroupIdentifier, newGroupIsPrivate]);

  // Charger les données initiales
  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  // Gérer la sélection depuis l'URL
  useEffect(() => {
    if (selectedGroupIdentifier && groups.length > 0) {
      // Retirer le préfixe mshy_ si présent
      const cleanIdentifier = selectedGroupIdentifier.replace(/^mshy_/, '');
      const group = groups.find(g => g.identifier === cleanIdentifier);
      if (group) {
        setSelectedGroup(group);
        if (isMobile) {
          setShowGroupsList(false);
        }
      } else {
        // Essayer de charger depuis l'API
        loadGroupDetails(cleanIdentifier);
      }
    }
  }, [selectedGroupIdentifier, groups, isMobile, loadGroupDetails]);

  // Mettre à jour l'identifiant automatiquement basé sur le nom
  useEffect(() => {
    if (newGroupName && !newGroupIdentifier) {
      setNewGroupIdentifier(generateIdentifier(newGroupName));
    }
  }, [newGroupName, newGroupIdentifier, generateIdentifier]);

  return (
    <DashboardLayout>
      {/* Contenu principal */}
      <div className="flex h-full">
        {/* Liste des groupes */}
        {showGroupsList && (
          <div className={cn(
            "border-r bg-muted/10",
            isMobile ? "w-full" : "w-80 min-w-80"
          )}>
            <div className="p-4 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Communautés</h2>
                <Button
                  onClick={() => setIsCreateModalOpen(true)}
                  size="sm"
                  className="rounded-xl"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Créer
                </Button>
              </div>
            </div>

            <div className="overflow-y-auto">
              {isLoading ? (
                <div className="p-4 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  <p className="mt-2 text-sm text-muted-foreground">Chargement...</p>
                </div>
              ) : groups.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Aucune communauté</p>
                  <p className="text-xs">Créez-en une pour commencer</p>
                </div>
              ) : (
                <div className="p-2">
                  {groups.map((group) => (
                    <div
                      key={group.id}
                      className={cn(
                        "p-3 mb-2 rounded-lg cursor-pointer transition-colors",
                        "hover:bg-muted/50",
                        selectedGroup?.id === group.id && "bg-primary/10 border border-primary/20"
                      )}
                      onClick={() => handleSelectGroup(group)}
                    >
                      <div className="flex items-start gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={group.avatar || undefined} />
                          <AvatarFallback>
                            {group.name.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium truncate">{group.name}</h3>
                            {group.isPrivate && (
                              <Lock className="h-3 w-3 text-muted-foreground" />
                            )}
                          </div>
                          
                          <div className="flex items-center gap-1 mt-1 group/identifier">
                            <span 
                              className="text-xs text-primary font-mono cursor-pointer hover:text-primary/80 transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                copyIdentifier(group.identifier || generateIdentifier(group.name));
                              }}
                              onMouseEnter={() => {}}
                            >
                              mshy_{group.identifier || generateIdentifier(group.name)}
                            </span>
                            {copiedIdentifier === (group.identifier || generateIdentifier(group.name)) ? (
                              <CheckCircle2 className="h-3 w-3 text-green-500" />
                            ) : (
                              <Copy className="h-3 w-3 text-muted-foreground opacity-0 group-hover/identifier:opacity-100 transition-opacity" />
                            )}
                          </div>
                          
                          {group.description && (
                            <p className="text-xs text-muted-foreground truncate mt-1">
                              {group.description}
                            </p>
                          )}
                          
                          <div className="flex items-center gap-2 mt-2">
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Users className="h-3 w-3" />
                              {group._count?.members || 0}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Détails du groupe */}
        {selectedGroup && (!isMobile || !showGroupsList) && (
          <div className="flex-1 flex flex-col">
            {/* Header du groupe */}
            <div className="p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {isMobile && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleBackToList}
                      className="mr-2"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                  )}
                  
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={selectedGroup.avatar || undefined} />
                    <AvatarFallback>
                      {selectedGroup.name.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div>
                    <div className="flex items-center gap-2">
                      <h1 className="text-lg font-semibold">{selectedGroup.name}</h1>
                      {selectedGroup.isPrivate ? (
                        <Badge variant="secondary" className="text-xs">
                          <Lock className="h-3 w-3 mr-1" />
                          Privée
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          <Globe className="h-3 w-3 mr-1" />
                          Publique
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-1 group/identifier">
                      <span 
                        className="text-sm text-primary font-mono cursor-pointer hover:text-primary/80 transition-colors"
                        onClick={() => copyIdentifier(selectedGroup.identifier || generateIdentifier(selectedGroup.name))}
                      >
                        mshy_{selectedGroup.identifier || generateIdentifier(selectedGroup.name)}
                      </span>
                      {copiedIdentifier === (selectedGroup.identifier || generateIdentifier(selectedGroup.name)) ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4 text-muted-foreground opacity-0 group-hover/identifier:opacity-100 transition-opacity" />
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm">
                    <UserPlus className="h-4 w-4 mr-1" />
                    Inviter
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setIsSettingsModalOpen(true)}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Contenu du groupe */}
            <div className="flex-1 p-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    À propos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    {selectedGroup.description || 'Aucune description disponible.'}
                  </p>
                  
                  <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      {selectedGroup._count?.members || 0} membres
                    </div>
                    <div>
                      Créée le {new Date(selectedGroup.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* État vide desktop */}
        {!selectedGroup && !isMobile && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Users className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="text-lg font-medium mb-2">Sélectionnez une communauté</h3>
              <p className="text-muted-foreground">
                Choisissez une communauté dans la liste pour voir ses détails
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Modal de création */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Créer une communauté</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nom</label>
              <Input
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Nom de la communauté"
                className="mt-1"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">Description (optionnel)</label>
              <Input
                value={newGroupDescription}
                onChange={(e) => setNewGroupDescription(e.target.value)}
                placeholder="Description de la communauté"
                className="mt-1"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">Identifiant</label>
              <div className="flex items-center mt-1">
                <span className="text-sm text-muted-foreground bg-muted px-3 py-2 rounded-l-md border border-r-0">
                  mshy_
                </span>
                <Input
                  value={newGroupIdentifier}
                  onChange={(e) => setNewGroupIdentifier(e.target.value.replace(/[^a-zA-Z0-9-_@]/g, ''))}
                  placeholder="identifiant-unique"
                  className="rounded-l-none"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Lettres, chiffres, tirets, underscores et @ uniquement
              </p>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium">Communauté privée</label>
                <p className="text-xs text-muted-foreground">
                  Seuls les membres invités peuvent rejoindre
                </p>
              </div>
              <Switch
                checked={newGroupIsPrivate}
                onCheckedChange={setNewGroupIsPrivate}
              />
            </div>
            
            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setIsCreateModalOpen(false)}
                className="flex-1"
              >
                Annuler
              </Button>
              <Button
                onClick={createGroup}
                disabled={!newGroupName.trim() || !newGroupIdentifier.trim()}
                className="flex-1"
              >
                Créer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
