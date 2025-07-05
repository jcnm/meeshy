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
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { User } from '@/types';
import { buildApiUrl, API_ENDPOINTS } from '@/lib/config';
import { toast } from 'sonner';
import { Check, X, Users, Shield, Eye } from 'lucide-react';

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onGroupCreated: (groupId: string) => void;
}

export function CreateGroupModal({
  isOpen,
  onClose,
  currentUser,
  onGroupCreated
}: CreateGroupModalProps) {
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Charger les utilisateurs disponibles
  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(buildApiUrl(API_ENDPOINTS.USER.SEARCH), {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        // Exclure l'utilisateur actuel
        const users = (data.users || []).filter((user: User) => user.id !== currentUser.id);
        setAvailableUsers(users);
      } else {
        toast.error('Erreur lors du chargement des utilisateurs');
      }
    } catch (error) {
      console.error('Erreur chargement utilisateurs:', error);
      toast.error('Erreur lors du chargement des utilisateurs');
    } finally {
      setIsLoading(false);
    }
  }, [currentUser.id]);

  useEffect(() => {
    if (isOpen) {
      loadUsers();
    }
  }, [isOpen, loadUsers]);

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

  const createGroup = async () => {
    if (!groupName.trim()) {
      toast.error('Veuillez saisir un nom pour le groupe');
      return;
    }

    if (selectedUsers.length === 0) {
      toast.error('Veuillez sélectionner au moins un membre');
      return;
    }

    setIsCreating(true);
    try {
      const token = localStorage.getItem('auth_token');

      const response = await fetch(buildApiUrl('/groups'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: groupName.trim(),
          description: groupDescription.trim() || undefined,
          isPrivate,
          memberIds: selectedUsers.map(u => u.id)
        })
      });

      if (response.ok) {
        const data = await response.json();
        toast.success('Groupe créé avec succès');
        onGroupCreated(data.group.id);
        handleClose();
      } else {
        const error = await response.json();
        toast.error(error.message || 'Erreur lors de la création du groupe');
      }
    } catch (error) {
      console.error('Erreur création groupe:', error);
      toast.error('Erreur lors de la création du groupe');
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    setSelectedUsers([]);
    setGroupName('');
    setGroupDescription('');
    setIsPrivate(false);
    setSearchQuery('');
    onClose();
  };

  const filteredUsers = availableUsers.filter(user =>
    (user.displayName || user.username).toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Créer un nouveau groupe</DialogTitle>
          <DialogDescription>
            Créez un groupe pour organiser vos conversations avec plusieurs personnes
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Nom du groupe */}
          <div>
            <Label htmlFor="name" className="text-sm font-medium">
              Nom du groupe *
            </Label>
            <Input
              id="name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Ex: Équipe Marketing, Famille, Amis..."
              className="mt-1"
            />
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="description" className="text-sm font-medium">
              Description (optionnelle)
            </Label>
            <Textarea
              id="description"
              value={groupDescription}
              onChange={(e) => setGroupDescription(e.target.value)}
              placeholder="Décrivez le but de ce groupe..."
              className="mt-1"
              rows={2}
            />
          </div>

          {/* Confidentialité */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Groupe privé</Label>
              <p className="text-xs text-gray-500">
                {isPrivate ? 'Seuls les membres invités peuvent rejoindre' : 'Le groupe peut être découvert et rejoint par d\'autres'}
              </p>
            </div>
            <div className="flex items-center space-x-2">
              {isPrivate ? <Shield className="h-4 w-4 text-blue-600" /> : <Eye className="h-4 w-4 text-gray-400" />}
              <Switch
                checked={isPrivate}
                onCheckedChange={setIsPrivate}
              />
            </div>
          </div>
          
          {/* Recherche d'utilisateurs */}
          <div>
            <Label htmlFor="search" className="text-sm font-medium">
              Rechercher des membres
            </Label>
            <Input
              id="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher par nom ou username..."
              className="mt-1"
            />
          </div>

          {/* Membres sélectionnés */}
          {selectedUsers.length > 0 && (
            <div>
              <Label className="text-sm font-medium">
                Membres sélectionnés ({selectedUsers.length + 1} au total, vous inclus)
              </Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {/* Utilisateur actuel (admin) */}
                <Badge variant="default" className="flex items-center gap-1">
                  {currentUser.displayName || currentUser.username}
                  <Shield className="h-3 w-3" />
                </Badge>
                {/* Membres sélectionnés */}
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
            <ScrollArea className="h-48 mt-2 border rounded-lg">
              {isLoading ? (
                <div className="p-4 text-center text-gray-500">
                  Chargement des utilisateurs...
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  Aucun utilisateur trouvé
                </div>
              ) : (
                <div className="p-2">
                  {filteredUsers.map(user => {
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
              onClick={createGroup}
              disabled={!groupName.trim() || selectedUsers.length === 0 || isCreating}
              className="flex-1"
            >
              <Users className="mr-2 h-4 w-4" />
              {isCreating ? 'Création...' : 'Créer le groupe'}
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
