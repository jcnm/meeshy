'use client';

import { useLanguage } from '@/context/LanguageContext';

interface RichSnippetsProps {
  type: 'organization' | 'website' | 'service' | 'contactPage' | 'aboutPage';
  customData?: Record<string, any>;
}

export default function RichSnippets({ type, customData = {} }: RichSnippetsProps) {
  const { currentInterfaceLanguage } = useLanguage();
  const baseUrl = process.env.NODE_ENV === 'production' ? 'https://meeshy.com' : 'http://localhost:3100';
  
  const getStructuredData = () => {
    const commonOrganization = {
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": "Meeshy",
      "url": baseUrl,
      "logo": `${baseUrl}/images/logo.png`,
      "description": currentInterfaceLanguage === 'fr' 
        ? "Plateforme de messagerie multilingue avec traduction IA en temps réel"
        : currentInterfaceLanguage === 'en'
        ? "Multilingual messaging platform with real-time AI translation"
        : "Plataforma de mensagens multilíngues com tradução IA em tempo real",
      "foundingDate": "2024",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "Tour First, 1 Place des Saisons",
        "addressLocality": "Courbevoie",
        "postalCode": "92400",
        "addressCountry": "FR"
      },
      "contactPoint": {
        "@type": "ContactPoint",
        "telephone": "+33-1-47-17-67-00",
        "contactType": "Customer Service",
        "email": "contact@meeshy.com",
        "availableLanguage": ["French", "English", "Portuguese"]
      },
      "sameAs": [
        "https://twitter.com/MeeshyApp",
        "https://linkedin.com/company/meeshy"
      ]
    };

    switch (type) {
      case 'organization':
        return commonOrganization;

      case 'website':
        return {
          "@context": "https://schema.org",
          "@type": "WebSite",
          "name": "Meeshy",
          "url": baseUrl,
          "description": commonOrganization.description,
          "publisher": commonOrganization,
          "potentialAction": {
            "@type": "SearchAction",
            "target": `${baseUrl}/search?q={search_term_string}`,
            "query-input": "required name=search_term_string"
          },
          "inLanguage": ["fr-FR", "en-US", "pt-BR"]
        };

      case 'service':
        return {
          "@context": "https://schema.org",
          "@type": "Service",
          "name": currentInterfaceLanguage === 'fr' 
            ? "Service de Traduction en Temps Réel"
            : currentInterfaceLanguage === 'en'
            ? "Real-Time Translation Service"
            : "Serviço de Tradução em Tempo Real",
          "description": currentInterfaceLanguage === 'fr'
            ? "Service de messagerie avec traduction automatique en temps réel utilisant l'intelligence artificielle"
            : currentInterfaceLanguage === 'en'
            ? "Messaging service with real-time automatic translation using artificial intelligence"
            : "Serviço de mensagens com tradução automática em tempo real usando inteligência artificial",
          "provider": commonOrganization,
          "serviceType": currentInterfaceLanguage === 'fr' 
            ? "Traduction Automatique"
            : currentInterfaceLanguage === 'en'
            ? "Automatic Translation"
            : "Tradução Automática",
          "availableLanguage": ["French", "English", "Portuguese"],
          "category": currentInterfaceLanguage === 'fr'
            ? "Communication et Technologie"
            : currentInterfaceLanguage === 'en'
            ? "Communication and Technology"
            : "Comunicação e Tecnologia"
        };

      case 'contactPage':
        return {
          "@context": "https://schema.org",
          "@type": "ContactPage",
          "name": currentInterfaceLanguage === 'fr'
            ? "Contacter Meeshy"
            : currentInterfaceLanguage === 'en'
            ? "Contact Meeshy"
            : "Contato Meeshy",
          "url": `${baseUrl}${currentInterfaceLanguage === 'fr' ? '' : `/${currentInterfaceLanguage}`}/contact`,
          "description": currentInterfaceLanguage === 'fr'
            ? "Contactez l'équipe Meeshy pour support, partenariats et questions commerciales"
            : currentInterfaceLanguage === 'en'
            ? "Contact the Meeshy team for support, partnerships and business inquiries"
            : "Entre em contato com a equipe Meeshy para suporte, parcerias e consultas comerciais",
          "mainEntity": commonOrganization
        };

      case 'aboutPage':
        return {
          "@context": "https://schema.org",
          "@type": "AboutPage",
          "name": currentInterfaceLanguage === 'fr'
            ? "À Propos de Meeshy"
            : currentInterfaceLanguage === 'en'
            ? "About Meeshy"
            : "Sobre Meeshy",
          "url": `${baseUrl}${currentInterfaceLanguage === 'fr' ? '' : `/${currentInterfaceLanguage}`}/about`,
          "description": currentInterfaceLanguage === 'fr'
            ? "Découvrez l'histoire, la mission et l'équipe de Meeshy"
            : currentInterfaceLanguage === 'en'
            ? "Discover the story, mission and team behind Meeshy"
            : "Descubra a história, missão e equipe por trás do Meeshy",
          "mainEntity": commonOrganization
        };

      default:
        return commonOrganization;
    }
  };

  const structuredData = { ...getStructuredData(), ...customData };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(structuredData, null, 2)
      }}
    />
  );
}
