'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { 
  MessageSquare, 
  Bell, 
  Search,
  LogOut,
  Settings,
  User as UserIcon,
  Home,
  Users,
  UserPlus,
  Link as LinkIcon,
  ChevronDown,
  Shield,
  Brain,
  Globe2,
  Send,
  MessageCircle,
  Star,
  Copy,
  AlertTriangle,
  Languages,
  MapPin,
  Timer,
  TrendingUp,
  Hash,
  MoreHorizontal,
  ChevronUp
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BubbleMessage } from '@/components/common/bubble-message';
import { useMessaging } from '@/hooks/use-messaging';
import { useNotifications } from '@/hooks/use-notifications';
import type { User, Message } from '@/types';
import { buildApiUrl, API_ENDPOINTS } from '@/lib/config';

interface LanguageStats {
  language: string;
  flag: string;
  count: number;
  color: string;
}

interface BubbleStreamMessage extends Message {
  location?: string;
  originalLanguage: string;
  isTranslated: boolean;
  translatedFrom?: string;
}

interface BubbleStreamPageProps {
  user: User;
}

const SUPPORTED_LANGUAGES = [
  { code: 'fr', name: 'Français', flag: '🇫🇷', color: 'bg-blue-500' },
  { code: 'en', name: 'English', flag: '🇬🇧', color: 'bg-red-500' },
  { code: 'es', name: 'Español', flag: '🇪🇸', color: 'bg-yellow-500' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪', color: 'bg-gray-800' },
  { code: 'pt', name: 'Português', flag: '🇵🇹', color: 'bg-green-500' },
  { code: 'zh', name: '中文', flag: '🇨🇳', color: 'bg-red-600' },
  { code: 'ja', name: '日本語', flag: '🇯🇵', color: 'bg-white border' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦', color: 'bg-green-600' },
];

const MAX_MESSAGE_LENGTH = 300;

// Composant pour les indicateurs de langues - affichage vertical seulement
interface LanguageIndicatorsProps {
  languageStats: LanguageStats[];
}

function LanguageIndicators({ languageStats }: LanguageIndicatorsProps) {
  const sortedStats = [...languageStats].sort((a, b) => b.count - a.count);
  
  // Layout vertical pour la sidebar avec scroll après les 7 premiers
  return (
    <div className="space-y-2">
      {/* Affichage des 7 premiers langages */}
      {sortedStats.slice(0, 7).map((stat) => (
        <div key={stat.language} className="flex items-center justify-between p-2 rounded hover:bg-gray-50/80 cursor-pointer transition-colors">
          <div className="flex items-center space-x-2">
            <span className="text-lg">{stat.flag}</span>
            <span className="text-sm font-medium">
              {SUPPORTED_LANGUAGES.find(l => l.code === stat.language)?.name || stat.language}
            </span>
          </div>
          <Badge variant="outline" className="text-xs bg-white/50">
            {stat.count}
          </Badge>
        </div>
      ))}
      
      {/* Section scrollable pour les langages restants */}
      {sortedStats.length > 7 && (
        <div className="max-h-32 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent space-y-2 pr-1">
          {sortedStats.slice(7).map((stat) => (
            <div key={stat.language} className="flex items-center justify-between p-2 rounded hover:bg-gray-50/80 cursor-pointer transition-colors">
              <div className="flex items-center space-x-2">
                <span className="text-lg">{stat.flag}</span>
                <span className="text-sm font-medium">
                  {SUPPORTED_LANGUAGES.find(l => l.code === stat.language)?.name || stat.language}
                </span>
              </div>
              <Badge variant="outline" className="text-xs bg-white/50">
                {stat.count}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Composant pour une section foldable générique
interface FoldableSectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}

function FoldableSection({ title, icon, children, defaultExpanded = true }: FoldableSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <Card className="mb-6 bg-white/80 backdrop-blur-sm border-gray-200/50 shadow-lg">
      <CardContent className="p-0">
        {/* Header cliquable */}
        <div 
          className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50/50 transition-colors"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <h3 className="font-semibold text-gray-900 flex items-center">
            {icon}
            {title}
          </h3>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          )}
        </div>
        
        {/* Contenu */}
        {isExpanded && (
          <div className="px-4 pb-4 border-t border-gray-100">
            <div className="mt-3">
              {children}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Composant pour les langues dans le header de la sidebar
interface SidebarLanguageHeaderProps {
  languageStats: LanguageStats[];
  userLanguage: string;
}

function SidebarLanguageHeader({ languageStats, userLanguage }: SidebarLanguageHeaderProps) {
  const topLanguages = [...languageStats]
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return (
    <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200/50">
      <h2 className="font-semibold text-gray-900 mb-3 flex items-center">
        <Globe2 className="h-4 w-4 mr-2" />
        Communication Globale
      </h2>
      <div className="flex flex-wrap gap-2 mb-3">
        {topLanguages.map((stat) => (
          <div 
            key={stat.language}
            className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs transition-colors ${
              stat.language === userLanguage 
                ? 'bg-blue-500 text-white' 
                : 'bg-white/80 text-gray-700 hover:bg-white'
            }`}
          >
            <span>{stat.flag}</span>
            <span className="font-medium">{stat.count}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-600">
        <span className="font-medium">{languageStats.reduce((sum, stat) => sum + stat.count, 0)}</span> messages 
        en <span className="font-medium">{languageStats.length}</span> langues actives
      </p>
    </div>
  );
}

export function  BubbleStreamPage({ user }: BubbleStreamPageProps) {
  const router = useRouter();
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // États
  const [messages, setMessages] = useState<BubbleStreamMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [detectedLanguage, setDetectedLanguage] = useState<string>('fr');
  const [userLanguage, setUserLanguage] = useState<string>(user.systemLanguage || 'fr');
  const [languageStats, setLanguageStats] = useState<LanguageStats[]>([]);
  const [isComposingEnabled, setIsComposingEnabled] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [location, setLocation] = useState<string>('');
  const [trendingHashtags, setTrendingHashtags] = useState<string[]>([]);
  const [activeUsers, setActiveUsers] = useState<User[]>([]);
  const [isDemoMode, setIsDemoMode] = useState(true); // Mode démo par défaut

  // Hooks
  const { 
    sendMessage: sendMessageToService,
    connectionStatus,
    startTyping,
    stopTyping
  } = useMessaging({
    conversationId: 'global_stream', // Conversation globale pour le stream
    currentUser: user,
    onNewMessage: handleNewMessage,
  });

  const { notifications, markAsRead } = useNotifications();

  // Hook pour détecter le statut de connexion réel
  useEffect(() => {
    const checkConnection = () => {
      const isReallyConnected = connectionStatus.isConnected && connectionStatus.hasSocket;
      setIsDemoMode(!isReallyConnected);
      console.log('🔌 Statut connexion vérifié:', { 
        isReallyConnected, 
        isDemoMode: !isReallyConnected,
        connectionStatus 
      });
    };

    checkConnection();
    
    // Vérifier périodiquement le statut
    const interval = setInterval(checkConnection, 5000);
    return () => clearInterval(interval);
  }, [connectionStatus]);

  // Géolocalisation
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            // Optionnel : Convertir les coordonnées en ville/région
            // Pour cet exemple, on utilise une ville par défaut
            setLocation('Paris');
          } catch (error) {
            console.error('Erreur géolocalisation:', error);
          }
        },
        (error) => {
          console.log('Géolocalisation non disponible');
        }
      );
    }
  }, []);

  // Détection automatique de langue
  useEffect(() => {
    if (newMessage.trim().length > 10) {
      // Simulation de détection de langue basique
      const detectLanguage = (text: string) => {
        const patterns = {
          fr: /\b(le|la|les|de|du|des|et|ou|un|une|ce|cette|pour|dans|avec|sur|par)\b/gi,
          en: /\b(the|and|or|a|an|this|that|for|in|with|on|by|from|to)\b/gi,
          es: /\b(el|la|los|las|de|del|y|o|un|una|este|esta|para|en|con|por)\b/gi,
          de: /\b(der|die|das|und|oder|ein|eine|dieser|diese|für|in|mit|auf|von)\b/gi,
        };

        for (const [lang, pattern] of Object.entries(patterns)) {
          if (pattern.test(text)) {
            return lang;
          }
        }
        return 'fr'; // Par défaut
      };

      setDetectedLanguage(detectLanguage(newMessage));
    }
  }, [newMessage]);

  // Mise à jour des statistiques de langues
  useEffect(() => {
    const updateLanguageStats = () => {
      const stats = SUPPORTED_LANGUAGES.map(lang => {
        const count = messages.filter(msg => 
          msg.originalLanguage === lang.code
        ).length;
        
        return {
          language: lang.code,
          flag: lang.flag,
          count: Math.max(1, count + Math.floor(Math.random() * 50)), // Simulation
          color: lang.color
        };
      }).filter(stat => stat.count > 0);

      setLanguageStats(stats);
    };

    updateLanguageStats();
    const interval = setInterval(updateLanguageStats, 30000); // Mise à jour toutes les 30s

    return () => clearInterval(interval);
  }, [messages]);

  // Simulation de messages existants pour la démo
  useEffect(() => {
    // Génération de 30 messages de démonstration
    const generateDemoMessages = (): BubbleStreamMessage[] => {
      const demoUsers = [
        { id: '1', username: 'alice_fr', firstName: 'Alice', lastName: 'Martin', systemLanguage: 'fr', flag: '🇫🇷', location: 'Paris' },
        { id: '2', username: 'bob_en', firstName: 'Bob', lastName: 'Smith', systemLanguage: 'en', flag: '�🇧', location: 'London' },
        { id: '3', username: 'carlos_es', firstName: 'Carlos', lastName: 'Rodriguez', systemLanguage: 'es', flag: '🇪🇸', location: 'Madrid' },
        { id: '4', username: 'marie_fr', firstName: 'Marie', lastName: 'Dubois', systemLanguage: 'fr', flag: '🇫🇷', location: 'Lyon' },
        { id: '5', username: 'hans_de', firstName: 'Hans', lastName: 'Mueller', systemLanguage: 'de', flag: '🇩🇪', location: 'Berlin' },
        { id: '6', username: 'sofia_pt', firstName: 'Sofia', lastName: 'Silva', systemLanguage: 'pt', flag: '🇵🇹', location: 'Lisbon' },
        { id: '7', username: 'li_zh', firstName: 'Li', lastName: 'Wei', systemLanguage: 'zh', flag: '🇨🇳', location: 'Beijing' },
        { id: '8', username: 'yuki_ja', firstName: 'Yuki', lastName: 'Tanaka', systemLanguage: 'ja', flag: '🇯🇵', location: 'Tokyo' },
      ];

      const demoTexts = {
        fr: [
          'Bonjour tout le monde ! 🌍 Ravi de découvrir cette plateforme incroyable !',
          'Cette technologie de traduction en temps réel est vraiment impressionnante 🚀',
          'J\'adore pouvoir communiquer avec des personnes du monde entier sans barrière linguistique',
          'Meeshy révolutionne vraiment la communication internationale ! 💫',
          'C\'est fantastique de voir tous ces drapeaux qui représentent notre diversité',
          'La qualité de traduction est remarquable, bravo à l\'équipe ! 👏',
          'Je suis fasciné par cette interface si intuitive et moderne',
          'Enfin une solution qui unit vraiment les cultures ! 🌈'
        ],
        en: [
          'Hello everyone! 👋 This multilingual platform is absolutely amazing!',
          'I\'m impressed by the real-time translation capabilities 🤖',
          'Connecting with people from different cultures has never been easier!',
          'The seamless communication across languages is mind-blowing 🤯',
          'Love seeing all these flags representing our global community 🌎',
          'This is the future of international communication! 🚀',
          'The AI translation quality is surprisingly accurate',
          'Great job on creating such an inclusive platform! 🎉'
        ],
        es: [
          '¡Hola a todos! 🇪🇸 Esta plataforma es increíblemente innovadora',
          'Me encanta poder hablar con gente de todo el mundo sin problemas',
          'La traducción automática funciona de maravilla 🔥',
          '¡Esto sí que es romper las barreras del idioma! 💪',
          'Qué emocionante ver tantas culturas unidas aquí',
          'La interfaz es muy intuitiva y fácil de usar 👌',
          'Felicidades por esta extraordinaria herramienta',
          '¡El futuro de la comunicación global está aquí! 🌟'
        ],
        de: [
          'Hallo alle zusammen! 🇩🇪 Diese Plattform ist wirklich beeindruckend',
          'Die Echtzeitübersetzung funktioniert fantastisch! ⚡',
          'Endlich können wir alle miteinander sprechen',
          'Diese Technologie wird die Welt verändern 🌍',
          'Ich bin begeistert von der Benutzerfreundlichkeit',
          'Großartige Arbeit beim Design dieser App! 🎨',
          'Die KI-Übersetzung ist erstaunlich präzise',
          'Das ist wahre Innovation in der Kommunikation! 💡'
        ],
        pt: [
          'Olá pessoal! 🇵🇹 Esta plataforma é realmente inovadora',
          'Adoro poder comunicar com pessoas de todo o mundo! 🌎',
          'A tradução em tempo real é simplesmente fantástica',
          'Finalmente uma ferramenta que une culturas 🤝',
          'A qualidade da tradução é impressionante',
          'Parabéns pela interface tão bem projetada! 🎯',
          'Isto vai revolucionar a comunicação global',
          'Que tecnologia incrível para quebrar barreiras! 🚀'
        ],
        zh: [
          '大家好！🇨🇳 这个多语言平台太棒了！',
          '实时翻译技术真的很令人印象深刻 🤖',
          '能够与世界各地的人交流真是太好了',
          '这种无缝的跨语言交流太神奇了！',
          '看到这么多国旗代表我们的全球社区真棒 🌍',
          '这就是国际交流的未来！',
          'AI翻译的质量令人惊讶地准确',
          '创建如此包容的平台做得很好！ 👏'
        ],
        ja: [
          'こんにちはみなさん！🇯� この多言語プラットフォームは素晴らしいです！',
          'リアルタイム翻訳機能に感動しています 🚀',
          '異なる文化の人々とのつながりがこんなに簡単になるなんて',
          '言語を超えたシームレスなコミュニケーションは驚異的です',
          '世界中からの参加者を表す旗を見るのが大好きです 🌈',
          'これは国際コミュニケーションの未来ですね！',
          'AI翻訳の品質は驚くほど正確です',
          'こんな包括的なプラットフォームを作ってくれてありがとう！ 🎉'
        ]
      };

      const messages: BubbleStreamMessage[] = [];
      
      for (let i = 0; i < 30; i++) {
        const user = demoUsers[i % demoUsers.length];
        const lang = user.systemLanguage as keyof typeof demoTexts;
        const texts = demoTexts[lang];
        const content = texts[i % texts.length];
        
        const baseUser = {
          ...user,
          email: `${user.username}@email.com`,
          avatar: '',
          role: 'USER' as const,
          permissions: {
            canAccessAdmin: false,
            canManageUsers: false,
            canManageGroups: false,
            canManageConversations: false,
            canViewAnalytics: false,
            canModerateContent: false,
            canViewAuditLogs: false,
            canManageNotifications: false,
            canManageTranslations: false,
          },
          regionalLanguage: user.systemLanguage,
          autoTranslateEnabled: true,
          translateToSystemLanguage: true,
          translateToRegionalLanguage: false,
          useCustomDestination: false,
          isOnline: true,
          lastSeen: new Date(),
          createdAt: new Date(),
          lastActiveAt: new Date()
        };

        messages.push({
          id: `demo-${i + 1}`,
          conversationId: 'global_stream',
          senderId: user.id,
          content,
          originalLanguage: user.systemLanguage,
          isTranslated: userLanguage !== user.systemLanguage,
          translatedFrom: userLanguage !== user.systemLanguage ? user.systemLanguage : undefined,
          isEdited: false,
          createdAt: new Date(Date.now() - (30 - i) * 2 * 60 * 1000), // Messages espacés de 2 minutes
          updatedAt: new Date(Date.now() - (30 - i) * 2 * 60 * 1000),
          location: user.location,
          sender: baseUser
        });
      }

      return messages.reverse(); // Plus récents en premier
    };

    const demoMessages = generateDemoMessages();
    setMessages(demoMessages);
    console.log('Messages de démo initialisés:', demoMessages.length);
  }, [userLanguage]);

  // Chargement des données trending et simulation de messages entrants
  useEffect(() => {
    // Simulation des hashtags tendances - Plus de 7 pour tester le scroll
    setTrendingHashtags([
      '#meeshy', '#multilingual', '#chat', '#translation', '#connect', 
      '#realtime', '#languages', '#global', '#community', '#innovation',
      '#communication', '#technology', '#ai', '#international', '#diversity'
    ]);
    
    // Premier message d'accueil après quelques secondes en mode démo
    const welcomeTimeout = setTimeout(() => {
      if (isDemoMode) {
        const welcomeMessage: BubbleStreamMessage = {
          id: `welcome-msg-${Date.now()}`,
          conversationId: 'global_stream',
          senderId: 'meeshy_bot',
          content: '🎉 Bienvenue sur Meeshy ! Les messages arrivent automatiquement toutes les 15-25 secondes en mode démo.',
          originalLanguage: 'fr',
          isTranslated: false,
          isEdited: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          location: 'Global',
          sender: {
            id: 'meeshy_bot',
            username: 'meeshy_bot',
            firstName: 'Meeshy',
            lastName: 'Bot',
            email: 'bot@meeshy.com',
            avatar: '',
            role: 'USER' as const,
            permissions: {
              canAccessAdmin: false,
              canManageUsers: false,
              canManageGroups: false,
              canManageConversations: false,
              canViewAnalytics: false,
              canModerateContent: false,
              canViewAuditLogs: false,
              canManageNotifications: false,
              canManageTranslations: false,
            },
            systemLanguage: 'fr',
            regionalLanguage: 'fr',
            autoTranslateEnabled: true,
            translateToSystemLanguage: true,
            translateToRegionalLanguage: false,
            useCustomDestination: false,
            isOnline: true,
            lastSeen: new Date(),
            createdAt: new Date(),
            lastActiveAt: new Date()
          }
        };

        setMessages(prev => [welcomeMessage, ...prev]);
        toast.info('🤖 Message de bienvenue du bot Meeshy !', { duration: 4000 });
        console.log('🤖 Message de bienvenue ajouté');
      }
    }, 5000); // Après 5 secondes

    // Simulation des utilisateurs actifs avec des objets User complets - Plus de 7 pour tester le scroll
    setActiveUsers([
      { 
        id: '1', 
        username: 'alice_fr', 
        firstName: 'Alice', 
        lastName: 'Martin', 
        email: 'alice@example.com',
        avatar: '',
        role: 'USER' as const,
        permissions: {
          canAccessAdmin: false,
          canManageUsers: false,
          canManageGroups: false,
          canManageConversations: false,
          canViewAnalytics: false,
          canModerateContent: false,
          canViewAuditLogs: false,
          canManageNotifications: false,
          canManageTranslations: false,
        },
        systemLanguage: 'fr',
        regionalLanguage: 'fr',
        autoTranslateEnabled: true,
        translateToSystemLanguage: true,
        translateToRegionalLanguage: false,
        useCustomDestination: false,
        isOnline: true,
        lastSeen: new Date(),
        createdAt: new Date(),
        lastActiveAt: new Date()
      },
      { 
        id: '2', 
        username: 'bob_en', 
        firstName: 'Bob', 
        lastName: 'Smith', 
        email: 'bob@example.com',
        avatar: '',
        role: 'USER' as const,
        permissions: {
          canAccessAdmin: false,
          canManageUsers: false,
          canManageGroups: false,
          canManageConversations: false,
          canViewAnalytics: false,
          canModerateContent: false,
          canViewAuditLogs: false,
          canManageNotifications: false,
          canManageTranslations: false,
        },
        systemLanguage: 'en',
        regionalLanguage: 'en',
        autoTranslateEnabled: true,
        translateToSystemLanguage: true,
        translateToRegionalLanguage: false,
        useCustomDestination: false,
        isOnline: true,
        lastSeen: new Date(),
        createdAt: new Date(),
        lastActiveAt: new Date()
      },
      { 
        id: '3', 
        username: 'carlos_es', 
        firstName: 'Carlos', 
        lastName: 'Rodriguez', 
        email: 'carlos@example.com',
        avatar: '',
        role: 'USER' as const,
        permissions: {
          canAccessAdmin: false,
          canManageUsers: false,
          canManageGroups: false,
          canManageConversations: false,
          canViewAnalytics: false,
          canModerateContent: false,
          canViewAuditLogs: false,
          canManageNotifications: false,
          canManageTranslations: false,
        },
        systemLanguage: 'es',
        regionalLanguage: 'es',
        autoTranslateEnabled: true,
        translateToSystemLanguage: true,
        translateToRegionalLanguage: false,
        useCustomDestination: false,
        isOnline: true,
        lastSeen: new Date(),
        createdAt: new Date(),
        lastActiveAt: new Date()
      },
      {
        id: '4',
        username: 'marie_fr',
        firstName: 'Marie',
        lastName: 'Dubois',
        email: 'marie@example.com',
        avatar: '',
        role: 'USER' as const,
        permissions: {
          canAccessAdmin: false,
          canManageUsers: false,
          canManageGroups: false,
          canManageConversations: false,
          canViewAnalytics: false,
          canModerateContent: false,
          canViewAuditLogs: false,
          canManageNotifications: false,
          canManageTranslations: false,
        },
        systemLanguage: 'fr',
        regionalLanguage: 'fr',
        autoTranslateEnabled: true,
        translateToSystemLanguage: true,
        translateToRegionalLanguage: false,
        useCustomDestination: false,
        isOnline: true,
        lastSeen: new Date(),
        createdAt: new Date(),
        lastActiveAt: new Date()
      },
      {
        id: '5',
        username: 'hans_de',
        firstName: 'Hans',
        lastName: 'Mueller',
        email: 'hans@example.com',
        avatar: '',
        role: 'USER' as const,
        permissions: {
          canAccessAdmin: false,
          canManageUsers: false,
          canManageGroups: false,
          canManageConversations: false,
          canViewAnalytics: false,
          canModerateContent: false,
          canViewAuditLogs: false,
          canManageNotifications: false,
          canManageTranslations: false,
        },
        systemLanguage: 'de',
        regionalLanguage: 'de',
        autoTranslateEnabled: true,
        translateToSystemLanguage: true,
        translateToRegionalLanguage: false,
        useCustomDestination: false,
        isOnline: true,
        lastSeen: new Date(),
        createdAt: new Date(),
        lastActiveAt: new Date()
      },
      {
        id: '6',
        username: 'sofia_pt',
        firstName: 'Sofia',
        lastName: 'Silva',
        email: 'sofia@example.com',
        avatar: '',
        role: 'USER' as const,
        permissions: {
          canAccessAdmin: false,
          canManageUsers: false,
          canManageGroups: false,
          canManageConversations: false,
          canViewAnalytics: false,
          canModerateContent: false,
          canViewAuditLogs: false,
          canManageNotifications: false,
          canManageTranslations: false,
        },
        systemLanguage: 'pt',
        regionalLanguage: 'pt',
        autoTranslateEnabled: true,
        translateToSystemLanguage: true,
        translateToRegionalLanguage: false,
        useCustomDestination: false,
        isOnline: true,
        lastSeen: new Date(),
        createdAt: new Date(),
        lastActiveAt: new Date()
      },
      {
        id: '7',
        username: 'li_zh',
        firstName: 'Li',
        lastName: 'Wei',
        email: 'li@example.com',
        avatar: '',
        role: 'USER' as const,
        permissions: {
          canAccessAdmin: false,
          canManageUsers: false,
          canManageGroups: false,
          canManageConversations: false,
          canViewAnalytics: false,
          canModerateContent: false,
          canViewAuditLogs: false,
          canManageNotifications: false,
          canManageTranslations: false,
        },
        systemLanguage: 'zh',
        regionalLanguage: 'zh',
        autoTranslateEnabled: true,
        translateToSystemLanguage: true,
        translateToRegionalLanguage: false,
        useCustomDestination: false,
        isOnline: true,
        lastSeen: new Date(),
        createdAt: new Date(),
        lastActiveAt: new Date()
      },
      {
        id: '8',
        username: 'yuki_ja',
        firstName: 'Yuki',
        lastName: 'Tanaka',
        email: 'yuki@example.com',
        avatar: '',
        role: 'USER' as const,
        permissions: {
          canAccessAdmin: false,
          canManageUsers: false,
          canManageGroups: false,
          canManageConversations: false,
          canViewAnalytics: false,
          canModerateContent: false,
          canViewAuditLogs: false,
          canManageNotifications: false,
          canManageTranslations: false,
        },
        systemLanguage: 'ja',
        regionalLanguage: 'ja',
        autoTranslateEnabled: true,
        translateToSystemLanguage: true,
        translateToRegionalLanguage: false,
        useCustomDestination: false,
        isOnline: true,
        lastSeen: new Date(),
        createdAt: new Date(),
        lastActiveAt: new Date()
      },
      {
        id: '9',
        username: 'ahmed_ar',
        firstName: 'Ahmed',
        lastName: 'Hassan',
        email: 'ahmed@example.com',
        avatar: '',
        role: 'USER' as const,
        permissions: {
          canAccessAdmin: false,
          canManageUsers: false,
          canManageGroups: false,
          canManageConversations: false,
          canViewAnalytics: false,
          canModerateContent: false,
          canViewAuditLogs: false,
          canManageNotifications: false,
          canManageTranslations: false,
        },
        systemLanguage: 'ar',
        regionalLanguage: 'ar',
        autoTranslateEnabled: true,
        translateToSystemLanguage: true,
        translateToRegionalLanguage: false,
        useCustomDestination: false,
        isOnline: true,
        lastSeen: new Date(),
        createdAt: new Date(),
        lastActiveAt: new Date()
      },
      {
        id: '10',
        username: 'elena_ru',
        firstName: 'Elena',
        lastName: 'Volkov',
        email: 'elena@example.com',
        avatar: '',
        role: 'USER' as const,
        permissions: {
          canAccessAdmin: false,
          canManageUsers: false,
          canManageGroups: false,
          canManageConversations: false,
          canViewAnalytics: false,
          canModerateContent: false,
          canViewAuditLogs: false,
          canManageNotifications: false,
          canManageTranslations: false,
        },
        systemLanguage: 'ru',
        regionalLanguage: 'ru',
        autoTranslateEnabled: true,
        translateToSystemLanguage: true,
        translateToRegionalLanguage: false,
        useCustomDestination: false,
        isOnline: true,
        lastSeen: new Date(),
        createdAt: new Date(),
        lastActiveAt: new Date()
      },
      {
        id: '11',
        username: 'priya_hi',
        firstName: 'Priya',
        lastName: 'Sharma',
        email: 'priya@example.com',
        avatar: '',
        role: 'USER' as const,
        permissions: {
          canAccessAdmin: false,
          canManageUsers: false,
          canManageGroups: false,
          canManageConversations: false,
          canViewAnalytics: false,
          canModerateContent: false,
          canViewAuditLogs: false,
          canManageNotifications: false,
          canManageTranslations: false,
        },
        systemLanguage: 'hi',
        regionalLanguage: 'hi',
        autoTranslateEnabled: true,
        translateToSystemLanguage: true,
        translateToRegionalLanguage: false,
        useCustomDestination: false,
        isOnline: true,
        lastSeen: new Date(),
        createdAt: new Date(),
        lastActiveAt: new Date()
      },
      {
        id: '12',
        username: 'giovanni_it',
        firstName: 'Giovanni',
        lastName: 'Rossi',
        email: 'giovanni@example.com',
        avatar: '',
        role: 'USER' as const,
        permissions: {
          canAccessAdmin: false,
          canManageUsers: false,
          canManageGroups: false,
          canManageConversations: false,
          canViewAnalytics: false,
          canModerateContent: false,
          canViewAuditLogs: false,
          canManageNotifications: false,
          canManageTranslations: false,
        },
        systemLanguage: 'it',
        regionalLanguage: 'it',
        autoTranslateEnabled: true,
        translateToSystemLanguage: true,
        translateToRegionalLanguage: false,
        useCustomDestination: false,
        isOnline: true,
        lastSeen: new Date(),
        createdAt: new Date(),
        lastActiveAt: new Date()
      }
    ]);

    // Simuler l'arrivée de nouveaux messages toutes les 10-20 secondes
    const messageInterval = setInterval(() => {
      console.log('🎯 Simulation de message - Mode démo:', isDemoMode, 'Connexion:', connectionStatus.isConnected);
      
      if (isDemoMode) { // Utilise notre état local fiable
        const randomMessages = [
          { user: 'alice_fr', text: 'Cette plateforme devient de plus en plus populaire ! 📈', lang: 'fr', location: 'Paris' },
          { user: 'bob_en', text: 'Amazing to see so many people connecting here! 🌟', lang: 'en', location: 'London' },
          { user: 'carlos_es', text: '¡La comunidad crece cada día más! Me encanta 💕', lang: 'es', location: 'Madrid' },
          { user: 'hans_de', text: 'Die Übersetzungsqualität wird immer besser! 🔥', lang: 'de', location: 'Berlin' },
          { user: 'sofia_pt', text: 'Que bom ver tantas culturas unidas aqui! 🤝', lang: 'pt', location: 'Lisbon' },
          { user: 'yuki_ja', text: 'みんなとつながれて嬉しいです！ 🎌', lang: 'ja', location: 'Tokyo' },
          { user: 'li_zh', text: '这个平台真的很棒！ 🇨🇳', lang: 'zh', location: 'Beijing' },
          { user: 'ahmed_ar', text: 'منصة رائعة للتواصل العالمي! 🌍', lang: 'ar', location: 'Cairo' },
        ];

        const randomMessage = randomMessages[Math.floor(Math.random() * randomMessages.length)];
        
        const newMessage: BubbleStreamMessage = {
          id: `auto-msg-${Date.now()}-${Math.random()}`,
          conversationId: 'global_stream',
          senderId: randomMessage.user,
          content: randomMessage.text,
          originalLanguage: randomMessage.lang,
          isTranslated: userLanguage !== randomMessage.lang,
          translatedFrom: userLanguage !== randomMessage.lang ? randomMessage.lang : undefined,
          isEdited: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          location: randomMessage.location,
          sender: {
            id: randomMessage.user,
            username: randomMessage.user,
            firstName: randomMessage.user.split('_')[0].charAt(0).toUpperCase() + randomMessage.user.split('_')[0].slice(1),
            lastName: randomMessage.user.split('_')[1]?.toUpperCase() || 'User',
            email: `${randomMessage.user}@example.com`,
            avatar: '',
            role: 'USER' as const,
            permissions: {
              canAccessAdmin: false,
              canManageUsers: false,
              canManageGroups: false,
              canManageConversations: false,
              canViewAnalytics: false,
              canModerateContent: false,
              canViewAuditLogs: false,
              canManageNotifications: false,
              canManageTranslations: false,
            },
            systemLanguage: randomMessage.lang,
            regionalLanguage: randomMessage.lang,
            autoTranslateEnabled: true,
            translateToSystemLanguage: true,
            translateToRegionalLanguage: false,
            useCustomDestination: false,
            isOnline: true,
            lastSeen: new Date(),
            createdAt: new Date(),
            lastActiveAt: new Date()
          }
        };

        setMessages(prev => [newMessage, ...prev.slice(0, 49)]); // Garder max 50 messages
        
        // Notification toast pour le nouveau message
        toast.info(`📨 Nouveau message de ${newMessage.sender.firstName}`, {
          duration: 3000
        });
        
        // Log pour debug
        console.log('✅ Nouveau message simulé ajouté:', newMessage.content);
      } else {
        console.log('⏸️  Simulation arrêtée - Mode temps réel actif');
      }
    }, 15000 + Math.random() * 10000); // Entre 15 et 25 secondes

    return () => {
      clearInterval(messageInterval);
      clearTimeout(welcomeTimeout);
    };
  }, [isDemoMode, userLanguage]); // Dépendance sur isDemoMode au lieu de connectionStatus

  function handleNewMessage(message: Message) {
    // Éviter les doublons si le message a déjà été ajouté localement
    const isDuplicate = messages.some(existingMsg => existingMsg.id === message.id);
    if (isDuplicate) return;

    const bubbleMessage: BubbleStreamMessage = {
      ...message,
      originalLanguage: message.originalLanguage || 'fr',
      isTranslated: message.originalLanguage !== userLanguage,
      translatedFrom: message.originalLanguage !== userLanguage ? message.originalLanguage : undefined,
      location: 'Paris' // Simulation par défaut
    };

    setMessages(prev => [bubbleMessage, ...prev]);
    
    // Auto-scroll vers le nouveau message
    setTimeout(() => {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTo({
          top: 0,
          behavior: 'smooth'
        });
      }
    }, 100);
  }

  const handleSendMessage = async () => {
    if (!newMessage.trim() || newMessage.length > MAX_MESSAGE_LENGTH) {
      return;
    }

    try {
      // Simuler l'envoi du message même sans connexion WebSocket
      const newBubbleMessage: BubbleStreamMessage = {
        id: `user-msg-${Date.now()}`,
        conversationId: 'global_stream',
        senderId: user.id,
        content: newMessage.trim(),
        originalLanguage: detectedLanguage,
        isTranslated: false,
        isEdited: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        location: location || 'Paris',
        sender: user
      };

      // Ajouter le message immédiatement à la liste
      setMessages(prev => [newBubbleMessage, ...prev]);

      // Essayer d'envoyer via le service WebSocket si connecté
      if (connectionStatus.isConnected) {
        try {
          await sendMessageToService(newMessage.trim());
        } catch (error) {
          console.log('WebSocket non disponible, message ajouté en mode local');
        }
      }

      // Réinitialiser le formulaire
      setNewMessage('');
      setIsTyping(false);
      
      // Réinitialiser la hauteur du textarea
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
      
      // Auto-scroll vers le nouveau message
      setTimeout(() => {
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTo({
            top: 0,
            behavior: 'smooth'
          });
        }
      }, 100);
      
      toast.success('Message publié !');

      // Simuler une réponse après quelques secondes si en mode démo
      if (isDemoMode) {
        setTimeout(() => {
          const responses = [
            'Intéressant point de vue ! 👍',
            'Je suis d\'accord avec vous 🤝',
            'Merci pour ce partage ! 🙏',
            'Excellente observation ! ✨',
            'C\'est exactement ce que je pensais ! 💯'
          ];
          
          const randomResponse = responses[Math.floor(Math.random() * responses.length)];
          const responseMessage: BubbleStreamMessage = {
            id: `demo-response-${Date.now()}`,
            conversationId: 'global_stream',
            senderId: 'demo-user',
            content: randomResponse,
            originalLanguage: 'fr',
            isTranslated: false,
            isEdited: false,
            createdAt: new Date(),
            updatedAt: new Date(),
            location: 'Lyon',
            sender: {
              id: 'demo-user',
              username: 'demo_user',
              firstName: 'Utilisateur',
              lastName: 'Démo',
              email: 'demo@example.com',
              avatar: '',
              role: 'USER' as const,
              permissions: {
                canAccessAdmin: false,
                canManageUsers: false,
                canManageGroups: false,
                canManageConversations: false,
                canViewAnalytics: false,
                canModerateContent: false,
                canViewAuditLogs: false,
                canManageNotifications: false,
                canManageTranslations: false,
              },
              systemLanguage: 'fr',
              regionalLanguage: 'fr',
              autoTranslateEnabled: true,
              translateToSystemLanguage: true,
              translateToRegionalLanguage: false,
              useCustomDestination: false,
              isOnline: true,
              lastSeen: new Date(),
              createdAt: new Date(),
              lastActiveAt: new Date()
            }
          };
          
          setMessages(prev => [responseMessage, ...prev]);
        }, 2000 + Math.random() * 3000); // Réponse après 2-5 secondes
      }
      
    } catch (error) {
      console.error('Erreur envoi message:', error);
      toast.error('Erreur lors de l\'envoi du message');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleTyping = (value: string) => {
    setNewMessage(value);
    
    if (value.trim() && !isTyping) {
      setIsTyping(true);
      startTyping();
    } else if (!value.trim() && isTyping) {
      setIsTyping(false);
      stopTyping();
    }

    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (token) {
        await fetch(buildApiUrl(API_ENDPOINTS.AUTH.LOGOUT), {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        });
      }
    } catch (error) {
      console.error('Erreur déconnexion:', error);
    } finally {
      localStorage.removeItem('auth_token');
      router.push('/');
      toast.success('Déconnexion réussie');
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  const remainingChars = MAX_MESSAGE_LENGTH - newMessage.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <style jsx global>{`
        /* Cache toutes les barres de défilement */
        .scrollbar-hidden {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .scrollbar-hidden::-webkit-scrollbar {
          display: none;
        }
        
        /* Style pour les conteneurs avec scroll caché */
        .scroll-hidden {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .scroll-hidden::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      {/* Header simplifié - Style Dashboard */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo et titre */}
            <div className="flex items-center space-x-4">
              <div 
                className="flex items-center space-x-2 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => router.push('/')}
              >
                <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                  <MessageSquare className="h-5 w-5 text-white" />
                </div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Meeshy</h1>
              </div>
              <div className="hidden lg:block">
                <span className="text-gray-400 mx-2">/</span>
                <span className="text-lg font-medium text-gray-700">Stream Global</span>
              </div>
            </div>

            {/* Barre de recherche centrée - Responsive */}
            <div className="flex-1 max-w-sm sm:max-w-md lg:max-w-lg mx-4 sm:mx-8">
              <form onSubmit={handleSearch} className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Rechercher..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-full text-sm"
                />
              </form>
            </div>

            {/* Menu utilisateur - Responsive */}
            <div className="flex items-center space-x-2 sm:space-x-4">
              {/* Notifications */}
              <Button 
                variant="ghost" 
                size="sm" 
                className="relative"
                onClick={() => toast.info('Notifications disponibles prochainement')}
              >
                <Bell className="h-5 w-5" />
                {notifications.length > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 text-xs bg-red-500">
                    {notifications.length}
                  </Badge>
                )}
              </Button>

              {/* Menu utilisateur */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center space-x-2 sm:space-x-3 hover:bg-gray-100">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user.avatar} alt={user.firstName} />
                      <AvatarFallback>
                        {user.firstName?.charAt(0)}{user.lastName?.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="hidden sm:block text-left">
                      <p className="text-sm font-medium text-gray-900">
                        {user.firstName} {user.lastName}
                      </p>
                      <p className="text-xs text-gray-500">@{user.username}</p>
                    </div>
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  </Button>
                </DropdownMenuTrigger>
                
                <DropdownMenuContent align="end" className="w-56 z-50">
                  <DropdownMenuItem onClick={() => router.push('/dashboard')}>
                    <Home className="mr-2 h-4 w-4" />
                    <span>Tableau de bord</span>
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem onClick={() => router.push('/conversations')}>
                    <MessageSquare className="mr-2 h-4 w-4" />
                    <span>Conversations</span>
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem onClick={() => router.push('/groups')}>
                    <Users className="mr-2 h-4 w-4" />
                    <span>Groupes</span>
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem onClick={() => router.push('/contacts')}>
                    <UserPlus className="mr-2 h-4 w-4" />
                    <span>Contacts</span>
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem onClick={() => router.push('/links')}>
                    <LinkIcon className="mr-2 h-4 w-4" />
                    <span>Liens</span>
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem onClick={() => router.push('/models')}>
                    <Brain className="mr-2 h-4 w-4" />
                    <span>Modèles</span>
                  </DropdownMenuItem>
                  
                  <DropdownMenuSeparator />
                  
                  <DropdownMenuItem onClick={() => router.push('/profile')}>
                    <UserIcon className="mr-2 h-4 w-4" />
                    <span>Profil</span>
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem onClick={() => router.push('/settings')}>
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Paramètres</span>
                  </DropdownMenuItem>
                  
                  {user.permissions?.canAccessAdmin && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => router.push('/admin')}>
                        <Shield className="mr-2 h-4 w-4" />
                        <span>Administration</span>
                      </DropdownMenuItem>
                    </>
                  )}
                  
                  <DropdownMenuSeparator />
                  
                  <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Déconnexion</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      {/* Layout principal */}
      <div className="pt-16 min-h-screen relative">
        {/* Feed principal - Container avec gestion propre du scroll */}
        <div className="w-full xl:pr-80 relative">
          {/* Indicateur de statut de connexion WebSocket */}
          <div className="px-4 sm:px-6 lg:px-8 mb-4 pt-4">
            <div className={`inline-flex items-center space-x-2 px-3 py-1 rounded-full text-sm backdrop-blur-sm transition-all ${
              !isDemoMode
                ? 'bg-green-100/80 text-green-800 border border-green-200/50' 
                : 'bg-orange-100/80 text-orange-800 border border-orange-200/50'
            }`}>
              <div className={`w-2 h-2 rounded-full animate-pulse ${
                !isDemoMode ? 'bg-green-600' : 'bg-orange-600'
              }`} />
              <span className="font-medium">
                {!isDemoMode ? 'Messages en temps réel' : 'Mode démonstration'}
              </span>
              {isDemoMode && (
                <span className="text-xs opacity-75">• Les messages sont simulés</span>
              )}
            </div>
          </div>

          {/* Feed des messages avec scroll correct */}
          <div className="relative">
            {/* Container des messages avec padding pour la zone de saisie */}
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-48 pt-8">
              <div 
                ref={messagesContainerRef}
                className="space-y-5 max-h-[calc(100vh-200px)] overflow-y-auto scroll-smooth scroll-hidden px-4 py-6"
                style={{ background: 'transparent' }}
              >
                {messages.length === 0 ? (
                  <div className="text-center py-12">
                    <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      Aucun message pour le moment
                    </h3>
                    <p className="text-gray-500">
                      Soyez le premier à publier dans le stream global !
                    </p>
                  </div>
                ) : (
                  messages.map((message) => (
                    <BubbleMessage
                      key={message.id}
                      message={message}
                      currentUser={user}
                      userLanguage={userLanguage}
                    />
                  ))
                )}
                {/* Espace supplémentaire pour s'assurer que le dernier message est entièrement visible */}
                <div className="h-24" />
              </div>
            </div>
            
            {/* Dégradé inférieur - Transition progressive vers les couleurs générales de la page */}
            <div className="absolute bottom-0 left-0 right-0 xl:right-80 h-32 bg-gradient-to-t from-blue-50/40 via-indigo-100/30 to-transparent pointer-events-none z-10" />
          </div>
        </div>

        {/* Zone de composition flottante - Position fixe avec transparence cohérente aux couleurs de la page */}
        <div className="fixed bottom-0 left-0 right-0 xl:right-80 z-50 bg-transparent">
          {/* Dégradé de fond pour transition douce avec les couleurs générales */}
          <div className="h-0 bg-gradient-to-t from-blue-50/30 via-indigo-100/20 to-transparent pointer-events-none" />
          
          {/* Zone de saisie avec transparence et couleurs harmonisées */}
          <div className="bg-blue-50/40 backdrop-blur-md border-t border-blue-200/30 p-4 shadow-lg shadow-indigo-500/10">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="relative max-w-2xl mx-auto">
                <Textarea
                  ref={textareaRef}
                  value={newMessage}
                  onChange={(e) => handleTyping(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={`Partagez quelque chose avec le monde...`}
                  className="expandable-textarea min-h-[80px] max-h-40 resize-none pr-24 text-base border-blue-200/40 bg-blue-50/50 backdrop-blur-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-400/30 focus:bg-blue-50/70 placeholder:text-gray-700 scroll-hidden transition-all duration-200"
                  maxLength={MAX_MESSAGE_LENGTH}
                  disabled={!isComposingEnabled}
                  style={{
                    borderRadius: '16px',
                    boxShadow: '0 4px 16px rgba(59, 130, 246, 0.15)'
                  }}
                />
                
                {/* Indicateurs dans le textarea */}
                <div className="absolute bottom-3 left-3 flex items-center space-x-3 text-sm text-gray-600">
                  {/* Indicateur de langue détectée */}
                  <div className="flex items-center space-x-1">
                    <Languages className="h-4 w-4" />
                    <span>
                      {SUPPORTED_LANGUAGES.find(l => l.code === detectedLanguage)?.flag}
                      {detectedLanguage.toUpperCase()}
                    </span>
                  </div>
                  
                  {/* Localisation */}
                  {location && (
                    <div className="flex items-center space-x-1">
                      <MapPin className="h-4 w-4" />
                      <span>{location}</span>
                    </div>
                  )}
                </div>

                {/* Bouton d'envoi */}
                <div className="absolute bottom-3 right-3 flex items-center space-x-2">
                  {/* Compteur de caractères */}
                  <span className={`text-xs ${
                    remainingChars < 50 
                      ? remainingChars < 0 
                        ? 'text-red-600' 
                        : 'text-orange-600'
                      : 'text-gray-500'
                  }`}>
                    {remainingChars}
                  </span>
                  
                  <Button
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim() || newMessage.length > MAX_MESSAGE_LENGTH}
                    size="sm"
                    className="send-button px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg backdrop-blur-sm transition-all duration-200"
                    style={{ borderRadius: '12px' }}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar droite - Desktop uniquement - FIXE avec scroll indépendant */}
        <div className="hidden xl:block w-80 fixed right-0 top-16 bottom-0 bg-white/50 backdrop-blur-md border-l border-white/50 z-30">
          <div 
            className="h-full overflow-y-auto p-6 scroll-hidden"
          >
            
            {/* Header avec langues globales */}
            <SidebarLanguageHeader 
              languageStats={languageStats} 
              userLanguage={userLanguage}
            />

            {/* Section Langues Actives - Foldable */}
            <FoldableSection
              title="Langues Actives"
              icon={<Languages className="h-4 w-4 mr-2" />}
              defaultExpanded={true}
            >
              <div className="space-y-2">
                {/* Affichage des 5 premiers langages */}
                {[...languageStats].sort((a, b) => b.count - a.count).slice(0, 5).map((stat) => (
                  <div key={stat.language} className="flex items-center justify-between p-2 rounded hover:bg-gray-50/80 cursor-pointer transition-colors">
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">{stat.flag}</span>
                      <span className="text-sm font-medium">
                        {SUPPORTED_LANGUAGES.find(l => l.code === stat.language)?.name || stat.language}
                      </span>
                    </div>
                    <Badge variant="outline" className="text-xs bg-white/50">
                      {stat.count}
                    </Badge>
                  </div>
                ))}
                
                {/* Section scrollable pour les langages restants */}
                {languageStats.length > 5 && (
                  <div 
                    className="max-h-40 overflow-y-auto space-y-2 pr-1 border-t border-gray-100 pt-2 mt-2 scroll-hidden"
                  >
                    {[...languageStats].sort((a, b) => b.count - a.count).slice(5).map((stat) => (
                      <div key={stat.language} className="flex items-center justify-between p-2 rounded hover:bg-gray-50/80 cursor-pointer transition-colors">
                        <div className="flex items-center space-x-2">
                          <span className="text-lg">{stat.flag}</span>
                          <span className="text-sm font-medium">
                            {SUPPORTED_LANGUAGES.find(l => l.code === stat.language)?.name || stat.language}
                          </span>
                        </div>
                        <Badge variant="outline" className="text-xs bg-white/50">
                          {stat.count}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </FoldableSection>

            {/* Section Tendances - Foldable */}
            <FoldableSection
              title="Tendances"
              icon={<TrendingUp className="h-4 w-4 mr-2" />}
              defaultExpanded={true}
            >
              <div className="space-y-2">
                {/* Affichage des 6 premiers hashtags */}
                {trendingHashtags.slice(0, 6).map((hashtag) => (
                  <div
                    key={hashtag}
                    className="trending-hashtag flex items-center justify-between p-2 rounded hover:bg-gray-50/80 cursor-pointer transition-colors"
                  >
                    <span className="text-blue-600 hover:underline">{hashtag}</span>
                    <Badge variant="outline" className="text-xs bg-white/50">
                      {Math.floor(Math.random() * 100) + 10}
                    </Badge>
                  </div>
                ))}
                
                {/* Section scrollable pour les hashtags restants */}
                {trendingHashtags.length > 6 && (
                  <div 
                    className="max-h-32 overflow-y-auto space-y-2 pr-1 border-t border-gray-100 pt-2 mt-2 scroll-hidden"
                  >
                    {trendingHashtags.slice(6).map((hashtag) => (
                      <div
                        key={hashtag}
                        className="trending-hashtag flex items-center justify-between p-2 rounded hover:bg-gray-50/80 cursor-pointer transition-colors"
                      >
                        <span className="text-blue-600 hover:underline">{hashtag}</span>
                        <Badge variant="outline" className="text-xs bg-white/50">
                          {Math.floor(Math.random() * 100) + 10}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </FoldableSection>

            {/* Section Utilisateurs Actifs - Foldable */}
            <FoldableSection
              title="Utilisateurs Actifs"
              icon={<Users className="h-4 w-4 mr-2" />}
              defaultExpanded={true}
            >
              <div className="space-y-3">
                {/* Affichage des 6 premiers utilisateurs */}
                {activeUsers.slice(0, 6).map((activeUser) => (
                  <div
                    key={activeUser.id}
                    className="flex items-center space-x-3 p-2 rounded hover:bg-gray-50/80 cursor-pointer transition-colors"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={activeUser.avatar} alt={activeUser.firstName} />
                      <AvatarFallback className="bg-gradient-to-br from-blue-400 to-indigo-500 text-white">
                        {activeUser.firstName?.charAt(0)}{activeUser.lastName?.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {activeUser.firstName} {activeUser.lastName}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        @{activeUser.username}
                      </p>
                    </div>
                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                  </div>
                ))}
                
                {/* Section scrollable pour les utilisateurs restants */}
                {activeUsers.length > 6 && (
                  <div 
                    className="max-h-48 overflow-y-auto space-y-3 pr-1 border-t border-gray-100 pt-3 mt-3 scroll-hidden"
                  >
                    {activeUsers.slice(6).map((activeUser) => (
                      <div
                        key={activeUser.id}
                        className="flex items-center space-x-3 p-2 rounded hover:bg-gray-50/80 cursor-pointer transition-colors"
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={activeUser.avatar} alt={activeUser.firstName} />
                          <AvatarFallback className="bg-gradient-to-br from-blue-400 to-indigo-500 text-white">
                            {activeUser.firstName?.charAt(0)}{activeUser.lastName?.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {activeUser.firstName} {activeUser.lastName}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            @{activeUser.username}
                          </p>
                        </div>
                        <div className="w-2 h-2 bg-green-500 rounded-full" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </FoldableSection>
          </div>
        </div>
      </div>
    </div>
  );
}
