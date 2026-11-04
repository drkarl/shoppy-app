import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { Toaster } from "sonner";

import { LocalOnlyBanner } from "@/components/layout/LocalOnlyBanner";
import { OfflineIndicator } from "@/components/layout/OfflineIndicator";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { HouseholdProvider } from "@/components/providers/HouseholdProvider";
import { SyncProvider } from "@/components/providers/SyncProvider";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";

import "./globals.css";

import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: {
    default: "Shoppy - Smart Shopping List",
    template: "%s | Shoppy",
  },
  description:
    "Collaborative smart shopping list app for families and households. Organize your shopping, sync in real-time, and never forget an item again.",
  keywords: ["shopping list", "grocery list", "collaborative", "family", "PWA"],
  authors: [{ name: "Shoppy Team" }],
  creator: "Shoppy",
  publisher: "Shoppy",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Shoppy",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Shoppy",
    title: "Shoppy - Smart Shopping List",
    description:
      "Collaborative smart shopping list app for families and households.",
  },
  twitter: {
    card: "summary",
    title: "Shoppy - Smart Shopping List",
    description:
      "Collaborative smart shopping list app for families and households.",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
  // Allow user scaling for accessibility (users with low vision need to zoom)
  minimumScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} font-sans antialiased`}
      >
        <ServiceWorkerRegistration />
        <AuthProvider>
          <HouseholdProvider>
            <SyncProvider>
              <LocalOnlyBanner />
              <OfflineIndicator />
              {children}
              <Toaster position="top-center" richColors />
            </SyncProvider>
          </HouseholdProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
