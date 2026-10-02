import "./globals.css";
import PwaRegister from "./PwaRegister";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "House of Ezra Giving | Give With Purpose",
  description: "Give with purpose and support the work of House of Ezra Worldwide Ministries — Jehovah Adonai Assembly.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    shortcut: ["/favicon.ico"],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "House of Ezra Giving",
    statusBarStyle: "default",
  },
  manifest: "/manifest.webmanifest",
  applicationName: "House of Ezra Giving",
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a3555",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}<PwaRegister /></body></html>;
}
