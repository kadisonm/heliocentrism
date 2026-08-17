import React from "react";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import "../styles/globals.scss";
import ClientRoot from "./ClientRoot";
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
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
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
        <SplashScreen />
        <ClientRoot>
          <Nav />
          {children}
        </ClientRoot>
      </body>
    </html>
  );
}
