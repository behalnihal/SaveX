import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Analytics } from "@vercel/analytics/next";
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SaveX",
  description: "Download videos from X (Twitter) with ease",
  icons: {
    icon: "/savex.png",
  },
  openGraph: {
    title: "SaveX",
    description: "SaveX - Download videos from X (Twitter) with ease",
    url: "https://savex.nihal.works",
    siteName: "SaveX",
    images: [
      {
        url: "https://savex.nihal.works/savex-og.png",
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
    description: "Download videos from X (Twitter) with ease",
    images: ["https://savex.nihal.works/savex-og.png"],
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
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <div className="min-h-screen max-w-3xl mx-auto flex flex-col">
            <Navbar />
            <main>{children}</main>
            <Footer />
          </div>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
