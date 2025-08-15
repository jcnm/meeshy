'use client';

import { useState, useEffect, useCallback } from 'react';
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
import { Check, X, Users } from 'lucide-react';

interface CreateConversationModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onConversationCreated: (conversationId: string) => void;
}

export function CreateConversationModal({
  isOpen,
  onClose,
  currentUser,
  onConversationCreated
}: CreateConversationModalProps) {
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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
        toast.error('Erreur lors de la recherche');
      }
    } catch (error) {
      console.error('Erreur recherche utilisateurs:', error);
      toast.error('Erreur lors de la recherche');
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
      toast.error('Veuillez sélectionner au moins un utilisateur');
      return;
    }

    setIsCreating(true);
    try {
      const token = localStorage.getItem('auth_token');
      // Générer automatiquement un titre basé sur les participants
      const title = selectedUsers.length === 1 
        ? `Conversation avec ${selectedUsers[0].displayName || selectedUsers[0].username}`
        : `Conversation avec ${selectedUsers.map(u => u.displayName || u.username).join(', ')}`;

      const response = await fetch(buildApiUrl(API_ENDPOINTS.CONVERSATION.CREATE), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title,
          type: 'direct', // Type requis pour les conversations directes
          participantIds: selectedUsers.map(u => u.id)
        })
      });

      if (response.ok) {
        const responseData = await response.json();
        const conversation = responseData.data;
        toast.success('Conversation créée avec succès');
        onConversationCreated(conversation.id);
        handleClose();
      } else {
        const error = await response.json();
        toast.error(error.message || 'Erreur lors de la création de la conversation');
      }
    } catch (error) {
      console.error('Erreur création conversation:', error);
      toast.error('Erreur lors de la création de la conversation');
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    setSelectedUsers([]);
    setSearchQuery('');
    setAvailableUsers([]);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nouvelle conversation</DialogTitle>
          <DialogDescription>
            Sélectionnez les utilisateurs pour créer une nouvelle conversation
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Recherche d'utilisateurs */}
          <div>
            <Label htmlFor="search" className="text-sm font-medium">
              Rechercher des utilisateurs
            </Label>
            <Input
              id="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher par nom ou username..."
              className="mt-1"
            />
          </div>

          {/* Utilisateurs sélectionnés */}
          {selectedUsers.length > 0 && (
            <div>
              <Label className="text-sm font-medium">
                Utilisateurs sélectionnés ({selectedUsers.length})
              </Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {selectedUsers.map(user => (
                  <Badge
                    key={user.id}
                    variant="secondary"
                    className="flex items-center gap-1"
                  >
                    {user.displayName || user.username}
                    <X
                      className="h-3 w-3 cursor-pointer"
                      onClick={() => toggleUserSelection(user)}
                    />
                  </Badge>
                ))}
              </div>
            </div>
          )}
          
          {/* Liste des utilisateurs */}
          <div>
            <Label className="text-sm font-medium">
              Utilisateurs disponibles
            </Label>
            <ScrollArea className="h-60 mt-2 border rounded-lg">
              {isLoading ? (
                <div className="p-4 text-center text-gray-500">
                  Chargement des utilisateurs...
                </div>
              ) : availableUsers.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  {searchQuery ? 'Aucun utilisateur trouvé' : 'Tapez pour rechercher des utilisateurs'}
                </div>
              ) : (
                <div className="p-2">
                  {availableUsers.map(user => {
                    const isSelected = selectedUsers.some(u => u.id === user.id);
                    return (
                      <div
                        key={user.id}
                        className={`flex items-center space-x-3 p-2 rounded-lg cursor-pointer hover:bg-gray-50 ${
                          isSelected ? 'bg-blue-50 border border-blue-200' : ''
                        }`}
                        onClick={() => toggleUserSelection(user)}
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
                          <p className="text-xs text-gray-500">@{user.username}</p>
                        </div>
                        {isSelected && (
                          <Check className="h-4 w-4 text-blue-600" />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>
          
          {/* Actions */}
          <div className="flex space-x-3 pt-4">
            <Button
              onClick={createConversation}
              disabled={selectedUsers.length === 0 || isCreating}
              className="flex-1"
            >
              <Users className="mr-2 h-4 w-4" />
              {isCreating ? 'Création...' : 'Créer la conversation'}
            </Button>
            <Button
              onClick={handleClose}
              variant="outline"
            >
              Annuler
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
