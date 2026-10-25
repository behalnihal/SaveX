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
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
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

  url.hostname = hostname;
  url.hash = "";
  return { url: url.href, format, quality, audio };
}

export function buildDownloadArgs({ url, format, quality, audio }, directory) {
  const args = [
    "--ignore-config",
    "--no-playlist",
    "--playlist-items", "1",
    "--no-progress",
    "--no-warnings",
    "--no-colors",
    "--socket-timeout", "30",
    "--retries", "2",
    "--fragment-retries", "2",
    "--max-filesize", "500M",
    "--match-filters", "!is_live",
    "--js-runtimes", "node",
    "--restrict-filenames",
    "--trim-filenames", "160",
    "--paths", directory,
    "--output", "%(title).100B [%(id)s].%(ext)s",
    "--print", "after_move:%(filepath)j",
  ];

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

export function downloadError(error) {
  if (error.code === "ENOENT") {
    return new MediaError("The server needs yt-dlp installed before it can download media.", 503);
  }
  if (error.killed) {
    return new MediaError("This download took too long. Try a shorter video or a lower quality.", 504);
  }
  const detail = String(error.stderr || "");
  if (/certificate.verify.failed|CERTIFICATE_VERIFY_FAILED/i.test(detail)) {
    return new MediaError("The download server could not establish a secure connection to this platform. Please try again later.", 502);
  }
  if (/(?:ffmpeg|ffprobe).*(?:not found|not installed|not available)/i.test(detail)) {
    return new MediaError("The server needs FFmpeg to merge video or convert this format.", 503);
  }
  if (/sign in|login|log in|cookies|private|age.restricted|confirm you|not a bot/i.test(detail)) {
    return new MediaError("This platform requires sign-in for this link. Try a public video that plays without signing in.", 422);
  }
  if (/requested format.*not available|no video formats/i.test(detail)) {
    return new MediaError("That format or quality is unavailable. Try Best available or a different format.", 422);
  }
  if (/too large|larger than|max.filesize/i.test(detail)) {
    return new MediaError("This file is too large. Try a lower quality or audio only.", 422);
  }
  return new MediaError("Could not download this link. Check that it is public and contains playable media, then try again.", 422);
}
