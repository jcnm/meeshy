import type { Metadata } from "next";
import "./globals.css";
import "../styles/bubble-stream.css";
import { Toaster } from "@/components/ui/sonner";
import { AppProvider } from "@/context/AppContext";
import { ErrorBoundary } from "@/components/common";
import { FontInitializer } from "@/components/common/font-initializer";
import { ClientOnly } from "@/components/common/client-only";
import { getAllFontVariables } from "@/lib/fonts";
// import { DebugModelsScript } from "@/components/debug/debug-models-script"; // Supprimé - obsolète

export const metadata: Metadata = {
  title: "Meeshy - Messagerie avec traduction automatique",
  description: "Application de messagerie avec traduction automatique côté client",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${getAllFontVariables()} antialiased font-nunito`}
      >
        <AppProvider>
          <ErrorBoundary>
            <ClientOnly>
              <FontInitializer />
            </ClientOnly>
            {children}
          </ErrorBoundary>
        </AppProvider>
        <Toaster />
        {/* <DebugModelsScript /> Supprimé - obsolète */}
      </body>
    </html>
  );
}
