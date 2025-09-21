'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ResponsiveTabs } from '@/components/ui/responsive-tabs';
import { Badge } from '@/components/ui/badge';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { toast } from 'sonner';
import { buildApiUrl } from '@/lib/config';
import { 
  Search,
  UserPlus,
  MessageSquare,
  Users,
  Phone,
  Mail,
  MoreVertical,
  UserMinus,
  Check,
  X,
  Clock,
  UserCheck,
  UserX,
  Share2,
  Calendar,
  Link,
  ChevronDown
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { User } from '@/types';
import { usersService, conversationsService, type ParticipantsFilters } from '@/services';
import { ShareAffiliateModal } from '@/components/affiliate/share-affiliate-modal';
import { useUser } from '@/context/UnifiedProvider';
import { useTranslations } from '@/hooks/useTranslations';

interface FriendRequest {
  id: string;
  senderId: string;
  receiverId: string;
  status: 'pending' | 'accepted' | 'rejected' | 'blocked';
  createdAt: string;
  updatedAt: string;
  sender?: User;
  receiver?: User;
}

interface AffiliateRelation {
  id: string;
  referredUser: {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
    email: string;
    avatar?: string;
    isOnline: boolean;
    createdAt: string;
  };
  status: string;
  createdAt: string;
  completedAt?: string;
  affiliateToken: {
    name: string;
    token: string;
    createdAt?: string;
  };
}

export default function ContactsPage() {
  const router = useRouter();
  const { user } = useUser();
  const { t } = useTranslations('contacts');
  const [contacts, setContacts] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [filters, setFilters] = useState<ParticipantsFilters>({});
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [affiliateRelations, setAffiliateRelations] = useState<AffiliateRelation[]>([]);
  const [activeTab, setActiveTab] = useState('all');
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        if (!token) {
          router.push('/login');
          return;
        }

        const response = await fetch(buildApiUrl('/auth/me'), {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (!response.ok) {
          localStorage.removeItem('auth_token');
          toast.error(t('errors.sessionExpired'));
          router.push('/login');
          return;
        }
        
        // Si l'authentification est valide, charger les contacts
        loadContacts();
        loadFriendRequests();
        loadAffiliateRelations();
      } catch (error) {
        console.error('Erreur vérification auth:', error);
        toast.error(t('errors.connectionError'));
        router.push('/login');
      }
    };

    checkAuth();
  }, [router]);

  const loadContacts = async (appliedFilters?: ParticipantsFilters) => {
    try {
      // Utiliser les filtres passés en paramètre ou les filtres de l'état
      const currentFilters = appliedFilters || filters;
      
      // Récupérer tous les utilisateurs via le service des utilisateurs
      const response = await usersService.getAllUsers();
      let contactsData = response.data || [];
      
      // Appliquer les filtres côté client si nécessaire
      if (currentFilters?.search) {
        const searchTerm = currentFilters.search.toLowerCase();
        contactsData = contactsData.filter(user => 
          user.username?.toLowerCase().includes(searchTerm) ||
          user.firstName?.toLowerCase().includes(searchTerm) ||
          user.lastName?.toLowerCase().includes(searchTerm) ||
          user.displayName?.toLowerCase().includes(searchTerm)
        );
      }
      
      if (currentFilters?.role) {
        contactsData = contactsData.filter(user => user.role === currentFilters.role);
      }
      
      if (currentFilters?.onlineOnly) {
        contactsData = contactsData.filter(user => user.isOnline);
      }
      
      if (currentFilters?.limit) {
        contactsData = contactsData.slice(0, currentFilters.limit);
      }
      
      setContacts(contactsData);
    } catch (error) {
      console.error('Erreur lors du chargement des contacts:', error);
      toast.error(t('errors.loadContactsError'));
      setContacts([]); // Initialiser avec un tableau vide en cas d'erreur
    } finally {
      setLoading(false);
    }
  };


  const loadFriendRequests = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      const response = await fetch(buildApiUrl('/users/friend-requests'), {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setFriendRequests(data.data || []);
      }
    } catch (error) {
      console.error('Erreur chargement friend requests:', error);
    }
  };

  const loadAffiliateRelations = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      const response = await fetch(buildApiUrl('/affiliate/stats'), {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setAffiliateRelations(data.data?.referrals || []);
      }
    } catch (error) {
      console.error('Erreur chargement relations affiliation:', error);
    }
  };

  const searchUsers = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      const response = await usersService.searchUsers(query);
      // S'assurer que response.data est un tableau
      const searchData = Array.isArray(response.data) ? response.data : [];
      setSearchResults(searchData);
    } catch (error) {
      console.error('Erreur lors de la recherche:', error);
      toast.error(t('errors.searchError'));
      setSearchResults([]); // Initialiser avec un tableau vide en cas d'erreur
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    searchUsers(searchQuery);
  };

  const startConversation = async (userId: string) => {
    try {
      const contact = displayedUsers.find(u => u.id === userId);
      if (!contact) return;

      const token = localStorage.getItem('auth_token');
      if (!token) {
        router.push('/login');
        return;
      }

      // Créer le titre automatique "user1 & user2"
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      const currentUserName = currentUser.displayName || `${currentUser.firstName} ${currentUser.lastName}`.trim() || currentUser.username;
      const contactName = getUserDisplayName(contact);
      const conversationTitle = `${currentUserName} & ${contactName}`;

      // Créer la conversation directe
      const response = await fetch(buildApiUrl('/conversations'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title: conversationTitle,
          type: 'direct',
          participantIds: [userId]
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          toast.success(t('success.conversationCreated'));
          router.push(`/conversations/${result.data.id}`);
        } else {
          throw new Error(result.error || t('errors.conversationCreationError'));
        }
      } else {
        const error = await response.json();
        throw new Error(error.error || t('errors.conversationCreationError'));
      }
    } catch (error) {
      console.error('Erreur lors de la création de la conversation:', error);
      toast.error(error instanceof Error ? error.message : t('errors.conversationCreationError'));
    }
  };

  const handleFriendRequest = async (requestId: string, action: 'accept' | 'reject') => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      const response = await fetch(buildApiUrl(`/users/friend-requests/${requestId}`), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ action })
      });

      if (response.ok) {
        toast.success(action === 'accept' ? t('success.friendRequestAccepted') : t('success.friendRequestRejected'));
        loadFriendRequests();
        loadContacts(); // Recharger les contacts pour voir les nouveaux amis
      } else {
        const error = await response.json();
        toast.error(error.error || t('errors.updateError'));
      }
    } catch (error) {
      console.error('Erreur friend request:', error);
      toast.error(t('errors.updateError'));
    }
  };

  const sendFriendRequest = async (userId: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      const response = await fetch(buildApiUrl('/users/friend-requests'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ receiverId: userId })
      });

      if (response.ok) {
        toast.success(t('success.friendRequestSent'));
        loadFriendRequests();
      } else {
        const error = await response.json();
        toast.error(error.error || t('errors.sendError'));
      }
    } catch (error) {
      console.error('Erreur envoi friend request:', error);
      toast.error(t('errors.sendError'));
    }
  };

  const getUserDisplayName = (user: User | { firstName: string; lastName: string; username: string; displayName?: string }): string => {
    if ('displayName' in user && user.displayName) return user.displayName;
    return `${user.firstName} ${user.lastName}`.trim() || user.username;
  };

  const filteredContacts = Array.isArray(contacts) ? contacts.filter(contact =>
    getUserDisplayName(contact).toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.username.toLowerCase().includes(searchQuery.toLowerCase())
  ) : [];

  const displayedUsers = searchQuery ? searchResults : filteredContacts;

  if (loading) {
    return (
      <DashboardLayout title={t('title')}>
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-12 bg-gray-200 rounded"></div>
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-16 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title={t('title')}>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header avec recherche */}
        <Card>
          <CardContent className="p-6">
            <form onSubmit={handleSearch} className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder={t('searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    searchUsers(e.target.value);
                  }}
                  className="pl-10"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <p className="text-sm text-gray-600">
                    {displayedUsers.length === 1 ? t('contactsFound', { count: displayedUsers.length }) : t('contactsFound_plural', { count: displayedUsers.length })}
                  </p>
                </div>
                
                <Button 
                  onClick={() => setIsShareModalOpen(true)}
                  variant="outline"
                  className="flex items-center space-x-2"
                >
                  <Share2 className="h-4 w-4" />
                  <span>{t('inviteContact')}</span>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Tabs responsifs avec ResponsiveTabs */}
        <ResponsiveTabs
          value={activeTab}
          onValueChange={setActiveTab}
          items={[
            {
              value: "all",
              label: t('tabs.all'),
              icon: <Users className="h-4 w-4" />,
              content: (
                <div className="space-y-4">
                  {displayedUsers.length === 0 ? (
                    <Card>
                      <CardContent className="flex flex-col items-center justify-center py-12">
                        <Users className="h-12 w-12 text-gray-400 mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                          {searchQuery ? t('messages.noContactsFound') : t('messages.noContacts')}
                        </h3>
                        <p className="text-gray-600 text-center max-w-sm mb-4">
                          {searchQuery 
                            ? t('messages.noContactsFoundDescription')
                            : t('messages.noContactsDescription')
                          }
                        </p>
                        <Button 
                          onClick={() => router.push('/search')}
                          className="flex items-center space-x-2"
                        >
                          <UserPlus className="h-4 w-4" />
                          <span>{t('messages.searchUsers')}</span>
                        </Button>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-2">
                      {displayedUsers.map((contact) => (
                        <Card key={contact.id} className="hover:shadow-md transition-shadow">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <Avatar className="h-12 w-12">
                                  <AvatarImage src={contact.avatar} alt={getUserDisplayName(contact)} />
                                  <AvatarFallback>
                                    {getUserDisplayName(contact).slice(0, 2).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                
                                <div className="flex-1">
                                  <h3 className="font-semibold text-gray-900">
                                    {getUserDisplayName(contact)}
                                  </h3>
                                  <p className="text-sm text-gray-600">@{contact.username}</p>
                                  
                                  <div className="flex items-center space-x-4 mt-1">
                                    <div className="flex items-center space-x-1">
                                      <div className={`w-2 h-2 rounded-full ${contact.isOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
                                      <span className="text-xs text-gray-500">
                                        {contact.isOnline ? t('status.online') : t('status.offline')}
                                      </span>
                                    </div>
                                    
                                    {contact.email && (
                                      <div className="flex items-center space-x-1">
                                        <Mail className="h-3 w-3 text-gray-400" />
                                        <span className="text-xs text-gray-500 truncate max-w-32">
                                          {contact.email}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                              
                              <div className="flex items-center space-x-2">
                                <Button
                                  size="sm"
                                  onClick={() => startConversation(contact.id)}
                                  className="flex items-center space-x-1"
                                >
                                  <MessageSquare className="h-4 w-4" />
                                  <span className="hidden sm:inline">{t('actions.message')}</span>
                                </Button>
                                
                                {searchQuery && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => sendFriendRequest(contact.id)}
                                    className="flex items-center space-x-1"
                                  >
                                    <Link className="h-4 w-4" />
                                    <span className="hidden sm:inline">{t('actions.connection')}</span>
                                  </Button>
                                )}
                                
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem 
                                      onClick={() => router.push(`/profile/${contact.id}`)}
                                    >
                                      {t('actions.viewProfile')}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => startConversation(contact.id)}>
                                      {t('actions.sendMessage')}
                                    </DropdownMenuItem>
                                    {contact.phoneNumber && (
                                      <DropdownMenuItem>
                                        <Phone className="mr-2 h-4 w-4" />
                                        {t('actions.call')}
                                      </DropdownMenuItem>
                                    )}
                                    {activeTab !== 'all' && (
                                      <DropdownMenuItem className="text-red-600">
                                        <UserMinus className="mr-2 h-4 w-4" />
                                        {t('actions.remove')}
                                      </DropdownMenuItem>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              )
            },
            {
              value: "pending",
              label: t('tabs.pending'),
              icon: <Clock className="h-4 w-4" />,
              content: (
                <div className="space-y-4">
                  {friendRequests.filter(r => r.status === 'pending').length === 0 ? (
                    <Card>
                      <CardContent className="flex flex-col items-center justify-center py-12">
                        <Clock className="h-12 w-12 text-gray-400 mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('messages.noPendingRequests')}</h3>
                        <p className="text-gray-600 text-center max-w-sm">
                          {t('messages.noPendingRequestsDescription')}
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-2">
                      {friendRequests.filter(r => r.status === 'pending').map((request) => {
                        const isCurrentUserSender = request.senderId === user?.id;
                        const otherUser = isCurrentUserSender ? request.receiver : request.sender;
                        
                        return (
                          <Card key={request.id} className="hover:shadow-md transition-shadow">
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                  <Avatar className="h-12 w-12">
                                    <AvatarImage src={otherUser?.avatar} alt={getUserDisplayName(otherUser!)} />
                                    <AvatarFallback>
                                      {getUserDisplayName(otherUser!).slice(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  
                                  <div className="flex-1">
                                    <h3 className="font-semibold text-gray-900">
                                      {getUserDisplayName(otherUser!)}
                                    </h3>
                                    <p className="text-sm text-gray-600">@{otherUser?.username}</p>
                                    <p className="text-xs text-gray-500">
                                      {isCurrentUserSender 
                                        ? t('messages.requestSent', { date: new Date(request.createdAt).toLocaleDateString('pt-BR') })
                                        : t('messages.requestReceived', { date: new Date(request.createdAt).toLocaleDateString('pt-BR') })
                                      }
                                    </p>
                                  </div>
                                </div>
                                
                                <div className="flex items-center space-x-2">
                                  {isCurrentUserSender ? (
                                    <Badge variant="outline" className="text-orange-600 border-orange-200">
                                      <Clock className="h-3 w-3 mr-1" />
                                      {t('status.pending')}
                                    </Badge>
                                  ) : (
                                    <>
                                      <Button
                                        size="sm"
                                        onClick={() => handleFriendRequest(request.id, 'accept')}
                                        className="flex items-center space-x-1 bg-green-600 hover:bg-green-700"
                                      >
                                        <Check className="h-4 w-4" />
                                        <span>{t('actions.accept')}</span>
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleFriendRequest(request.id, 'reject')}
                                        className="flex items-center space-x-1"
                                      >
                                        <X className="h-4 w-4" />
                                        <span>{t('actions.reject')}</span>
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </div>
              )
            },
            {
              value: "connected", 
              label: t('tabs.connected'),
              icon: <UserCheck className="h-4 w-4" />,
              content: (
                <div className="space-y-4">
                  {friendRequests.filter(r => r.status === 'accepted').length === 0 ? (
                    <Card>
                      <CardContent className="flex flex-col items-center justify-center py-12">
                        <UserCheck className="h-12 w-12 text-gray-400 mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('messages.noConnectedContacts')}</h3>
                        <p className="text-gray-600 text-center max-w-sm">
                          {t('messages.noConnectedContactsDescription')}
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-2">
                      {friendRequests.filter(r => r.status === 'accepted').map((request) => {
                        const otherUser = request.senderId === user?.id ? request.receiver : request.sender;
                        const otherUserId = request.senderId === user?.id ? request.receiverId : request.senderId;
                        
                        return (
                          <Card key={request.id} className="hover:shadow-md transition-shadow">
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                  <Avatar className="h-12 w-12">
                                    <AvatarImage src={otherUser?.avatar} alt={getUserDisplayName(otherUser!)} />
                                    <AvatarFallback>
                                      {getUserDisplayName(otherUser!).slice(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  
                                  <div className="flex-1">
                                    <h3 className="font-semibold text-gray-900">
                                      {getUserDisplayName(otherUser!)}
                                    </h3>
                                    <p className="text-sm text-gray-600">@{otherUser?.username}</p>
                                    <div className="flex items-center space-x-1 mt-1">
                                      <div className={`w-2 h-2 rounded-full ${otherUser?.isOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
                                      <span className="text-xs text-gray-500">
                                        {otherUser?.isOnline ? t('status.online') : t('status.offline')}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="flex items-center space-x-2">
                                  <Button
                                    size="sm"
                                    onClick={() => startConversation(otherUserId)}
                                    className="flex items-center space-x-1"
                                  >
                                    <MessageSquare className="h-4 w-4" />
                                    <span>{t('actions.message')}</span>
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </div>
              )
            },
            {
              value: "refused",
              label: t('tabs.refused'),
              icon: <UserX className="h-4 w-4" />,
              content: (
                <div className="space-y-4">
                  {friendRequests.filter(r => r.status === 'rejected').length === 0 ? (
                    <Card>
                      <CardContent className="flex flex-col items-center justify-center py-12">
                        <UserX className="h-12 w-12 text-gray-400 mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('messages.noRefusedRequests')}</h3>
                        <p className="text-gray-600 text-center max-w-sm">
                          {t('messages.noRefusedRequestsDescription')}
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-2">
                      {friendRequests.filter(r => r.status === 'rejected').map((request) => {
                        const isCurrentUserSender = request.senderId === user?.id;
                        const otherUser = isCurrentUserSender ? request.receiver : request.sender;
                        const otherUserId = isCurrentUserSender ? request.receiverId : request.senderId;
                        
                        return (
                          <Card key={request.id} className="hover:shadow-md transition-shadow">
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                  <Avatar className="h-12 w-12">
                                    <AvatarImage src={otherUser?.avatar} alt={getUserDisplayName(otherUser!)} />
                                    <AvatarFallback>
                                      {getUserDisplayName(otherUser!).slice(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  
                                  <div className="flex-1">
                                    <h3 className="font-semibold text-gray-900">
                                      {getUserDisplayName(otherUser!)}
                                    </h3>
                                    <p className="text-sm text-gray-600">@{otherUser?.username}</p>
                                    <p className="text-xs text-gray-500">
                                      {t('messages.requestRejected', { date: new Date(request.updatedAt).toLocaleDateString('pt-BR') })}
                                    </p>
                                  </div>
                                </div>
                                
                                <div className="flex items-center space-x-2">
                                  {isCurrentUserSender ? (
                                    <Badge variant="outline" className="text-red-600 border-red-200">
                                      <UserX className="h-3 w-3 mr-1" />
                                      {t('status.rejected')}
                                    </Badge>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => sendFriendRequest(otherUserId)}
                                      className="flex items-center space-x-1"
                                    >
                                      <UserPlus className="h-4 w-4" />
                                      <span>{t('actions.resend')}</span>
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </div>
              )
            },
            {
              value: "affiliates",
              label: t('tabs.affiliates'),
              icon: <Share2 className="h-4 w-4" />,
              content: (
                <div className="space-y-4">
                  {affiliateRelations.length === 0 ? (
                    <Card>
                      <CardContent className="flex flex-col items-center justify-center py-12">
                        <Share2 className="h-12 w-12 text-gray-400 mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('messages.noAffiliateContacts')}</h3>
                        <p className="text-gray-600 text-center max-w-sm">
                          {t('messages.noAffiliateContactsDescription')}
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-2">
                      {affiliateRelations.map((relation) => (
                        <Card key={relation.id} className="hover:shadow-md transition-shadow">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <Avatar className="h-12 w-12">
                                  <AvatarImage src={relation.referredUser.avatar} alt={getUserDisplayName(relation.referredUser)} />
                                  <AvatarFallback>
                                    {getUserDisplayName(relation.referredUser).slice(0, 2).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                
                                <div className="flex-1">
                                  <h3 className="font-semibold text-gray-900">
                                    {getUserDisplayName(relation.referredUser)}
                                  </h3>
                                  <p className="text-sm text-gray-600">@{relation.referredUser.username}</p>
                                  
                                  {/* Informations détaillées */}
                                  <div className="space-y-2 mt-3">
                                    {/* Email si disponible */}
                                    {relation.referredUser.email && (
                                      <div className="flex items-center space-x-2 p-2 bg-gray-50 rounded-md">
                                        <Mail className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                          <span className="text-xs text-gray-500 uppercase tracking-wide">
                                            {t('messages.emailAddress')}
                                          </span>
                                          <p className="text-sm text-gray-700 truncate">
                                            {relation.referredUser.email}
                                          </p>
                                        </div>
                                      </div>
                                    )}
                                    
                                    {/* Lien d'invitation utilisé */}
                                    <div className="flex items-center space-x-2 p-2 bg-blue-50 rounded-md">
                                      <Link className="h-4 w-4 text-blue-500 flex-shrink-0" />
                                      <div className="flex-1 min-w-0">
                                        <span className="text-xs text-blue-500 uppercase tracking-wide">
                                          {t('messages.linkUsed')}
                                        </span>
                                        <p className="text-sm text-blue-700 font-medium truncate">
                                          {relation.affiliateToken.name}
                                        </p>
                                      </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                      {/* Date d'inscription */}
                                      <div className="flex items-center space-x-2 p-2 bg-gray-50 rounded-md">
                                        <Calendar className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                        <div className="flex-1">
                                          <span className="text-xs text-gray-500 uppercase tracking-wide block">
                                            {t('messages.registeredAt')}
                                          </span>
                                          <p className="text-sm text-gray-700">
                                            {new Date(relation.referredUser.createdAt).toLocaleDateString('fr-FR', {
                                              day: 'numeric',
                                              month: 'short',
                                              year: 'numeric'
                                            })}
                                          </p>
                                        </div>
                                      </div>
                                      
                                      {/* Date de jointure via le lien */}
                                      <div className="flex items-center space-x-2 p-2 bg-green-50 rounded-md">
                                        <UserCheck className="h-4 w-4 text-green-500 flex-shrink-0" />
                                        <div className="flex-1">
                                          <span className="text-xs text-green-600 uppercase tracking-wide block">
                                            {t('messages.joinedOn')}
                                          </span>
                                          <p className="text-sm text-green-700 font-medium">
                                            {new Date(relation.createdAt).toLocaleDateString('fr-FR', {
                                              day: 'numeric',
                                              month: 'short',
                                              year: 'numeric'
                                            })}
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                    
                                    {/* Statut en ligne/hors ligne */}
                                    <div className="flex items-center justify-between p-2 bg-gray-50 rounded-md">
                                      <div className="flex items-center space-x-2">
                                        <div className={`w-3 h-3 rounded-full ${relation.referredUser.isOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
                                        <span className="text-sm text-gray-700">
                                          {relation.referredUser.isOnline ? t('status.online') : t('status.offline')}
                                        </span>
                                      </div>
                                      {relation.referredUser.isOnline && (
                                        <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full">
                                          Actif
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="flex items-center space-x-2">
                                <Button
                                  size="sm"
                                  onClick={() => startConversation(relation.referredUser.id)}
                                  className="flex items-center space-x-1"
                                >
                                  <MessageSquare className="h-4 w-4" />
                                  <span>{t('actions.message')}</span>
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              )
            }
          ]}
          mobileBreakpoint="md"
          className="mb-6"
        />

{/* Modal d'affiliation */}
        <ShareAffiliateModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          userLanguage={user?.systemLanguage || 'fr'}
        />
      </div>
    </DashboardLayout>
  );
}
