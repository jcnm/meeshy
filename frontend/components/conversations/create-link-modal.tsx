'use client';

import { useState, useEffect, useCallback, useMemo, Fragment } from 'react';
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
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { buildApiUrl, API_ENDPOINTS } from '@/lib/config';
import { copyToClipboard } from '@/lib/clipboard';
import { toast } from 'sonner';
import {
  Link2,
  Copy,
  Calendar,
  Clock,
  Shield,
  Globe,
  Users,
  MessageSquare,
  Settings,
  Eye,
  FileText,
  Image,
  ChevronRight,
  ChevronLeft,
  Search,
  Plus,
  MessageSquarePlus,
  UserPlus,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Check,
  RefreshCw,
  Info,
  ChevronDown,
  X
} from 'lucide-react';
import { conversationsService } from '@/services/conversations.service';
import { apiService } from '@/services/api.service';
import { Conversation } from '@shared/types';
import { User } from '@shared/types';
import { useI18n } from '@/hooks/useI18n';
import { useUser } from '@/stores';
import { generateLinkName } from '@/utils/link-name-generator';
import { authManager } from '@/services/auth-manager.service';

// Langues supportées
const SUPPORTED_LANGUAGES = [
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'pt', name: 'Português', flag: '🇵🇹' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' }
];


// Options prédéfinies pour les durées - seront traduites dans le composant
const DURATION_OPTIONS = [
  { value: 1, labelKey: 'createLinkModal.durationOptions.1.label', descriptionKey: 'createLinkModal.durationOptions.1.description' },
  { value: 3, labelKey: 'createLinkModal.durationOptions.3.label', descriptionKey: 'createLinkModal.durationOptions.3.description' },
  { value: 7, labelKey: 'createLinkModal.durationOptions.7.label', descriptionKey: 'createLinkModal.durationOptions.7.description' },
  { value: 14, labelKey: 'createLinkModal.durationOptions.14.label', descriptionKey: 'createLinkModal.durationOptions.14.description' },
  { value: 30, labelKey: 'createLinkModal.durationOptions.30.label', descriptionKey: 'createLinkModal.durationOptions.30.description' },
  { value: 60, labelKey: 'createLinkModal.durationOptions.60.label', descriptionKey: 'createLinkModal.durationOptions.60.description' },
  { value: 90, labelKey: 'createLinkModal.durationOptions.90.label', descriptionKey: 'createLinkModal.durationOptions.90.description' },
  { value: 180, labelKey: 'createLinkModal.durationOptions.180.label', descriptionKey: 'createLinkModal.durationOptions.180.description' },
  { value: 365, labelKey: 'createLinkModal.durationOptions.365.label', descriptionKey: 'createLinkModal.durationOptions.365.description' },
  { value: 730, labelKey: 'createLinkModal.durationOptions.730.label', descriptionKey: 'createLinkModal.durationOptions.730.description' }
];

// Options prédéfinies pour les limitations - seront traduites dans le composant
const LIMIT_OPTIONS = [
  { value: undefined, labelKey: 'createLinkModal.limitOptions.unlimited.label', descriptionKey: 'createLinkModal.limitOptions.unlimited.description' },
  { value: 5, labelKey: 'createLinkModal.limitOptions.5.label', descriptionKey: 'createLinkModal.limitOptions.5.description' },
  { value: 10, labelKey: 'createLinkModal.limitOptions.10.label', descriptionKey: 'createLinkModal.limitOptions.10.description' },
  { value: 25, labelKey: 'createLinkModal.limitOptions.25.label', descriptionKey: 'createLinkModal.limitOptions.25.description' },
  { value: 50, labelKey: 'createLinkModal.limitOptions.50.label', descriptionKey: 'createLinkModal.limitOptions.50.description' },
  { value: 100, labelKey: 'createLinkModal.limitOptions.100.label', descriptionKey: 'createLinkModal.limitOptions.100.description' },
  { value: 250, labelKey: 'createLinkModal.limitOptions.250.label', descriptionKey: 'createLinkModal.limitOptions.250.description' },
  { value: 500, labelKey: 'createLinkModal.limitOptions.500.label', descriptionKey: 'createLinkModal.limitOptions.500.description' },
  { value: 1000, labelKey: 'createLinkModal.limitOptions.1000.label', descriptionKey: 'createLinkModal.limitOptions.1000.description' },
  { value: 5000, labelKey: 'createLinkModal.limitOptions.5000.label', descriptionKey: 'createLinkModal.limitOptions.5000.description' }
];

interface CreateLinkModalV2Props {
  isOpen: boolean;
  onClose: () => void;
  onLinkCreated: () => void;
  preGeneratedLink?: string; // Lien déjà généré à afficher directement
  preGeneratedToken?: string; // Token déjà généré à afficher directement
}

// Composant pour les carrés sélectionnables
interface SelectableSquareProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

const SelectableSquare = ({ checked, onChange, label, description, icon, disabled = false }: SelectableSquareProps) => (
  <div
    className={`p-4 rounded-lg border-2 transition-all ${
      disabled
        ? 'opacity-50 cursor-not-allowed'
        : 'cursor-pointer hover:shadow-md'
    } ${
      checked
        ? 'border-primary bg-primary/5'
        : 'border-muted-foreground/20 hover:border-muted-foreground/40'
    }`}
    onClick={() => !disabled && onChange(!checked)}
  >
    <div className="flex items-start space-x-3">
      <div className={`w-6 h-6 rounded border-2 flex items-center justify-center flex-shrink-0 ${
        checked
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-muted-foreground/40'
      }`}>
        {checked && <Check className="w-4 h-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center space-x-2 mb-1">
          {icon && <div className="text-muted-foreground">{icon}</div>}
          <Label className={`text-sm font-medium ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>{label}</Label>
        </div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  </div>
);

// Composant pour les icônes d'information
interface InfoIconProps {
  content: string;
}

const InfoIcon = ({ content }: InfoIconProps) => (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
      </TooltipTrigger>
      <TooltipContent>
        <p className="max-w-xs text-sm">{content}</p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

interface NewConversationData {
  title: string;
  description: string;
  memberIds: string[];
}

// Helper function to format conversation type labels
const getConversationTypeLabel = (type: string): string => {
  switch (type) {
    case 'global':
      return 'Global Group';
    case 'group':
      return 'Private Group';
    case 'public':
      return 'Public Group';
    case 'broadcast':
      return 'Broadcast';
    case 'direct':
      return 'Direct';
    default:
      return type;
  }
};

export function CreateLinkModalV2({
  isOpen,
  onClose,
  onLinkCreated,
  preGeneratedLink,
  preGeneratedToken
}: CreateLinkModalV2Props) {
  const { t } = useI18n('modals');
  const { t: tCommon } = useI18n('common');
  const { user: currentUser } = useUser();
  
  // États pour les étapes
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 3;

  // États pour la sélection de conversation
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [conversationSearchQuery, setConversationSearchQuery] = useState('');
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);

  // États pour la création de nouvelle conversation
  const [createNewConversation, setCreateNewConversation] = useState(false);
  const [newConversationData, setNewConversationData] = useState<NewConversationData>({
    title: '',
    description: '',
    memberIds: []
  });
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  // États pour les options du lien
  const [linkTitle, setLinkTitle] = useState('');
  const [linkIdentifier, setLinkIdentifier] = useState('');
  const [description, setDescription] = useState('');
  const [expirationDays, setExpirationDays] = useState(7);
  const [maxUses, setMaxUses] = useState<number | undefined>(undefined);
  const [maxConcurrentUsers, setMaxConcurrentUsers] = useState<number | undefined>(undefined);
  const [maxUniqueSessions, setMaxUniqueSessions] = useState<number | undefined>(undefined);

  // États des permissions
  const [allowAnonymousMessages, setAllowAnonymousMessages] = useState(true);
  const [allowAnonymousFiles, setAllowAnonymousFiles] = useState(false);
  const [allowAnonymousImages, setAllowAnonymousImages] = useState(true);
  const [allowViewHistory, setAllowViewHistory] = useState(true);
  const [requireAccount, setRequireAccount] = useState(false);
  const [requireNickname, setRequireNickname] = useState(true);
  const [requireEmail, setRequireEmail] = useState(false);
  const [requireBirthday, setRequireBirthday] = useState(false);

  // États des restrictions de sécurité
  const [allowedLanguages, setAllowedLanguages] = useState<string[]>([]);

  // États pour la génération
  const [isCreating, setIsCreating] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);

  // États pour les sections dépliables
  const [isPermissionsOpen, setIsPermissionsOpen] = useState(false);
  const [isLanguagesOpen, setIsLanguagesOpen] = useState(false);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);

  // L'identifiant est maintenant simple, pas besoin d'état d'édition

  // Debounce pour la recherche d'utilisateurs
  const [userSearchDebounce, setUserSearchDebounce] = useState<NodeJS.Timeout | null>(null);

  // Link identifier availability check states
  const [isCheckingLinkIdentifier, setIsCheckingLinkIdentifier] = useState(false);
  const [linkIdentifierAvailable, setLinkIdentifierAvailable] = useState<boolean | null>(null);
  const [linkIdentifierCheckMessage, setLinkIdentifierCheckMessage] = useState<string>('');

  // Effet pour initialiser les liens pré-générés
  useEffect(() => {
    if (isOpen && preGeneratedLink && preGeneratedToken) {
      setGeneratedLink(preGeneratedLink);
      setGeneratedToken(preGeneratedToken);
    }
  }, [isOpen, preGeneratedLink, preGeneratedToken]);

  // Fonction pour générer un identifiant basé sur le titre avec suffixe hex aléatoire
  const generateIdentifier = (baseText: string): string => {
    if (!baseText.trim()) return '';

    const baseIdentifier = baseText
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Keep only letters, numbers, spaces and hyphens
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single
      .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
      .substring(0, 30); // Limit base identifier length

    if (!baseIdentifier) return '';

    // Generate 6-10 character random hex suffix for uniqueness
    const hexLength = Math.floor(Math.random() * 5) + 6; // Random between 6 and 10
    const hexBytes = Math.ceil(hexLength / 2);
    const hexSuffix = Array.from(crypto.getRandomValues(new Uint8Array(hexBytes)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .substring(0, hexLength); // Trim to exact length

    return `${baseIdentifier}-${hexSuffix}`;
  };

  // Validation function for link identifier
  const validateLinkIdentifier = (identifier: string): boolean => {
    const regex = /^[a-zA-Z0-9\-_@]+$/;
    return regex.test(identifier);
  };

  // Check link identifier availability
  const checkLinkIdentifierAvailability = useCallback(async (identifier: string) => {
    if (!identifier || !identifier.trim() || !validateLinkIdentifier(identifier)) {
      setLinkIdentifierAvailable(null);
      setLinkIdentifierCheckMessage('');
      return;
    }

    setIsCheckingLinkIdentifier(true);
    setLinkIdentifierCheckMessage('');

    try {
      const response = await apiService.get<{ success: boolean; available: boolean; identifier: string }>(
        `/api/links/check-identifier/${encodeURIComponent(identifier)}`
      );

      if (response.data.success) {
        const available = response.data.available;
        setLinkIdentifierAvailable(available);
        setLinkIdentifierCheckMessage(
          available
            ? '✓ Identifiant disponible'
            : '✗ Identifiant déjà utilisé'
        );
      }
    } catch (error) {
      console.error('Error checking link identifier availability:', error);
      setLinkIdentifierAvailable(null);
      setLinkIdentifierCheckMessage('Erreur lors de la vérification');
    } finally {
      setIsCheckingLinkIdentifier(false);
    }
  }, []);

  // Charger les conversations disponibles
  const loadConversations = useCallback(async () => {
    setIsLoadingConversations(true);
    try {
      const conversationsData = await conversationsService.getConversations();
      // Filtrer les conversations directes et globales (pas de liens possibles)
      const linkableConversations = (conversationsData.conversations || []).filter(conv => 
        conv.type !== 'direct' && conv.type !== 'global'
      );
      setConversations(linkableConversations);
    } catch (error) {
      console.error('Erreur lors du chargement des conversations:', error);
      toast.error(t('createLinkModal.errors.searchError'));
    } finally {
      setIsLoadingConversations(false);
    }
  }, []);

  // Charger les utilisateurs disponibles (réutilise la logique du modal de création de conversation)
  const loadUsers = useCallback(async (searchQuery: string = '') => {
    if (!searchQuery.trim()) {
      setAvailableUsers([]);
      return;
    }

    setIsLoadingUsers(true);
    try {
      const token = authManager.getAuthToken();
      const response = await fetch(buildApiUrl(`${API_ENDPOINTS.USER.SEARCH}?q=${encodeURIComponent(searchQuery)}`), {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        const users = await response.json();
        setAvailableUsers(users);
      } else {
        console.error('Erreur lors de la recherche d\'utilisateurs');
      }
    } catch (error) {
      console.error('Erreur lors de la recherche d\'utilisateurs:', error);
    } finally {
      setIsLoadingUsers(false);
    }
  }, []);

  // Conversations filtrées
  const filteredConversations = useMemo(() => {
    if (!conversationSearchQuery.trim()) return conversations;
    return conversations.filter(conv =>
      (conv.title && conv.title.toLowerCase().includes(conversationSearchQuery.toLowerCase())) ||
      (conv.description && conv.description.toLowerCase().includes(conversationSearchQuery.toLowerCase()))
    );
  }, [conversations, conversationSearchQuery]);

  // Utilisateurs filtrés (exclure l'utilisateur connecté)
  const filteredUsers = useMemo(() => {
    if (!currentUser) return availableUsers;
    return availableUsers.filter(user => user.id !== currentUser.id);
  }, [availableUsers, currentUser]);

  // Charger les données au montage
  useEffect(() => {
    if (isOpen) {
      loadConversations();
      // Ne pas charger les utilisateurs au montage, seulement lors de la recherche
    }
  }, [isOpen, loadConversations]);

  // Debounce pour la recherche d'utilisateurs
  useEffect(() => {
    if (userSearchDebounce) {
      clearTimeout(userSearchDebounce);
    }

    const timeout = setTimeout(() => {
      loadUsers(userSearchQuery);
    }, 300); // 300ms de délai

    setUserSearchDebounce(timeout);

    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [userSearchQuery, loadUsers]);

  // Check link identifier availability with debounce
  useEffect(() => {
    if (!linkIdentifier || !linkIdentifier.trim()) {
      setLinkIdentifierAvailable(null);
      setLinkIdentifierCheckMessage('');
      return;
    }

    // Debounce the check to avoid too many API calls
    const timer = setTimeout(() => {
      checkLinkIdentifierAvailability(linkIdentifier);
    }, 500);

    return () => clearTimeout(timer);
  }, [linkIdentifier, checkLinkIdentifierAvailability]);

  // Générer le lien
  const generateLink = async () => {
    // Le titre est généré automatiquement, pas besoin de vérifier linkTitle

    if (!selectedConversationId && !createNewConversation) {
      toast.error(t('createLinkModal.errors.selectConversation'));
      return;
    }

    if (createNewConversation && !newConversationData.title.trim()) {
      toast.error(t('createLinkModal.errors.enterTitle'));
      return;
    }

    setIsCreating(true);
    try {
      const token = authManager.getAuthToken();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expirationDays);

      // Générer le nom du lien automatiquement selon la langue
      const conversationTitle = createNewConversation 
        ? newConversationData.title 
        : conversations.find(c => c.id === selectedConversationId)?.title;
      
      const generatedLinkName = conversationTitle 
        ? generateLinkName({
            conversationTitle,
            language: currentUser?.systemLanguage || 'fr',
            durationDays: expirationDays,
            maxParticipants: maxConcurrentUsers,
            maxUses: maxUses,
            isPublic: !maxConcurrentUsers && !maxUses
          })
        : 'Lien de partage';

      const requestBody: any = {
        name: generatedLinkName,
        description: description.trim() || undefined,
        expiresAt: expiresAt.toISOString(),
        maxUses: maxUses || undefined,
        maxConcurrentUsers: maxConcurrentUsers || undefined,
        maxUniqueSessions: maxUniqueSessions || undefined,
        allowAnonymousMessages,
        allowAnonymousFiles,
        allowAnonymousImages,
        allowViewHistory,
        requireAccount,
        requireNickname,
        requireEmail,
        requireBirthday,
        allowedLanguages: allowedLanguages.length > 0 ? allowedLanguages : undefined
      };

      // Si on crée une nouvelle conversation, inclure les données
      if (createNewConversation) {
        requestBody.newConversation = {
          title: newConversationData.title.trim(),
          description: newConversationData.description.trim() || undefined,
          memberIds: newConversationData.memberIds
        };
      } else {
        // Sinon, utiliser la conversation sélectionnée
        requestBody.conversationId = selectedConversationId;
      }

      const response = await fetch(buildApiUrl(API_ENDPOINTS.CONVERSATION.CREATE_LINK), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        const data = await response.json();
        
        const linkToken = data.data?.linkId || data.linkId;
        if (!linkToken) {
          throw new Error('Token de lien manquant dans la réponse');
        }
        
        const linkUrl = `${window.location.origin}/join/${linkToken}`;
        setGeneratedLink(linkUrl);
        setGeneratedToken(linkToken);
        
        // Copier automatiquement dans le presse-papiers
        const copyResult = await copyToClipboard(linkUrl);
        if (copyResult.success) {
          toast.success(t('createLinkModal.successMessages.linkGeneratedAndCopied'));
        } else {
          toast.success(t('createLinkModal.successMessages.linkGenerated'));
        }
        
        // Ne pas appeler onLinkCreated() ici pour garder la modale ouverte
        // onLinkCreated();
      } else {
        const error = await response.json();
        console.error('[CREATE_LINK_V2] Erreur API:', error);
        toast.error(error.message || `Erreur lors de la génération du lien (${response.status})`);
      }
    } catch (error) {
      console.error('[CREATE_LINK_V2] Erreur génération lien:', error);
      toast.error(error instanceof Error ? error.message : 'Erreur lors de la génération du lien');
    } finally {
      setIsCreating(false);
    }
  };

  const copyLink = async () => {
    if (generatedLink) {
      const copyResult = await copyToClipboard(generatedLink, 'input[readonly]');
      if (copyResult.success) {
        toast.success(t('createLinkModal.successMessages.linkCopied'));
      } else {
        toast.info(copyResult.message);
      }
    }
  };

  const copyToken = async () => {
    if (generatedToken) {
      const copyResult = await copyToClipboard(generatedToken);
      if (copyResult.success) {
        toast.success(t('createLinkModal.successMessages.tokenCopied'));
      } else {
        toast.info(copyResult.message);
      }
    }
  };

  const handleClose = () => {
    // Nettoyer le timeout de recherche
    if (userSearchDebounce) {
      clearTimeout(userSearchDebounce);
      setUserSearchDebounce(null);
    }
    // Reset all form states
    setCurrentStep(1);
    setSelectedConversationId(null);
    setCreateNewConversation(false);
    setNewConversationData({ title: '', description: '', memberIds: [] });
    setLinkTitle('');
    setLinkIdentifier('');
    setDescription('');
    setExpirationDays(7);
    setMaxUses(undefined);
    setMaxConcurrentUsers(undefined);
    setMaxUniqueSessions(undefined);
    setAllowAnonymousMessages(true);
    setAllowAnonymousFiles(false);
    setAllowAnonymousImages(true);
    setAllowViewHistory(true);
    setRequireNickname(true);
    setRequireEmail(false);
    setAllowedLanguages([]);
    setGeneratedLink(null);
    setGeneratedToken(null);
    setConversationSearchQuery('');
    setUserSearchQuery('');
    
    // Appeler onLinkCreated() seulement si un lien a été généré
    if (generatedLink) {
      onLinkCreated();
    }
    
    onClose();
  };

  const nextStep = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const canProceedToNext = () => {
    switch (currentStep) {
      case 1:
        return selectedConversationId || createNewConversation;
      case 2:
        if (createNewConversation) {
          return newConversationData.title.trim() !== '';
        }
        return true; // L'étape 2 inclut maintenant la configuration et les options (anciennement étapes 2 et 3)
      case 3:
        return true; // Étape de résumé - le nom est généré automatiquement
      default:
        return false;
    }
  };

  const canCreateLink = () => {
    // Vérifier qu'une conversation est sélectionnée ou qu'on crée une nouvelle
    const hasConversation = selectedConversationId || createNewConversation;
    if (!hasConversation) return false;

    // Si on crée une nouvelle conversation, vérifier le titre
    if (createNewConversation && !newConversationData.title.trim()) return false;

    // Si on utilise une conversation existante, vérifier qu'elle a un titre
    if (!createNewConversation) {
      const selectedConv = conversations.find(c => c.id === selectedConversationId);
      if (!selectedConv?.title) return false;
    }

    // Vérifier la disponibilité de l'identifiant du lien
    if (linkIdentifier && linkIdentifier.trim()) {
      // Si l'identifiant est invalide ou en cours de vérification, empêcher la création
      if (!validateLinkIdentifier(linkIdentifier)) return false;
      if (isCheckingLinkIdentifier) return false;
      if (linkIdentifierAvailable === false) return false;
    }

    return true;
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case 1:
        return t('createLinkModal.steps.selectConversation');
      case 2:
        return createNewConversation ? t('createLinkModal.createNewConversation.title') : t('createLinkModal.steps.configureLink');
      case 3:
        return t('createLinkModal.steps.summaryAndGeneration');
      default:
        return '';
    }
  };

  const getStepDescription = () => {
    switch (currentStep) {
      case 1:
        return t('createLinkModal.stepDescriptions.selectConversation');
      case 2:
        return createNewConversation ? t('createLinkModal.stepDescriptions.configureNewConversation') : t('createLinkModal.stepDescriptions.configureLink');
      case 3:
        return t('createLinkModal.stepDescriptions.summaryAndGeneration');
      default:
        return '';
    }
  };

  // Étape 1: Sélection de conversation
  const renderStep1 = () => (
    <div className="space-y-6">
      {/* Option: Créer une nouvelle conversation */}
      <Card 
        className={`border-2 border-dashed transition-all cursor-pointer ${
          createNewConversation 
            ? 'border-primary bg-primary/5' 
            : 'border-primary/20 hover:border-primary/40 hover:bg-primary/5'
        }`}
        onClick={() => {
          setCreateNewConversation(true);
          setSelectedConversationId(null);
          // Passer automatiquement à l'étape suivante
          if (currentStep < totalSteps) {
            setCurrentStep(currentStep + 1);
          }
        }}
      >
        <CardContent className="p-6">
          <div className="flex items-center space-x-4">
            <div className={`h-12 w-12 rounded-full flex items-center justify-center ${
              createNewConversation ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary'
            }`}>
              <Plus className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold">{t('createLinkModal.createNewConversation.title')}</h3>
              <p className="text-sm text-muted-foreground">
                {t('createLinkModal.createNewConversation.description')}
              </p>
            </div>
            <div className="flex items-center space-x-2">
              {createNewConversation && (
                <CheckCircle className="h-5 w-5 text-primary" />
              )}
              <ArrowRight className={`h-4 w-4 ${createNewConversation ? 'text-primary' : 'text-muted-foreground'}`} />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">{t('createLinkModal.createNewConversation.orSelectExisting')}</span>
        </div>
      </div>

      {/* Recherche de conversations */}
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('createLinkModal.search.conversations')}
            value={conversationSearchQuery}
            onChange={(e) => setConversationSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Liste des conversations */}
        <div className="space-y-3 max-h-64 overflow-y-auto p-1">
          {isLoadingConversations ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{t('createLinkModal.search.noConversationsFound')}</p>
            </div>
          ) : (
            filteredConversations.map((conversation) => (
              <Card
                key={conversation.id}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  selectedConversationId === conversation.id
                    ? 'ring-1 ring-primary border-primary'
                    : 'hover:border-primary/50'
                }`}
                onClick={() => {
                  setSelectedConversationId(conversation.id);
                  setCreateNewConversation(false);
                }}
              >
                <CardContent className="p-2.5">
                  <div className="flex items-center space-x-2.5">
                    <div className="h-7 w-7 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                      <MessageSquare className="h-3.5 w-3.5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium truncate text-sm">{conversation.title}</h4>
                      {conversation.description && (
                        <p className="text-xs text-muted-foreground truncate">
                          {conversation.description}
                        </p>
                      )}
                      <div className="flex items-center space-x-2 mt-0.5">
                        <Badge variant="secondary" className="text-xs px-1 py-0">
                          {getConversationTypeLabel(conversation.type)}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(conversation.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    {selectedConversationId === conversation.id && (
                      <CheckCircle className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );

  // Étape 2: Configuration de la conversation et du lien
  const renderStep2 = () => {
    return (
      <div className="space-y-8">
        {/* SECTION 1: CONVERSATION */}
        <Card className="border-2">
          <CardHeader className="bg-muted/30">
            <CardTitle className="text-lg flex items-center">
              <MessageSquare className="h-5 w-5 mr-2" />
              {createNewConversation ? t('createLinkModal.createNewConversation.title') : t('summary.conversation')}
            </CardTitle>
            <CardDescription>
              {createNewConversation 
                ? t('createLinkModal.conversationForm.titleInfo')
                : t('createLinkModal.stepDescriptions.configureLink')
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            {/* Si on crée une nouvelle conversation */}
            {createNewConversation && (
              <>
                {/* Titre de la conversation */}
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Label htmlFor="conversationTitle" className="text-sm font-medium">
                      {t('createLinkModal.conversationForm.title')}
                    </Label>
                    <InfoIcon content={t('createLinkModal.conversationForm.titleInfo')} />
                  </div>
                  <Input
                    id="conversationTitle"
                    value={newConversationData.title}
                    onChange={(e) => setNewConversationData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder={t('createLinkModal.conversationForm.titlePlaceholder')}
                    className="text-lg"
                  />
                </div>

                {/* Description de la conversation */}
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Label htmlFor="conversationDescription" className="text-sm font-medium">
                      {t('createLinkModal.conversationForm.description')}
                    </Label>
                    <InfoIcon content={t('createLinkModal.conversationForm.descriptionInfo')} />
                  </div>
                  <Textarea
                    id="conversationDescription"
                    value={newConversationData.description}
                    onChange={(e) => setNewConversationData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder={t('createLinkModal.conversationForm.descriptionPlaceholder')}
                    className="min-h-[80px]"
                  />
                </div>

                {/* Ajout de membres */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">{t('createLinkModal.conversationForm.baseMembers')}</Label>
                    <Badge variant="secondary">
                      {t('createLinkModal.conversationForm.memberCount', { count: newConversationData.memberIds.length })}
                    </Badge>
                  </div>

                  {/* Recherche d'utilisateurs */}
                  <div className="relative">
                    {isLoadingUsers ? (
                      <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                      </div>
                    ) : (
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    )}
                    <Input
                      placeholder={t('createLinkModal.conversationForm.searchUsers')}
                      value={userSearchQuery}
                      onChange={(e) => setUserSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  {/* Liste des utilisateurs */}
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {isLoadingUsers ? (
                      <div className="flex items-center justify-center py-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                      </div>
                    ) : filteredUsers.length === 0 ? (
                      <div className="text-center py-4 text-muted-foreground">
                        <UserPlus className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">{t('createLinkModal.conversationForm.noUsersFound')}</p>
                      </div>
                    ) : (
                      filteredUsers.map((user) => {
                        const isSelected = newConversationData.memberIds.includes(user.id);
                        
                        const toggleUserSelection = () => {
                          if (isSelected) {
                            setNewConversationData(prev => ({
                              ...prev,
                              memberIds: prev.memberIds.filter(id => id !== user.id)
                            }));
                          } else {
                            setNewConversationData(prev => ({
                              ...prev,
                              memberIds: [...prev.memberIds, user.id]
                            }));
                          }
                        };

                        return (
                          <div
                            key={user.id}
                            className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer"
                            onClick={toggleUserSelection}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                e.stopPropagation();
                                if (e.target.checked) {
                                  setNewConversationData(prev => ({
                                    ...prev,
                                    memberIds: [...prev.memberIds, user.id]
                                  }));
                                } else {
                                  setNewConversationData(prev => ({
                                    ...prev,
                                    memberIds: prev.memberIds.filter(id => id !== user.id)
                                  }));
                                }
                              }}
                              className="rounded"
                            />
                            <div className="h-8 w-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                              <span className="text-xs font-medium text-white">
                                {user.displayName?.[0] || user.firstName?.[0] || user.username[0].toUpperCase()}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">
                                {user.displayName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username}
                              </p>
                              <p className="text-sm text-muted-foreground truncate">@{user.username}</p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Si une conversation existante est sélectionnée */}
            {selectedConversationId && !createNewConversation && (
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                    <MessageSquare className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium">{conversations.find(c => c.id === selectedConversationId)?.title}</h3>
                    {conversations.find(c => c.id === selectedConversationId)?.description && (
                      <p className="text-sm text-muted-foreground">{conversations.find(c => c.id === selectedConversationId)?.description}</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* SECTION 2: CONFIGURATION DU LIEN */}
        <Card className="border-2 border-primary/20">
          <CardHeader className="bg-primary/5">
            <CardTitle className="text-lg flex items-center">
              <Link2 className="h-5 w-5 mr-2" />
              {t('createLinkModal.linkDetails.title')}
            </CardTitle>
            <CardDescription>
              {t('createLinkModal.linkConfiguration.validityDurationInfo')}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            {/* Option requireAccount */}
            <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border-2 border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Shield className="h-4 w-4 text-blue-600" />
                    <Label className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                      {t('createLinkModal.linkDetails.requireAccount.label')}
                    </Label>
                    <InfoIcon content={t('createLinkModal.linkDetails.requireAccount.info')} />
                  </div>
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    {t('createLinkModal.linkDetails.requireAccount.description')}
                  </p>
                </div>
                <Switch
                  checked={requireAccount}
                  onCheckedChange={setRequireAccount}
                  className="data-[state=checked]:bg-blue-600"
                />
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Label className="text-sm font-medium">{t('createLinkModal.linkConfiguration.validityDuration')}</Label>
                  <InfoIcon content={t('createLinkModal.linkConfiguration.validityDurationInfo')} />
                </div>
                <Select value={expirationDays.toString()} onValueChange={(value) => setExpirationDays(parseInt(value))}>
                  <SelectTrigger className="w-full h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DURATION_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value.toString()}>
                        <div>
                          <div className="font-medium">{t(option.labelKey)}</div>
                          <div className="text-xs text-muted-foreground">{t(option.descriptionKey)}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Label className="text-sm font-medium">{t('createLinkModal.linkConfiguration.usageLimit')}</Label>
                  <InfoIcon content={t('createLinkModal.linkConfiguration.usageLimitInfo')} />
                </div>
                <Select 
                  value={maxUses?.toString() || 'unlimited'} 
                  onValueChange={(value) => setMaxUses(value === 'unlimited' ? undefined : parseInt(value))}
                >
                  <SelectTrigger className="w-full h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LIMIT_OPTIONS.map((option) => (
                      <SelectItem key={option.value || 'unlimited'} value={option.value?.toString() || 'unlimited'}>
                        <div>
                          <div className="font-medium">{t(option.labelKey)}</div>
                          <div className="text-xs text-muted-foreground">{t(option.descriptionKey)}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* SECTION 3: OPTIONS AVANCÉES - fusionné dans l'étape 2 */}
        {/* Permissions des participants anonymes */}
        <Card>
        <CardHeader 
          className="pb-3 cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => setIsPermissionsOpen(!isPermissionsOpen)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center">
            <MessageSquare className="h-4 w-4 mr-2" />
              <CardTitle className="text-lg">{t('createLinkModal.permissions.title')}</CardTitle>
            </div>
            {isPermissionsOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </div>
          <CardDescription>
            {t('createLinkModal.permissions.description')}
          </CardDescription>
        </CardHeader>
        {isPermissionsOpen && (
        <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <SelectableSquare
                checked={requireAccount ? true : allowAnonymousMessages}
                onChange={setAllowAnonymousMessages}
                label={t('createLinkModal.permissions.sendMessages.label')}
                description={t('createLinkModal.permissions.sendMessages.description')}
                icon={<MessageSquare className="w-4 h-4" />}
                disabled={requireAccount}
              />

              <SelectableSquare
                checked={requireAccount ? true : allowAnonymousImages}
                onChange={setAllowAnonymousImages}
                label={t('createLinkModal.permissions.shareImages.label')}
                description={t('createLinkModal.permissions.shareImages.description')}
                icon={<Image className="w-4 h-4" />}
                disabled={requireAccount}
              />

              <SelectableSquare
                checked={requireAccount ? true : allowAnonymousFiles}
                onChange={setAllowAnonymousFiles}
                label={t('createLinkModal.permissions.shareFiles.label')}
                description={t('createLinkModal.permissions.shareFiles.description')}
                icon={<FileText className="w-4 h-4" />}
                disabled={requireAccount}
              />

              <SelectableSquare
                checked={requireAccount ? true : allowViewHistory}
                onChange={setAllowViewHistory}
                label={t('createLinkModal.permissions.viewHistory.label')}
                description={t('createLinkModal.permissions.viewHistory.description')}
                icon={<Eye className="w-4 h-4" />}
                disabled={requireAccount}
              />
          </div>

          <Separator />

            {/* Note: requireNickname est toujours true (pas de toggle) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <SelectableSquare
                checked={requireAccount ? true : requireEmail}
                onChange={setRequireEmail}
                label={t('createLinkModal.permissions.requireEmail.label')}
                description={t('createLinkModal.permissions.requireEmail.description')}
                icon={<Settings className="w-4 h-4" />}
                disabled={requireAccount}
              />

              <SelectableSquare
                checked={requireAccount ? true : requireBirthday}
                onChange={setRequireBirthday}
                label={t('createLinkModal.permissions.requireBirthday.label')}
                description={t('createLinkModal.permissions.requireBirthday.description')}
                icon={<Calendar className="w-4 h-4" />}
                disabled={requireAccount}
              />
          </div>
        </CardContent>
        )}
      </Card>

      {/* Langues autorisées */}
      <Card>
        <CardHeader 
          className="pb-3 cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => setIsLanguagesOpen(!isLanguagesOpen)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Globe className="h-4 w-4 mr-2" />
              <CardTitle className="text-lg">{t('createLinkModal.allowedLanguages.title')}</CardTitle>
            </div>
            {isLanguagesOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </div>
          <CardDescription>
            {t('createLinkModal.allowedLanguages.description')}
          </CardDescription>
        </CardHeader>
        {isLanguagesOpen && (
        <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {SUPPORTED_LANGUAGES.map((lang) => (
                <SelectableSquare
                  key={lang.code}
                    checked={allowedLanguages.includes(lang.code)}
                  onChange={(checked) => {
                    if (checked) {
                        setAllowedLanguages([...allowedLanguages, lang.code]);
                      } else {
                        setAllowedLanguages(allowedLanguages.filter(l => l !== lang.code));
                      }
                    }}
                  label={`${lang.flag} ${lang.name}`}
                  description={t('createLinkModal.allowedLanguages.allowLanguage', { language: lang.name })}
                  icon={<Globe className="w-4 h-4" />}
                  />
              ))}
            </div>
            <p className="text-xs text-muted-foreground italic">
              💡 {t('createLinkModal.allowedLanguages.allowAllLanguagesHint')}
            </p>
          </CardContent>
        )}
      </Card>
      </div>
    );
  };

  // Étape 3: Résumé et génération (anciennement étape 4)
  const renderStep3 = () => (
    <div className="space-y-6">
      {/* Titre du lien - modifiable */}
      <Card className="border-2 border-dashed border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center">
            <Link2 className="h-4 w-4 mr-2" />
            {t('createLinkModal.linkDetails.title')}
          </CardTitle>
          <CardDescription>
            {t('createLinkModal.linkDetails.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Label htmlFor="linkName" className="text-sm font-medium">
                {t('createLinkModal.linkDetails.linkName')}
              </Label>
              <InfoIcon content={t('createLinkModal.linkDetails.linkNameInfo')} />
            </div>
            <Input
              id="linkName"
              value={linkTitle || (() => {
                const conversationTitle = createNewConversation 
                  ? newConversationData.title 
                  : conversations.find(c => c.id === selectedConversationId)?.title;
                return conversationTitle ? `${t('createLinkModal.linkDetails.linkNameDefaultPrefix')} ${conversationTitle}` : '';
              })()}
              onChange={(e) => setLinkTitle(e.target.value)}
              placeholder={t('createLinkModal.linkDetails.linkNamePlaceholder')}
              className="text-lg"
            />
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Label htmlFor="linkIdentifier" className="text-sm font-medium">
                {t('createLinkModal.linkDetails.linkIdentifier')}
              </Label>
              <InfoIcon content={t('createLinkModal.linkDetails.linkIdentifierInfo')} />
            </div>
            <div className="flex items-center space-x-2">
              <Input
                id="linkIdentifier"
                value={linkIdentifier || (() => {
                  const baseText = linkTitle || (createNewConversation 
                    ? newConversationData.title 
                    : conversations.find(c => c.id === selectedConversationId)?.title || 'link');
                  return generateIdentifier(baseText);
                })()}
                onChange={(e) => setLinkIdentifier(e.target.value)}
                className="flex-1 font-mono text-sm"
                placeholder="Identifiant du lien..."
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const baseText = linkTitle || (createNewConversation 
                    ? newConversationData.title 
                    : conversations.find(c => c.id === selectedConversationId)?.title || 'link');
                  setLinkIdentifier(generateIdentifier(baseText));
                }}
                title={t('createLinkModal.linkDetails.regenerateIdentifier')}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            {/* Link identifier availability indicator */}
            {linkIdentifier && validateLinkIdentifier(linkIdentifier) && (
              <div className="mt-2">
                {isCheckingLinkIdentifier ? (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
                    Vérification...
                  </p>
                ) : linkIdentifierAvailable === true ? (
                  <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                    <Check className="h-3 w-3" />
                    {linkIdentifierCheckMessage}
                  </p>
                ) : linkIdentifierAvailable === false ? (
                  <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                    <X className="h-3 w-3" />
                    {linkIdentifierCheckMessage}
                  </p>
                ) : null}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Label htmlFor="welcomeMessage" className="text-sm font-medium">
                {t('createLinkModal.linkDetails.welcomeMessage')}
            </Label>
              <InfoIcon content={t('createLinkModal.linkDetails.welcomeMessageInfo')} />
            </div>
            <Textarea
              id="welcomeMessage"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('createLinkModal.linkDetails.welcomeMessagePlaceholder')}
              className="min-h-[80px]"
            />
          </div>
        </CardContent>
      </Card>

      {/* Résumé de la configuration */}
      <Card>
        <CardHeader 
          className="cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => setIsSummaryOpen(!isSummaryOpen)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center">
            <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
              <CardTitle className="text-lg">{t('summary.title')}</CardTitle>
            </div>
            {isSummaryOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </div>
          <CardDescription>
            {t('summary.description')}
          </CardDescription>
        </CardHeader>
        {isSummaryOpen && (
          <CardContent className="space-y-6">
          {/* Informations de base */}
          <div className="space-y-4">
            <h4 className="font-semibold text-base flex items-center">
              <MessageSquare className="h-4 w-4 mr-2" />
              {t('summary.basicInfo')}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3 bg-muted/30 rounded-lg">
                <h5 className="font-medium text-sm text-muted-foreground mb-1">{t('summary.conversation')}</h5>
              <p className="font-medium">
                {createNewConversation 
                  ? `Nouvelle: ${newConversationData.title}`
                  : conversations.find(c => c.id === selectedConversationId)?.title || 'Non sélectionnée'
                }
              </p>
                {createNewConversation && newConversationData.description && (
                  <p className="text-sm text-muted-foreground mt-1">{newConversationData.description}</p>
                )}
            </div>
            
              <div className="p-3 bg-muted/30 rounded-lg">
                <h5 className="font-medium text-sm text-muted-foreground mb-1">{t('summary.validityDuration')}</h5>
              <p className="font-medium">{DURATION_OPTIONS.find(d => d.value === expirationDays) ? t(DURATION_OPTIONS.find(d => d.value === expirationDays)!.labelKey) : `${expirationDays} jours`}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Expire le {new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000).toLocaleDateString()}
                </p>
            </div>
            
              <div className="p-3 bg-muted/30 rounded-lg">
                <h5 className="font-medium text-sm text-muted-foreground mb-1">{t('summary.usageLimit')}</h5>
              <p className="font-medium">{maxUses ? t('summary.usageCount', { count: maxUses }) : t('summary.unlimited')}</p>
                {maxUses && (
                  <p className="text-xs text-muted-foreground mt-1">{t('summary.linkDisabledAfter', { count: maxUses })}</p>
                )}
              </div>
              
              <div className="p-3 bg-muted/30 rounded-lg">
                <h5 className="font-medium text-sm text-muted-foreground mb-1">{t('summary.welcomeMessage')}</h5>
                <p className="font-medium">{description || t('summary.noCustomMessage')}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('summary.welcomeMessageDescription')}
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Permissions détaillées */}
          <div className="space-y-4">
            <h4 className="font-semibold text-base flex items-center">
              <Shield className="h-4 w-4 mr-2" />
              {t('summary.permissionsGranted')}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className={`p-3 rounded-lg border-2 ${allowAnonymousMessages ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                <div className="flex items-center space-x-2">
                  <MessageSquare className={`h-4 w-4 ${allowAnonymousMessages ? 'text-green-600' : 'text-red-600'}`} />
                  <span className="font-medium text-sm">{t('summary.messages')}</span>
                  <Badge variant={allowAnonymousMessages ? 'default' : 'destructive'} className="text-xs">
                    {allowAnonymousMessages ? t('summary.allowed') : t('summary.forbidden')}
                  </Badge>
            </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {allowAnonymousMessages ? t('summary.guestsCanSendMessages') : t('summary.guestsCannotSendMessages')}
                </p>
          </div>

              <div className={`p-3 rounded-lg border-2 ${allowAnonymousImages ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                <div className="flex items-center space-x-2">
                  <Image className={`h-4 w-4 ${allowAnonymousImages ? 'text-green-600' : 'text-red-600'}`} />
                  <span className="font-medium text-sm">{t('summary.images')}</span>
                  <Badge variant={allowAnonymousImages ? 'default' : 'destructive'} className="text-xs">
                    {allowAnonymousImages ? t('summary.allowed') : t('summary.forbidden')}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {allowAnonymousImages ? t('summary.guestsCanShareImages') : t('summary.guestsCannotShareImages')}
                </p>
              </div>

              <div className={`p-3 rounded-lg border-2 ${allowAnonymousFiles ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                <div className="flex items-center space-x-2">
                  <FileText className={`h-4 w-4 ${allowAnonymousFiles ? 'text-green-600' : 'text-red-600'}`} />
                  <span className="font-medium text-sm">{t('summary.files')}</span>
                  <Badge variant={allowAnonymousFiles ? 'default' : 'destructive'} className="text-xs">
                    {allowAnonymousFiles ? t('summary.allowed') : t('summary.forbidden')}
                  </Badge>
              </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {allowAnonymousFiles ? t('summary.guestsCanShareFiles') : t('summary.guestsCannotShareFiles')}
                </p>
            </div>

              <div className={`p-3 rounded-lg border-2 ${allowViewHistory ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                <div className="flex items-center space-x-2">
                  <Eye className={`h-4 w-4 ${allowViewHistory ? 'text-green-600' : 'text-red-600'}`} />
                  <span className="font-medium text-sm">{t('summary.history')}</span>
                  <Badge variant={allowViewHistory ? 'default' : 'destructive'} className="text-xs">
                    {allowViewHistory ? t('summary.visible') : t('summary.hidden')}
                  </Badge>
      </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {allowViewHistory ? t('summary.guestsCanViewHistory') : t('summary.guestsCannotViewHistory')}
                </p>
    </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
              <div className={`p-3 rounded-lg border-2 ${requireNickname ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-gray-50'}`}>
                <div className="flex items-center space-x-2">
                  <Users className={`h-4 w-4 ${requireNickname ? 'text-blue-600' : 'text-gray-600'}`} />
                  <span className="font-medium text-sm">{t('summary.nicknameRequired')}</span>
                  <Badge variant={requireNickname ? 'secondary' : 'outline'} className="text-xs">
                    {requireNickname ? t('summary.yes') : t('summary.no')}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {requireNickname ? t('summary.guestsMustEnterNickname') : t('summary.guestsCanStayAnonymous')}
                </p>
              </div>

              <div className={`p-3 rounded-lg border-2 ${requireEmail ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-gray-50'}`}>
          <div className="flex items-center space-x-2">
                  <Settings className={`h-4 w-4 ${requireEmail ? 'text-blue-600' : 'text-gray-600'}`} />
                  <span className="font-medium text-sm">{t('summary.emailRequired')}</span>
                  <Badge variant={requireEmail ? 'secondary' : 'outline'} className="text-xs">
                    {requireEmail ? t('summary.yes') : t('summary.no')}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {requireEmail ? t('summary.guestsMustEnterEmail') : t('summary.guestsCanStayAnonymous')}
                </p>
              </div>
            </div>
          </div>

          {/* Langues autorisées */}
          {allowedLanguages.length > 0 && (
            <>
              <Separator />
              <div className="space-y-4">
                <h4 className="font-semibold text-base flex items-center">
                  <Globe className="h-4 w-4 mr-2" />
                  {t('summary.allowedLanguages')}
                </h4>
                <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <h5 className="font-medium text-sm text-orange-800 mb-2">{t('summary.selectedLanguages')}</h5>
                  <div className="flex flex-wrap gap-1">
                    {allowedLanguages.map(lang => {
                      const langInfo = SUPPORTED_LANGUAGES.find(l => l.code === lang);
  return (
                        <Badge key={lang} variant="outline" className="text-xs">
                          {langInfo?.flag} {langInfo?.name}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
        )}
      </Card>

    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl w-[95vw] max-h-[95vh] p-0 gap-0 flex flex-col sm:max-w-2xl sm:w-[90vw] sm:max-h-[90vh] md:w-[85vw] md:max-h-[85vh]">
        <DialogHeader className="flex-shrink-0 bg-background border-b px-3 py-3 sm:px-6 sm:py-4">
          <DialogTitle className="text-base sm:text-xl font-bold flex items-center">
            <Link2 className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
            {t('createLinkModal.title')}
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            {t('createLinkModal.description')}
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto px-3 sm:px-6">
          {/* Progress indicator - Timeline horizontale */}
          <div className="py-6">
            <div className="flex items-center justify-between">
              {Array.from({ length: totalSteps }, (_, i) => {
                const stepNumber = i + 1;
                const isActive = stepNumber === currentStep;
                const isCompleted = stepNumber < currentStep;
                const stepTitles = [
                  t('createLinkModal.steps.selectConversation'),
                  t('createLinkModal.steps.configureLink'),
                  t('createLinkModal.steps.summaryAndGeneration')
                ];

                return (
                  <Fragment key={i}>
                    {/* Ligne de connexion avant le point (sauf pour le premier) */}
                    {i > 0 && (
                      <div className={`flex-1 h-0.5 ${
                        stepNumber <= currentStep ? 'bg-primary' : 'bg-muted'
                      }`} />
                    )}

                    {/* Container du point et texte */}
                    <div className="flex flex-col items-center flex-shrink-0">
                      {/* Point de l'étape */}
                      <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                        isActive
                          ? 'bg-primary ring-4 ring-primary/20'
                          : isCompleted
                          ? 'bg-primary'
                          : 'bg-muted'
                      }`} />

                      {/* Texte de l'étape */}
                      <div className="mt-3 text-center max-w-[120px]">
                        <p className={`text-xs font-medium leading-tight ${
                          isActive ? 'text-primary' : isCompleted ? 'text-primary' : 'text-muted-foreground'
                        }`}>
                          {stepTitles[i]}
                        </p>
                      </div>
                    </div>
                  </Fragment>
                );
              })}
            </div>
          </div>

          {/* Step content */}
          <div className="min-h-[400px] pb-6">
          {generatedLink && generatedToken ? (
            // Afficher la page de synthèse finale au lieu des étapes
            <div className="space-y-6">
              {/* En-tête de succès */}
              <Card className="border-green-200 bg-green-50">
                <CardHeader className="text-center">
                  <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                    <CheckCircle className="h-8 w-8 text-green-600" />
                  </div>
                  <CardTitle className="text-2xl text-green-700">
                    {t('createLinkModal.success.linkCreated')}
                  </CardTitle>
                  <CardDescription className="text-green-600">
                    {t('createLinkButton.linkCreated')}
                  </CardDescription>
                </CardHeader>
              </Card>

              {/* Synthèse rapide */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center">
                    <FileText className="h-5 w-5 mr-2" />
                    {t('summary.title')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 bg-muted/30 rounded-lg">
                      <h4 className="font-medium text-sm text-muted-foreground mb-2">{t('summary.conversation')}</h4>
                      <p className="font-medium">
                        {createNewConversation 
                          ? `${tCommon('new')}: ${newConversationData.title}`
                          : conversations.find(c => c.id === selectedConversationId)?.title || tCommon('notSelected')
                        }
                      </p>
                    </div>
                    
                    <div className="p-4 bg-muted/30 rounded-lg">
                      <h4 className="font-medium text-sm text-muted-foreground mb-2">{t('summary.validityDuration')}</h4>
                      <p className="font-medium">{DURATION_OPTIONS.find(d => d.value === expirationDays) ? t(DURATION_OPTIONS.find(d => d.value === expirationDays)!.labelKey) : `${expirationDays} ${tCommon('days')}`}</p>
                    </div>
                    
                    <div className="p-4 bg-muted/30 rounded-lg">
                      <h4 className="font-medium text-sm text-muted-foreground mb-2">{t('summary.usageLimit')}</h4>
                      <p className="font-medium">{maxUses ? `${maxUses} ${t('summary.usageCount', { count: maxUses })}` : t('summary.unlimited')}</p>
                    </div>
                    
                    <div className="p-4 bg-muted/30 rounded-lg">
                      <h4 className="font-medium text-sm text-muted-foreground mb-2">{t('summary.permissions')}</h4>
                      <div className="flex flex-wrap gap-1">
                        {allowAnonymousMessages && <Badge variant="outline" className="text-xs">{t('summary.messages')}</Badge>}
                        {allowAnonymousImages && <Badge variant="outline" className="text-xs">{t('summary.images')}</Badge>}
                        {allowAnonymousFiles && <Badge variant="outline" className="text-xs">{t('summary.files')}</Badge>}
                        {allowViewHistory && <Badge variant="outline" className="text-xs">{t('summary.history')}</Badge>}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Lien complet */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center">
                    <Link2 className="h-5 w-5 mr-2" />
                    {t('createLinkButton.generatedLink')}
                  </CardTitle>
                  <CardDescription>
                    {t('linkSummaryModal.shareLink')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-white border rounded-lg">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-2">
                      <Input
                        value={generatedLink}
                        readOnly
                        className="flex-1 text-sm bg-white font-mono"
                      />
                      <Button
                        onClick={copyLink}
                        size="sm"
                        variant="outline"
                        className="w-full sm:w-auto"
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        {t('createLinkButton.copy')}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Actions finales */}
              <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
                <Button
                  onClick={copyLink}
                  variant="outline"
                  className="flex-1"
                >
                  <Copy className="mr-2 h-4 w-4" />
                  {t('createLinkModal.actions.copyLink')}
                </Button>
                <Button
                  onClick={handleClose}
                  className="flex-1"
                >
                  {t('createLinkModal.actions.close')}
                </Button>
              </div>
            </div>
          ) : (
            // Afficher les étapes normales
            <>
              {currentStep === 1 && renderStep1()}
              {currentStep === 2 && renderStep2()}
              {currentStep === 3 && renderStep3()}
            </>
          )}
          </div>
        </div>

        {/* Navigation buttons - masqués quand la synthèse est affichée */}
        {!generatedLink && (
          <div className="flex-shrink-0 bg-background border-t px-3 py-3 sm:px-6 sm:py-4">
            <div className="flex flex-col sm:flex-row justify-between items-center space-y-2 sm:space-y-0 sm:space-x-4">
              <div className="flex space-x-2 w-full sm:w-auto">
                {currentStep > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={prevStep}
                    className="w-full sm:w-auto text-xs sm:text-sm h-9 sm:h-10"
                  >
                    <ChevronLeft className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    {t('createLinkModal.navigation.previous')}
                  </Button>
                )}
              </div>
              
              <div className="flex space-x-2 w-full sm:w-auto">
                {currentStep < totalSteps ? (
                  <Button
                    type="button"
                    onClick={nextStep}
                    disabled={!canProceedToNext()}
                    className="w-full sm:w-auto text-xs sm:text-sm h-9 sm:h-10"
                  >
                    {t('createLinkModal.navigation.next')}
                    <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4 ml-1 sm:ml-2" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={generateLink}
                    disabled={!canCreateLink() || isCreating}
                    className="flex items-center w-full sm:w-auto text-xs sm:text-sm h-9 sm:h-10"
                  >
                    <Link2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    {isCreating ? t('createLinkModal.navigation.generating') : t('createLinkModal.navigation.createLink')}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

      </DialogContent>
    </Dialog>
  );
}
