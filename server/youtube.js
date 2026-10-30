import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { isYouTubeUrl, MediaError } from "./media.js";

function configurationError(diagnostic) {
  const error = new MediaError("The server's YouTube session is not configured correctly. Please try again later.", 503, "YOUTUBE_CONFIG_ERROR");
  error.diagnostic = diagnostic;
  return error;
}

export async function prepareYouTubeSession(url, directory, { cookiesFile, proxyUrl } = {}) {
  if (!isYouTubeUrl(url)) return {};
  const session = {};
  if (proxyUrl) {
    let proxy;
    try { proxy = new URL(proxyUrl); } catch { /* Report a configuration error below. */ }
    if (!proxy || !["http:", "https:", "socks5:"].includes(proxy.protocol) || !proxy.hostname) {
      throw configurationError("YOUTUBE_PROXY_URL must be a valid HTTP, HTTPS, or SOCKS5 proxy URL.");
    }
    session.proxyUrl = proxy.href;
  }
  if (cookiesFile) {
    let cookies;
    try { cookies = (await readFile(cookiesFile, "utf8")).replace(/^\uFEFF/, ""); } catch {
      throw configurationError("YOUTUBE_COOKIES_FILE could not be read. Check the container's secret mount and permissions.");
    }
    if (!/^#(?: Netscape)? HTTP Cookie File/i.test(cookies)) {
      throw configurationError("YOUTUBE_COOKIES_FILE must be a Netscape-format cookies.txt file.");
    }
    // yt-dlp writes its cookie jar. Each request gets a private, writable copy;
    // the original secret can stay mounted read-only and is never modified.
    session.cookiesFile = path.join(directory, "youtube-cookies.txt");
    await writeFile(session.cookiesFile, cookies, { mode: 0o600, flag: "wx" });
  }
  return session;
}
