"use client";
import { useState } from "react";

export default function Home() {
  const [url, setUrl] = useState("");
  const [processing, setProcessing] = useState(false);

  const isUrlValid = () => {
    if (!url.trim()) return false;
    if (!url.includes("twitter.com") || !url.includes("x.com")) return false;
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
    }
    setProcessing(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 font-sans">
      <div className="bg-white/70 backdrop-blur-md shadow-xl rounded-2xl p-8 w-full max-w-md flex flex-col items-center animate-fade-in">
        <p className="text-lg text-gray-700 mb-6 text-center font-semibold">
          Download videos from X (Twitter) with ease
        </p>
        <form className="flex flex-col items-center w-full gap-3">
          <input
            type="text"
            placeholder="Enter a video URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all text-base bg-white/90 placeholder-gray-400 text-black"
          />
          <button
            type="submit"
            onClick={handleDownload}
            className="bg-gradient-to-r from-blue-500 to-purple-500 text-white p-3 rounded-lg w-full font-semibold shadow-md hover:from-blue-600 hover:to-purple-600 transition-all duration-200 mt-1 focus:outline-none focus:ring-2 focus:ring-purple-400"
          >
            {processing ? "Processing..." : "Download"}
          </button>
        </form>
      </div>
    </div>
  );
}
