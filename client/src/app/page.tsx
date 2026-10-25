"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ArrowDown, Check, ChevronDown, Link2, LoaderCircle, X } from "lucide-react";

const formats = [
  { value: "mp4", label: "MP4", description: "Video", audio: false },
  { value: "webm", label: "WebM", description: "Video", audio: false },
  { value: "mp3", label: "MP3", description: "Audio only", audio: true },
  { value: "m4a", label: "M4A", description: "Audio only", audio: true },
];
const videoQualities = [
  ["best", "Best available"], ["2160", "Up to 4K"], ["1440", "Up to 1440p"],
  ["1080", "Up to 1080p"], ["720", "Up to 720p"], ["480", "Up to 480p"], ["360", "Up to 360p"],
];
const audioQualities = [
  ["best", "Best available"], ["320", "320 kbps"], ["192", "192 kbps"], ["128", "128 kbps"],
];

function downloadFilename(header: string | null, format: string) {
  const encoded = header?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (encoded) {
    try { return decodeURIComponent(encoded); } catch { /* Use the plain filename below. */ }
  }
  return header?.match(/filename="([^"]+)"/i)?.[1] || `savex.${format}`;
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [format, setFormat] = useState("mp4");
  const [quality, setQuality] = useState("best");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const request = useRef<AbortController | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const isAudio = formats.find((item) => item.value === format)?.audio;

  useEffect(() => () => request.current?.abort(), []);

  const handleDownload = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess(false);
    let mediaUrl: URL;
    try {
      mediaUrl = new URL(url.trim());
      if (!["http:", "https:"].includes(mediaUrl.protocol)) throw new Error();
    } catch {
      setError("Enter a complete video link starting with https://.");
      input.current?.focus();
      return;
    }

    setProcessing(true);
    const controller = new AbortController();
    request.current = controller;
    try {
      const api = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");
      const params = new URLSearchParams({ url: mediaUrl.href, format, quality });
      const response = await fetch(`${api}/download?${params}`, { signal: controller.signal });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || "The download failed. Please try again.");
      }

      const blob = await response.blob();
      if (controller.signal.aborted) return;
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = downloadFilename(response.headers.get("Content-Disposition"), format);
      document.body.appendChild(link);
      link.click();
      link.remove();
      // Give the browser time to start saving before releasing the blob.
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
      setSuccess(true);
    } catch (caught) {
      if (controller.signal.aborted) return;
      setError(caught instanceof TypeError
        ? "Could not reach the download server. Check your connection and try again."
        : caught instanceof Error ? caught.message : "The download failed. Please try again.");
    } finally {
      if (request.current === controller) {
        request.current = null;
        setProcessing(false);
      }
    }
  };

  return (
    <div className="downloader">
      <div className="hero">
        <Image src="/savex-dither.png" alt="Dithered download arrow" width={104} height={104} priority className="hero-logo" />
        <h1>Good things.<br />Worth saving.</h1>
        <p>The video you love. The format you need.</p>
      </div>

      <form onSubmit={handleDownload} className="download-form" aria-label="Download media">
        <div className="url-field">
          <label htmlFor="media-url">Video link</label>
          <div className={`url-input-wrap${error ? " has-error" : ""}`}>
            <Link2 size={18} aria-hidden="true" />
            <input
              ref={input}
              id="media-url"
              name="url"
              type="url"
              inputMode="url"
              placeholder="Paste a video link here"
              value={url}
              onChange={(event) => { setUrl(event.target.value); setError(""); setSuccess(false); }}
              disabled={processing}
              required
              autoComplete="off"
              spellCheck={false}
              aria-invalid={!!error}
              aria-describedby={error ? "download-error" : "supported-sites"}
            />
            {url && !processing && (
              <button type="button" className="clear-button" aria-label="Clear link" onClick={() => { setUrl(""); setError(""); setSuccess(false); input.current?.focus(); }}>
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        <div className="format-fields">
          <div className="select-field">
            <label htmlFor="format">Format</label>
            <div className="select-wrap">
              <select id="format" name="format" value={format} disabled={processing} onChange={(event) => { setFormat(event.target.value); setQuality("best"); setError(""); setSuccess(false); }}>
                {formats.map((item) => <option key={item.value} value={item.value}>{item.label} — {item.description}</option>)}
              </select>
              <ChevronDown size={16} aria-hidden="true" />
            </div>
          </div>
          <div className="select-field">
            <label htmlFor="quality">{isAudio ? "Audio quality" : "Quality"}</label>
            <div className="select-wrap">
              <select id="quality" name="quality" value={quality} disabled={processing} onChange={(event) => { setQuality(event.target.value); setError(""); setSuccess(false); }}>
                {(isAudio ? audioQualities : videoQualities).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <ChevronDown size={16} aria-hidden="true" />
            </div>
          </div>
        </div>

        <p className="quality-note">{isAudio ? "Audio extracted from the original video." : "Quality depends on the source. We never upscale."}</p>

        <button type="submit" disabled={processing || !url.trim()} className="download-button">
          {processing ? <LoaderCircle size={18} className="loading-spinner" aria-hidden="true" /> : <ArrowDown size={18} aria-hidden="true" />}
          {processing ? "Preparing your download…" : `Download ${isAudio ? "audio" : "video"}`}
        </button>

        {processing && (
          <div className="processing-message" role="status">
            <span>Longer videos and format conversion can take a few minutes.</span>
            <button type="button" onClick={() => request.current?.abort()}>Cancel</button>
          </div>
        )}
        {error && <p id="download-error" className="error-message" role="alert">{error}</p>}
        {success && <p className="success-message" role="status"><Check size={16} aria-hidden="true" /> Your download is ready. Check your browser’s downloads.</p>}
      </form>

      <div className="supported-sites" id="supported-sites">
        <p>One link, from any of these.</p>
        <ul aria-label="Supported platforms">
          {["YouTube", "Instagram", "X / Twitter", "TikTok", "Vimeo", "Reddit"].map((site) => <li key={site}>{site}</li>)}
        </ul>
      </div>
      <p className="usage-note">Public videos and reels. Save only what you have permission to use.</p>
    </div>
  );
}
