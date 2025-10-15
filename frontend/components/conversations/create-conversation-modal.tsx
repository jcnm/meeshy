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
import { apiService } from '@/services/api.service';
import { toast } from 'sonner';
import { Check, X, Users, User as UserIcon, Building2, Hash, Search, Plus, Sparkles, UserPlus, Globe, Lock, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { IdentifierSuggestions } from './identifier-suggestions';
import { ConversationPreview } from './conversation-preview';
import { SmartSearch } from './smart-search';
import { useI18n } from '@/hooks/useI18n';
import { Switch } from '@/components/ui/switch';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

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
  const { t } = useI18n('modals');
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
  const [conversationType, setConversationType] = useState<'direct' | 'group' | 'public'>('direct');
  const [step, setStep] = useState<'members' | 'details'>('members');
  
  // New state for community toggle and preview accordion
  const [showCommunitySection, setShowCommunitySection] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Validation function for identifier (allows hex suffix)
  const validateIdentifier = (identifier: string): boolean => {
    // Accepte lettres, chiffres, tirets, underscores et @ 
    // Le suffixe hex sera composé de a-f0-9 après un tiret
    const regex = /^[a-zA-Z0-9\-_@]+$/;
    return regex.test(identifier);
  };

  // Generate identifier from title with hex suffix for uniqueness
  const generateIdentifierFromTitle = (title: string): string => {
    if (!title.trim()) return '';
    
    const baseIdentifier = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Keep only letters, numbers, spaces and hyphens
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single
      .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
    
    if (!baseIdentifier) return '';
    
    // Generate 4-byte hex suffix for uniqueness (like conversation links)
    const hexSuffix = Array.from(crypto.getRandomValues(new Uint8Array(4)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    return `${baseIdentifier}-${hexSuffix}`;
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
      const response = await apiService.get<{ success: boolean; data: any[] }>(
        searchQuery.length >= 2 
          ? `/api/communities?search=${encodeURIComponent(searchQuery)}`
          : '/api/communities'
      );
      
      if (response.data.success) {
        setCommunities(response.data.data || []);
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
      const response = await apiService.get<User[]>(`/api/users/search?q=${encodeURIComponent(query)}`);
      
      if (response.data) {
        const users = response.data;
        // Exclure l'utilisateur actuel et les utilisateurs déjà sélectionnés
        const filteredUsers = users.filter((user: User) => 
          user.id !== currentUser.id && 
          !selectedUsers.some(selected => selected.id === user.id)
        );
        setAvailableUsers(filteredUsers);
      } else {
        toast.error(t('createConversationModal.errors.searchError'));
      }
    } catch (error) {
      console.error('Erreur recherche utilisateurs:', error);
      toast.error(t('createConversationModal.errors.searchError'));
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
        autoTitle = t('createConversationModal.autoGeneratedTitles.directWithUser', { username: selectedUsers[0].displayName || selectedUsers[0].username });
      } else if (selectedUsers.length === 2) {
        // Conversation entre 2 personnes
        const names = selectedUsers.map(u => u.displayName || u.username);
        autoTitle = t('createConversationModal.autoGeneratedTitles.betweenTwoUsers', { user1: names[0], user2: names[1] });
      } else {
        // Groupe avec plusieurs personnes
        const firstNames = selectedUsers.slice(0, 2).map(u => u.displayName || u.username);
        const remainingCount = selectedUsers.length - 2;
        if (remainingCount > 0) {
          autoTitle = t('createConversationModal.autoGeneratedTitles.groupWithMultiple', { 
            user1: firstNames[0], 
            user2: firstNames[1], 
            count: remainingCount,
            plural: remainingCount > 1 ? 's' : ''
          });
        } else {
          autoTitle = t('createConversationModal.autoGeneratedTitles.groupWithTwo', { user1: firstNames[0], user2: firstNames[1] });
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
        // Clear search query after selecting a user
        setSearchQuery('');
        return [...prev, user];
      }
    });
  };

  const createConversation = async () => {
    // Pour les conversations publiques, les participants ne sont pas obligatoires
    if (conversationType !== 'public' && selectedUsers.length === 0) {
      toast.error(t('createConversationModal.errors.selectAtLeastOneUser'));
      return;
    }

    // Validate identifier - mandatory for group and public conversations only
    if (conversationType !== 'direct') {
      if (!customIdentifier.trim()) {
        toast.error(t('createConversationModal.errors.identifierRequired'));
        return;
      }

      if (!validateIdentifier(customIdentifier)) {
        toast.error(t('createConversationModal.errors.invalidIdentifier'));
        return;
      }
    }

    setIsCreating(true);
    try {
      
      // Determine conversation type and title - use the selected type instead of auto-detection
      let conversationTitle = title;
      
      // For direct messages, use default title if none provided
      if (conversationType === 'direct' && !conversationTitle) {
        conversationTitle = selectedUsers.length > 0 
          ? t('createConversationModal.preview.defaultTitles.direct', { 
              username: selectedUsers[0].displayName || selectedUsers[0].username 
            })
          : t('createConversationModal.conversationTypes.direct');
      }
      
      // For group conversations with 2+ users, require title
      if (conversationType === 'group' && !conversationTitle) {
        conversationTitle = selectedUsers.length > 0
          ? t('createConversationModal.preview.defaultTitles.group', {
              users: selectedUsers.map(u => u.displayName || u.username).join(', ')
            })
          : t('createConversationModal.conversationTypes.group');
      }

      // For public conversations, require title
      if (conversationType === 'public' && !conversationTitle) {
        conversationTitle = t('createConversationModal.preview.defaultTitles.public');
      }

      // Map conversation type for backend compatibility
      const backendType = conversationType === 'public' ? 'broadcast' : conversationType;

      // Prepare request body - identifier is mandatory for group and public only
      const requestBody: any = {
        title: conversationTitle,
        type: backendType,
        participantIds: selectedUsers.map(u => u.id)
      };

      // Add identifier only for group and public conversations
      if (conversationType !== 'direct' && customIdentifier.trim()) {
        requestBody.identifier = customIdentifier;
      }

      // Add community if selected
      if (selectedCommunity) {
        requestBody.communityId = selectedCommunity;
      }

      const response = await apiService.post<{ success: boolean; data: any }>('/api/conversations', requestBody);

      if (response.data.success) {
        const responseData = response.data;
        const conversation = responseData.data;
        toast.success(t('createConversationModal.success.conversationCreated'));
        
        // Passer les données de la conversation créée pour un ajout immédiat
        onConversationCreated(conversation.id, conversation);
        handleClose();
      } else {
        // Handle error response
        toast.error(t('createConversationModal.errors.creationError'));
      }
    } catch (error) {
      console.error('Erreur création conversation:', error);
      toast.error(t('createConversationModal.errors.creationError'));
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
    setShowCommunitySection(false);
    setIsPreviewOpen(false);
    onClose();
  };

  // Auto-detect conversation type based on selected users
  useEffect(() => {
    if (selectedUsers.length === 1) {
      // Only set to direct if it's not already group or public
      if (conversationType !== 'group' && conversationType !== 'public') {
        setConversationType('direct');
      }
    } else if (selectedUsers.length > 1) {
      // If more than 1 user, switch from direct to group automatically
      if (conversationType === 'direct') {
        setConversationType('group');
      }
    }
  }, [selectedUsers.length, conversationType]); // Include conversationType to satisfy React Hooks rules


  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl w-[95vw] max-h-[95vh] p-0 sm:max-w-3xl sm:w-[90vw] sm:max-h-[90vh] md:max-h-[85vh] flex flex-col">
        <DialogHeader className="px-4 pt-4 sm:px-6 sm:pt-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            {t('createConversationModal.title')}
          </DialogTitle>
          <DialogDescription>
            {t('createConversationModal.description')}
          </DialogDescription>
        </DialogHeader>
        
        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
          <div className="space-y-6">
          {/* User Selection with Input Field - Always visible */}
          <div>
            <Label className="text-sm font-medium flex items-center gap-2 mb-2">
              <UserPlus className="h-4 w-4" />
              {t('createConversationModal.members.title')}
            </Label>
            <Input
              placeholder={t('createConversationModal.members.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full"
            />
            
            {/* User Search Results */}
            {searchQuery.length >= 2 && (
              <div className="mt-2 border rounded-lg bg-background shadow-sm max-h-48 overflow-y-auto">
                {isLoading ? (
                  <div className="p-3 text-center text-sm text-muted-foreground">
                    {t('createConversationModal.members.loading')}
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
                    {t('createConversationModal.members.noUsersFound')}
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
                {t('createConversationModal.members.selectedMembers', { count: selectedUsers.length })}
              </Label>
              <div className="flex flex-wrap gap-2">
                {selectedUsers.map(user => (
                  <Badge
                    key={user.id}
                    variant="outline"
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 border-2",
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
                    <button
                      type="button"
                      onClick={() => toggleUserSelection(user)}
                      className="ml-1 rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                      aria-label={`Retirer ${user.displayName || user.username}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Conversation Type Selection - Show when at least 1 user is selected */}
          {selectedUsers.length > 0 && (
            <div>
              <Label className="text-sm font-medium mb-2 block">
                {t('createConversationModal.conversationDetails.conversationType')}
              </Label>
              <div className={cn(
                "grid gap-2",
                selectedUsers.length === 1 ? "grid-cols-3" : "grid-cols-2"
              )}>
                {/* Direct - Only show when exactly 1 user is selected */}
                {selectedUsers.length === 1 && (
                  <Button
                    type="button"
                    variant={conversationType === 'direct' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setConversationType('direct')}
                    className="flex items-center gap-2"
                  >
                    <UserIcon className="h-4 w-4" />
                    {t('createConversationModal.conversationTypes.direct')}
                  </Button>
                )}
                {/* Group - Always show when users are selected */}
                <Button
                  type="button"
                  variant={conversationType === 'group' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setConversationType('group')}
                  className="flex items-center gap-2"
                >
                  <Users className="h-4 w-4" />
                  {t('createConversationModal.conversationTypes.group')}
                </Button>
                {/* Public - Always show when users are selected */}
                <Button
                  type="button"
                  variant={conversationType === 'public' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setConversationType('public')}
                  className="flex items-center gap-2"
                >
                  <Globe className="h-4 w-4" />
                  {t('createConversationModal.conversationTypes.public')}
                </Button>
              </div>
            </div>
          )}

          {/* Title and Identifier - Only show for Group or Public */}
          {selectedUsers.length > 0 && (conversationType === 'group' || conversationType === 'public') && (
            <div className="space-y-4 p-4 border rounded-lg bg-gradient-to-r from-primary/5 to-secondary/5">
              <div className="flex items-center gap-2 mb-2">
                <Hash className="h-4 w-4 text-primary" />
                <span className="font-medium">{t('createConversationModal.conversationDetails.title')}</span>
              </div>

              <div>
                <Label htmlFor="title" className="text-sm font-medium">
                  {t('createConversationModal.conversationDetails.conversationTitle')}
                </Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t('createConversationModal.conversationDetails.titlePlaceholder')}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {t('createConversationModal.conversationDetails.titleInfoGroup')}
                </p>
              </div>
              
              <div>
                <Label htmlFor="identifier" className="text-sm font-medium flex items-center gap-2">
                  <Hash className="h-4 w-4" />
                  {t('createConversationModal.conversationDetails.identifier')} <span className="text-red-500">{t('createConversationModal.conversationDetails.identifierRequired')}</span>
                </Label>
                <div className="mt-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground font-mono bg-muted px-2 py-1 rounded">{t('createConversationModal.conversationDetails.identifierPrefix')}</span>
                    <Input
                      id="identifier"
                      value={customIdentifier}
                      onChange={(e) => setCustomIdentifier(e.target.value)}
                      placeholder={t('createConversationModal.conversationDetails.identifierPlaceholder')}
                      className="flex-1 font-mono"
                      required
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('createConversationModal.conversationDetails.identifierInfo')}
                  </p>
                  {customIdentifier && !validateIdentifier(customIdentifier) && (
                    <p className="text-xs text-red-500 mt-1">
                      {t('createConversationModal.conversationDetails.identifierError')}
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

          {/* Community Toggle and Selection - Only show when at least 1 user is selected */}
          {selectedUsers.length > 0 && (
            <div className="space-y-3 p-4 border rounded-lg bg-muted/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  <Label htmlFor="community-toggle" className="text-sm font-medium cursor-pointer">
                    {t('createConversationModal.community.addToCommunity')}
                  </Label>
                </div>
                <Switch
                  id="community-toggle"
                  checked={showCommunitySection}
                  onCheckedChange={setShowCommunitySection}
                />
              </div>

              {/* Community Selection - Only show when toggle is ON */}
              {showCommunitySection && (
                <div className="space-y-3 pt-3 border-t">
                  <Input
                    placeholder={t('createConversationModal.community.searchPlaceholder')}
                    value={communitySearchQuery}
                    onChange={(e) => setCommunitySearchQuery(e.target.value)}
                    className="w-full"
                  />
                  
                  {/* Community Search Results */}
                  {communitySearchQuery.length >= 2 && (
                    <div className="mt-2 border rounded-lg bg-background shadow-sm max-h-48 overflow-y-auto">
                      {isLoadingCommunities ? (
                        <div className="p-3 text-center text-sm text-muted-foreground">
                          {t('createConversationModal.community.loading')}
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
                                  {t('createConversationModal.community.membersCount', { count: community._count.members, conversations: community._count.Conversation })}
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
                          {t('createConversationModal.community.noCommunitiesFound')}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Preview - Collapsible/Accordion - Hidden by default */}
          {selectedUsers.length > 0 && (conversationType === 'direct' || customIdentifier) && (
            <Collapsible
              open={isPreviewOpen}
              onOpenChange={setIsPreviewOpen}
              className="border rounded-lg"
            >
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full flex items-center justify-between p-4 hover:bg-muted/50"
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span className="font-medium">Récapitulatif de la conversation</span>
                  </div>
                  {isPreviewOpen ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="p-4 pt-0">
                <ConversationPreview
                  title={title}
                  identifier={customIdentifier}
                  selectedUsers={selectedUsers}
                  selectedCommunity={selectedCommunity ? communities.find(c => c.id === selectedCommunity) : undefined}
                  conversationType={conversationType}
                  getUserAccentColor={getUserAccentColor}
                />
              </CollapsibleContent>
            </Collapsible>
          )}
          </div>
        </div>
        
        {/* Fixed Actions Footer */}
        <div className="border-t bg-background px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
            <Button
              onClick={createConversation}
              disabled={
                selectedUsers.length === 0 || 
                isCreating || 
                (conversationType !== 'direct' && !customIdentifier.trim()) ||
                (conversationType !== 'direct' && !validateIdentifier(customIdentifier))
              }
              className="flex-1 w-full sm:w-auto text-xs sm:text-sm h-9 sm:h-11"
            >
              <Sparkles className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
              {isCreating ? t('createConversationModal.actions.creating') : 
                conversationType === 'direct' ? t('createConversationModal.actions.createDirectConversation') :
                conversationType === 'public' ? t('createConversationModal.actions.createPublicConversation') :
                t('createConversationModal.actions.createGroupConversation')}
            </Button>
            <Button
              onClick={handleClose}
              variant="outline"
              className="w-full sm:w-auto text-xs sm:text-sm h-9 sm:h-11"
            >
              {t('createConversationModal.actions.cancel')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
