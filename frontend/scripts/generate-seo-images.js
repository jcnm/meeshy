#!/usr/bin/env node

/**
 * Script pour générer les images SEO manquantes
 * Ce script crée des images de placeholder SVG qui peuvent être converties en JPG/PNG
 */

const fs = require('fs');
const path = require('path');

const imagesDir = path.join(__dirname, '../public/images');
const seoDir = path.join(imagesDir, 'seo');

// Créer le dossier seo s'il n'existe pas
if (!fs.existsSync(seoDir)) {
  fs.mkdirSync(seoDir, { recursive: true });
}

// Configuration des images à générer
const imageConfigs = [
  // Open Graph Images (1200x630)
  { name: 'og-home-fr', title: 'Meeshy', subtitle: 'Messagerie Multilingue', description: 'Communiquez sans barrières linguistiques avec traduction IA', lang: 'fr' },
  { name: 'og-home-en', title: 'Meeshy', subtitle: 'Multilingual Messaging', description: 'Break language barriers with AI translation', lang: 'en' },
  { name: 'og-home-pt', title: 'Meeshy', subtitle: 'Mensagens Multilíngues', description: 'Quebre barreiras linguísticas com tradução IA', lang: 'pt' },
  
  { name: 'og-about-fr', title: 'À Propos', subtitle: 'Notre Mission', description: 'L\'équipe passionnée derrière Meeshy', lang: 'fr' },
  { name: 'og-about-en', title: 'About Us', subtitle: 'Our Mission', description: 'The passionate team behind Meeshy', lang: 'en' },
  { name: 'og-about-pt', title: 'Sobre Nós', subtitle: 'Nossa Missão', description: 'A equipe apaixonada por trás do Meeshy', lang: 'pt' },
  
  { name: 'og-contact-fr', title: 'Contact', subtitle: 'Nous Contacter', description: 'Support et partenariats à Paris La Défense', lang: 'fr' },
  { name: 'og-contact-en', title: 'Contact', subtitle: 'Get in Touch', description: 'Support and partnerships in Paris La Défense', lang: 'en' },
  { name: 'og-contact-pt', title: 'Contato', subtitle: 'Entre em Contato', description: 'Suporte e parcerias em Paris La Défense', lang: 'pt' },
  
  { name: 'og-partners-fr', title: 'Partenaires', subtitle: 'Solutions Entreprise', description: 'API traduction et support dédié', lang: 'fr' },
  { name: 'og-partners-en', title: 'Partners', subtitle: 'Enterprise Solutions', description: 'Translation API and dedicated support', lang: 'en' },
  { name: 'og-partners-pt', title: 'Parceiros', subtitle: 'Soluções Empresariais', description: 'API tradução e suporte dedicado', lang: 'pt' },
  
  { name: 'og-privacy-fr', title: 'Confidentialité', subtitle: 'Protection des Données', description: 'RGPD, chiffrement TLS, traitement local', lang: 'fr' },
  { name: 'og-privacy-en', title: 'Privacy', subtitle: 'Data Protection', description: 'GDPR, TLS encryption, local processing', lang: 'en' },
  { name: 'og-privacy-pt', title: 'Privacidade', subtitle: 'Proteção de Dados', description: 'RGPD, criptografia TLS, processamento local', lang: 'pt' },
  
  { name: 'og-terms-fr', title: 'CGU', subtitle: 'Conditions d\'Utilisation', description: 'Droits et responsabilités utilisateurs', lang: 'fr' },
  { name: 'og-terms-en', title: 'Terms', subtitle: 'Terms of Service', description: 'User rights and responsibilities', lang: 'en' },
  { name: 'og-terms-pt', title: 'Termos', subtitle: 'Termos de Serviço', description: 'Direitos e responsabilidades dos usuários', lang: 'pt' },
  
  // Images par défaut
  { name: 'og-default-fr', title: 'Meeshy', subtitle: 'Messagerie Multilingue', description: 'Traduction IA en temps réel', lang: 'fr' },
  { name: 'og-default-en', title: 'Meeshy', subtitle: 'Multilingual Messaging', description: 'Real-time AI translation', lang: 'en' },
  { name: 'og-default-pt', title: 'Meeshy', subtitle: 'Mensagens Multilíngues', description: 'Tradução IA em tempo real', lang: 'pt' },
];

// Twitter Cards (1200x675)
const twitterConfigs = [
  { name: 'twitter-home-fr', title: 'Meeshy', subtitle: 'Chat Multilingue', description: 'Messagerie temps réel avec traduction IA', lang: 'fr' },
  { name: 'twitter-home-en', title: 'Meeshy', subtitle: 'Multilingual Chat', description: 'Real-time messaging with AI translation', lang: 'en' },
  { name: 'twitter-home-pt', title: 'Meeshy', subtitle: 'Chat Multilíngue', description: 'Mensagens tempo real com tradução IA', lang: 'pt' },
  
  { name: 'twitter-about-fr', title: 'Équipe Meeshy', subtitle: 'Innovation IA', description: 'Révolutionner la communication multilingue', lang: 'fr' },
  { name: 'twitter-about-en', title: 'Meeshy Team', subtitle: 'AI Innovation', description: 'Revolutionizing multilingual communication', lang: 'en' },
  { name: 'twitter-about-pt', title: 'Equipe Meeshy', subtitle: 'Inovação IA', description: 'Revolucionando comunicação multilíngue', lang: 'pt' },
  
  { name: 'twitter-contact-fr', title: 'Contact Meeshy', subtitle: 'Équipe Paris', description: 'Support, partenariats et questions', lang: 'fr' },
  { name: 'twitter-contact-en', title: 'Contact Meeshy', subtitle: 'Paris Team', description: 'Support, partnerships and inquiries', lang: 'en' },
  { name: 'twitter-contact-pt', title: 'Contato Meeshy', subtitle: 'Equipe Paris', description: 'Suporte, parcerias e consultas', lang: 'pt' },
  
  { name: 'twitter-partners-fr', title: 'Partenariats Meeshy', subtitle: 'API Traduction B2B', description: 'Solutions entreprise et support dédié', lang: 'fr' },
  { name: 'twitter-partners-en', title: 'Meeshy Partnerships', subtitle: 'B2B Translation API', description: 'Enterprise solutions and dedicated support', lang: 'en' },
  { name: 'twitter-partners-pt', title: 'Parcerias Meeshy', subtitle: 'API Tradução B2B', description: 'Soluções empresariais e suporte dedicado', lang: 'pt' },
  
  { name: 'twitter-privacy-fr', title: 'Confidentialité Meeshy', subtitle: 'Sécurité Garantie', description: 'Traitement local, chiffrement TLS', lang: 'fr' },
  { name: 'twitter-privacy-en', title: 'Meeshy Privacy', subtitle: 'Security Guaranteed', description: 'Local processing, TLS encryption', lang: 'en' },
  { name: 'twitter-privacy-pt', title: 'Privacidade Meeshy', subtitle: 'Segurança Garantida', description: 'Processamento local, criptografia TLS', lang: 'pt' },
  
  { name: 'twitter-terms-fr', title: 'CGU Meeshy', subtitle: 'Conditions d\'Utilisation', description: 'Termes et conditions de service', lang: 'fr' },
  { name: 'twitter-terms-en', title: 'Meeshy Terms', subtitle: 'Terms of Service', description: 'Service terms and conditions', lang: 'en' },
  { name: 'twitter-terms-pt', title: 'Termos Meeshy', subtitle: 'Condições de Uso', description: 'Termos e condições de serviço', lang: 'pt' },
  
  // Images par défaut Twitter
  { name: 'twitter-default-fr', title: 'Meeshy', subtitle: 'Chat Multilingue', description: 'Traduction IA instantanée', lang: 'fr' },
  { name: 'twitter-default-en', title: 'Meeshy', subtitle: 'Multilingual Chat', description: 'Instant AI translation', lang: 'en' },
  { name: 'twitter-default-pt', title: 'Meeshy', subtitle: 'Chat Multilíngue', description: 'Tradução IA instantânea', lang: 'pt' },
];

// Fonction pour générer un SVG
function generateSVG(config, isTwitter = false) {
  const width = isTwitter ? 1200 : 1200;
  const height = isTwitter ? 675 : 630;
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- Background -->
  <rect width="${width}" height="${height}" fill="#F9FAFB"/>
  
  <!-- Header -->
  <rect x="0" y="0" width="${width}" height="120" fill="#2563eb"/>
  
  <!-- Logo/Title -->
  <text x="${width/2}" y="70" font-family="Arial, sans-serif" font-size="48" font-weight="bold" fill="white" text-anchor="middle">${config.title}</text>
  
  <!-- Subtitle -->
  <text x="${width/2}" y="220" font-family="Arial, sans-serif" font-size="36" font-weight="bold" fill="#2563eb" text-anchor="middle">${config.subtitle}</text>
  
  <!-- Description -->
  <text x="${width/2}" y="280" font-family="Arial, sans-serif" font-size="24" fill="#6b7280" text-anchor="middle">${config.description}</text>
  
  <!-- Language indicator -->
  <text x="${width/2}" y="350" font-family="Arial, sans-serif" font-size="18" fill="#9ca3af" text-anchor="middle">${config.lang.toUpperCase()}</text>
  
  <!-- Meeshy branding -->
  <text x="${width/2}" y="${height - 40}" font-family="Arial, sans-serif" font-size="16" fill="#9ca3af" text-anchor="middle">meeshy.me</text>
</svg>`;
}

// Générer toutes les images
console.log('🎨 Génération des images SEO...');

// Générer les images Open Graph
imageConfigs.forEach(config => {
  const svgContent = generateSVG(config, false);
  const filePath = path.join(seoDir, `${config.name}.svg`);
  fs.writeFileSync(filePath, svgContent);
  console.log(`✅ Généré: ${config.name}.svg`);
});

// Générer les images Twitter
twitterConfigs.forEach(config => {
  const svgContent = generateSVG(config, true);
  const filePath = path.join(seoDir, `${config.name}.svg`);
  fs.writeFileSync(filePath, svgContent);
  console.log(`✅ Généré: ${config.name}.svg`);
});

console.log('\n🎉 Toutes les images SEO ont été générées !');
console.log('\n📝 Prochaines étapes:');
console.log('1. Convertir les SVG en JPG/PNG avec un outil comme Inkscape ou en ligne');
console.log('2. Optimiser les images pour le web (< 500KB)');
console.log('3. Tester l\'affichage sur Facebook, Twitter et LinkedIn');
console.log('\n💡 Outils recommandés pour la conversion:');
console.log('- Inkscape (gratuit)');
console.log('- GIMP (gratuit)');
console.log('- Canva (en ligne)');
console.log('- convertio.co (en ligne)');
