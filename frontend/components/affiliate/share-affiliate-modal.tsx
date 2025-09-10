'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Share2, 
  Copy, 
  Plus, 
  Link, 
  Users, 
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  ExternalLink,
  MessageSquare
} from 'lucide-react';
import { buildApiUrl } from '@/lib/config';
import { useTranslations } from '@/hooks/useTranslations';

interface AffiliateToken {
  id: string;
  token: string;
  name: string;
  affiliateLink: string;
  maxUses: number | null;
  currentUses: number;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
  _count: {
    affiliations: number;
  };
}

interface ShareAffiliateModalProps {
  isOpen: boolean;
  onClose: () => void;
  userLanguage: string;
}

export function ShareAffiliateModal({ isOpen, onClose, userLanguage }: ShareAffiliateModalProps) {
  const [tokens, setTokens] = useState<AffiliateToken[]>([]);
  const [selectedToken, setSelectedToken] = useState<AffiliateToken | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newTokenName, setNewTokenName] = useState('');
  const [shareMessage, setShareMessage] = useState('');
  const [currentStep, setCurrentStep] = useState<'select' | 'create' | 'share'>('select');
  const { t } = useTranslations('affiliate');
  const { t: tCommon } = useTranslations('common');

  // Messages de partage par défaut selon la langue
  const defaultMessages = {
    fr: "Rejoins-moi sur Meeshy ! Une plateforme de messagerie multilingue où tu peux discuter avec des personnes du monde entier et apprendre les langues en t'amusant. Clique sur ce lien pour t'inscrire :",
    en: "Join me on Meeshy! A multilingual messaging platform where you can chat with people from around the world and learn languages while having fun. Click this link to sign up:",
    es: "¡Únete a mí en Meeshy! Una plataforma de mensajería multilingüe donde puedes chatear con personas de todo el mundo y aprender idiomas mientras te diviertes. Haz clic en este enlace para registrarte:",
    de: "Komm zu mir auf Meeshy! Eine mehrsprachige Messaging-Plattform, auf der du mit Menschen aus aller Welt chatten und dabei Sprachen lernen kannst. Klicke auf diesen Link, um dich anzumelden:",
    pt: "Junte-se a mim no Meeshy! Uma plataforma de mensagens multilíngue onde você pode conversar com pessoas de todo o mundo e aprender idiomas se divertindo. Clique neste link para se inscrever:"
  };

  // Suggestions de noms prédéfinis pour les tokens
  const tokenNameSuggestions = [
    'Inviter amis',
    'Inviter famille', 
    'Pour mes camarades',
    'Campagne LinkedIn',
    'Campagne Facebook',
    'Partage général',
    'Invitation communauté',
    'Partage professionnel'
  ];

  useEffect(() => {
    if (isOpen) {
      loadTokens();
      setShareMessage(defaultMessages[userLanguage as keyof typeof defaultMessages] || defaultMessages.en);
      setCurrentStep('select');
      setSelectedToken(null);
      setIsCreatingNew(false);
      setNewTokenName('');
    }
  }, [isOpen, userLanguage]);

  const loadTokens = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      const response = await fetch(buildApiUrl('/affiliate/tokens'), {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setTokens(data.data || []);
      }
    } catch (error) {
      console.error('Erreur chargement tokens:', error);
      toast.error(t('errorLoadingTokens'));
    } finally {
      setIsLoading(false);
    }
  };

  const createNewToken = async () => {
    if (!newTokenName.trim()) {
      toast.error(t('enterTokenName'));
      return false;
    }

    try {
      setIsCreating(true);
      const token = localStorage.getItem('auth_token');
      if (!token) return false;

      const response = await fetch(buildApiUrl('/affiliate/tokens'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newTokenName.trim()
        })
      });

      if (response.ok) {
        const data = await response.json();
        const newToken = data.data;
        setTokens(prev => [newToken, ...prev]);
        setSelectedToken(newToken);
        setIsCreatingNew(false);
        setNewTokenName('');
        toast.success(t('tokenCreated'));
        return true;
      } else {
        const error = await response.json();
        toast.error(error.error || t('errorCreatingToken'));
        return false;
      }
    } catch (error) {
      console.error('Erreur création token:', error);
      toast.error(t('errorCreatingToken'));
      return false;
    } finally {
      setIsCreating(false);
    }
  };

  const createAndShareToken = async () => {
    const success = await createNewToken();
    if (success && selectedToken) {
      // Partager directement après création
      const fullMessage = `${shareMessage}\n\n${selectedToken.affiliateLink}`;
      
      // D'abord copier le message dans le presse-papiers
      await copyToClipboard(fullMessage);
      
      // Ensuite proposer le partage natif
      if (navigator.share) {
        try {
          await navigator.share({
            title: t('shareTitle'),
            text: fullMessage,
            url: selectedToken.affiliateLink
          });
          onClose(); // Fermer la modale après partage
        } catch (error) {
          if (error instanceof Error && error.name !== 'AbortError') {
            console.error('Erreur partage natif:', error);
          }
          // Le message est déjà copié, donc on peut fermer la modale
          onClose();
        }
      } else {
        // Si pas de partage natif, le message est déjà copié
        onClose();
      }
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t('linkCopied'));
    } catch (error) {
      console.error('Erreur copie:', error);
      toast.error(t('errorCopying'));
    }
  };

  const shareViaNative = async () => {
    if (!selectedToken) return;

    const fullMessage = `${shareMessage}\n\n${selectedToken.affiliateLink}`;

    // D'abord copier le message dans le presse-papiers
    await copyToClipboard(fullMessage);

    // Ensuite proposer le partage natif
    if (navigator.share) {
      try {
        await navigator.share({
          title: t('shareTitle'),
          text: fullMessage,
          url: selectedToken.affiliateLink
        });
        onClose(); // Fermer la modale après partage
      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError') {
          console.error('Erreur partage natif:', error);
          toast.error(t('errorSharing'));
        }
        // Le message est déjà copié, donc on peut fermer la modale
        onClose();
      }
    } else {
      // Si pas de partage natif, le message est déjà copié
      onClose();
    }
  };

  const getTokenStatus = (token: AffiliateToken) => {
    if (!token.isActive) return { status: 'inactive', label: t('tokenStatus.inactive'), color: 'bg-gray-500' };
    if (token.expiresAt && new Date(token.expiresAt) < new Date()) return { status: 'expired', label: t('tokenStatus.expired'), color: 'bg-red-500' };
    if (token.maxUses && token.currentUses >= token.maxUses) return { status: 'limit', label: t('tokenStatus.limitReached'), color: 'bg-orange-500' };
    return { status: 'active', label: t('tokenStatus.active'), color: 'bg-green-500' };
  };

  const formatDate = (dateString: string) => {
    const localeMap = {
      fr: 'fr-FR',
      en: 'en-US',
      es: 'es-ES',
      de: 'de-DE',
      pt: 'pt-BR'
    };
    
    return new Date(dateString).toLocaleDateString(localeMap[userLanguage as keyof typeof localeMap] || 'fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'select':
        return (
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">{t('selectToken')}</h3>
              <p className="text-gray-600 text-sm">{t('modalDescription')}</p>
            </div>

            {tokens.length > 0 && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">{t('existingTokens')}</Label>
                <div className="space-y-3 max-h-48 overflow-y-auto">
                  {tokens.map((token) => {
                    const status = getTokenStatus(token);
                    return (
                      <Card 
                        key={token.id} 
                        className={`transition-colors cursor-pointer ${
                          selectedToken?.id === token.id ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:bg-gray-50'
                        }`}
                        onClick={() => {
                          setSelectedToken(token);
                          setCurrentStep('share');
                        }}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center space-x-3 flex-1 min-w-0">
                              <div className={`w-3 h-3 rounded-full ${status.color} flex-shrink-0`} />
                              <div className="min-w-0 flex-1">
                                <p className="font-medium truncate">{token.name}</p>
                                <p className="text-xs text-gray-500 truncate">
                                  {token._count?.affiliations || 0} {t('uses')} • {formatDate(token.createdAt)}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2 flex-shrink-0">
                              <Badge variant="secondary" className="text-xs">
                                {status.label}
                              </Badge>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedToken(token);
                                  shareViaNative();
                                }}
                                className="flex items-center space-x-1"
                              >
                                <Share2 className="h-3 w-3" />
                                <span className="text-xs hidden sm:inline">{t('share')}</span>
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

          </div>
        );

      case 'create':
        return (
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">Créer un nouveau lien</h3>
              <p className="text-gray-600 text-sm">Choisissez un nom pour votre lien de partage</p>
            </div>

            {/* Suggestions de noms */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Suggestions :</Label>
              <div className="grid grid-cols-3 gap-2">
                {tokenNameSuggestions.map((suggestion, index) => (
                  <div
                    key={index}
                    className={`p-2 rounded-lg border cursor-pointer transition-all hover:bg-primary/5 hover:border-primary/50 ${
                      newTokenName === suggestion ? 'bg-primary/10 border-primary ring-2 ring-primary/20' : 'bg-white'
                    }`}
                    onClick={() => setNewTokenName(suggestion)}
                  >
                    <div className="font-medium text-xs text-center truncate">{suggestion}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Champ nom personnalisé */}
            <div className="space-y-2">
              <Label htmlFor="tokenName">Ou saisissez un nom personnalisé :</Label>
              <Input
                id="tokenName"
                value={newTokenName}
                onChange={(e) => setNewTokenName(e.target.value)}
                placeholder="Ex: Mon lien spécial..."
                className="mt-1"
              />
            </div>

            {/* Bouton créer et partager */}
            <div className="pt-4">
              <Button
                onClick={createAndShareToken}
                disabled={isCreating || !newTokenName.trim()}
                className="w-full flex items-center space-x-2"
              >
                <Share2 className="h-4 w-4" />
                <span>{isCreating ? 'Création...' : 'Créer et partager'}</span>
              </Button>
            </div>

          </div>
        );

      case 'share':
        return (
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">{t('share')}</h3>
              <p className="text-gray-600 text-sm">{t('modalDescription')}</p>
            </div>

            {selectedToken && (
              <>
                <div className="space-y-3">
                  <Label htmlFor="shareMessage">{t('shareMessage')}</Label>
                  <Textarea
                    id="shareMessage"
                    value={shareMessage}
                    onChange={(e) => setShareMessage(e.target.value)}
                    placeholder={t('shareMessagePlaceholder')}
                    rows={3}
                    className="resize-none"
                  />
                </div>

                <Card>
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <div className="text-sm font-mono break-all text-gray-700 overflow-hidden">
                          {selectedToken.affiliateLink}
                        </div>
                      </div>
                      
                      <div className="flex space-x-2">
                        <Button
                          onClick={() => copyToClipboard(`${shareMessage}\n\n${selectedToken.affiliateLink}`)}
                          variant="outline"
                          className="flex-1 flex items-center space-x-2"
                        >
                          <Copy className="h-4 w-4" />
                          <span>Copier</span>
                        </Button>
                        
                        <Button
                          onClick={shareViaNative}
                          className="flex-1 flex items-center space-x-2"
                        >
                          <Share2 className="h-4 w-4" />
                          <span>Partager</span>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Share2 className="h-5 w-5 text-blue-600" />
            <span>{t('modalTitle')}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4">
          {renderStepContent()}
        </div>

        {/* Boutons fixes en bas */}
        <div className="flex-shrink-0 border-t p-4 bg-white">
          {currentStep === 'create' ? (
            /* Bouton Précédent pour l'étape de création */
            <Button
              onClick={() => setCurrentStep('select')}
              variant="outline"
              className="w-full"
            >
              {tCommon('previous')}
            </Button>
          ) : (
            /* Bouton Nouveau pour les autres étapes */
            <Button
              onClick={() => setCurrentStep('create')}
              className="w-full flex items-center space-x-2"
            >
              <Plus className="h-4 w-4" />
              <span>{t('newToken')}</span>
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
