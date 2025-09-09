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
// import { DebugModelsScript } from "@/components/debug/debug-models-script"; // Supprimé - obsolète

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
  return (
    <html lang="fr">
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
                  </ClientOnly>
                  {children}
                </ErrorBoundary>
              </AuthProvider>
            </AppProvider>
          </TranslationProvider>
        </LanguageProvider>
        <Toaster 
          position="bottom-right"
          expand={false}
          richColors
          visibleToasts={3}
          toastOptions={{
            duration: 3000,
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
