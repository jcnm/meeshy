import { Metadata } from 'next';

// Types pour les métadonnées SEO
export interface SEOMetadata {
  title: string;
  description: string;
  keywords: string[];
  openGraph?: {
    title: string;
    description: string;
    images?: string[];
    type?: string;
  };
  twitter?: {
    card: string;
    title: string;
    description: string;
    images?: string[];
  };
  alternates?: {
    canonical?: string;
    languages?: Record<string, string>;
  };
}

// Configuration SEO par langue et page
export const seoConfig = {
  fr: {
    home: {
      title: "Meeshy - Messagerie Multilingue en Temps Réel | Traduction Instantanée",
      description: "Communiquez sans barrières linguistiques avec Meeshy. Messagerie en temps réel avec traduction automatique IA. Français, anglais, portugais et plus. Gratuit et sécurisé.",
      keywords: [
        "messagerie multilingue",
        "traduction instantanée",
        "chat traduction temps réel",
        "communication internationale",
        "IA traduction",
        "français anglais portugais",
        "messagerie sécurisée",
        "chat multilingue gratuit",
        "traduction automatique",
        "communication sans frontières"
      ],
      openGraph: {
        title: "Meeshy - Messagerie Multilingue avec Traduction Instantanée",
        description: "Brisez les barrières linguistiques ! Chattez en temps réel avec traduction automatique en français, anglais, portugais et plus.",
        type: "website",
        images: ["/images/og-home-fr.jpg"]
      },
      twitter: {
        card: "summary_large_image",
        title: "Meeshy - Chat Multilingue Instantané",
        description: "Messagerie en temps réel avec traduction IA. Communiquez librement en français, anglais, portugais.",
        images: ["/images/twitter-home-fr.jpg"]
      }
    },
    about: {
      title: "À Propos de Meeshy | Notre Mission et Équipe de Traduction IA",
      description: "Découvrez l'équipe passionnée derrière Meeshy. Notre mission : éliminer les barrières linguistiques avec une technologie de traduction IA innovante depuis Paris.",
      keywords: [
        "à propos Meeshy",
        "équipe traduction IA",
        "mission communication multilingue",
        "startup Paris",
        "technologie traduction",
        "innovation linguistique",
        "communication internationale",
        "développeurs français",
        "intelligence artificielle"
      ],
      openGraph: {
        title: "À Propos de Meeshy - Révolutionner la Communication Multilingue",
        description: "Rencontrez l'équipe qui révolutionne la communication internationale avec la traduction IA en temps réel.",
        type: "website",
        images: ["/images/og-about-fr.jpg"]
      },
      twitter: {
        card: "summary_large_image",
        title: "L'Équipe Meeshy - Innovation en Traduction IA",
        description: "Découvrez notre mission : briser les barrières linguistiques avec l'IA depuis Paris.",
        images: ["/images/twitter-about-fr.jpg"]
      }
    },
    contact: {
      title: "Contactez Meeshy | Support et Partenariats | Paris La Défense",
      description: "Contactez l'équipe Meeshy à Paris La Défense. Support technique, partenariats commerciaux, questions sur notre plateforme de traduction multilingue.",
      keywords: [
        "contact Meeshy",
        "support client",
        "partenariats",
        "Paris La Défense",
        "aide technique",
        "collaboration",
        "Tour First Courbevoie",
        "contact commercial",
        "assistance utilisateur"
      ],
      openGraph: {
        title: "Contactez Meeshy - Support et Partenariats",
        description: "Besoin d'aide ? Questions sur nos services ? Contactez notre équipe basée à Paris La Défense.",
        type: "website",
        images: ["/images/og-contact-fr.jpg"]
      },
      twitter: {
        card: "summary",
        title: "Contact Meeshy - Équipe Paris",
        description: "Support, partenariats et questions commerciales. Nous sommes là pour vous aider.",
        images: ["/images/twitter-contact-fr.jpg"]
      }
    },
    partners: {
      title: "Partenaires Meeshy | Entreprises, Éducation, Tech | API Traduction",
      description: "Rejoignez les partenaires Meeshy : entreprises multinationales, institutions éducatives, startups tech. API traduction, support dédié, accès prioritaire.",
      keywords: [
        "partenaires Meeshy",
        "API traduction",
        "entreprises multinationales",
        "éducation multilingue",
        "partenariat technologique",
        "intégration traduction",
        "communication entreprise",
        "collaboration internationale",
        "solution B2B"
      ],
      openGraph: {
        title: "Partenaires Meeshy - Solutions de Traduction pour Entreprises",
        description: "Intégrez la traduction IA dans vos projets. API robuste, support dédié pour entreprises et institutions.",
        type: "website",
        images: ["/images/og-partners-fr.jpg"]
      },
      twitter: {
        card: "summary_large_image",
        title: "Partenariats Meeshy - API Traduction B2B",
        description: "Solutions de traduction pour entreprises. API, support dédié, intégration simple.",
        images: ["/images/twitter-partners-fr.jpg"]
      }
    },
    privacy: {
      title: "Politique de Confidentialité Meeshy | Protection Données RGPD",
      description: "Politique de confidentialité complète de Meeshy. Traitement local des données, chiffrement TLS, conformité RGPD. Votre vie privée est notre priorité.",
      keywords: [
        "politique confidentialité",
        "RGPD",
        "protection données",
        "vie privée",
        "traitement local",
        "chiffrement TLS",
        "sécurité données",
        "conformité européenne"
      ],
      openGraph: {
        title: "Politique de Confidentialité - Protection de vos Données",
        description: "Comment Meeshy protège vos données personnelles. Traitement local, chiffrement, conformité RGPD.",
        type: "website",
        images: ["/images/og-privacy-fr.jpg"]
      },
      twitter: {
        card: "summary",
        title: "Confidentialité Meeshy - Sécurité Garantie",
        description: "Traitement local, chiffrement TLS, conformité RGPD. Vos données sont protégées.",
        images: ["/images/twitter-privacy-fr.jpg"]
      }
    },
    terms: {
      title: "Conditions d'Utilisation Meeshy | CGU Services de Traduction",
      description: "Conditions générales d'utilisation de Meeshy. Droits et responsabilités utilisateurs, utilisation acceptable, propriété intellectuelle, loi française.",
      keywords: [
        "conditions utilisation",
        "CGU",
        "termes service",
        "droits utilisateur",
        "responsabilités",
        "utilisation acceptable",
        "propriété intellectuelle",
        "loi française"
      ],
      openGraph: {
        title: "Conditions d'Utilisation - Termes du Service Meeshy",
        description: "Consultez nos conditions d'utilisation. Droits, responsabilités et utilisation acceptable de nos services.",
        type: "website",
        images: ["/images/og-terms-fr.jpg"]
      },
      twitter: {
        card: "summary",
        title: "CGU Meeshy - Conditions d'Utilisation",
        description: "Termes et conditions d'utilisation de nos services de traduction multilingue.",
        images: ["/images/twitter-terms-fr.jpg"]
      }
    }
  },
  en: {
    home: {
      title: "Meeshy - Real-Time Multilingual Messaging | Instant AI Translation",
      description: "Break language barriers with Meeshy. Real-time messaging with automatic AI translation. French, English, Portuguese and more. Free and secure.",
      keywords: [
        "multilingual messaging",
        "instant translation",
        "real-time chat translation",
        "international communication",
        "AI translation",
        "French English Portuguese",
        "secure messaging",
        "free multilingual chat",
        "automatic translation",
        "borderless communication"
      ],
      openGraph: {
        title: "Meeshy - Multilingual Messaging with Instant Translation",
        description: "Break language barriers! Chat in real-time with automatic translation in French, English, Portuguese and more.",
        type: "website",
        images: ["/images/og-home-en.jpg"]
      },
      twitter: {
        card: "summary_large_image",
        title: "Meeshy - Instant Multilingual Chat",
        description: "Real-time messaging with AI translation. Communicate freely in French, English, Portuguese.",
        images: ["/images/twitter-home-en.jpg"]
      }
    },
    about: {
      title: "About Meeshy | Our AI Translation Mission and Team",
      description: "Meet the passionate team behind Meeshy. Our mission: eliminate language barriers with innovative AI translation technology from Paris.",
      keywords: [
        "about Meeshy",
        "AI translation team",
        "multilingual communication mission",
        "Paris startup",
        "translation technology",
        "linguistic innovation",
        "international communication",
        "French developers",
        "artificial intelligence"
      ],
      openGraph: {
        title: "About Meeshy - Revolutionizing Multilingual Communication",
        description: "Meet the team revolutionizing international communication with real-time AI translation.",
        type: "website",
        images: ["/images/og-about-en.jpg"]
      },
      twitter: {
        card: "summary_large_image",
        title: "Meeshy Team - AI Translation Innovation",
        description: "Discover our mission: breaking language barriers with AI from Paris.",
        images: ["/images/twitter-about-en.jpg"]
      }
    },
    contact: {
      title: "Contact Meeshy | Support and Partnerships | Paris La Défense",
      description: "Contact the Meeshy team in Paris La Défense. Technical support, business partnerships, questions about our multilingual translation platform.",
      keywords: [
        "contact Meeshy",
        "customer support",
        "partnerships",
        "Paris La Défense",
        "technical help",
        "collaboration",
        "Tour First Courbevoie",
        "business contact",
        "user assistance"
      ],
      openGraph: {
        title: "Contact Meeshy - Support and Partnerships",
        description: "Need help? Questions about our services? Contact our team based in Paris La Défense.",
        type: "website",
        images: ["/images/og-contact-en.jpg"]
      },
      twitter: {
        card: "summary",
        title: "Contact Meeshy - Paris Team",
        description: "Support, partnerships and business inquiries. We're here to help.",
        images: ["/images/twitter-contact-en.jpg"]
      }
    },
    partners: {
      title: "Meeshy Partners | Enterprise, Education, Tech | Translation API",
      description: "Join Meeshy partners: multinational companies, educational institutions, tech startups. Translation API, dedicated support, priority access.",
      keywords: [
        "Meeshy partners",
        "translation API",
        "multinational companies",
        "multilingual education",
        "technology partnership",
        "translation integration",
        "enterprise communication",
        "international collaboration",
        "B2B solution"
      ],
      openGraph: {
        title: "Meeshy Partners - Enterprise Translation Solutions",
        description: "Integrate AI translation into your projects. Robust API, dedicated support for companies and institutions.",
        type: "website",
        images: ["/images/og-partners-en.jpg"]
      },
      twitter: {
        card: "summary_large_image",
        title: "Meeshy Partnerships - B2B Translation API",
        description: "Translation solutions for enterprises. API, dedicated support, simple integration.",
        images: ["/images/twitter-partners-en.jpg"]
      }
    },
    privacy: {
      title: "Meeshy Privacy Policy | GDPR Data Protection",
      description: "Complete privacy policy of Meeshy. Local data processing, TLS encryption, GDPR compliance. Your privacy is our priority.",
      keywords: [
        "privacy policy",
        "GDPR",
        "data protection",
        "privacy",
        "local processing",
        "TLS encryption",
        "data security",
        "European compliance"
      ],
      openGraph: {
        title: "Privacy Policy - Protecting Your Data",
        description: "How Meeshy protects your personal data. Local processing, encryption, GDPR compliance.",
        type: "website",
        images: ["/images/og-privacy-en.jpg"]
      },
      twitter: {
        card: "summary",
        title: "Meeshy Privacy - Security Guaranteed",
        description: "Local processing, TLS encryption, GDPR compliance. Your data is protected.",
        images: ["/images/twitter-privacy-en.jpg"]
      }
    },
    terms: {
      title: "Meeshy Terms of Service | Translation Service Terms",
      description: "Terms and conditions of use for Meeshy. User rights and responsibilities, acceptable use, intellectual property, French law.",
      keywords: [
        "terms of service",
        "terms and conditions",
        "service terms",
        "user rights",
        "responsibilities",
        "acceptable use",
        "intellectual property",
        "French law"
      ],
      openGraph: {
        title: "Terms of Service - Meeshy Service Terms",
        description: "View our terms of service. Rights, responsibilities and acceptable use of our services.",
        type: "website",
        images: ["/images/og-terms-en.jpg"]
      },
      twitter: {
        card: "summary",
        title: "Meeshy Terms - Terms of Service",
        description: "Terms and conditions for using our multilingual translation services.",
        images: ["/images/twitter-terms-en.jpg"]
      }
    }
  },
  pt: {
    home: {
      title: "Meeshy - Mensagens Multilíngues em Tempo Real | Tradução IA Instantânea",
      description: "Quebre barreiras linguísticas com Meeshy. Mensagens em tempo real com tradução automática IA. Francês, inglês, português e mais. Gratuito e seguro.",
      keywords: [
        "mensagens multilíngues",
        "tradução instantânea",
        "chat tradução tempo real",
        "comunicação internacional",
        "IA tradução",
        "francês inglês português",
        "mensagens seguras",
        "chat multilíngue grátis",
        "tradução automática",
        "comunicação sem fronteiras"
      ],
      openGraph: {
        title: "Meeshy - Mensagens Multilíngues com Tradução Instantânea",
        description: "Quebre barreiras linguísticas! Chat em tempo real com tradução automática em francês, inglês, português e mais.",
        type: "website",
        images: ["/images/og-home-pt.jpg"]
      },
      twitter: {
        card: "summary_large_image",
        title: "Meeshy - Chat Multilíngue Instantâneo",
        description: "Mensagens em tempo real com tradução IA. Comunique-se livremente em francês, inglês, português.",
        images: ["/images/twitter-home-pt.jpg"]
      }
    },
    about: {
      title: "Sobre Meeshy | Nossa Missão e Equipe de Tradução IA",
      description: "Conheça a equipe apaixonada por trás do Meeshy. Nossa missão: eliminar barreiras linguísticas com tecnologia inovadora de tradução IA de Paris.",
      keywords: [
        "sobre Meeshy",
        "equipe tradução IA",
        "missão comunicação multilíngue",
        "startup Paris",
        "tecnologia tradução",
        "inovação linguística",
        "comunicação internacional",
        "desenvolvedores franceses",
        "inteligência artificial"
      ],
      openGraph: {
        title: "Sobre Meeshy - Revolucionando a Comunicação Multilíngue",
        description: "Conheça a equipe que revoluciona a comunicação internacional com tradução IA em tempo real.",
        type: "website",
        images: ["/images/og-about-pt.jpg"]
      },
      twitter: {
        card: "summary_large_image",
        title: "Equipe Meeshy - Inovação em Tradução IA",
        description: "Descubra nossa missão: quebrar barreiras linguísticas com IA de Paris.",
        images: ["/images/twitter-about-pt.jpg"]
      }
    },
    contact: {
      title: "Contato Meeshy | Suporte e Parcerias | Paris La Défense",
      description: "Entre em contato com a equipe Meeshy em Paris La Défense. Suporte técnico, parcerias comerciais, dúvidas sobre nossa plataforma de tradução multilíngue.",
      keywords: [
        "contato Meeshy",
        "suporte cliente",
        "parcerias",
        "Paris La Défense",
        "ajuda técnica",
        "colaboração",
        "Tour First Courbevoie",
        "contato comercial",
        "assistência usuário"
      ],
      openGraph: {
        title: "Contato Meeshy - Suporte e Parcerias",
        description: "Precisa de ajuda? Dúvidas sobre nossos serviços? Entre em contato com nossa equipe em Paris La Défense.",
        type: "website",
        images: ["/images/og-contact-pt.jpg"]
      },
      twitter: {
        card: "summary",
        title: "Contato Meeshy - Equipe Paris",
        description: "Suporte, parcerias e consultas comerciais. Estamos aqui para ajudar.",
        images: ["/images/twitter-contact-pt.jpg"]
      }
    },
    partners: {
      title: "Parceiros Meeshy | Empresas, Educação, Tech | API Tradução",
      description: "Junte-se aos parceiros Meeshy: empresas multinacionais, instituições educacionais, startups tech. API tradução, suporte dedicado, acesso prioritário.",
      keywords: [
        "parceiros Meeshy",
        "API tradução",
        "empresas multinacionais",
        "educação multilíngue",
        "parceria tecnológica",
        "integração tradução",
        "comunicação empresarial",
        "colaboração internacional",
        "solução B2B"
      ],
      openGraph: {
        title: "Parceiros Meeshy - Soluções de Tradução para Empresas",
        description: "Integre tradução IA em seus projetos. API robusta, suporte dedicado para empresas e instituições.",
        type: "website",
        images: ["/images/og-partners-pt.jpg"]
      },
      twitter: {
        card: "summary_large_image",
        title: "Parcerias Meeshy - API Tradução B2B",
        description: "Soluções de tradução para empresas. API, suporte dedicado, integração simples.",
        images: ["/images/twitter-partners-pt.jpg"]
      }
    },
    privacy: {
      title: "Política de Privacidade Meeshy | Proteção Dados RGPD",
      description: "Política de privacidade completa do Meeshy. Processamento local de dados, criptografia TLS, conformidade RGPD. Sua privacidade é nossa prioridade.",
      keywords: [
        "política privacidade",
        "RGPD",
        "proteção dados",
        "privacidade",
        "processamento local",
        "criptografia TLS",
        "segurança dados",
        "conformidade europeia"
      ],
      openGraph: {
        title: "Política de Privacidade - Protegendo seus Dados",
        description: "Como o Meeshy protege seus dados pessoais. Processamento local, criptografia, conformidade RGPD.",
        type: "website",
        images: ["/images/og-privacy-pt.jpg"]
      },
      twitter: {
        card: "summary",
        title: "Privacidade Meeshy - Segurança Garantida",
        description: "Processamento local, criptografia TLS, conformidade RGPD. Seus dados estão protegidos.",
        images: ["/images/twitter-privacy-pt.jpg"]
      }
    },
    terms: {
      title: "Termos de Serviço Meeshy | Condições de Uso Tradução",
      description: "Termos e condições de uso do Meeshy. Direitos e responsabilidades dos usuários, uso aceitável, propriedade intelectual, lei francesa.",
      keywords: [
        "termos de serviço",
        "condições uso",
        "termos serviço",
        "direitos usuário",
        "responsabilidades",
        "uso aceitável",
        "propriedade intelectual",
        "lei francesa"
      ],
      openGraph: {
        title: "Termos de Serviço - Condições do Serviço Meeshy",
        description: "Consulte nossos termos de serviço. Direitos, responsabilidades e uso aceitável de nossos serviços.",
        type: "website",
        images: ["/images/og-terms-pt.jpg"]
      },
      twitter: {
        card: "summary",
        title: "Termos Meeshy - Condições de Uso",
        description: "Termos e condições para usar nossos serviços de tradução multilíngue.",
        images: ["/images/twitter-terms-pt.jpg"]
      }
    }
  }
};

// URLs de base par environnement
const baseUrls = {
  production: 'https://meeshy.com',
  development: 'http://localhost:3100'
};

// Fonction pour générer les métadonnées Next.js
export function generateSEOMetadata(
  page: keyof (typeof seoConfig)['fr'],
  lang: 'fr' | 'en' | 'pt' = 'fr',
  customData?: Partial<SEOMetadata>
): Metadata {
  const baseUrl = process.env.NODE_ENV === 'production' ? baseUrls.production : baseUrls.development;
  const pageData = seoConfig[lang][page];
  
  // Merge avec les données personnalisées
  const data = { ...pageData, ...customData };
  
  // URLs canoniques et alternates
  const canonical = `${baseUrl}${page === 'home' ? '' : `/${page}`}`;
  const alternateLanguages = {
    'fr': `${baseUrl}${page === 'home' ? '' : `/${page}`}`,
    'en': `${baseUrl}/en${page === 'home' ? '' : `/${page}`}`,
    'pt': `${baseUrl}/pt${page === 'home' ? '' : `/${page}`}`
  };

  return {
    title: data.title,
    description: data.description,
    keywords: data.keywords,
    authors: [{ name: 'Meeshy Team', url: 'https://meeshy.com' }],
    creator: 'Meeshy',
    publisher: 'Meeshy SAS',
    
    // Métadonnées Open Graph
    openGraph: {
      type: data.openGraph?.type || 'website',
      locale: lang === 'fr' ? 'fr_FR' : lang === 'en' ? 'en_US' : 'pt_BR',
      title: data.openGraph?.title || data.title,
      description: data.openGraph?.description || data.description,
      siteName: 'Meeshy',
      url: canonical,
      images: data.openGraph?.images?.map(img => ({
        url: `${baseUrl}${img}`,
        width: 1200,
        height: 630,
        alt: data.openGraph?.title || data.title
      })) || [
        {
          url: `${baseUrl}/images/og-default-${lang}.jpg`,
          width: 1200,
          height: 630,
          alt: data.title
        }
      ]
    },

    // Métadonnées Twitter
    twitter: {
      card: (data.twitter?.card as any) || 'summary_large_image',
      site: '@MeeshyApp',
      creator: '@MeeshyApp',
      title: data.twitter?.title || data.title,
      description: data.twitter?.description || data.description,
      images: data.twitter?.images?.map(img => `${baseUrl}${img}`) || [`${baseUrl}/images/twitter-default-${lang}.jpg`]
    },

    // URLs alternatives et canonique
    alternates: {
      canonical,
      languages: alternateLanguages
    },

    // Métadonnées additionnelles
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },

    // Informations de l'application
    applicationName: 'Meeshy',
    referrer: 'origin-when-cross-origin',
    colorScheme: 'light',
    viewport: 'width=device-width, initial-scale=1',

    // Données structurées
    other: {
      'application-name': 'Meeshy',
      'mobile-web-app-capable': 'yes',
      'apple-mobile-web-app-title': 'Meeshy',
      'apple-mobile-web-app-status-bar-style': 'default',
      'format-detection': 'telephone=no',
    }
  };
}

// Données structurées JSON-LD pour les moteurs de recherche
export function generateStructuredData(
  page: keyof (typeof seoConfig)['fr'],
  lang: 'fr' | 'en' | 'pt' = 'fr'
) {
  const baseUrl = process.env.NODE_ENV === 'production' ? baseUrls.production : baseUrls.development;
  const pageData = seoConfig[lang][page];

  const organizationData = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Meeshy",
    description: lang === 'fr' 
      ? "Plateforme de messagerie multilingue avec traduction IA en temps réel"
      : lang === 'en'
      ? "Multilingual messaging platform with real-time AI translation"
      : "Plataforma de mensagens multilíngues com tradução IA em tempo real",
    url: baseUrl,
    logo: `${baseUrl}/images/logo.png`,
    foundingDate: "2024",
    founders: [
      {
        "@type": "Person",
        name: "Meeshy Team"
      }
    ],
    address: {
      "@type": "PostalAddress",
      streetAddress: "Tour First, 1 Place des Saisons",
      addressLocality: "Courbevoie",
      postalCode: "92400",
      addressCountry: "FR"
    },
    contactPoint: {
      "@type": "ContactPoint",
      telephone: "+33-1-47-17-67-00",
      contactType: "Customer Service",
      email: "contact@meeshy.com",
      availableLanguage: ["French", "English", "Portuguese"]
    },
    sameAs: [
      "https://twitter.com/MeeshyApp",
      "https://linkedin.com/company/meeshy"
    ]
  };

  const webPageData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: pageData.title,
    description: pageData.description,
    url: `${baseUrl}${page === 'home' ? '' : `/${page}`}`,
    inLanguage: lang === 'fr' ? 'fr-FR' : lang === 'en' ? 'en-US' : 'pt-BR',
    isPartOf: {
      "@type": "WebSite",
      name: "Meeshy",
      url: baseUrl
    },
    author: organizationData,
    publisher: organizationData
  };

  if (page === 'home') {
    return {
      ...webPageData,
      "@type": "WebSite",
      potentialAction: {
        "@type": "SearchAction",
        target: `${baseUrl}/search?q={search_term_string}`,
        "query-input": "required name=search_term_string"
      }
    };
  }

  return webPageData;
}
