import type { Metadata, Viewport } from "next";
import "./globals.css";
import "../styles/bubble-stream.css";
import { Toaster } from "@/components/ui/sonner";
import { AppProvider } from "@/context/AppContext";
import { LanguageProvider } from "@/context/LanguageContext";
import { TranslationProvider } from "@/components/common/translation-provider";
import { ErrorBoundary } from "@/components/common";
import { FontInitializer } from "@/components/common/font-initializer";
import { ClientOnly } from "@/components/common/client-only";
// import { LanguageDetectionNotification } from "@/components/LanguageDetectionNotification";
import { getAllFontVariables } from "@/lib/fonts";
import { AuthProvider } from "@/components/auth/auth-provider";
import { generateSEOMetadata, generateViewport } from "@/lib/seo-metadata";
import StructuredDataSSR from "@/components/StructuredDataSSR";
import StructuredData from "@/components/StructuredData";
// import { DebugModelsScript } from "@/components/debug/debug-models-script"; // Supprimé - obsolète

// Métadonnées SEO par défaut (page d'accueil en français)
export const metadata: Metadata = {
  ...generateSEOMetadata('home', 'fr'),
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(process.env.NODE_ENV === 'production' ? 'https://meeshy.me' : 'http://localhost:3100'),
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    other: [
      { rel: 'mask-icon', url: '/favicon.svg', color: '#2563eb' },
    ],
  },
  manifest: '/site.webmanifest',
};

export const viewport: Viewport = generateViewport();

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <head>
        {/* Version SSR pour le SEO optimal (dans le head) */}
        <StructuredDataSSR page="home" language="fr" />
      </head>
      <body
        className={`${getAllFontVariables()} antialiased font-nunito`}
      >
        <LanguageProvider>
          <TranslationProvider>
            <AppProvider>
              <AuthProvider>
                <ErrorBoundary>
                  <ClientOnly>
                    <FontInitializer />
                    {/* <LanguageDetectionNotification /> */}
                    {/* Version dynamique pour les changements de langue */}
                    <StructuredData />
                  </ClientOnly>
                  {children}
                </ErrorBoundary>
              </AuthProvider>
            </AppProvider>
          </TranslationProvider>
        </LanguageProvider>
        <Toaster 
          position="top-right"
          expand={true}
          richColors
          toastOptions={{
            style: {
              background: 'white',
              border: '1px solid #e5e7eb',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            },
          }}
        />
        {/* <DebugModelsScript /> Supprimé - obsolète */}
      </body>
    </html>
  );
}
