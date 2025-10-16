import type { Metadata, Viewport } from "next";
import "./globals.css";
import "../styles/bubble-stream.css";
import "../styles/z-index-fix.css";
import { Toaster } from "@/components/ui/sonner";
import { StoreInitializer } from "@/stores";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { ErrorBoundary } from "@/components/common";
import { ClientOnly } from "@/components/common/client-only";
import { defaultFont, getAllFontVariables } from "@/lib/fonts";
import { preloadCriticalComponents } from "@/lib/lazy-components";
import "@/utils/console-override"; // 🔇 Désactive console.log en production

export const metadata: Metadata = {
  title: 'Meeshy',
  description: 'Messagerie multilingue en temps réel',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
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
        <StoreInitializer>
          <ThemeProvider>
            <ErrorBoundary>
              <ClientOnly>
                {children}
              </ClientOnly>
            </ErrorBoundary>
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
