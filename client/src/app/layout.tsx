import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Analytics } from "@vercel/analytics/next";

export const metadata: Metadata = {
  metadataBase: new URL("https://savex.nihal.works"),
  title: "SaveX — Video & Audio Downloader",
  description: "Download videos and audio from YouTube, Instagram, X, TikTok, Vimeo, and Reddit. Choose MP4, WebM, MP3, or M4A and your preferred quality.",
  openGraph: {
    title: "SaveX",
    description: "Your favorite videos. Your preferred format. Download from YouTube, Instagram, X, and more.",
    url: "https://savex.nihal.works",
    siteName: "SaveX",
    images: [
      {
        url: "https://savex.nihal.works/opengraph-image",
        width: 1200,
        height: 630,
        alt: "SaveX",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "SaveX",
    description: "Download video and audio from YouTube, Instagram, X, and more.",
    images: ["https://savex.nihal.works/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
    "max-image-preview": "large",
    "max-video-preview": -1,
    "max-snippet": -1,
  },
  alternates: {
    canonical: "https://savex.nihal.works",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} antialiased`}
      >
        <div className="site-shell">
          <Navbar />
          <main className="site-main">{children}</main>
          <Footer />
        </div>
        <Analytics />
      </body>
    </html>
  );
}
