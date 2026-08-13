import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Dashboard - Governo Federal",
  description: "Plataforma premium de mídia programática",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

import { CampaignProvider } from "../context/CampaignContext";
import { ThemeProvider } from "../context/ThemeContext";
import { AuthProvider } from "../context/AuthContext";
import { OpecAssistantWidget } from "../components/assistant/OpecAssistantWidget";
import { UserWelcomeBubble } from "../components/assistant/UserWelcomeBubble";
import { DashboardActivityTracker } from "../components/dashboard/DashboardActivityTracker";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${inter.className} antialiased`}>
        <ThemeProvider>
          <AuthProvider>
            <CampaignProvider>
              {children}
              <DashboardActivityTracker />
              <OpecAssistantWidget />
              <UserWelcomeBubble />
            </CampaignProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
