'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
  UserMinus
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { User } from '@/types';
import { usersService } from '@/services';

export default function ContactsPage() {
  const router = useRouter();
  const [contacts, setContacts] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchResults, setSearchResults] = useState<User[]>([]);

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
          toast.error('Session expirée, veuillez vous reconnecter');
          router.push('/login');
          return;
        }
        
        // Si l'authentification est valide, charger les contacts
        loadContacts();
      } catch (error) {
        console.error('Erreur vérification auth:', error);
        toast.error('Erreur de connexion');
        router.push('/login');
      }
    };

    checkAuth();
  }, [router]);

  const loadContacts = async () => {
    try {
      // Pour l'instant, on charge tous les utilisateurs comme contacts potentiels
      const response = await usersService.getAllUsers();
      // S'assurer que response.data est un tableau
      const contactsData = Array.isArray(response.data) ? response.data : [];
      setContacts(contactsData);
    } catch (error) {
      console.error('Erreur lors du chargement des contacts:', error);
      toast.error('Erreur lors du chargement des contacts');
      setContacts([]); // Initialiser avec un tableau vide en cas d'erreur
    } finally {
      setLoading(false);
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
      toast.error('Erreur lors de la recherche');
      setSearchResults([]); // Initialiser avec un tableau vide en cas d'erreur
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    searchUsers(searchQuery);
  };

  const startConversation = (userId: string) => {
    router.push(`/conversations?user=${userId}`);
  };

  const getUserDisplayName = (user: User): string => {
    if (user.displayName) return user.displayName;
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
      <DashboardLayout title="Contacts">
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
    <DashboardLayout title="Contacts">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header avec recherche */}
        <Card>
          <CardContent className="p-6">
            <form onSubmit={handleSearch} className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Rechercher des contacts..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    searchUsers(e.target.value);
                  }}
                  className="pl-10"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  {displayedUsers.length} contact{displayedUsers.length !== 1 ? 's' : ''} trouvé{displayedUsers.length !== 1 ? 's' : ''}
                </p>
                
                <Button 
                  onClick={() => router.push('/search')}
                  variant="outline"
                  className="flex items-center space-x-2"
                >
                  <UserPlus className="h-4 w-4" />
                  <span>Ajouter un contact</span>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Liste des contacts */}
        {displayedUsers.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Users className="h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {searchQuery ? 'Aucun contact trouvé' : 'Aucun contact'}
              </h3>
              <p className="text-gray-600 text-center max-w-sm mb-4">
                {searchQuery 
                  ? 'Essayez avec d\'autres mots-clés ou ajoutez de nouveaux contacts.'
                  : 'Commencez par ajouter des contacts pour pouvoir démarrer des conversations.'
                }
              </p>
              <Button 
                onClick={() => router.push('/search')}
                className="flex items-center space-x-2"
              >
                <UserPlus className="h-4 w-4" />
                <span>Rechercher des utilisateurs</span>
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
                              {contact.isOnline ? 'En ligne' : 'Hors ligne'}
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
                        <span className="hidden sm:inline">Message</span>
                      </Button>
                      
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
                            Voir le profil
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => startConversation(contact.id)}>
                            Envoyer un message
                          </DropdownMenuItem>
                          {contact.phoneNumber && (
                            <DropdownMenuItem>
                              <Phone className="mr-2 h-4 w-4" />
                              Appeler
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem className="text-red-600">
                            <UserMinus className="mr-2 h-4 w-4" />
                            Supprimer
                          </DropdownMenuItem>
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
    </DashboardLayout>
  );
}
