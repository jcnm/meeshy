'use client';

import { useState, useRef, KeyboardEvent, forwardRef, useImperativeHandle, useEffect, useCallback, memo } from 'react';
import { Send, MapPin, X, MessageCircle, Languages, Paperclip, Loader2, Mic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { LanguageFlagSelector } from '@/components/translation';
import { getMaxMessageLength } from '@/lib/constants/languages';
import { type LanguageChoice } from '@/lib/bubble-stream-modules';
import { useI18n } from '@/hooks/useI18n';
import { useReplyStore, type ReplyingToMessage } from '@/stores/reply-store';
import { AttachmentCarousel } from '@/components/attachments/AttachmentCarousel';
import { useTextAttachmentDetection } from '@/hooks/useTextAttachmentDetection';
import { AttachmentService } from '@/services/attachmentService';
import { UploadedAttachmentResponse } from '@/shared/types/attachment';
import { toast } from 'sonner';
import { SimpleAudioRecorder } from '@/components/audio/SimpleAudioRecorder';

interface MessageComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  selectedLanguage: string;
  onLanguageChange: (language: string) => void;
  location?: string;
  isComposingEnabled?: boolean;
  placeholder?: string;
  onKeyPress?: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  className?: string;
  choices?: LanguageChoice[]; // Choix de langues disponibles pour l'utilisateur
  // Nouveaux props pour les attachments
  onAttachmentsChange?: (attachmentIds: string[]) => void;
  token?: string;
  userRole?: string; // Rôle de l'utilisateur pour déterminer la limite de caractères
}

export interface MessageComposerRef {
  focus: () => void;
  blur: () => void;
  clearAttachments?: () => void;
}

/**
 * Composant modulaire pour la saisie et l'envoi de messages
 * Inclut le textarea, sélecteur de langue, localisation et bouton d'envoi
 */
export const MessageComposer = forwardRef<MessageComposerRef, MessageComposerProps>(({
  value,
  onChange,
  onSend,
  selectedLanguage,
  onLanguageChange,
  location,
  isComposingEnabled = true,
  placeholder,
  onKeyPress,
  className = "",
  choices,
  onAttachmentsChange,
  token,
  userRole
}, ref) => {

  // ...hooks d'état et variables...
  const { t } = useI18n('conversations');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Déterminer la limite de caractères en fonction du rôle
  const maxMessageLength = getMaxMessageLength(userRole);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { replyingTo, clearReply } = useReplyStore();
  const [isMobile, setIsMobile] = useState(false);
  
  // États pour les attachments
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadedAttachments, setUploadedAttachments] = useState<UploadedAttachmentResponse[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ [key: number]: number }>({});

  // États pour l'enregistrement audio
  const [showAudioRecorder, setShowAudioRecorder] = useState(false);
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  
  // Utiliser le placeholder fourni ou la traduction par défaut
  const finalPlaceholder = placeholder || t('conversationSearch.shareMessage');

  
  // Détection mobile
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Gestion du collage de texte trop long : créer un .txt UTF-8 et ne pas remplir le textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const handlePaste = async (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData('text');
      if (text && text.length > maxMessageLength) {
        e.preventDefault();
        // Créer un fichier texte UTF-8
        const encoder = new TextEncoder();
        const utf8Text = encoder.encode(text);
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        const fileName = `presspaper-content-${year}${month}${day}-${hours}${minutes}${seconds}.txt`;
        const textFile = new File([utf8Text], fileName, { type: 'text/plain;charset=utf-8' });
        setSelectedFiles(prev => [...prev, textFile]);
        toast.info(t('conversations.pasteTooLongTxtCreated'));
      }
    };
    textarea.addEventListener('paste', handlePaste as any);
    return () => textarea.removeEventListener('paste', handlePaste as any);
  }, [maxMessageLength, t]);

  // Fonction pour formater la date en fonction du jour
  const formatReplyDate = (date: Date | string) => {
    const messageDate = new Date(date);
    const now = new Date();

    // Réinitialiser l'heure pour comparer uniquement les dates
    const messageDateOnly = new Date(messageDate.getFullYear(), messageDate.getMonth(), messageDate.getDate());
    const nowDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const isSameDay = messageDateOnly.getTime() === nowDateOnly.getTime();
    const isSameYear = messageDate.getFullYear() === now.getFullYear();
    
    if (isSameDay) {
      // Même jour : afficher seulement l'heure
      return messageDate.toLocaleString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit'
      });
    } else if (isSameYear) {
      // Même année mais jour différent : afficher jour + mois + heure
      return messageDate.toLocaleString('fr-FR', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });
    } else {
      // Année différente : afficher date complète + heure
      return messageDate.toLocaleString('fr-FR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  };

  // Handler pour créer un attachment texte avec nom formaté - mémorisé (déclaré en premier car utilisé par le hook)
  const handleCreateTextAttachment = useCallback(async (text: string) => {
    if (!text) return;

    setIsUploading(true);
    try {
      // Générer le nom de fichier avec la date actuelle
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      
      const fileName = `presspaper-content-${year}${month}${day}-${hours}${minutes}${seconds}.txt`;
      
      // Créer un fichier virtuel pour l'affichage dans le carrousel
      const textFile = new File([text], fileName, {
        type: 'text/plain',
      });
      
      // Ajouter immédiatement au carrousel pour feedback visuel
      setSelectedFiles(prev => [...prev, textFile]);
      
      // Upload le texte
      const response = await AttachmentService.uploadText(text, token);
      if (response.success && response.attachment) {
        setUploadedAttachments(prev => [...prev, response.attachment]);
        console.log('✅ Texte collé créé comme attachment:', fileName);
      }
    } catch (error) {
      console.error('❌ Erreur création text attachment:', error);
      // Retirer le fichier du carrousel en cas d'erreur
      setSelectedFiles(prev => prev.slice(0, -1));
    } finally {
      setIsUploading(false);
    }
  }, [token]);

  // Hook pour la détection de texte collé - création automatique
  // Utilise maxMessageLength comme threshold (1500 pour USER, 2000 pour MODERATOR+)
  useTextAttachmentDetection(textareaRef as React.RefObject<HTMLTextAreaElement>, {
    enabled: true,
    threshold: maxMessageLength,
    onTextDetected: async (text) => {
      // Créer automatiquement l'attachement sans demander
      await handleCreateTextAttachment(text);
    },
  });

  // Notifier le parent quand les attachments changent
  useEffect(() => {
    if (onAttachmentsChange) {
      const attachmentIds = uploadedAttachments.map(att => att.id);
      console.log('📎 Notification parent - IDs d\'attachments:', attachmentIds);
      onAttachmentsChange(attachmentIds);
    }
  }, [uploadedAttachments, onAttachmentsChange]);

  // Handler pour la sélection de fichiers - mémorisé
  const handleFilesSelected = useCallback(async (files: File[]) => {
    if (files.length === 0) return;

    // Valider les fichiers
    const validation = AttachmentService.validateFiles(files);
    if (!validation.valid) {
      // Show toast for each validation error
      validation.errors.forEach(error => {
        toast.error(error);
      });
      console.error('Validation errors:', validation.errors);
      return;
    }

    setSelectedFiles(prev => [...prev, ...files]);
    setIsUploading(true);

    console.log('📎 Début upload de', files.length, 'fichier(s)');

    try {
      // Upload les fichiers
      const response = await AttachmentService.uploadFiles(files, token);
      
      console.log('📎 Réponse upload:', response);
      
      if (response.success && response.attachments) {
        console.log('✅ Upload réussi:', response.attachments.length, 'attachment(s)');
        setUploadedAttachments(prev => {
          const newAttachments = [...prev, ...response.attachments];
          console.log('📎 Total attachments après ajout:', newAttachments.length);
          return newAttachments;
        });
      } else {
        console.warn('⚠️ Upload sans succès ou sans attachments:', response);
      }
    } catch (error) {
      console.error('❌ Upload error:', error);
      if (error instanceof Error) {
        console.error('❌ Error message:', error.message);
        toast.error(`Upload failed: ${error.message}`);
      } else {
        toast.error('Upload failed. Please try again.');
      }
    } finally {
      setIsUploading(false);
    }
  }, [token]);

  // Handlers pour le drag & drop - mémorisés pour éviter les re-créations
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    await handleFilesSelected(files);
  }, [handleFilesSelected]);

  // Handler pour le clic sur l'icône d'attachement - mémorisé
  const handleAttachmentClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // Handler pour le changement de l'input file - mémorisé
  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    handleFilesSelected(files);
    // Reset l'input pour permettre de sélectionner le même fichier à nouveau
    e.target.value = '';
  }, [handleFilesSelected]);

  // Handler pour retirer un fichier - mémorisé
  const handleRemoveFile = useCallback(async (index: number) => {
    // Récupérer l'attachment uploadé correspondant à cet index
    const attachmentToDelete = uploadedAttachments[index];

    // Si l'attachment a un ID (déjà uploadé), le supprimer du backend
    if (attachmentToDelete?.id) {
      try {
        console.log('[MessageComposer] Suppression attachment:', attachmentToDelete.id);
        await AttachmentService.deleteAttachment(attachmentToDelete.id, token);
        console.log('[MessageComposer] ✅ Attachment supprimé du backend');
      } catch (error) {
        console.error('[MessageComposer] ❌ Erreur suppression attachment:', error);
        toast.error('Impossible de supprimer le fichier');
        return; // Ne pas supprimer du state local si la suppression backend a échoué
      }
    }

    // Supprimer du state local uniquement si la suppression backend a réussi
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setUploadedAttachments(prev => prev.filter((_, i) => i !== index));
  }, [uploadedAttachments, token]);

  // Clear attachments après envoi - mémorisé
  const clearAttachments = useCallback(() => {
    setSelectedFiles([]);
    setUploadedAttachments([]);
    setUploadProgress({});
  }, []);

  // Handler pour l'enregistrement audio terminé - mémorisé
  const handleAudioRecordingComplete = useCallback(async (audioBlob: Blob, duration: number) => {
    try {
      setIsUploadingAudio(true);

      // Créer un FormData pour l'upload
      const formData = new FormData();
      const filename = `audio_${Date.now()}.webm`;
      formData.append('file', audioBlob, filename);

      // Upload du fichier audio
      const response = await AttachmentService.uploadFiles([audioBlob as File], token);

      if (response.success && response.attachments && response.attachments.length > 0) {
        const uploadedAttachment = response.attachments[0];

        // Ajouter à la liste des attachments
        setUploadedAttachments(prev => [...prev, uploadedAttachment]);

        // Créer un File pour l'affichage dans le carrousel
        const audioFile = new File([audioBlob], filename, { type: audioBlob.type });
        setSelectedFiles(prev => [...prev, audioFile]);

        // Fermer le recorder
        setShowAudioRecorder(false);

        console.log('✅ Audio message uploaded:', uploadedAttachment);
        toast.success('Message audio enregistré');
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      console.error('Failed to send audio message:', error);
      toast.error('Erreur lors de l\'envoi du message audio');
    } finally {
      setIsUploadingAudio(false);
    }
  }, [token]);

  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
    blur: () => textareaRef.current?.blur(),
    clearAttachments, // Exposer la fonction pour clear les attachments
  } as any));

  // Initialiser la hauteur du textarea au montage
  useEffect(() => {
    if (textareaRef.current && textareaRef.current.style) {
      try {
        textareaRef.current.style.height = '80px'; // Hauteur minimale
      } catch (error) {
        console.warn('Erreur lors de l\'initialisation du textarea:', error);
      }
    }
  }, []);

  const handleKeyPress = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (onKeyPress) {
      onKeyPress(e);
    }
  }, [onKeyPress]);

  // Handle blur for mobile to ensure zoom out - mémorisé
  const handleBlur = useCallback(() => {
    if (isMobile && textareaRef.current) {
      // Force blur and zoom out on mobile devices
      textareaRef.current.blur();
      // Slight delay to ensure keyboard is fully dismissed before zoom reset
      setTimeout(() => {
        window.scrollTo(0, window.scrollY);
      }, 100);
    }
  }, [isMobile]);

  // Auto-resize du textarea comme dans BubbleStreamPage - mémorisé
  const handleTextareaChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    
    // Auto-resize textarea avec gestion améliorée des retours à la ligne
    if (textareaRef.current && textareaRef.current.style) {
      try {
        // Réinitialiser la hauteur pour obtenir la hauteur naturelle du contenu
        textareaRef.current.style.height = 'auto';
        
        // Calculer la hauteur nécessaire avec une hauteur minimale
        const minHeight = 80; // Correspond à min-h-[80px]
        const maxHeight = 160; // Correspond à max-h-40 (40 * 4px = 160px)
        const scrollHeight = textareaRef.current.scrollHeight;
        
        // Utiliser la hauteur calculée en respectant les limites
        const newHeight = Math.max(minHeight, Math.min(scrollHeight, maxHeight));
        textareaRef.current.style.height = `${newHeight}px`;
        
        // Si le contenu dépasse la hauteur maximale, permettre le scroll
        if (scrollHeight > maxHeight) {
          textareaRef.current.style.overflowY = 'auto';
        } else {
          textareaRef.current.style.overflowY = 'hidden';
        }
      } catch (error) {
        console.warn('Erreur lors du redimensionnement du textarea:', error);
      }
    }
  }, [onChange]);


  return (
    <div 
      className={`relative ${className} ${isDragOver ? 'ring-2 ring-blue-500 bg-blue-50/20' : ''}`}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Affichage du message auquel on répond */}
      {replyingTo && (
        <div className="p-3 bg-gradient-to-r from-blue-50/90 to-indigo-50/90 dark:from-blue-900/30 dark:to-indigo-900/30 border-l-4 border-blue-400 dark:border-blue-500 rounded-t-lg backdrop-blur-sm">
          <div className="flex items-start justify-between space-x-2">
            <div className="flex items-start space-x-2 flex-1 min-w-0">
              <MessageCircle className="h-4 w-4 text-blue-500 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 mb-1">
                  <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                    {t('replyingTo')} {replyingTo.sender?.displayName || replyingTo.sender?.username || t('unknownUser')}
                  </span>
                  <span className="text-xs text-blue-600/60 dark:text-blue-400/60">
                    {formatReplyDate(replyingTo.createdAt)}
                  </span>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2 italic">
                  {replyingTo.content}
                </p>
                {replyingTo.translations && replyingTo.translations.length > 0 && (
                  <div className="mt-1 flex items-center space-x-1">
                    <Languages className="h-3 w-3 text-blue-500/60 dark:text-blue-400/60" />
                    <span className="text-xs text-blue-600/60 dark:text-blue-400/60">
                      {replyingTo.translations.length} {t('translations')}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearReply}
              className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 p-1 h-6 w-6"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Carrousel d'attachments - positionné juste après la citation */}
      {selectedFiles.length > 0 && (
        <AttachmentCarousel
          files={selectedFiles}
          onRemove={handleRemoveFile}
          uploadProgress={uploadProgress}
          disabled={isUploading}
        />
      )}

      {/* Recorder audio - affiché quand activé */}
      {showAudioRecorder && (
        <div className="p-2 border-t border-gray-200 dark:border-gray-700">
          <SimpleAudioRecorder
            onRecordingComplete={handleAudioRecordingComplete}
            onCancel={() => setShowAudioRecorder(false)}
            maxDuration={600}
          />
        </div>
      )}
      
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handleTextareaChange}
        onKeyPress={handleKeyPress}
        onBlur={handleBlur}
        placeholder={finalPlaceholder}
        className={`expandable-textarea min-h-[60px] sm:min-h-[80px] max-h-40 resize-none pr-20 sm:pr-28 pb-6 sm:pb-10 pt-3 pl-3 border-blue-200/60 bg-white/90 backdrop-blur-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-400/30 focus:bg-white/95 placeholder:text-gray-600 scroll-hidden transition-all duration-200 ${
          replyingTo || selectedFiles.length > 0 
            ? 'rounded-b-2xl rounded-t-none border-t-0' 
            : 'rounded-2xl'
        } ${isMobile ? 'text-base' : 'text-sm sm:text-base'}`}
        maxLength={maxMessageLength}
        disabled={!isComposingEnabled}
        style={{
          borderRadius: replyingTo || selectedFiles.length > 0 ? '0 0 16px 16px' : '16px',
          boxShadow: '0 4px 20px rgba(59, 130, 246, 0.15)',
          fontSize: isMobile ? '16px' : undefined
        }}
      />

      
      {/* Indicateurs dans le textarea */}
      <div className="absolute bottom-2 sm:bottom-3 left-3 flex items-center space-x-2 sm:space-x-3 text-xs sm:text-sm text-gray-600 pointer-events-auto">
        {/* Indicateur d'upload */}
        {isUploading && (
          <div className="flex items-center space-x-1 text-blue-600 dark:text-blue-400">
            <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
            <span className="hidden sm:inline">
              {selectedFiles.length > 1 
                ? t('uploadingMultiple', { count: selectedFiles.length })
                : t('uploading')
              }
            </span>
          </div>
        )}
        
        {/* Localisation */}
        {location && !isUploading && (
          <div className="flex items-center space-x-1">
            <MapPin className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">{location}</span>
          </div>
        )}
      </div>

      {/* Bouton d'envoi, compteur et sélecteur de langue */}
      <div className="absolute bottom-2 sm:bottom-3 right-3 sm:right-4 flex items-center space-x-1 sm:space-x-2 pointer-events-auto">
        {/* Compteur de caractères : affiché uniquement si > 90% du max */}
        {value.length > maxMessageLength * 0.9 && (
          <span className={`hidden sm:inline text-xs ${value.length > maxMessageLength ? 'text-red-500' : 'text-orange-500'}`}>
            {value.length}/{maxMessageLength}
          </span>
        )}
        
        {/* Icône d'attachement */}
        <Button
          onClick={handleAttachmentClick}
          disabled={!isComposingEnabled || isUploading}
          size="sm"
          variant="ghost"
          className="h-7 w-7 sm:h-8 sm:w-8 p-0 rounded-full hover:bg-gray-100 relative"
        >
          {isUploading ? (
            <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600 animate-spin" />
          ) : (
            <Paperclip className="h-3 w-3 sm:h-4 sm:w-4 text-gray-600" />
          )}
          {selectedFiles.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
              {selectedFiles.length}
            </span>
          )}
        </Button>

        {/* Bouton Microphone (Audio) */}
        <Button
          onClick={() => setShowAudioRecorder(!showAudioRecorder)}
          disabled={!isComposingEnabled || isUploadingAudio}
          size="sm"
          variant="ghost"
          className="h-7 w-7 sm:h-8 sm:w-8 p-0 rounded-full hover:bg-gray-100 relative"
          title="Enregistrer un message vocal"
        >
          {isUploadingAudio ? (
            <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600 animate-spin" />
          ) : (
            <Mic className={`h-3 w-3 sm:h-4 sm:w-4 ${showAudioRecorder ? 'text-blue-600' : 'text-gray-600'}`} />
          )}
        </Button>
        
        {/* Sélecteur de langue d'envoi et bouton d'envoi côte à côte */}
        <div className="flex flex-row items-center space-x-1">
          <LanguageFlagSelector
            value={selectedLanguage}
            onValueChange={onLanguageChange}
            choices={choices}
            className="mr-1"
            popoverSide="top"
            popoverAlign="center"
            popoverSideOffset={8}
          />
          <Button
            onClick={onSend}
            disabled={(!value.trim() && selectedFiles.length === 0) || value.length > maxMessageLength || !isComposingEnabled || isUploading}
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white h-7 w-7 sm:h-8 sm:w-8 p-0 rounded-full shadow-lg hover:shadow-xl transition-all duration-200"
          >
            <Send className="h-3 w-3 sm:h-4 sm:w-4" />
          </Button>
        </div>
      </div>

      {/* Input file caché */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileInputChange}
        accept="image/*,video/*,audio/*,application/pdf,text/plain,.doc,.docx,.ppt,.pptx,.md,.sh,.js,.ts,.py,.zip"
      />
    </div>
  );
});

MessageComposer.displayName = 'MessageComposer';
