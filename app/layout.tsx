import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "INNOVER STORE - Gestion Boutique",
  description: "Platform de gestion complète pour votre boutique",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className="bg-gray-50 text-gray-900">
        <div className="min-h-screen flex flex-col">
          {children}
        </div>
      </body>
    </html>
  );
}
