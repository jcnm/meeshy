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
            style: {
              background: 'white',
              border: '1px solid #e5e7eb',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            },
          }}
        />
      </body>
    </html>
  );
}
