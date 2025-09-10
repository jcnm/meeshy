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
import { useUser } from '@/context/AppContext';

interface CreateLinkButtonProps {
  onLinkCreated?: () => void;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary' | 'destructive';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  children?: React.ReactNode;
  forceModal?: boolean; // Force l'ouverture de la modale au lieu de créer un lien directement
}

export function CreateLinkButton({
  onLinkCreated,
  variant = 'default',
  size = 'default',
  className,
  children,
  forceModal = false
}: CreateLinkButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [linkSummaryData, setLinkSummaryData] = useState<any>(null);
  const { user: currentUser } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();

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
    if (!currentUser || !conversationId) {
      toast.error('Impossible de créer le lien : informations manquantes');
      return;
    }

    setIsCreating(true);
    
    try {
      const linkData = {
        conversationId: conversationId,
        title: `Lien de partage - ${new Date().toLocaleDateString('fr-FR')}`,
        description: 'Lien de partage créé automatiquement',
        expirationDays: 1, // 24h
        maxUses: undefined,
        maxConcurrentUsers: undefined,
        maxUniqueSessions: undefined,
        allowAnonymousMessages: true,
        allowAnonymousFiles: true, // Tous types de fichiers
        allowAnonymousImages: true,
        allowViewHistory: true,
        requireNickname: false, // Pas de pseudo requis
        requireEmail: false, // Pas d'email requis
        allowedLanguages: ['fr', 'en', 'es', 'de', 'it', 'pt', 'zh', 'ja', 'ar'] // Toutes les langues supportées
      };

      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      
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
          allowAnonymousMessages: linkData.allowAnonymousMessages,
          allowAnonymousFiles: linkData.allowAnonymousFiles,
          allowAnonymousImages: linkData.allowAnonymousImages,
          allowViewHistory: linkData.allowViewHistory,
          requireNickname: linkData.requireNickname,
          requireEmail: linkData.requireEmail,
          allowedLanguages: linkData.allowedLanguages
        });
        
        // Essayer de copier dans le presse-papiers avec gestion d'erreur
        try {
          await navigator.clipboard.writeText(linkUrl);
          toast.success('Lien créé et copié dans le presse-papier !');
        } catch (clipboardError: any) {
          console.warn('Clipboard access denied or not available:', clipboardError);
          // Fallback: afficher le lien dans un toast avec action de copie manuelle
          toast.success('Lien créé avec succès !', {
            description: linkUrl,
            duration: 10000,
            action: {
              label: 'Copier manuellement',
              onClick: () => {
                // Essayer une méthode alternative de copie
                const textArea = document.createElement('textarea');
                textArea.value = linkUrl;
                document.body.appendChild(textArea);
                textArea.select();
                try {
                  document.execCommand('copy');
                  toast.success('Copié dans le presse-papiers !');
                } catch (fallbackError) {
                  console.error('Fallback copy failed:', fallbackError);
                  toast.error('Échec de la copie');
                }
                document.body.removeChild(textArea);
              }
            }
          });
        }
        
        // Ouvrir le modal synthétique avec le récapitulatif
        setIsSummaryModalOpen(true);
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

    // Détecter le contexte : si on est dans une conversation spécifique
    const currentPath = window.location.pathname;
    const conversationIdFromPath = currentPath.match(/\/conversations\/([^\/]+)/)?.[1];
    const conversationIdFromQuery = searchParams.get('id');
    const currentConversationId = conversationIdFromPath || conversationIdFromQuery;
    
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
