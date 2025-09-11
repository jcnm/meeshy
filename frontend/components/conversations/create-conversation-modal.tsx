'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { User } from '@/types';
import { buildApiUrl, API_ENDPOINTS } from '@/lib/config';
import { toast } from 'sonner';
import { Check, X, Users, Building2, Hash, Search, Plus, Sparkles, UserPlus, Globe, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { IdentifierSuggestions } from './identifier-suggestions';
import { ConversationPreview } from './conversation-preview';
import { SmartSearch } from './smart-search';
import { useTranslations } from '@/hooks/useTranslations';

interface Community {
  id: string;
  name: string;
  description?: string;
  identifier?: string;
  isPrivate: boolean;
  members: Array<{
    id: string;
    username: string;
    displayName?: string;
    avatar?: string;
  }>;
  _count: {
    members: number;
    Conversation: number;
  };
}

interface CreateConversationModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onConversationCreated: (conversationId: string, conversationData?: any) => void;
}

export function CreateConversationModal({
  isOpen,
  onClose,
  currentUser,
  onConversationCreated
}: CreateConversationModalProps) {
  const { t } = useTranslations('createConversationModal');
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Enhanced state for modern features
  const [communities, setCommunities] = useState<Community[]>([]);
  const [selectedCommunity, setSelectedCommunity] = useState<string>('');
  const [communitySearchQuery, setCommunitySearchQuery] = useState('');
  const [title, setTitle] = useState('');
  const [customIdentifier, setCustomIdentifier] = useState('');
  const [isLoadingCommunities, setIsLoadingCommunities] = useState(false);
  
  // New modern UI states
  const [conversationType, setConversationType] = useState<'direct' | 'group'>('direct');
  const [step, setStep] = useState<'members' | 'details'>('members');

  // Validation function for identifier
  const validateIdentifier = (identifier: string): boolean => {
    const regex = /^[a-zA-Z0-9\-_@]*$/;
    return regex.test(identifier);
  };

  // Generate identifier from title - now mandatory
  const generateIdentifierFromTitle = (title: string): string => {
    if (!title.trim()) return '';
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Keep only letters, numbers, spaces and hyphens
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single
      .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
  };

  // Generate user accent color based on user ID
  const getUserAccentColor = (userId: string): string => {
    const colors = [
      'bg-blue-100 text-blue-800 border-blue-200',
      'bg-green-100 text-green-800 border-green-200',
      'bg-purple-100 text-purple-800 border-purple-200',
      'bg-pink-100 text-pink-800 border-pink-200',
      'bg-yellow-100 text-yellow-800 border-yellow-200',
      'bg-indigo-100 text-indigo-800 border-indigo-200',
      'bg-red-100 text-red-800 border-red-200',
      'bg-teal-100 text-teal-800 border-teal-200',
      'bg-orange-100 text-orange-800 border-orange-200',
      'bg-cyan-100 text-cyan-800 border-cyan-200'
    ];
    
    // Generate a consistent color based on user ID
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  // Memoized filtered communities
  const filteredCommunities = useMemo(() => {
    if (!communitySearchQuery.trim()) return communities;
    return communities.filter(community =>
      community.name.toLowerCase().includes(communitySearchQuery.toLowerCase()) ||
      (community.description && community.description.toLowerCase().includes(communitySearchQuery.toLowerCase()))
    );
  }, [communities, communitySearchQuery]);

  // Memoized filtered users
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return availableUsers;
    return availableUsers.filter(user =>
      user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.displayName && user.displayName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (user.firstName && user.firstName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (user.lastName && user.lastName.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [availableUsers, searchQuery]);

  // Load communities
  const loadCommunities = useCallback(async (searchQuery: string = '') => {
    setIsLoadingCommunities(true);
    try {
      const token = localStorage.getItem('auth_token');
      const url = searchQuery.length >= 2 
        ? `${buildApiUrl('/communities')}?search=${encodeURIComponent(searchQuery)}`
        : buildApiUrl('/communities');
      
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setCommunities(data.data || []);
      } else {
        console.error('Error loading communities');
      }
    } catch (error) {
      console.error('Error loading communities:', error);
    } finally {
      setIsLoadingCommunities(false);
    }
  }, []);

  // Recherche d'utilisateurs
  const searchUsers = useCallback(async (query: string) => {
    if (!query.trim()) {
      setAvailableUsers([]);
      return;
    }

    setIsLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(buildApiUrl(`${API_ENDPOINTS.USER.SEARCH}?q=${encodeURIComponent(query)}`), {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        const users = await response.json();
        // Exclure l'utilisateur actuel et les utilisateurs déjà sélectionnés
        const filteredUsers = users.filter((user: User) => 
          user.id !== currentUser.id && 
          !selectedUsers.some(selected => selected.id === user.id)
        );
        setAvailableUsers(filteredUsers);
      } else {
        toast.error(t('errors.searchError'));
      }
    } catch (error) {
      console.error('Erreur recherche utilisateurs:', error);
      toast.error(t('errors.searchError'));
    } finally {
      setIsLoading(false);
    }
  }, [currentUser.id, selectedUsers]);

  // Effet pour gérer la recherche en temps réel
  useEffect(() => {
    if (isOpen && searchQuery.trim()) {
      const timer = setTimeout(() => {
        searchUsers(searchQuery);
      }, 300); // Debounce de 300ms

      return () => clearTimeout(timer);
    } else if (isOpen && !searchQuery.trim()) {
      setAvailableUsers([]);
    }
  }, [isOpen, searchQuery, searchUsers]);

  // Load communities when modal opens
  useEffect(() => {
    if (isOpen) {
      loadCommunities();
    }
  }, [isOpen, loadCommunities]);

  // Handle community search
  useEffect(() => {
    if (communitySearchQuery.length >= 2) {
      const timer = setTimeout(() => {
        loadCommunities(communitySearchQuery);
      }, 300);
      return () => clearTimeout(timer);
    } else if (communitySearchQuery.length === 0) {
      loadCommunities();
    }
  }, [communitySearchQuery, loadCommunities]);

  // Auto-generate title and identifier based on selected users
  useEffect(() => {
    if (selectedUsers.length > 0) {
      let autoTitle = '';
      
      if (selectedUsers.length === 1) {
        // Conversation directe
        autoTitle = t('autoGeneratedTitles.directWithUser', { username: selectedUsers[0].displayName || selectedUsers[0].username });
      } else if (selectedUsers.length === 2) {
        // Conversation entre 2 personnes
        const names = selectedUsers.map(u => u.displayName || u.username);
        autoTitle = t('autoGeneratedTitles.betweenTwoUsers', { user1: names[0], user2: names[1] });
      } else {
        // Groupe avec plusieurs personnes
        const firstNames = selectedUsers.slice(0, 2).map(u => u.displayName || u.username);
        const remainingCount = selectedUsers.length - 2;
        if (remainingCount > 0) {
          autoTitle = t('autoGeneratedTitles.groupWithMultiple', { 
            user1: firstNames[0], 
            user2: firstNames[1], 
            count: remainingCount,
            plural: remainingCount > 1 ? 's' : ''
          });
        } else {
          autoTitle = t('autoGeneratedTitles.groupWithTwo', { user1: firstNames[0], user2: firstNames[1] });
        }
      }
      
      // Auto-generate title if not manually set
      if (!title || title === '') {
        setTitle(autoTitle);
      }
      
      // Auto-generate identifier from current title
      const currentTitle = title || autoTitle;
      if (currentTitle.trim()) {
        const generated = generateIdentifierFromTitle(currentTitle);
        setCustomIdentifier(generated);
      }
    }
  }, [selectedUsers, title]);

  const toggleUserSelection = (user: User) => {
    setSelectedUsers(prev => {
      const isSelected = prev.some(u => u.id === user.id);
      if (isSelected) {
        return prev.filter(u => u.id !== user.id);
      } else {
        return [...prev, user];
      }
    });
  };

  const createConversation = async () => {
    if (selectedUsers.length === 0) {
      toast.error(t('errors.selectAtLeastOneUser'));
      return;
    }

    // Validate identifier - now mandatory
    if (!customIdentifier.trim()) {
      toast.error(t('errors.identifierRequired'));
      return;
    }

    if (!validateIdentifier(customIdentifier)) {
      toast.error(t('errors.invalidIdentifier'));
      return;
    }

    setIsCreating(true);
    try {
      const token = localStorage.getItem('auth_token');
      
      // Determine conversation type and title
      const conversationType = selectedUsers.length === 1 ? 'direct' : 'group';
      let conversationTitle = title;
      
      // For direct messages, use default title if none provided
      if (conversationType === 'direct' && !conversationTitle) {
        conversationTitle = `Conversation avec ${selectedUsers[0].displayName || selectedUsers[0].username}`;
      }
      
      // For group conversations with 2+ users, require title
      if (conversationType === 'group' && !conversationTitle) {
        conversationTitle = `Conversation avec ${selectedUsers.map(u => u.displayName || u.username).join(', ')}`;
      }

      // Prepare request body - identifier is now mandatory
      const requestBody: any = {
        title: conversationTitle,
        type: conversationType,
        participantIds: selectedUsers.map(u => u.id),
        identifier: customIdentifier // Always include identifier
      };

      // Add community if selected
      if (selectedCommunity) {
        requestBody.communityId = selectedCommunity;
      }

      const response = await fetch(buildApiUrl(API_ENDPOINTS.CONVERSATION.CREATE), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        const responseData = await response.json();
        const conversation = responseData.data;
        toast.success(t('success.conversationCreated'));
        
        // Passer les données de la conversation créée pour un ajout immédiat
        onConversationCreated(conversation.id, conversation);
        handleClose();
      } else {
        const error = await response.json();
        toast.error(error.message || t('errors.creationError'));
      }
    } catch (error) {
      console.error('Erreur création conversation:', error);
      toast.error(t('errors.creationError'));
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    setSelectedUsers([]);
    setSearchQuery('');
    setAvailableUsers([]);
    setCommunities([]);
    setSelectedCommunity('');
    setCommunitySearchQuery('');
    setTitle('');
    setCustomIdentifier('');
    setConversationType('direct');
    setStep('members');
    onClose();
  };

  // Auto-detect conversation type based on selected users
  useEffect(() => {
    if (selectedUsers.length === 1) {
      setConversationType('direct');
    } else if (selectedUsers.length > 1) {
      setConversationType('group');
    }
  }, [selectedUsers]);


  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl w-[95vw] max-h-[90vh] overflow-y-auto sm:max-w-3xl sm:w-[90vw] sm:max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
{t('title')}
          </DialogTitle>
          <DialogDescription>
{t('description')}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Step Indicator */}
          <div className="flex items-center gap-4">
            <div className={cn(
              "flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium",
              step === 'members' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            )}>
              <UserPlus className="h-4 w-4" />
{t('steps.members')}
            </div>
            <div className="h-px bg-border flex-1" />
            <div className={cn(
              "flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium",
              step === 'details' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            )}>
              <Hash className="h-4 w-4" />
{t('steps.details')}
            </div>
          </div>

          {/* Community Selection with Input Field */}
          <div>
            <Label className="text-sm font-medium flex items-center gap-2 mb-2">
              <Building2 className="h-4 w-4" />
{t('community.title')}
            </Label>
            <Input
placeholder={t('community.searchPlaceholder')}
              value={communitySearchQuery}
              onChange={(e) => setCommunitySearchQuery(e.target.value)}
              className="w-full"
            />
            
            {/* Community Search Results */}
            {communitySearchQuery.length >= 2 && (
              <div className="mt-2 border rounded-lg bg-background shadow-sm max-h-48 overflow-y-auto">
                {isLoadingCommunities ? (
                  <div className="p-3 text-center text-sm text-muted-foreground">
{t('community.loading')}
                  </div>
                ) : filteredCommunities.length > 0 ? (
                  <div className="p-1">
                    {filteredCommunities.map((community) => (
                      <div
                        key={community.id}
                        className={cn(
                          "flex items-center gap-3 p-2 rounded cursor-pointer hover:bg-muted/50",
                          selectedCommunity === community.id && "bg-primary/10 border border-primary/20"
                        )}
                        onClick={() => {
                          setSelectedCommunity(community.id === selectedCommunity ? '' : community.id);
                        }}
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>
                            <Building2 className="h-4 w-4" />
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{community.name}</span>
                            {community.isPrivate ? (
                              <Lock className="h-3 w-3 text-muted-foreground" />
                            ) : (
                              <Globe className="h-3 w-3 text-muted-foreground" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {t('community.membersCount', { count: community._count.members, conversations: community._count.Conversation })}
                          </p>
                        </div>
                        <Check
                          className={cn(
                            "h-4 w-4",
                            selectedCommunity === community.id ? "opacity-100 text-primary" : "opacity-0"
                          )}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 text-center text-sm text-muted-foreground">
                    {t('community.noCommunitiesFound')}
                  </div>
                )}
              </div>
            )}
            
            {/* Selected Community Display */}
            {selectedCommunity && (
              <div className="mt-2 p-2 bg-primary/10 border border-primary/20 rounded-lg">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">
                    {communities.find(c => c.id === selectedCommunity)?.name}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 ml-auto"
                    onClick={() => setSelectedCommunity('')}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* User Selection with Input Field */}
          <div>
            <Label className="text-sm font-medium flex items-center gap-2 mb-2">
              <Users className="h-4 w-4" />
              {t('members.title')}
            </Label>
            <Input
              placeholder={t('members.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full"
            />
            
            {/* User Search Results */}
            {searchQuery.length >= 2 && (
              <div className="mt-2 border rounded-lg bg-background shadow-sm max-h-48 overflow-y-auto">
                {isLoading ? (
                  <div className="p-3 text-center text-sm text-muted-foreground">
                    {t('members.loading')}
                  </div>
                ) : filteredUsers.length > 0 ? (
                  <div className="p-1">
                    {filteredUsers.map((user) => (
                      <div
                        key={user.id}
                        className={cn(
                          "flex items-center gap-3 p-2 rounded cursor-pointer hover:bg-muted/50",
                          selectedUsers.some(u => u.id === user.id) && "bg-primary/10 border border-primary/20"
                        )}
                        onClick={() => {
                          toggleUserSelection(user);
                        }}
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={user.avatar} />
                          <AvatarFallback>
                            {(user.displayName || user.username).charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="font-medium text-sm">
                            {user.displayName || user.username}
                          </p>
                          <p className="text-xs text-muted-foreground">@{user.username}</p>
                        </div>
                        <Check
                          className={cn(
                            "h-4 w-4",
                            selectedUsers.some(u => u.id === user.id) ? "opacity-100 text-primary" : "opacity-0"
                          )}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 text-center text-sm text-muted-foreground">
                    {t('members.noUsersFound')}
                  </div>
                )}
              </div>
            )}
            
            {/* Smart search suggestions when no search query */}
            {!searchQuery && (
              <div className="mt-2">
                <SmartSearch
                  searchQuery={searchQuery}
                  onSearch={setSearchQuery}
                  onUserSelect={toggleUserSelection}
                  selectedUsers={selectedUsers}
                />
              </div>
            )}
          </div>

          {/* Selected Users with Accent Colors */}
          {selectedUsers.length > 0 && (
            <div>
              <Label className="text-sm font-medium mb-2">
                {t('members.selectedMembers', { count: selectedUsers.length })}
              </Label>
              <div className="flex flex-wrap gap-2">
                {selectedUsers.map(user => (
                  <Badge
                    key={user.id}
                    variant="outline"
                    className={cn(
                      "flex items-center gap-2 px-3 py-1 border-2",
                      getUserAccentColor(user.id)
                    )}
                  >
                    <Avatar className="h-4 w-4">
                      <AvatarImage src={user.avatar} />
                      <AvatarFallback className="text-xs">
                        {(user.displayName || user.username).charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">
                      {user.displayName || user.username}
                    </span>
                    <X
                      className="h-3 w-3 cursor-pointer hover:opacity-70"
                      onClick={() => toggleUserSelection(user)}
                    />
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Conversation Details - Always show when users are selected */}
          {selectedUsers.length > 0 && (
            <div className="space-y-4 p-4 border rounded-lg bg-gradient-to-r from-primary/5 to-secondary/5">
              <div className="flex items-center gap-2 mb-4">
                <Hash className="h-4 w-4 text-primary" />
                <span className="font-medium">{t('conversationDetails.title')}</span>
                <Badge variant="outline" className="ml-auto">
                  {conversationType === 'direct' ? t('conversationDetails.typeDirect') : t('conversationDetails.typeGroup')}
                </Badge>
              </div>
              
              <div>
                <Label htmlFor="title" className="text-sm font-medium">
                  {t('conversationDetails.conversationTitle')}
                </Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t('conversationDetails.titlePlaceholder')}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {conversationType === 'direct' 
                    ? t('conversationDetails.titleInfoDirect')
                    : t('conversationDetails.titleInfoGroup')
                  }
                </p>
              </div>
              
              <div>
                <Label htmlFor="identifier" className="text-sm font-medium flex items-center gap-2">
                  <Hash className="h-4 w-4" />
                  {t('conversationDetails.identifier')} <span className="text-red-500">{t('conversationDetails.identifierRequired')}</span>
                </Label>
                <div className="mt-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground font-mono bg-muted px-2 py-1 rounded">{t('conversationDetails.identifierPrefix')}</span>
                    <Input
                      id="identifier"
                      value={customIdentifier}
                      onChange={(e) => setCustomIdentifier(e.target.value)}
                      placeholder={t('conversationDetails.identifierPlaceholder')}
                      className="flex-1 font-mono"
                      required
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('conversationDetails.identifierInfo')}
                  </p>
                  {customIdentifier && !validateIdentifier(customIdentifier) && (
                    <p className="text-xs text-red-500 mt-1">
                      {t('conversationDetails.identifierError')}
                    </p>
                  )}
                </div>
                
                {/* Suggestions d'identifiants intelligents */}
                <IdentifierSuggestions
                  title={title}
                  selectedUsers={selectedUsers}
                  onSelect={setCustomIdentifier}
                  currentIdentifier={customIdentifier}
                />
              </div>
            </div>
          )}

          {/* Aperçu de la conversation */}
          {selectedUsers.length > 0 && customIdentifier && (
            <ConversationPreview
              title={title}
              identifier={customIdentifier}
              selectedUsers={selectedUsers}
              selectedCommunity={selectedCommunity ? communities.find(c => c.id === selectedCommunity) : undefined}
              conversationType={conversationType}
              getUserAccentColor={getUserAccentColor}
            />
          )}
          
          {/* Actions */}
          <div className="flex space-x-3 pt-4">
            <Button
              onClick={createConversation}
              disabled={
                selectedUsers.length === 0 || 
                isCreating || 
                !customIdentifier.trim() ||
                !validateIdentifier(customIdentifier)
              }
              className="flex-1"
              size="lg"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              {isCreating ? t('actions.creating') : 
                selectedUsers.length === 1 ? t('actions.createDirectConversation') : 
                t('actions.createGroupConversation')}
            </Button>
            <Button
              onClick={handleClose}
              variant="outline"
              size="lg"
            >
              {t('actions.cancel')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
