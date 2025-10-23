'use client';

import { useState, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  X,
  Edit,
  Save,
  Languages,
  Users,
  Link2,
  Copy,
  Check
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Conversation, User, Message } from '@shared/types';
import { conversationsService } from '@/services/conversations.service';
import { getLanguageDisplayName, getLanguageFlag } from '@/utils/language-utils';
import { toast } from 'sonner';
import { ConversationLinksSection } from './conversation-links-section';
import { CreateLinkButton } from './create-link-button';
import { UserRoleEnum } from '@shared/types';
import { useI18n } from '@/hooks/useI18n';
import { copyToClipboard } from '@/lib/clipboard';

// Import des composants de la sidebar de BubbleStreamPage
import {
  FoldableSection,
  LanguageIndicators,
  SidebarLanguageHeader,
  type LanguageStats
} from '@/lib/bubble-stream-modules';

interface ConversationDetailsSidebarProps {
  conversation: Conversation;
  currentUser: User;
  messages: Message[];
  isOpen: boolean;
  onClose: () => void;
}



export function ConversationDetailsSidebar({
  conversation,
  currentUser,
  messages,
  isOpen,
  onClose
}: ConversationDetailsSidebarProps) {
  const { t } = useI18n('conversations');
  
  // États pour la gestion des conversations
  const [isEditingName, setIsEditingName] = useState(false);
  const [conversationName, setConversationName] = useState(conversation.title || '');
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [conversationDescription, setConversationDescription] = useState(conversation.description || '');
  const [isLoading, setIsLoading] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  // États pour les statistiques de langues
  const [messageLanguageStats, setMessageLanguageStats] = useState<LanguageStats[]>([]);
  const [activeLanguageStats, setActiveLanguageStats] = useState<LanguageStats[]>([]);
  const [activeUsers, setActiveUsers] = useState<User[]>([]);

  // Vérifier si l'utilisateur actuel est admin/modérateur de la conversation
  const userMembership = conversation.participants?.find(p => p.userId === currentUser.id);
  const isAdmin = currentUser.role === UserRoleEnum.ADMIN || 
                  currentUser.role === UserRoleEnum.BIGBOSS ||
                  userMembership?.role === UserRoleEnum.ADMIN ||
                  userMembership?.role === UserRoleEnum.MODERATOR;

  // Calculer les statistiques de langues des messages et participants (comme dans BubbleStreamPage)
  useEffect(() => {
    const calculateLanguageStats = () => {
      // Calculer les langues des messages
      const messagesPerLanguage: Record<string, number> = {};
      messages.forEach(message => {
        const lang = message.originalLanguage || 'fr';
        messagesPerLanguage[lang] = (messagesPerLanguage[lang] || 0) + 1;
      });

      const messageStats: LanguageStats[] = Object.entries(messagesPerLanguage)
        .map(([language, count], index) => ({
          language,
          flag: getLanguageFlag(language),
          count,
          color: `hsl(${(index * 137.5) % 360}, 50%, 50%)`
        }))
        .filter(stat => stat.count > 0)
        .sort((a, b) => b.count - a.count);

      setMessageLanguageStats(messageStats);

      // Calculer les langues des participants comme dans BubbleStreamPage
      if (conversation.participants && conversation.participants.length > 0) {
        const userLanguages: { [key: string]: Set<string> } = {};
        
        conversation.participants.forEach(participant => {
          const lang = participant.user?.systemLanguage || 'fr';
          if (!userLanguages[lang]) {
            userLanguages[lang] = new Set();
          }
          userLanguages[lang].add(participant.userId);
        });
        
        const userStats: LanguageStats[] = Object.entries(userLanguages)
          .map(([code, users], index) => ({
            language: code,
            flag: getLanguageFlag(code),
            count: users.size,
            color: `hsl(${(index * 137.5) % 360}, 50%, 50%)`
          }))
          .filter(stat => stat.count > 0)
          .sort((a, b) => b.count - a.count);
        
        setActiveLanguageStats(userStats);
        console.log('👥 Statistiques langues participants calculées:', userStats);
        
        // Calculer les utilisateurs actifs
        const activeParticipants = conversation.participants
          .filter(p => p.user?.isOnline)
          .map(p => p.user)
          .filter(Boolean) as User[];
        setActiveUsers(activeParticipants);
      }
    };

    calculateLanguageStats();
  }, [conversation.participants, messages]);

  const getConversationDisplayName = (conv: Conversation) => {
    if (conv.type !== 'direct') {
      return conv.title || 'Conversation de groupe';
    }
    
    const otherParticipant = conv.participants?.find(p => p.userId !== currentUser.id);
    if (otherParticipant && otherParticipant.user) {
      // Prioriser le displayName, sinon prénom/nom, sinon username
      return otherParticipant.user.displayName ||
             `${otherParticipant.user.firstName || ''} ${otherParticipant.user.lastName || ''}`.trim() ||
             otherParticipant.user.username;
    }

    return conv.title || 'Conversation';
  };

  // Fonctions pour la gestion des conversations
  const handleSaveName = async () => {
    try {
      setIsLoading(true);
      
      // Validation du nom
      if (!conversationName.trim()) {
        toast.error(t('conversationDetails.nameCannotBeEmpty'));
        return;
      }
      
      if (conversationName.trim() === (conversation.title || '')) {
        // Pas de changement, juste fermer l'édition
        setIsEditingName(false);
        return;
      }
      
      await conversationsService.updateConversation(conversation.id, {
        title: conversationName.trim()
      });
      
      setIsEditingName(false);
      toast.success(t('conversationDetails.nameUpdated'));
    } catch (error) {
      console.error('Erreur lors de la mise à jour du nom:', error);
      
      // Gestion d'erreur améliorée
      let errorMessage = t('conversationDetails.updateError');
      
      if (error.status === 409) {
        errorMessage = t('conversationDetails.conversationExists');
      } else if (error.status === 403) {
        errorMessage = t('conversationDetails.noPermissionToModify');
      } else if (error.status === 404) {
        errorMessage = t('conversationDetails.conversationNotFound');
      } else if (error.status === 400) {
        errorMessage = t('conversationDetails.invalidData');
      }
      
      toast.error(errorMessage);
      
      // Restaurer le nom original en cas d'erreur
      setConversationName(conversation.title || '');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveDescription = async () => {
    try {
      setIsLoading(true);
      
      // Vérifier si la description a changé
      if (conversationDescription.trim() === (conversation.description || '')) {
        // Pas de changement, juste fermer l'édition
        setIsEditingDescription(false);
        return;
      }
      
      await conversationsService.updateConversation(conversation.id, {
        description: conversationDescription.trim()
      });
      
      setIsEditingDescription(false);
      toast.success(t('conversationDetails.descriptionUpdated') || 'Description mise à jour avec succès');
    } catch (error) {
      console.error('Erreur lors de la mise à jour de la description:', error);
      
      // Gestion d'erreur améliorée
      let errorMessage = t('conversationDetails.updateError');
      
      if (error.status === 403) {
        errorMessage = t('conversationDetails.noPermissionToModify');
      } else if (error.status === 404) {
        errorMessage = t('conversationDetails.conversationNotFound');
      } else if (error.status === 400) {
        errorMessage = t('conversationDetails.invalidData');
      }
      
      toast.error(errorMessage);
      
      // Restaurer la description originale en cas d'erreur
      setConversationDescription(conversation.description || '');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveParticipant = async (userId: string) => {
    if (!isAdmin) return;
    
    try {
      setIsLoading(true);
      await conversationsService.removeParticipant(conversation.id, userId);
      toast.success(t('conversationDetails.participantRemoved'));
    } catch (error) {
      console.error('Erreur lors de la suppression du participant:', error);
      toast.error(t('conversationDetails.removeParticipantError'));
    } finally {
      setIsLoading(false);
    }
  };

  // Copier le lien de la conversation
  const handleCopyConversationLink = async () => {
    const conversationUrl = `${window.location.origin}/conversations/${conversation.id}`;
    const result = await copyToClipboard(conversationUrl);
    
    if (result.success) {
      setIsCopied(true);
      toast.success('Lien de conversation copié !');
      setTimeout(() => setIsCopied(false), 2000);
    } else {
      toast.error(result.message || 'Erreur lors de la copie');
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay pour fermer en cliquant en dehors */}
      <div 
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[110] animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Sidebar au niveau de la conversation - Positionnée à GAUCHE */}
      <div className="absolute inset-y-0 left-0 w-80 bg-card dark:bg-card border-r border-border z-[120] shadow-2xl animate-in slide-in-from-left duration-300">
        <div className="flex flex-col h-full">
          {/* Header fixe */}
          <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-border bg-card dark:bg-card">
            <h2 className="text-lg font-semibold">{t('conversationDetails.title')}</h2>
            <Button
              size="sm"
              variant="ghost"
              onClick={onClose}
              className="h-8 w-8 p-0 rounded-full hover:bg-accent"
              aria-label={t('conversationDetails.close')}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Contenu scrollable */}
          <ScrollArea className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-6">
            {/* Info principale */}
            <div className="text-center space-y-3">
              <Avatar className="h-16 w-16 mx-auto ring-2 ring-primary/20">
                <AvatarImage />
                <AvatarFallback className="bg-primary/20 text-primary font-bold text-lg">
                  {getConversationDisplayName(conversation).charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                {isEditingName ? (
                  <div className="flex items-center gap-2 justify-center">
                    <Input
                      value={conversationName}
                      onChange={(e) => setConversationName(e.target.value)}
                      className="h-8 text-sm"
                      placeholder={t('conversationDetails.conversationName')}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleSaveName();
                        } else if (e.key === 'Escape') {
                          setIsEditingName(false);
                          setConversationName(conversation.title || '');
                        }
                      }}
                      onBlur={handleSaveName}
                    />
                    <Button
                      size="sm"
                      onClick={handleSaveName}
                      disabled={isLoading}
                      className="h-8 px-2"
                    >
                      <Save className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setIsEditingName(false);
                        setConversationName(conversation.title || '');
                      }}
                      className="h-8 px-2"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 justify-center">
                    <h3 
                      className="font-semibold text-lg cursor-pointer hover:text-primary transition-colors"
                      onClick={() => {
                        setIsEditingName(true);
                        setConversationName(conversation.title || getConversationDisplayName(conversation));
                      }}
                      title={t('conversationDetails.clickToEdit')}
                    >
                      {getConversationDisplayName(conversation)}
                    </h3>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setIsEditingName(true);
                        setConversationName(conversation.title || getConversationDisplayName(conversation));
                      }}
                      className="h-6 w-6 p-0"
                      title={t('conversationDetails.editName')}
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                  </div>
                )}
                <p className="text-sm text-muted-foreground text-center">
                  {conversation.type !== 'direct' ? t('conversationDetails.conversationGroup') : t('conversationDetails.conversationPrivate')}
                </p>
              </div>

              {/* Section description - Seulement pour les conversations de groupe */}
              {conversation.type !== 'direct' && (
                <div className="space-y-2">
                  {isEditingDescription ? (
                    <div className="space-y-2">
                      <Textarea
                        value={conversationDescription}
                        onChange={(e) => setConversationDescription(e.target.value)}
                        className="min-h-[80px] text-sm resize-none"
                        placeholder={t('conversationDetails.descriptionPlaceholder') || 'Ajoutez une description...'}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') {
                            setIsEditingDescription(false);
                            setConversationDescription(conversation.description || '');
                          }
                          // Ctrl/Cmd + Enter pour sauvegarder
                          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                            handleSaveDescription();
                          }
                        }}
                      />
                      <div className="flex items-center gap-2 justify-end">
                        <Button
                          size="sm"
                          onClick={handleSaveDescription}
                          disabled={isLoading}
                          className="h-8 px-3"
                        >
                          <Save className="h-3 w-3 mr-1" />
                          {t('conversationDetails.save') || 'Enregistrer'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setIsEditingDescription(false);
                            setConversationDescription(conversation.description || '');
                          }}
                          className="h-8 px-3"
                        >
                          <X className="h-3 w-3 mr-1" />
                          {t('conversationDetails.cancel') || 'Annuler'}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div 
                      className="group relative p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => {
                        if (isAdmin) {
                          setIsEditingDescription(true);
                          setConversationDescription(conversation.description || '');
                        }
                      }}
                    >
                      {conversation.description ? (
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {conversation.description}
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground/50 italic">
                          {isAdmin 
                            ? (t('conversationDetails.addDescription') || 'Cliquez pour ajouter une description...')
                            : (t('conversationDetails.noDescription') || 'Aucune description')
                          }
                        </p>
                      )}
                      {isAdmin && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="absolute top-2 right-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsEditingDescription(true);
                            setConversationDescription(conversation.description || '');
                          }}
                          title={t('conversationDetails.editDescription') || 'Modifier la description'}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <Separator />

            {/* ID de la conversation avec bouton copier */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800">
              <span className="text-xs font-mono text-gray-600 dark:text-gray-400 truncate">
                {conversation.id}
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCopyConversationLink}
                className="h-8 w-8 p-0 flex-shrink-0"
              >
                {isCopied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>

            <Separator />

            {/* Header avec langues globales */}
            <SidebarLanguageHeader 
              languageStats={messageLanguageStats} 
              userLanguage={currentUser.systemLanguage}
            />

            {/* Section Langues Actives - Foldable */}
            <FoldableSection
              title={t('conversationDetails.activeLanguages')}
              icon={<Languages className="h-4 w-4 mr-2" />}
              defaultExpanded={true}
            >
              <LanguageIndicators languageStats={activeLanguageStats} />
            </FoldableSection>

            {/* Section Utilisateurs Actifs - Foldable */}
            <FoldableSection
              title={`${t('conversationDetails.activeUsers')} (${activeUsers.length})`}
              icon={<Users className="h-4 w-4 mr-2" />}
              defaultExpanded={true}
            >
              <div className="space-y-3">
                {activeUsers.slice(0, 6).map((user) => (
                  <div key={user.id} className="flex items-center space-x-3 p-2 rounded hover:bg-accent cursor-pointer transition-colors">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user.avatar} alt={user.firstName} />
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                        {(user.firstName || user.username || 'U').charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {user.firstName && user.lastName 
                          ? `${user.firstName} ${user.lastName}` 
                          : user.username}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {getLanguageDisplayName(user.systemLanguage)} {getLanguageFlag(user.systemLanguage)}
                      </p>
                    </div>
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  </div>
                ))}
                
                {activeUsers.length > 6 && (
                  <div className="text-center pt-2">
                    <p className="text-xs text-gray-500">
                      {t('conversationDetails.otherActiveUsers', { count: activeUsers.length - 6 })}
                    </p>
                  </div>
                )}
                
                {activeUsers.length === 0 && (
                  <div className="text-center py-4">
                    <Users className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    <p className="text-sm text-gray-500">{t('conversationDetails.noActiveUsers')}</p>
                  </div>
                )}
              </div>
            </FoldableSection>

            {/* Section Liens de partage */}
            {/* Section des liens de partage - seulement pour les conversations de groupe */}
            {conversation.type !== 'direct' && (
              <FoldableSection
                title={t('conversationDetails.shareLinks')}
                icon={<Link2 className="h-4 w-4 mr-2" />}
                defaultExpanded={false}
              >
                <div className="space-y-4">
                  {/* Bouton pour créer un nouveau lien */}
                  <CreateLinkButton
                    forceModal={true}
                    onLinkCreated={() => {
                      // Recharger la liste des liens
                      window.location.reload();
                    }}
                    variant="outline"
                    className="w-full"
                  >
                    <Link2 className="h-4 w-4 mr-2" />
                    {t('conversationDetails.createLink')}
                  </CreateLinkButton>
                  
                  {/* Liste des liens existants */}
                  <ConversationLinksSection 
                    conversationId={conversation.id}
                  />
                </div>
              </FoldableSection>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
    </>
  );
}
