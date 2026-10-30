import "dotenv/config";
import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { downloadDiagnostic, downloadError, isYouTubeUrl, MediaError, parseDownloadOptions } from "./media.js";
import { prepareYouTubeSession } from "./youtube.js";

const run = promisify(execFile);
let directory;
let options;
try {
  options = parseDownloadOptions({ url: process.argv[2] });
  if (!isYouTubeUrl(options.url)) throw new Error("Provide a YouTube video URL.");
  const executable = process.env.YT_DLP_PATH || "yt-dlp";
  const { stdout: version } = await run(executable, ["--version"]);
  console.log(`yt-dlp ${version.trim()}; Node ${process.versions.node}`);
  directory = await mkdtemp(path.join(tmpdir(), "savex-diagnose-"));
  const session = await prepareYouTubeSession(options.url, directory, {
    cookiesFile: process.env.YOUTUBE_COOKIES_FILE,
    proxyUrl: process.env.YOUTUBE_PROXY_URL,
  });
  console.log(`YouTube cookies: ${session.cookiesFile ? "configured" : "not configured"}; proxy: ${session.proxyUrl ? "configured" : "not configured"}`);
  const args = ["--ignore-config", "--no-playlist", "--simulate", "--list-formats", "--no-colors", "--socket-timeout", "15", "--retries", "0", "--js-runtimes", `node:${process.execPath}`];
  if (session.cookiesFile) args.push("--cookies", session.cookiesFile);
  if (session.proxyUrl) args.push("--proxy", session.proxyUrl);
  const { stdout, stderr } = await run(executable, [...args, "--", options.url], { timeout: 60_000, maxBuffer: 1024 * 1024 });
  console.log(downloadDiagnostic({ stderr: stdout }));
  if (stderr) console.warn(downloadDiagnostic({ stderr }));
  console.log("Format extraction succeeded. No video was downloaded.");
} catch (error) {
  const failure = error instanceof MediaError ? error : downloadError(error, options);
  console.error(`${failure.code || "DIAGNOSIS_FAILED"}: ${failure.message}`);
  if (error.stderr || error.diagnostic) console.error(downloadDiagnostic(error));
  process.exitCode = 1;
} finally {
  if (directory) await rm(directory, { recursive: true, force: true });
}
