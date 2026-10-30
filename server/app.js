import express from "express";
import cors from "cors";
import { execFile } from "node:child_process";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { buildDownloadArgs, downloadDiagnostic, downloadError, MediaError, parseDownloadOptions } from "./media.js";
import { prepareYouTubeSession } from "./youtube.js";
import { logError, logInfo, observeDownload } from "./logging.js";

const execFileAsync = promisify(execFile);

export function createApp({
  runDownload = execFileAsync,
  maxDownloads = 3,
  youtubeCookiesFile = process.env.YOUTUBE_COOKIES_FILE,
  youtubeProxyUrl = process.env.YOUTUBE_PROXY_URL,
  logDownloadError = logError,
  logEvent = logInfo,
} = {}) {
  const app = express();
  let activeDownloads = 0;
  app.disable("x-powered-by");
  app.use(cors({
    origin: process.env.CLIENT_ORIGIN?.split(",").map((origin) => origin.trim()) || "*",
    exposedHeaders: ["Content-Disposition", "X-Request-Id"],
  }));

  app.get("/", (_req, res) => {
    res.json({ name: "SaveX", status: "ok" });
  });

  // Keep the original route and defaults so existing clients continue to work.
  app.get("/download", async (req, res) => {
    let directory;
    let options;
    let acquired = false;
    const requestId = randomUUID();
    const startedAt = Date.now();
    const record = (event, fields = {}) => logEvent({ event, requestId, ...fields });
    res.set("X-Request-Id", requestId);
    const controller = new AbortController();
    const onClose = () => {
      if (!res.writableFinished) {
        controller.abort();
        record("download_cancelled", { elapsedMs: Date.now() - startedAt });
      }
    };
    res.on("close", onClose);
    record("download_received");

    try {
      options = parseDownloadOptions(req.query);
      if (activeDownloads >= maxDownloads) {
        res.set("Retry-After", "15");
        throw new MediaError("All download slots are busy. Try again in a few seconds.", 503, "DOWNLOAD_BUSY");
      }
      activeDownloads += 1;
      acquired = true;
      record("download_started", {
        host: new URL(options.url).hostname,
        format: options.format, quality: options.quality, clip: options.clip,
        activeDownloads,
      });
      directory = await mkdtemp(path.join(tmpdir(), "savex-"));
      const session = await prepareYouTubeSession(options.url, directory, {
        cookiesFile: youtubeCookiesFile, proxyUrl: youtubeProxyUrl,
      });

      let stdout;
      try {
        record("ytdlp_started", { cookiesConfigured: !!session.cookiesFile, proxyConfigured: !!session.proxyUrl });
        const execution = runDownload(
          process.env.YT_DLP_PATH || "yt-dlp",
          buildDownloadArgs(options, directory, session),
          { timeout: 10 * 60 * 1000, maxBuffer: 1024 * 1024, signal: controller.signal },
        );
        ({ stdout } = await observeDownload(execution, (detail) => record("ytdlp_stderr", { detail })));
      } catch (error) {
        if (controller.signal.aborted) return;
        const failure = downloadError(error, options);
        failure.cause = error;
        throw failure;
      }

      // yt-dlp reports the actual path after merging or conversion, not the input extension.
      const result = stdout.trim().split(/\r?\n/).at(-1);
      if (!result) {
        throw new MediaError(options.clip
          ? "No media was found in that time range. Check that the start time is within the video."
          : "No downloadable file was found. Try a public, recorded video under 500 MB.", 422);
      }
      const filename = JSON.parse(result);
      if (
        typeof filename !== "string" ||
        path.dirname(path.resolve(filename)) !== directory ||
        path.extname(filename) !== `.${options.format}` ||
        !(await stat(filename)).isFile()
      ) {
        throw new MediaError("The selected format could not be prepared. Try another format.", 422);
      }

      if (controller.signal.aborted) return;
      record("download_prepared", { bytes: (await stat(filename)).size, elapsedMs: Date.now() - startedAt });
      res.set("Cache-Control", "no-store");
      await new Promise((resolve, reject) => {
        res.download(filename, path.basename(filename), (error) => error ? reject(error) : resolve());
      });
      record("download_completed", { elapsedMs: Date.now() - startedAt });
    } catch (error) {
      logDownloadError({ event: "download_failed", requestId, code: error.code || "INTERNAL_ERROR", host: options ? new URL(options.url).hostname : undefined, detail: downloadDiagnostic(error.cause || error), elapsedMs: Date.now() - startedAt });
      if (!res.headersSent && !res.destroyed) {
        res.status(error instanceof MediaError ? error.status : 500).json({
          error: error instanceof MediaError ? error.message : "The download could not be completed. Please try again.",
          code: error instanceof MediaError ? error.code : "INTERNAL_ERROR",
          requestId,
        });
      }
    } finally {
      res.off("close", onClose);
      if (acquired) activeDownloads -= 1;
      if (directory) await rm(directory, { recursive: true, force: true }).catch(console.error);
    }
  });

  return app;
}
