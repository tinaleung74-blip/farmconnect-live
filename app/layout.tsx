import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { KaFarmClientMonitor } from "./_components/KaFarmClientMonitor";
import { FarmConnectPwa } from "./_components/FarmConnectPwa";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FarmConnect",
  description: "FarmConnect customer, caretaker, and admin operations.",
  manifest: "/manifest.webmanifest",
  applicationName: "FarmConnect",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "FarmConnect" },
  icons: {
    icon: [
      { url: "/farmconnect/pwa/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/farmconnect/pwa/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/farmconnect/pwa/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#07563f",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <FarmConnectPwa />
        <KaFarmClientMonitor />
        {children}
      </body>
    </html>
  );
}
