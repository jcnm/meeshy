'use client';

import { useState } from 'react';
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
import { buildApiUrl, API_ENDPOINTS } from '@/lib/config';
import { copyToClipboard } from '@/lib/clipboard';
import { toast } from 'sonner';
import { Link2, Copy, Calendar, Clock, Shield, Globe, Users, MessageSquare, Settings, Eye, FileText, Image } from 'lucide-react';

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

// Pays supportés (sélection)
const SUPPORTED_COUNTRIES = [
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'US', name: 'États-Unis', flag: '🇺🇸' },
  { code: 'GB', name: 'Royaume-Uni', flag: '🇬🇧' },
  { code: 'DE', name: 'Allemagne', flag: '🇩🇪' },
  { code: 'ES', name: 'Espagne', flag: '🇪🇸' },
  { code: 'IT', name: 'Italie', flag: '🇮🇹' },
  { code: 'PT', name: 'Portugal', flag: '🇵🇹' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  { code: 'JP', name: 'Japon', flag: '🇯🇵' },
  { code: 'CN', name: 'Chine', flag: '🇨🇳' }
];

interface CreateLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLinkCreated: () => void;
}

export function CreateLinkModal({
  isOpen,
  onClose,
  onLinkCreated
}: CreateLinkModalProps) {
  // États de base
  const [linkTitle, setLinkTitle] = useState('');
  const [description, setDescription] = useState('');
  const [expirationDays, setExpirationDays] = useState(7);
  const [isCreating, setIsCreating] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  
  // États des limitations
  const [maxUses, setMaxUses] = useState<number | undefined>(undefined);
  const [maxConcurrentUsers, setMaxConcurrentUsers] = useState<number | undefined>(undefined);
  const [maxUniqueSessions, setMaxUniqueSessions] = useState<number | undefined>(undefined);
  
  // États des permissions
  const [allowAnonymousMessages, setAllowAnonymousMessages] = useState(true);
  const [allowAnonymousFiles, setAllowAnonymousFiles] = useState(false);
  const [allowAnonymousImages, setAllowAnonymousImages] = useState(true);
  const [allowViewHistory, setAllowViewHistory] = useState(true);
  const [requireNickname, setRequireNickname] = useState(true);
  const [requireEmail, setRequireEmail] = useState(false);
  
  // États des restrictions de sécurité
  const [allowedLanguages, setAllowedLanguages] = useState<string[]>([]);
  const [allowedCountries, setAllowedCountries] = useState<string[]>([]);
  const [allowedIpRanges, setAllowedIpRanges] = useState('');
  
  // État pour les sections pliables
  const [showAdvanced, setShowAdvanced] = useState(false);

  const generateLink = async () => {
    if (!linkTitle.trim()) {
      toast.error('Veuillez saisir un titre pour le lien');
      return;
    }

    setIsCreating(true);
    try {
      const token = localStorage.getItem('auth_token');
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expirationDays);

      const response = await fetch(buildApiUrl(API_ENDPOINTS.CONVERSATION.CREATE_LINK), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: linkTitle.trim(),
          description: description.trim() || undefined,
          expiresAt: expiresAt.toISOString(),
          maxUses: maxUses || undefined,
          maxConcurrentUsers: maxConcurrentUsers || undefined,
          maxUniqueSessions: maxUniqueSessions || undefined,
          allowAnonymousMessages,
          allowAnonymousFiles,
          allowAnonymousImages,
          allowViewHistory,
          requireNickname,
          requireEmail,
          allowedLanguages: allowedLanguages.length > 0 ? allowedLanguages : undefined,
          allowedCountries: allowedCountries.length > 0 ? allowedCountries : undefined,
          allowedIpRanges: allowedIpRanges.trim() ? allowedIpRanges.split('\n').map(ip => ip.trim()).filter(Boolean) : undefined
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('[CREATE_LINK] Réponse API:', data);
        
        // Le backend renvoie { success: true, data: { linkId: "...", conversationId: "...", shareLink: {...} } }
        const linkToken = data.data?.linkId || data.linkId; // Support des deux formats
        if (!linkToken) {
          throw new Error('Token de lien manquant dans la réponse');
        }
        
        const linkUrl = `${window.location.origin}/join/${linkToken}`;
        setGeneratedLink(linkUrl);
        
        // Copier automatiquement dans le presse-papiers
        const copyResult = await copyToClipboard(linkUrl);
        if (copyResult.success) {
          toast.success('Lien généré et copié dans le presse-papiers !');
        } else {
          toast.success('Lien généré avec succès !');
        }
        
        onLinkCreated();
      } else {
        const error = await response.json();
        console.error('[CREATE_LINK] Erreur API:', error);
        toast.error(error.message || `Erreur lors de la génération du lien (${response.status})`);
      }
    } catch (error) {
      console.error('[CREATE_LINK] Erreur génération lien:', error);
      toast.error(error instanceof Error ? error.message : 'Erreur lors de la génération du lien');
    } finally {
      setIsCreating(false);
    }
  };

  const copyLink = async () => {
    if (generatedLink) {
      const copyResult = await copyToClipboard(generatedLink, 'input[readonly]');
      if (copyResult.success) {
        toast.success('Lien copié dans le presse-papiers');
      } else {
        toast.info(copyResult.message);
      }
    }
  };

  const handleClose = () => {
    // Reset all form states
    setLinkTitle('');
    setDescription('');
    setExpirationDays(7);
    setGeneratedLink(null);
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
    setAllowedCountries([]);
    setAllowedIpRanges('');
    setShowAdvanced(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Link2 className="h-5 w-5 mr-2" />
            Créer un lien de partage
          </DialogTitle>
          <DialogDescription>
            Configurez les accès et les restrictions pour permettre à d&apos;autres de rejoindre cette conversation
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          {!generatedLink ? (
            <>
              {/* Informations de base */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center">
                    <Settings className="h-4 w-4 mr-2" />
                    Informations générales
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="title" className="text-sm font-medium">
                      Nom du lien *
                    </Label>
                    <Input
                      id="title"
                      value={linkTitle}
                      onChange={(e) => setLinkTitle(e.target.value)}
                      placeholder="Ex: Discussion équipe, Brainstorming projet..."
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="description" className="text-sm font-medium">
                      Description (optionnelle)
                    </Label>
                    <Textarea
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Décrivez brièvement l'objectif de cette conversation..."
                      className="mt-1 min-h-[60px]"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="expiration" className="text-sm font-medium">
                      Durée de validité
                    </Label>
                    <div className="flex items-center space-x-2 mt-1">
                      <Calendar className="h-4 w-4 text-gray-500" />
                      <Input
                        id="expiration"
                        type="number"
                        min="1"
                        max="365"
                        value={expirationDays}
                        onChange={(e) => setExpirationDays(parseInt(e.target.value) || 7)}
                        className="w-20"
                      />
                      <span className="text-sm text-gray-500">jour(s)</span>
                      <div className="flex-1" />
                      <span className="text-xs text-gray-500">
                        <Clock className="h-3 w-3 inline mr-1" />
                        Expire le {new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Limitations d'usage */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center">
                    <Users className="h-4 w-4 mr-2" />
                    Limitations d&apos;usage
                  </CardTitle>
                  <CardDescription>
                    Contrôlez le nombre d&apos;utilisateurs et d&apos;utilisations
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="maxUses" className="text-sm font-medium">
                        Max utilisations
                      </Label>
                      <Input
                        id="maxUses"
                        type="number"
                        min="1"
                        value={maxUses || ''}
                        onChange={(e) => setMaxUses(e.target.value ? parseInt(e.target.value) : undefined)}
                        placeholder="Illimité"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="maxConcurrent" className="text-sm font-medium">
                        Max simultanés
                      </Label>
                      <Input
                        id="maxConcurrent"
                        type="number"
                        min="1"
                        value={maxConcurrentUsers || ''}
                        onChange={(e) => setMaxConcurrentUsers(e.target.value ? parseInt(e.target.value) : undefined)}
                        placeholder="Illimité"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="maxSessions" className="text-sm font-medium">
                        Max sessions uniques
                      </Label>
                      <Input
                        id="maxSessions"
                        type="number"
                        min="1"
                        value={maxUniqueSessions || ''}
                        onChange={(e) => setMaxUniqueSessions(e.target.value ? parseInt(e.target.value) : undefined)}
                        placeholder="Illimité"
                        className="mt-1"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Permissions des participants anonymes */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center">
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Permissions des invités
                  </CardTitle>
                  <CardDescription>
                    Définissez ce que les participants anonymes peuvent faire
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm font-medium">Envoyer des messages</Label>
                        <p className="text-xs text-gray-500">Autoriser l&apos;envoi de messages texte</p>
                      </div>
                      <Switch
                        checked={allowAnonymousMessages}
                        onCheckedChange={setAllowAnonymousMessages}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm font-medium">Partager des images</Label>
                        <p className="text-xs text-gray-500">Autoriser l&apos;envoi d&apos;images</p>
                      </div>
                      <Switch
                        checked={allowAnonymousImages}
                        onCheckedChange={setAllowAnonymousImages}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm font-medium">Partager des fichiers</Label>
                        <p className="text-xs text-gray-500">Autoriser l&apos;envoi de fichiers</p>
                      </div>
                      <Switch
                        checked={allowAnonymousFiles}
                        onCheckedChange={setAllowAnonymousFiles}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm font-medium">Voir l&apos;historique</Label>
                        <p className="text-xs text-gray-500">Accès aux anciens messages</p>
                      </div>
                      <Switch
                        checked={allowViewHistory}
                        onCheckedChange={setAllowViewHistory}
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm font-medium">Pseudo obligatoire</Label>
                        <p className="text-xs text-gray-500">Forcer la saisie d&apos;un pseudo</p>
                      </div>
                      <Switch
                        checked={requireNickname}
                        onCheckedChange={setRequireNickname}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm font-medium">Email obligatoire</Label>
                        <p className="text-xs text-gray-500">Forcer la saisie d&apos;un email</p>
                      </div>
                      <Switch
                        checked={requireEmail}
                        onCheckedChange={setRequireEmail}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Options avancées pliables */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg flex items-center">
                        <Shield className="h-4 w-4 mr-2" />
                        Restrictions de sécurité
                      </CardTitle>
                      <CardDescription>
                        Limitez l&apos;accès par pays, langue ou adresse IP
                      </CardDescription>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowAdvanced(!showAdvanced)}
                    >
                      {showAdvanced ? 'Masquer' : 'Afficher'}
                    </Button>
                  </div>
                </CardHeader>
                
                {showAdvanced && (
                  <CardContent className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium mb-2 flex items-center">
                        <Globe className="h-4 w-4 mr-1" />
                        Langues autorisées
                      </Label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-32 overflow-y-auto">
                        {SUPPORTED_LANGUAGES.map((lang) => (
                          <div key={lang.code} className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id={`lang-${lang.code}`}
                              checked={allowedLanguages.includes(lang.code)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setAllowedLanguages([...allowedLanguages, lang.code]);
                                } else {
                                  setAllowedLanguages(allowedLanguages.filter(l => l !== lang.code));
                                }
                              }}
                              className="rounded"
                            />
                            <Label htmlFor={`lang-${lang.code}`} className="text-xs flex items-center">
                              <span className="mr-1">{lang.flag}</span>
                              {lang.name}
                            </Label>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Laisser vide pour autoriser toutes les langues
                      </p>
                    </div>

                    <div>
                      <Label className="text-sm font-medium mb-2 flex items-center">
                        <Globe className="h-4 w-4 mr-1" />
                        Pays autorisés
                      </Label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-32 overflow-y-auto">
                        {SUPPORTED_COUNTRIES.map((country) => (
                          <div key={country.code} className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id={`country-${country.code}`}
                              checked={allowedCountries.includes(country.code)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setAllowedCountries([...allowedCountries, country.code]);
                                } else {
                                  setAllowedCountries(allowedCountries.filter(c => c !== country.code));
                                }
                              }}
                              className="rounded"
                            />
                            <Label htmlFor={`country-${country.code}`} className="text-xs flex items-center">
                              <span className="mr-1">{country.flag}</span>
                              {country.name}
                            </Label>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Laisser vide pour autoriser tous les pays
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="ipRanges" className="text-sm font-medium">
                        Plages d&apos;adresses IP autorisées
                      </Label>
                      <Textarea
                        id="ipRanges"
                        value={allowedIpRanges}
                        onChange={(e) => setAllowedIpRanges(e.target.value)}
                        placeholder="192.168.1.0/24&#10;10.0.0.1-10.0.0.100&#10;203.0.113.5"
                        className="mt-1 min-h-[80px] font-mono text-xs"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Une IP/plage par ligne. Formats: IP exacte, CIDR (192.168.1.0/24), ou plage (10.0.0.1-10.0.0.100)
                      </p>
                    </div>
                  </CardContent>
                )}
              </Card>
              
              {/* Actions de génération */}
              <div className="flex space-x-3 pt-4">
                <Button
                  onClick={generateLink}
                  disabled={!linkTitle.trim() || isCreating}
                  className="flex-1"
                  size="lg"
                >
                  <Link2 className="mr-2 h-4 w-4" />
                  {isCreating ? 'Génération...' : 'Créer le lien de partage'}
                </Button>
                <Button
                  onClick={handleClose}
                  variant="outline"
                  size="lg"
                >
                  Annuler
                </Button>
              </div>
            </>
          ) : (
            /* Lien généré */
            <Card>
              <CardHeader>
                <CardTitle className="text-lg text-green-700 flex items-center">
                  ✅ Lien créé avec succès !
                </CardTitle>
                <CardDescription>
                  Votre lien de partage est prêt à être utilisé
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm font-medium text-green-900 mb-2">
                    {linkTitle}
                  </p>
                  {description && (
                    <p className="text-xs text-green-700 mb-3">
                      {description}
                    </p>
                  )}
                  <div className="flex items-center space-x-2">
                    <Input
                      value={generatedLink}
                      readOnly
                      className="flex-1 text-xs bg-white"
                    />
                    <Button
                      onClick={copyLink}
                      size="sm"
                      variant="outline"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                <div className="text-sm text-gray-600 space-y-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <p>⏰ Expire dans {expirationDays} jour(s)</p>
                    <p>👥 {maxUses ? `Max ${maxUses} utilisations` : 'Utilisations illimitées'}</p>
                    <p>🔗 {maxConcurrentUsers ? `Max ${maxConcurrentUsers} simultanés` : 'Accès simultanés illimités'}</p>
                    <p>💬 {allowAnonymousMessages ? 'Messages autorisés' : 'Messages interdits'}</p>
                  </div>
                  
                  {(allowedLanguages.length > 0 || allowedCountries.length > 0) && (
                    <div className="mt-3 p-2 bg-blue-50 rounded border border-blue-200">
                      <p className="text-xs font-medium text-blue-800 mb-1">Restrictions actives:</p>
                      {allowedLanguages.length > 0 && (
                        <p className="text-xs text-blue-700">
                          🌐 Langues: {allowedLanguages.map(code => SUPPORTED_LANGUAGES.find(l => l.code === code)?.name).join(', ')}
                        </p>
                      )}
                      {allowedCountries.length > 0 && (
                        <p className="text-xs text-blue-700">
                          🌍 Pays: {allowedCountries.map(code => SUPPORTED_COUNTRIES.find(c => c.code === code)?.name).join(', ')}
                        </p>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="flex space-x-3 pt-4">
                  <Button
                    onClick={copyLink}
                    variant="outline"
                    className="flex-1"
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copier à nouveau
                  </Button>
                  <Button
                    onClick={handleClose}
                    className="flex-1"
                  >
                    Fermer
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
