import type { Metadata, Viewport } from "next";
import { Fraunces, Manrope } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { ToastProvider } from "@/contexts/ToastContext";
import { PwaRegistration } from "@/components/PwaRegistration";
import { InstallPrompt } from "@/components/InstallPrompt";
import { TooltipProvider } from "@/components/ui/tooltip";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "RMS — Restaurant Management System",
  description: "Premium restaurant management system for modern dining operations",
  manifest: "/manifest.webmanifest",
  applicationName: "RMS",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "RMS",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#07131a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${fraunces.variable} ${manrope.variable}`}>
      <body suppressHydrationWarning className="app-body">
        <AuthProvider>
          <SettingsProvider>
            <ToastProvider>
              <TooltipProvider delayDuration={250}>
                <PwaRegistration />
                <InstallPrompt />
                {children}
              </TooltipProvider>
            </ToastProvider>
          </SettingsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
