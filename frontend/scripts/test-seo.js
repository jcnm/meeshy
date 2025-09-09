#!/usr/bin/env node

/**
 * Script de test pour valider les fonctionnalités SEO
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Test des fonctionnalités SEO de Meeshy...\n');

// Tests à effectuer
const tests = [
  {
    name: 'Sitemap XML',
    test: () => {
      const sitemapPath = path.join(__dirname, '../app/sitemap.ts');
      return fs.existsSync(sitemapPath);
    }
  },
  {
    name: 'Robots.txt',
    test: () => {
      const robotsPath = path.join(__dirname, '../app/robots.ts');
      return fs.existsSync(robotsPath);
    }
  },
  {
    name: 'Métadonnées SEO (lib/seo-metadata.ts)',
    test: () => {
      const seoPath = path.join(__dirname, '../lib/seo-metadata.ts');
      if (!fs.existsSync(seoPath)) return false;
      
      const content = fs.readFileSync(seoPath, 'utf8');
      return content.includes('generateSEOMetadata') && 
             content.includes('Open Graph') && 
             content.includes('Twitter');
    }
  },
  {
    name: 'Images Open Graph',
    test: () => {
      const imagesDir = path.join(__dirname, '../public/images/seo');
      if (!fs.existsSync(imagesDir)) return false;
      
      const files = fs.readdirSync(imagesDir);
      const ogImages = files.filter(f => f.startsWith('og-') && f.endsWith('.svg'));
      return ogImages.length >= 15; // Au moins 15 images OG
    }
  },
  {
    name: 'Images Twitter Cards',
    test: () => {
      const imagesDir = path.join(__dirname, '../public/images/seo');
      if (!fs.existsSync(imagesDir)) return false;
      
      const files = fs.readdirSync(imagesDir);
      const twitterImages = files.filter(f => f.startsWith('twitter-') && f.endsWith('.svg'));
      return twitterImages.length >= 15; // Au moins 15 images Twitter
    }
  },
  {
    name: 'Métadonnées page About',
    test: () => {
      const aboutPath = path.join(__dirname, '../app/about/page.tsx');
      if (!fs.existsSync(aboutPath)) return false;
      
      const content = fs.readFileSync(aboutPath, 'utf8');
      return content.includes('generateSEOMetadata') && 
             content.includes('about');
    }
  },
  {
    name: 'Métadonnées page Contact',
    test: () => {
      const contactPath = path.join(__dirname, '../app/contact/page.tsx');
      if (!fs.existsSync(contactPath)) return false;
      
      const content = fs.readFileSync(contactPath, 'utf8');
      return content.includes('generateSEOMetadata') && 
             content.includes('contact');
    }
  },
  {
    name: 'Métadonnées page Partners',
    test: () => {
      const partnersPath = path.join(__dirname, '../app/partners/page.tsx');
      if (!fs.existsSync(partnersPath)) return false;
      
      const content = fs.readFileSync(partnersPath, 'utf8');
      return content.includes('generateSEOMetadata') && 
             content.includes('partners');
    }
  },
  {
    name: 'Métadonnées page Privacy',
    test: () => {
      const privacyPath = path.join(__dirname, '../app/privacy/page.tsx');
      if (!fs.existsSync(privacyPath)) return false;
      
      const content = fs.readFileSync(privacyPath, 'utf8');
      return content.includes('generateSEOMetadata') && 
             content.includes('privacy');
    }
  },
  {
    name: 'Métadonnées page Terms',
    test: () => {
      const termsPath = path.join(__dirname, '../app/terms/page.tsx');
      if (!fs.existsSync(termsPath)) return false;
      
      const content = fs.readFileSync(termsPath, 'utf8');
      return content.includes('generateSEOMetadata') && 
             content.includes('terms');
    }
  },
  {
    name: 'Configuration Next.js SEO',
    test: () => {
      const configPath = path.join(__dirname, '../next.config.ts');
      if (!fs.existsSync(configPath)) return false;
      
      const content = fs.readFileSync(configPath, 'utf8');
      return content.includes('poweredByHeader: false') && 
             content.includes('compress: true') &&
             content.includes('generateEtags: true');
    }
  },
  {
    name: 'Manifeste Web',
    test: () => {
      const manifestPath = path.join(__dirname, '../public/site.webmanifest');
      if (!fs.existsSync(manifestPath)) return false;
      
      const content = fs.readFileSync(manifestPath, 'utf8');
      return content.includes('Meeshy') && 
             content.includes('theme_color') &&
             content.includes('icons');
    }
  },
  {
    name: 'Composants de données structurées',
    test: () => {
      const structuredDataPath = path.join(__dirname, '../components/StructuredDataSSR.tsx');
      const structuredDataClientPath = path.join(__dirname, '../components/StructuredData.tsx');
      return fs.existsSync(structuredDataPath) && fs.existsSync(structuredDataClientPath);
    }
  }
];

// Exécuter les tests
let passedTests = 0;
let totalTests = tests.length;

tests.forEach(test => {
  try {
    const result = test.test();
    if (result) {
      console.log(`✅ ${test.name}`);
      passedTests++;
    } else {
      console.log(`❌ ${test.name}`);
    }
  } catch (error) {
    console.log(`❌ ${test.name} (Erreur: ${error.message})`);
  }
});

// Résumé
console.log(`\n📊 Résultats: ${passedTests}/${totalTests} tests réussis`);

if (passedTests === totalTests) {
  console.log('🎉 Toutes les fonctionnalités SEO sont correctement configurées !');
} else {
  console.log('⚠️  Certaines fonctionnalités SEO nécessitent une attention.');
}

// Recommandations
console.log('\n💡 Recommandations pour améliorer le SEO:');
console.log('1. Convertir les images SVG en JPG/PNG pour de meilleures performances');
console.log('2. Optimiser les images pour le web (< 500KB)');
console.log('3. Tester l\'affichage sur Facebook, Twitter et LinkedIn');
console.log('4. Utiliser Google Search Console pour surveiller les performances');
console.log('5. Implémenter Google Analytics pour le suivi des conversions');
console.log('6. Ajouter des données structurées pour les conversations et messages');
console.log('7. Optimiser les Core Web Vitals (LCP, FID, CLS)');
console.log('8. Implémenter la pagination pour les listes de conversations');
console.log('9. Ajouter des breadcrumbs pour la navigation');
console.log('10. Créer un plan de contenu SEO régulier');
