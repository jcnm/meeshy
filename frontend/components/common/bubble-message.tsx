'use client';

import { useState } from 'react';
import { 
  MessageCircle,
  Globe2,
  Star,
  Copy,
  AlertTriangle,
  MapPin,
  Timer,
  Languages,
  MoreHorizontal
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import type { Message, User } from '@/types';

interface BubbleMessageProps {
  message: Message & {
    location?: string;
    originalLanguage: string;
    isTranslated: boolean;
    translatedFrom?: string;
  };
  currentUser: User;
  userLanguage: string;
}

const SUPPORTED_LANGUAGES = [
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'pt', name: 'Português', flag: '🇵🇹' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
];

export function BubbleMessage({ message, currentUser, userLanguage }: BubbleMessageProps) {
  const [showOriginal, setShowOriginal] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);

  const getLanguageInfo = (langCode: string) => {
    return SUPPORTED_LANGUAGES.find(lang => lang.code === langCode) || SUPPORTED_LANGUAGES[0];
  };

  const formatTimeAgo = (timestamp: string | Date) => {
    const now = new Date();
    const messageTime = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - messageTime.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'à l\'instant';
    if (diffInMinutes < 60) return `il y a ${diffInMinutes}min`;
    if (diffInMinutes < 1440) return `il y a ${Math.floor(diffInMinutes / 60)}h`;
    return `il y a ${Math.floor(diffInMinutes / 1440)}j`;
  };

  const handleReply = () => {
    toast.info('Fonction de réponse à venir');
  };

  const handleTranslateToggle = () => {
    if (message.isTranslated) {
      setShowOriginal(!showOriginal);
    } else {
      toast.info('Ce message est déjà dans votre langue');
    }
  };

  const handleFavorite = () => {
    setIsFavorited(!isFavorited);
    toast.success(isFavorited ? 'Retiré des favoris' : 'Ajouté aux favoris');
  };

  const handleCopyLink = () => {
    const link = `${window.location.origin}/message/${message.id}`;
    navigator.clipboard.writeText(link);
    toast.success('Lien copié !');
  };

  const handleReport = () => {
    toast.info('Message signalé - Merci pour votre vigilance');
  };

  const originalLangInfo = getLanguageInfo(message.originalLanguage);
  const isOwnMessage = message.senderId === currentUser.id;

  // Simuler le contenu traduit/original
  const displayContent = message.isTranslated && !showOriginal 
    ? `[Traduit de ${originalLangInfo.name}] ${message.content}`
    : message.content;

  return (
    <Card 
      className={`bubble-message relative transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${
        isOwnMessage ? 'bg-blue-50 border-blue-200' : 'bg-white'
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <CardContent className="p-4">
        {/* Header du message */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={message.sender?.avatar} alt={message.sender?.firstName} />
              <AvatarFallback>
                {message.sender?.firstName?.charAt(0)}{message.sender?.lastName?.charAt(0)}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <span className="font-medium text-gray-900">
                  @{message.sender?.username}
                </span>
                <span className="text-gray-500">•</span>
                <span className="text-sm text-gray-500 flex items-center">
                  <Timer className="h-3 w-3 mr-1" />
                  {formatTimeAgo(message.createdAt)}
                </span>
                {message.location && (
                  <>
                    <span className="text-gray-500">•</span>
                    <span className="text-sm text-gray-500 flex items-center">
                      <MapPin className="h-3 w-3 mr-1" />
                      {message.location}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Indicateur de langue originale */}
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="text-xs">
              <span className="mr-1">{originalLangInfo.flag}</span>
              {originalLangInfo.code.toUpperCase()}
            </Badge>
          </div>
        </div>

          {/* Contenu du message */}
        <div className={`mb-3 ${message.isTranslated && showOriginal !== (message.originalLanguage === userLanguage) ? 'translation-flip' : ''}`}>
          <p className="text-gray-900 leading-relaxed whitespace-pre-wrap">
            {displayContent}
          </p>
          
          {/* Indicateur de traduction */}
          {message.isTranslated && (
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-gray-500 italic flex items-center">
                <Languages className="h-3 w-3 mr-1" />
                {showOriginal ? 'Version originale' : `Traduit de ${originalLangInfo.name}`}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleTranslateToggle}
                className="text-xs text-blue-600 hover:text-blue-800 p-0 h-auto"
              >
                {showOriginal ? 'Voir la traduction' : 'Voir l\'original'}
              </Button>
            </div>
          )}
        </div>

        {/* Actions (apparaissent au survol) */}
        <div className={`flex items-center justify-between transition-opacity duration-200 ${
          isHovered ? 'opacity-100' : 'opacity-0'
        }`}>
          <div className="flex items-center space-x-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReply}
              className="action-icon text-gray-500 hover:text-blue-600 hover:bg-blue-50 p-2"
              title="Répondre"
            >
              <MessageCircle className="h-4 w-4" />
            </Button>

            {/* Traduire/Langue originale */}
            {message.isTranslated && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleTranslateToggle}
                className="action-icon text-gray-500 hover:text-green-600 hover:bg-green-50 p-2"
                title={showOriginal ? 'Voir la traduction' : 'Voir l\'original'}
              >
                <Globe2 className="h-4 w-4" />
              </Button>
            )}

            {/* Favoris */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleFavorite}
              className={`action-icon p-2 ${
                isFavorited 
                  ? 'text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50' 
                  : 'text-gray-500 hover:text-yellow-600 hover:bg-yellow-50'
              }`}
              title="Ajouter aux favoris"
            >
              <Star className={`h-4 w-4 ${isFavorited ? 'fill-current' : ''}`} />
            </Button>

            {/* Copier lien */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyLink}
              className="action-icon text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 p-2"
              title="Copier le lien"
            >
              <Copy className="h-4 w-4" />
            </Button>

            {/* Signaler */}
            {!isOwnMessage && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReport}
                className="action-icon text-gray-500 hover:text-red-600 hover:bg-red-50 p-2"
                title="Signaler"
              >
                <AlertTriangle className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Menu plus d'options */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-gray-500 hover:text-gray-700 p-2"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleReply}>
                <MessageCircle className="mr-2 h-4 w-4" />
                <span>Répondre</span>
              </DropdownMenuItem>
              
              {message.isTranslated && (
                <DropdownMenuItem onClick={handleTranslateToggle}>
                  <Globe2 className="mr-2 h-4 w-4" />
                  <span>{showOriginal ? 'Voir la traduction' : 'Voir l\'original'}</span>
                </DropdownMenuItem>
              )}
              
              <DropdownMenuItem onClick={handleFavorite}>
                <Star className="mr-2 h-4 w-4" />
                <span>{isFavorited ? 'Retirer des favoris' : 'Ajouter aux favoris'}</span>
              </DropdownMenuItem>
              
              <DropdownMenuItem onClick={handleCopyLink}>
                <Copy className="mr-2 h-4 w-4" />
                <span>Copier le lien</span>
              </DropdownMenuItem>
              
              {!isOwnMessage && (
                <DropdownMenuItem onClick={handleReport} className="text-red-600">
                  <AlertTriangle className="mr-2 h-4 w-4" />
                  <span>Signaler</span>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}
