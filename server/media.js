export const PLATFORMS = [
  { name: "YouTube", domains: ["youtube.com", "youtu.be", "youtube-nocookie.com"] },
  { name: "Instagram", domains: ["instagram.com"] },
  { name: "X", domains: ["x.com", "twitter.com"] },
  { name: "TikTok", domains: ["tiktok.com"] },
  { name: "Vimeo", domains: ["vimeo.com"] },
  { name: "Reddit", domains: ["reddit.com", "redd.it"] },
];

const VIDEO_FORMATS = ["mp4", "webm"];
const AUDIO_FORMATS = ["mp3", "m4a"];
const VIDEO_QUALITIES = ["best", "2160", "1440", "1080", "720", "480", "360"];
const AUDIO_QUALITIES = ["best", "320", "192", "128"];

export class MediaError extends Error {
  constructor(message, status = 400, code = "INVALID_REQUEST") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function isYouTubeUrl(url) {
  const hostname = new URL(url).hostname;
  return PLATFORMS[0].domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
}

function parseTimestamp(value, label) {
  if (value === undefined || (typeof value === "string" && !value.trim())) return undefined;
  if (typeof value !== "string" || value.length > 16 || !/^\d+(?::[0-5]\d){0,2}(?:\.\d{1,3})?$/.test(value.trim())) {
    throw new MediaError(`${label} must be seconds, MM:SS, or HH:MM:SS (for example, 90 or 01:30).`);
  }
  const seconds = value.trim().split(":").reduce((total, part) => total * 60 + Number(part), 0);
  if (!Number.isSafeInteger(Math.round(seconds * 1000))) {
    throw new MediaError(`${label} is too large.`);
  }
  return seconds;
}

export function parseDownloadOptions(query) {
  if (typeof query.url !== "string" || query.url.length > 4096) {
    throw new MediaError("Enter a video or audio URL.");
  }

  let url;
  try {
    url = new URL(query.url.trim());
  } catch {
    throw new MediaError("Enter a complete URL starting with https://.");
  }

  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username || url.password || url.port
  ) {
    throw new MediaError("Use a public HTTP or HTTPS URL without credentials or a custom port.");
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  const platform = PLATFORMS.find(({ domains }) => domains.some(
    (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
  ));
  if (!platform) {
    throw new MediaError("Use a link from YouTube, Instagram, X, TikTok, Vimeo, or Reddit.");
  }

  const format = query.format ?? "mp4";
  const quality = query.quality ?? "best";
  if (![...VIDEO_FORMATS, ...AUDIO_FORMATS].includes(format)) {
    throw new MediaError("Choose MP4, WebM, MP3, or M4A.");
  }
  const audio = AUDIO_FORMATS.includes(format);
  if (!(audio ? AUDIO_QUALITIES : VIDEO_QUALITIES).includes(quality)) {
    throw new MediaError(audio ? "Choose a valid audio bitrate." : "Choose a valid video quality.");
  }

  const start = parseTimestamp(query.start, "Start time");
  const end = parseTimestamp(query.end, "End time");
  if (end !== undefined && end <= (start ?? 0)) {
    throw new MediaError("End time must be later than start time.");
  }
  const clip = start !== undefined || end !== undefined ? { start: start ?? 0, end: end ?? null } : undefined;

  url.hostname = hostname;
  url.hash = "";
  return { url: url.href, format, quality, audio, ...(clip ? { clip } : {}) };
}

export function buildDownloadArgs({ url, format, quality, audio, clip }, directory, { cookiesFile, proxyUrl } = {}) {
  const args = [
    "--ignore-config",
    "--no-playlist",
    "--playlist-items", "1",
    "--no-progress",
    "--no-colors",
    "--socket-timeout", "30",
    "--retries", "2",
    "--fragment-retries", "2",
    "--max-filesize", "500M",
    "--match-filters", clip ? `!is_live & duration>?${clip.start}s` : "!is_live",
    "--js-runtimes", `node:${process.execPath}`,
    "--restrict-filenames",
    "--trim-filenames", "160",
    "--paths", directory,
    "--output", "%(title).100B [%(id)s].%(ext)s",
    "--print", "after_move:%(filepath)j",
  ];

  // These are server-owned settings, never options supplied by a download request.
  if (isYouTubeUrl(url)) {
    if (cookiesFile) args.push("--cookies", cookiesFile);
    if (proxyUrl) args.push("--proxy", proxyUrl);
  }

  if (clip) {
    args.push("--download-sections", `*${clip.start}-${clip.end ?? "inf"}`);
    // Re-encode video cuts so clips don't begin at an earlier keyframe.
    if (!audio) args.push("--force-keyframes-at-cuts");
  }

  if (audio) {
    args.push(
      "--format", "bestaudio/best",
      "--extract-audio",
      "--audio-format", format,
      "--audio-quality", quality === "best" ? "0" : `${quality}K`,
    );
  } else {
    const height = quality === "best" ? "" : `[height<=${quality}]`;
    const audioExtension = format === "mp4" ? "m4a" : "webm";
    const selector = [
      `bv*[ext=${format}]${height}+ba[ext=${audioExtension}]`,
      `b[ext=${format}]${height}`,
      `bv*${height}+ba`,
      `b${height}`,
      `bv*${height}`,
    ].join("/");
    args.push(
      "--format", selector,
      "--merge-output-format", `${format}/mkv`,
      "--recode-video", format,
    );
  }

  // The URL is one argument, never shell text or an option.
  return [...args, "--", url];
}

export function downloadError(error, { url } = {}) {
  if (error.code === "ENOENT") {
    return new MediaError("The server needs yt-dlp installed before it can download media.", 503, "YTDLP_MISSING");
  }
  if (error.killed) {
    return new MediaError("This download took too long. Try a shorter video or a lower quality.", 504, "DOWNLOAD_TIMEOUT");
  }
  const detail = String(error.stderr || "");
  // Ignore sign-in/cookie suggestions in warnings when the actual error is something else.
  const errors = detail.split(/\r?\n/).filter((line) => /^ERROR:/i.test(line.trim())).join("\n") || detail;
  const youtube = (url && isYouTubeUrl(url)) || /\[youtube\]/i.test(detail);
  if (/certificate.verify.failed|CERTIFICATE_VERIFY_FAILED/i.test(errors)) {
    return new MediaError("The download server could not establish a secure connection to this platform. Please try again later.", 502, "UPSTREAM_TLS_ERROR");
  }
  if (/(?:ffmpeg|ffprobe).*(?:not found|not installed|not available)/i.test(errors)) {
    return new MediaError("The server needs FFmpeg to trim, merge, or convert this media.", 503, "FFMPEG_MISSING");
  }
  if (/start time.*(?:greater|longer|exceed)|time range.*(?:outside|invalid)|requested section.*(?:outside|invalid)/i.test(errors)) {
    return new MediaError("The selected time range is outside this video's duration. Choose an earlier start time.", 422, "INVALID_TIME_RANGE");
  }
  if (/not a bot|automated (?:requests|traffic)|unusual traffic/i.test(errors)) {
    return new MediaError(youtube
      ? "YouTube is asking the download server to verify its session. This can happen even for public videos. Please try again later."
      : "This platform is asking the download server to verify its session. Please try again later.", 503, youtube ? "YOUTUBE_BOT_CHECK" : "UPSTREAM_BOT_CHECK");
  }
  if (/HTTP Error 429|too many requests|rate.?limit|This content isn.t available, try again later/i.test(errors)) {
    return new MediaError("This platform is temporarily limiting requests from the download server. Please try again later.", 503, "UPSTREAM_RATE_LIMIT");
  }
  if (/sign[ -]?in|login required|log in|private video|age.restricted|members.only|confirm your age/i.test(errors)) {
    return new MediaError("This video requires an account with access or age verification. Try a public, unrestricted video.", 422, "AUTH_REQUIRED");
  }
  if (youtube && /PO[ -]?Token|proof of origin|HTTP Error 403|403 Forbidden/i.test(errors)) {
    return new MediaError("YouTube rejected the download server's session. Please try again later.", 503, "YOUTUBE_SESSION_REJECTED");
  }
  if (youtube && /no supported JavaScript runtime|challenge solving failed|challenge solver|yt-dlp-ejs|JavaScript runtime.*not (?:found|available)/i.test(detail)) {
    return new MediaError("The server's YouTube downloader needs an update. Please try again later.", 503, "YOUTUBE_RUNTIME_ERROR");
  }
  if (/requested format.*not available|no video formats/i.test(errors)) {
    return new MediaError("That format or quality is unavailable. Try Best available or a different format.", 422, "FORMAT_UNAVAILABLE");
  }
  if (/too large|larger than|max.filesize/i.test(errors)) {
    return new MediaError("This file is too large. Try a lower quality or audio only.", 422, "FILE_TOO_LARGE");
  }
  return new MediaError("Could not download this link. Check that it is public and contains playable media, then try again.", 422, "DOWNLOAD_FAILED");
}

export function downloadDiagnostic(error) {
  const detail = String(error.stderr || error.diagnostic || error.code || "DOWNLOAD_FAILED");
  return detail
    .replace(/\x1b\[[0-9;]*m/g, "")
    .replace(/(?:https?|socks[45]h?):\/\/[^\s"'<>]+/gi, "[url]")
    .replace(/((?:cookie|authorization|proxy-authorization)\s*[:=])[^\r\n]*/gi, "$1 [redacted]")
    .replace(/((?:po_token|visitor_data|password|token)\s*[:=])[^\s;]+/gi, "$1[redacted]")
    .split(/\r?\n/).filter(Boolean).slice(-8).join("\n").slice(0, 3000);
}
