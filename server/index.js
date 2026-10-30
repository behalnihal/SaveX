import "dotenv/config";
import { createApp } from "./app.js";
import { execFile } from "node:child_process";
import { logError, logInfo } from "./logging.js";

const port = process.env.PORT || 8000;
createApp().listen(port, () => {
  logInfo({ event: "server_started", port, node: process.versions.node, youtubeCookiesConfigured: !!process.env.YOUTUBE_COOKIES_FILE, youtubeProxyConfigured: !!process.env.YOUTUBE_PROXY_URL });
  for (const [tool, executable, args] of [
    ["yt-dlp", process.env.YT_DLP_PATH || "yt-dlp", ["--version"]],
    ["ffmpeg", "ffmpeg", ["-version"]],
  ]) {
    execFile(executable, args, { timeout: 10_000 }, (error, stdout) => {
      if (error) logError({ event: "dependency_check_failed", tool, code: error.code || "CHECK_FAILED" });
      else logInfo({ event: "dependency_version", tool, version: stdout.trim().split(/\r?\n/)[0] });
    });
  }
});
