import React from "react";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import "../styles/globals.scss";
import ClientRoot from "./ClientRoot";
import Background from "../components/shared/background";
import Nav from "../components/shared/nav";
import SplashScreen from "../components/pages/splash-screen";
import ThemeSync from "../components/theme-sync";
import { THEME_INIT_SCRIPT } from "../lib/theme";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Heliocentrism",
  description: "Heliocentrism: the earth still orbits the sun. Every day, without fail, no matter what's happening down here. Heliocentrism helps you carry that same quiet steadiness — for the days you need reminding that this, too, keeps turning.",
  // capable: true is what actually gets iOS to launch a home-screen icon in
  // its own standalone window instead of just opening the bookmark in
  // Safari — the manifest's display:"standalone" (see manifest.ts) covers
  // Android/Chrome, but iOS Safari still keys off this specifically. This
  // Next.js version only renders it as the standards-track
  // "mobile-web-app-capable" tag (iOS 17.4+); `other` below adds the
  // Apple-prefixed one back for iOS versions before that stopped shipping.
  appleWebApp: {
    capable: true,
    title: "Heliocentrism",
    statusBarStyle: "black-translucent",
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // The dashboard is drag/swipe-driven throughout (widgets, page paging) —
  // letting the OS pinch/double-tap zoom on top of that fights those
  // gestures and stops feeling like a native app. Locks the page at 1x,
  // particularly needed on iOS which otherwise zooms on its own.
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0b0b0b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script
          // Sets data-palette/data-theme on <html> synchronously before
          // first paint, from the cached choice in localStorage, so the
          // correct theme renders immediately instead of flashing to the
          // default while the Firestore-backed setting loads.
          dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
        />
        <ThemeSync />
        <Background />
        <SplashScreen />
        <ClientRoot>
          <Nav />
          {children}
        </ClientRoot>
      </body>
    </html>
  );
}
