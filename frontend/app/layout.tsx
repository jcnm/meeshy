import type { Metadata, Viewport } from "next";
import "./globals.css";
import "../styles/bubble-stream.css";
import "../styles/z-index-fix.css";
import { Toaster } from "@/components/ui/sonner";
import { StoreInitializer } from "@/stores";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { ErrorBoundary } from "@/components/common";
import { ClientOnly } from "@/components/common/client-only";
import { MessageViewProvider } from "@/hooks/use-message-view-state";
import { defaultFont, getAllFontVariables } from "@/lib/fonts";
import { preloadCriticalComponents } from "@/lib/lazy-components";
import { CallManager } from "@/components/video-call";
import { GoogleAnalytics } from "@/components/analytics";
import "@/utils/console-override"; // 🔇 Désactive console.log en production

export const metadata: Metadata = {
  title: 'Meeshy - Messagerie multilingue en temps réel',
  description: 'Discutez avec le monde entier dans votre langue. Traduction automatique en temps réel pour plus de 100 langues. Rejoignez des conversations mondiales sans barrière linguistique.',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    url: 'https://meeshy.me',
    siteName: 'Meeshy',
    title: 'Meeshy - Messagerie multilingue en temps réel',
    description: 'Discutez avec le monde entier dans votre langue. Traduction automatique en temps réel pour plus de 100 langues. Rejoignez des conversations mondiales sans barrière linguistique.',
    images: [
      {
        url: 'https://meeshy.me/images/meeshy-og-welcome.jpg',
        width: 1200,
        height: 630,
        alt: 'Meeshy - Bienvenue dans la messagerie multilingue',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Meeshy - Messagerie multilingue en temps réel',
    description: 'Discutez avec le monde entier dans votre langue. Traduction automatique en temps réel pour plus de 100 langues.',
    images: ['https://meeshy.me/images/meeshy-og-welcome.jpg'],
    creator: '@meeshy_app',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Preload des composants critiques après le rendu initial
  if (typeof window !== 'undefined') {
    setTimeout(preloadCriticalComponents, 0);
  }

  return (
    <html lang="fr">
      <body className={`${getAllFontVariables()} antialiased font-nunito`}>
        {/* Google Analytics - Tracking sur toutes les pages */}
        <GoogleAnalytics />

        <StoreInitializer>
          <ThemeProvider>
            <MessageViewProvider>
              <ErrorBoundary>
                <ClientOnly>
                  {children}
                  <CallManager />
                </ClientOnly>
              </ErrorBoundary>
            </MessageViewProvider>
          </ThemeProvider>
        </StoreInitializer>
        <Toaster
          position="bottom-right"
          expand={false}
          richColors
          visibleToasts={1}
          toastOptions={{
            duration: 3000,
            classNames: {
              toast: 'dark:bg-gray-800 dark:border-gray-700',
              title: 'dark:text-white',
              description: 'dark:text-gray-400',
            },
          }}
        />
      </body>
    </html>
  );
}
