"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import LinePatternBackground from "@/components/LinePatternBackground";
import { Marquee } from "@/components/magicui/marquee";
import TypewriterEffect from "@/components/TypewriterEffect";

export default function Home() {
  const [url, setUrl] = useState("");
  const [processing, setProcessing] = useState(false);

  const isUrlValid = () => {
    if (!url.trim()) return false;
    if (!url.includes("twitter.com") && !url.includes("x.com")) return false;
    return true;
  };

  const handleDownload = async (e: React.FormEvent) => {
    const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    e.preventDefault();
    if (!isUrlValid()) {
      alert("Please enter a valid X (Twitter) video URL.");
      return;
    }
    setProcessing(true);
    try {
      const response = await fetch(
        `${api}/download?url=${encodeURIComponent(url)}`
      );
      if (!response.ok) {
        alert("Failed to download video.");
        setProcessing(false);
        return;
      }
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = "video.mp4";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
      setUrl("");
    } catch (err) {
      alert("An error occurred while downloading.");
      console.log(err);
    }
    setProcessing(false);
  };

  return (
    <>
      <LinePatternBackground />
      <div className="min-h-screen flex items-center justify-center font-sans relative px-4">
        <div className="w-full max-w-3xl">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-slate-800 dark:text-slate-200 mb-4 min-h-[3rem] flex items-center justify-center">
              <TypewriterEffect
                texts={[
                  "SaveX",
                  "Video Downloader",
                  "Content Saver",
                  "Media Extractor",
                ]}
                speed={150}
                delay={3000}
              />
            </h1>
            <p className="text-lg text-slate-600 dark:text-slate-400 mb-6">
              Download videos from X (Twitter) with ease
            </p>
          </div>

          <Card className="backdrop-blur-md bg-white/80 dark:bg-slate-900/80 shadow-2xl border-0 max-w-md mx-auto">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-semibold text-slate-800 dark:text-slate-200">
                Video Downloader
              </CardTitle>
              <CardDescription className="text-slate-600 dark:text-slate-400">
                Paste your X video URL below to download
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleDownload} className="space-y-4">
                <Input
                  type="text"
                  placeholder="https://x.com/username/status/..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="bg-white/90 dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 focus:border-blue-400 dark:focus:border-blue-400"
                />
                <Button
                  type="submit"
                  className="w-full text-white font-semibold py-3 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl"
                  disabled={processing}
                >
                  {processing ? "Processing..." : "Download Video"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="mt-12">
            <Marquee className="py-4" pauseOnHover>
              <div className="flex items-center space-x-8 text-slate-600 dark:text-slate-400">
                <span className="font-medium">✨ Fast Downloads</span>
                <span className="font-medium">🔒 Secure & Private</span>
                <span className="font-medium">🎯 High Quality</span>
                <span className="font-medium">🚀 No Watermarks</span>
                <span className="font-medium">📱 Mobile Friendly</span>
              </div>
            </Marquee>
          </div>
        </div>
      </div>
    </>
  );
}
