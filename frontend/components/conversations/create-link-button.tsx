'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Link2, Plus } from 'lucide-react';
import { CreateLinkModalV2 } from './create-link-modal';
import { LinkSummaryModal } from './link-summary-modal';
import { toast } from 'sonner';
import { buildApiUrl, API_ENDPOINTS } from '@/lib/config';
import { copyToClipboard } from '@/lib/clipboard';
import { useUser } from '@/stores';
import { useLanguage } from '@/hooks/use-language';
import { generateLinkName } from '@/utils/link-name-generator';
import { conversationsService } from '@/services/conversations.service';
import { authManager } from '@/services/auth-manager.service';

interface CreateLinkButtonProps {
  conversationId?: string; // ID de la conversation (optionnel, détecté depuis l'URL sinon)
  currentUser?: any; // Utilisateur courant (optionnel, utilise le store si non fourni)
  onLinkCreated?: () => void;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary' | 'destructive';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  children?: React.ReactNode;
  forceModal?: boolean; // Force l'ouverture de la modale au lieu de créer un lien directement
  disableSummaryModal?: boolean; // Désactive la modale de résumé après création
}

export function CreateLinkButton({

  conversationId: propConversationId,
  currentUser: propCurrentUser,
  onLinkCreated,
  variant = 'default',
  size = 'default',
  className,
  children,
  forceModal = false,
  disableSummaryModal = false
}: CreateLinkButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [linkSummaryData, setLinkSummaryData] = useState<any>(null);
  const { user: storeUser } = useUser();
  const currentUser = propCurrentUser || storeUser; // Utiliser la prop en priorité, sinon le store
  const router = useRouter();
  const searchParams = useSearchParams();
  const { detectedInterfaceLanguage } = useLanguage();

  // Messages traduits selon la langue de l'interface
  const getTranslatedMessages = (lang: string) => {
    const messages: Record<string, { success: string; shareMessage: string; copied: string }> = {
      fr: {
        success: 'Point d\'ancrage créé avec succès',
        shareMessage: '🔗 Rejoignez la conversation Meeshy !\n\n',
        copied: 'Lien copié dans le presse-papier !'
      },
      en: {
        success: 'Anchor point created successfully',
        shareMessage: '🔗 Join the Meeshy conversation!\n\n',
        copied: 'Link copied to clipboard!'
      },
      es: {
        success: 'Punto de anclaje creado con éxito',
        shareMessage: '🔗 ¡Únete a la conversación de Meeshy!\n\n',
        copied: '¡Enlace copiado al portapapeles!'
      },
      de: {
        success: 'Ankerpunkt erfolgreich erstellt',
        shareMessage: '🔗 Treten Sie dem Meeshy-Gespräch bei!\n\n',
        copied: 'Link in die Zwischenablage kopiert!'
      },
      it: {
        success: 'Punto di ancoraggio creato con successo',
        shareMessage: '🔗 Unisciti alla conversazione Meeshy!\n\n',
        copied: 'Link copiato negli appunti!'
      },
      pt: {
        success: 'Ponto de ancoragem criado com sucesso',
        shareMessage: '🔗 Junte-se à conversa Meeshy!\n\n',
        copied: 'Link copiado para a área de transferência!'
      },
      zh: {
        success: '锚点创建成功',
        shareMessage: '🔗 加入 Meeshy 对话！\n\n',
        copied: '链接已复制到剪贴板！'
      },
      ja: {
        success: 'アンカーポイントが正常に作成されました',
        shareMessage: '🔗 Meeshy の会話に参加しましょう！\n\n',
        copied: 'リンクがクリップボードにコピーされました！'
      },
      ar: {
        success: 'تم إنشاء نقطة الربط بنجاح',
        shareMessage: '🔗 انضم إلى محادثة Meeshy!\n\n',
        copied: 'تم نسخ الرابط إلى الحافظة!'
      }
    };
    return messages[lang] || messages['en'];
  };

  const handleLinkCreated = () => {
    setIsModalOpen(false);
    setGeneratedLink(null);
    setGeneratedToken(null);
    setLinkSummaryData(null);
    console.log('Lien de partage créé avec succès !');
    onLinkCreated?.();
  };

  const handleSummaryModalClose = () => {
    setIsSummaryModalOpen(false);
    setGeneratedLink(null);
    setGeneratedToken(null);
    setLinkSummaryData(null);
  };

  const createQuickLink = async (conversationId: string) => {
    if (!currentUser) {
      toast.error('Impossible de créer le lien : utilisateur non connecté');
      return;
    }
    
    if (!conversationId) {
      toast.error('Impossible de créer le lien : conversation non identifiée');
      return;
    }

    setIsCreating(true);
    
    try {
      // Récupérer les détails de la conversation pour obtenir le titre
      const conversation = await conversationsService.getConversation(conversationId);
      const conversationTitle = conversation.title || 'Conversation';
      
      // Paramètres du lien
      const expirationDays = 1; // 24h
      const maxUses = undefined;
      const maxConcurrentUsers = undefined;
      
      // Générer le nom du lien selon la langue de l'utilisateur
      const linkTitle = generateLinkName({
        conversationTitle,
        language: currentUser.systemLanguage || detectedInterfaceLanguage || 'fr',
        durationDays: expirationDays,
        maxParticipants: maxConcurrentUsers,
        maxUses: maxUses,
        isPublic: true
      });
      
      const linkData = {
        conversationId: conversationId,
        title: linkTitle,
        description: 'Lien de partage créé automatiquement',
        expirationDays: expirationDays,
        maxUses: maxUses,
        maxConcurrentUsers: maxConcurrentUsers,
        maxUniqueSessions: undefined,
        allowAnonymousMessages: true,
        allowAnonymousFiles: true, // Tous types de fichiers
        allowAnonymousImages: true,
        allowViewHistory: true,
        requireNickname: false, // Pas de pseudo requis
        requireEmail: false, // Pas d'email requis
        allowedLanguages: ['fr', 'en', 'es', 'de', 'it', 'pt', 'zh', 'ja', 'ar'] // Toutes les langues supportées
      };

      const token = typeof window !== 'undefined' ? authManager.getAuthToken() : null;
      
      const response = await fetch(buildApiUrl(API_ENDPOINTS.CONVERSATION.CREATE_LINK), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` })
        },
        body: JSON.stringify(linkData)
      });

      if (response.ok) {
        const result = await response.json();
        const linkUrl = `${window.location.origin}/join/${result.data.linkId}`;
        const messages = getTranslatedMessages(detectedInterfaceLanguage);
        const shareText = messages.shareMessage + linkUrl;
        
        // Stocker les liens générés
        setGeneratedLink(linkUrl);
        setGeneratedToken(result.data.linkId);
        
        // Préparer les données pour le modal synthétique
        setLinkSummaryData({
          url: linkUrl,
          token: result.data.linkId,
          title: linkData.title,
          description: linkData.description,
          expirationDays: linkData.expirationDays,
          maxUses: linkData.maxUses,
          maxConcurrentUsers: linkData.maxConcurrentUsers,
          maxUniqueSessions: linkData.maxUniqueSessions,
          allowAnonymousMessages: linkData.allowAnonymousMessages,
          allowAnonymousFiles: linkData.allowAnonymousFiles,
          allowAnonymousImages: linkData.allowAnonymousImages,
          allowViewHistory: linkData.allowViewHistory,
          requireNickname: linkData.requireNickname,
          requireEmail: linkData.requireEmail,
          allowedLanguages: linkData.allowedLanguages
        });
        
        // Copier le lien avec message de partage dans le presse-papier
        try {
          await navigator.clipboard.writeText(shareText);
          toast.success(messages.success, {
            description: linkUrl,
            duration: 10000,
            onClick: async () => {
              // Recopier au clic sur le toast
              try {
                await navigator.clipboard.writeText(shareText);
                toast.success(messages.copied);
              } catch (err) {
                console.error('Erreur copie:', err);
              }
            },
            style: { cursor: 'pointer' }
          });
        } catch (clipboardError: any) {
          console.warn('Clipboard access denied or not available:', clipboardError);
          // Fallback: afficher le lien dans un toast cliquable
          toast.success(messages.success, {
            description: linkUrl,
            duration: 10000,
            onClick: () => {
              // Essayer une méthode alternative de copie
              const textArea = document.createElement('textarea');
              textArea.value = shareText;
              document.body.appendChild(textArea);
              textArea.select();
              try {
                document.execCommand('copy');
                toast.success(messages.copied);
              } catch (fallbackError) {
                console.error('Fallback copy failed:', fallbackError);
                toast.error('Échec de la copie');
              }
              document.body.removeChild(textArea);
            },
            style: { cursor: 'pointer' }
          });
        }
        
        // Ouvrir le modal synthétique avec le récapitulatif seulement si pas désactivé
        if (!disableSummaryModal) {
          setIsSummaryModalOpen(true);
        }
        onLinkCreated?.();
      } else {
        const error = await response.json();
        console.error('Erreur API:', error);
        toast.error(error.message || 'Erreur lors de la création du lien');
      }
    } catch (error) {
      console.error('Erreur création lien:', error);
      toast.error('Erreur lors de la création du lien');
    } finally {
      setIsCreating(false);
    }
  };

  const handleClick = () => {
    // Si forceModal est activé, ouvrir toujours la modale
    if (forceModal) {
      setIsModalOpen(true);
      return;
    }

    // Utiliser la prop conversationId en priorité, sinon détecter depuis l'URL
    const currentPath = window.location.pathname;
    const conversationIdFromPath = currentPath.match(/\/conversations\/([^\/]+)/)?.[1];
    const conversationIdFromQuery = searchParams.get('id');
    const currentConversationId = propConversationId || conversationIdFromPath || conversationIdFromQuery;
    
    if (currentConversationId) {
      // Contexte : conversation spécifique -> génération automatique
      createQuickLink(currentConversationId);
    } else {
      // Contexte : liste des conversations -> modale complète
      setIsModalOpen(true);
    }
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={handleClick}
        disabled={isCreating}
        className={className}
      >
        {children || (
          <>
            <Link2 className="h-4 w-4 mr-2" />
            {isCreating ? 'Création...' : 'Créer un lien'}
          </>
        )}
      </Button>

      <CreateLinkModalV2
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onLinkCreated={handleLinkCreated}
        preGeneratedLink={generatedLink || undefined}
        preGeneratedToken={generatedToken || undefined}
      />

      {linkSummaryData && (
        <LinkSummaryModal
          isOpen={isSummaryModalOpen}
          onClose={handleSummaryModalClose}
          linkData={linkSummaryData}
        />
      )}
    </>
  );
}
