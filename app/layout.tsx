import type { Metadata, Viewport } from "next";
import "./globals.css";
import Pwa from "./pwa";

export const metadata: Metadata = {
  title: "INNOVER STORE",
  description: "Téléphones, accessoires et high-tech au meilleur prix.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "INNOVER STORE",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/logo.jpg",
    apple: "/apple-icon.jpg",
  },
};

export const viewport: Viewport = {
  themeColor: "#1e3a8a",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className="bg-gray-50 text-gray-900">
        <Pwa />
        <div className="min-h-screen flex flex-col">
          <div className="flex-1">{children}</div>
          <footer className="bg-white border-t py-3 text-center text-xs text-gray-400">
            INNOVER STORE · Gestion de boutique
          </footer>
        </div>
      </body>
    </html>
  );
}
