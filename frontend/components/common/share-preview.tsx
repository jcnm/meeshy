'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Share2, 
  Copy, 
  ExternalLink, 
  MessageSquare, 
  Users, 
  Globe,
  UserPlus,
  CheckCircle
} from 'lucide-react';
import { toast } from 'sonner';

interface SharePreviewProps {
  url: string;
  type: 'affiliate' | 'conversation' | 'join' | 'default';
  affiliateToken?: string;
  linkId?: string;
  className?: string;
}

interface MetadataData {
  title: string;
  description: string;
  image: string;
  url: string;
  type: string;
  siteName: string;
  locale: string;
}

export function SharePreview({ 
  url, 
  type, 
  affiliateToken, 
  linkId, 
  className = "" 
}: SharePreviewProps) {
  const [metadata, setMetadata] = useState<MetadataData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchMetadata();
  }, [type, affiliateToken, linkId]);

  const fetchMetadata = async () => {
    try {
      setIsLoading(true);
      
      const params = new URLSearchParams({
        type,
        ...(affiliateToken && { affiliate: affiliateToken }),
        ...(linkId && { linkId }),
      });

      const response = await fetch(`/api/metadata?${params}`);
      
      if (response.ok) {
        const data = await response.json();
        setMetadata(data);
      } else {
        // Fallback vers des métadonnées par défaut
        setMetadata({
          title: 'Meeshy - Messagerie Multilingue en Temps Réel',
          description: 'Connectez-vous avec le monde entier grâce à Meeshy, la plateforme de messagerie multilingue avec traduction automatique en temps réel.',
          image: '/images/meeshy-og-default.jpg',
          url,
          type: 'website',
          siteName: 'Meeshy',
          locale: 'fr_FR'
        });
      }
    } catch (error) {
      console.error('Erreur récupération métadonnées:', error);
      // Métadonnées de fallback
      setMetadata({
        title: 'Meeshy - Messagerie Multilingue en Temps Réel',
        description: 'Connectez-vous avec le monde entier grâce à Meeshy.',
        image: '/images/meeshy-og-default.jpg',
        url,
        type: 'website',
        siteName: 'Meeshy',
        locale: 'fr_FR'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('Lien copié dans le presse-papiers !');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Erreur lors de la copie du lien');
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: metadata?.title || 'Meeshy',
          text: metadata?.description || 'Rejoignez Meeshy !',
          url: url,
        });
      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError') {
          toast.error('Erreur lors du partage');
        }
      }
    } else {
      handleCopyLink();
    }
  };

  const getTypeIcon = () => {
    switch (type) {
      case 'affiliate':
        return <UserPlus className="h-4 w-4" />;
      case 'conversation':
        return <MessageSquare className="h-4 w-4" />;
      case 'join':
        return <Users className="h-4 w-4" />;
      default:
        return <Globe className="h-4 w-4" />;
    }
  };

  const getTypeLabel = () => {
    switch (type) {
      case 'affiliate':
        return 'Lien d\'invitation';
      case 'conversation':
        return 'Conversation';
      case 'join':
        return 'Rejoindre';
      default:
        return 'Lien Meeshy';
    }
  };

  if (isLoading) {
    return (
      <Card className={`w-full max-w-md ${className}`}>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <span className="text-sm text-gray-600">Chargement de l'aperçu...</span>
          </div>
        </CardHeader>
      </Card>
    );
  }

  if (!metadata) {
    return null;
  }

  return (
    <Card className={`w-full max-w-md ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center space-x-2">
            {getTypeIcon()}
            <span>Aperçu du partage</span>
          </CardTitle>
          <Badge variant="secondary" className="text-xs">
            {getTypeLabel()}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Aperçu de la carte sociale */}
        <div className="border rounded-lg overflow-hidden bg-white">
          <div className="aspect-video bg-gradient-to-br from-blue-50 to-indigo-100 relative">
            {metadata.image && (
              <img 
                src={metadata.image} 
                alt={metadata.title}
                className="w-full h-full object-cover"
                onError={(e) => {
                  // Fallback vers une image par défaut si l'image échoue
                  e.currentTarget.src = '/images/meeshy-og-default.jpg';
                }}
              />
            )}
            <div className="absolute bottom-2 right-2">
              <div className="bg-white/90 backdrop-blur-sm rounded-full p-2">
                <MessageSquare className="h-4 w-4 text-blue-600" />
              </div>
            </div>
          </div>
          
          <div className="p-3 space-y-2">
            <h3 className="font-semibold text-sm line-clamp-2 text-gray-900">
              {metadata.title}
            </h3>
            <p className="text-xs text-gray-600 line-clamp-2">
              {metadata.description}
            </p>
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>{metadata.siteName}</span>
              <ExternalLink className="h-3 w-3" />
            </div>
          </div>
        </div>

        {/* Actions de partage */}
        <div className="flex space-x-2">
          <Button 
            onClick={handleShare}
            className="flex-1"
            size="sm"
          >
            <Share2 className="h-4 w-4 mr-2" />
            Partager
          </Button>
          
          <Button 
            onClick={handleCopyLink}
            variant="outline"
            size="sm"
            className="flex-1"
          >
            {copied ? (
              <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
            ) : (
              <Copy className="h-4 w-4 mr-2" />
            )}
            {copied ? 'Copié' : 'Copier'}
          </Button>
        </div>

        {/* URL complète */}
        <div className="text-xs text-gray-500 break-all bg-gray-50 p-2 rounded">
          {url}
        </div>
      </CardContent>
    </Card>
  );
}
