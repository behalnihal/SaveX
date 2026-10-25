import express from "express";
import cors from "cors";
import { execFile } from "node:child_process";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { buildDownloadArgs, downloadError, MediaError, parseDownloadOptions } from "./media.js";

const execFileAsync = promisify(execFile);

export function createApp({ runDownload = execFileAsync, maxDownloads = 3 } = {}) {
  const app = express();
  let activeDownloads = 0;
  app.disable("x-powered-by");
  app.use(cors({
    origin: process.env.CLIENT_ORIGIN?.split(",").map((origin) => origin.trim()) || "*",
    exposedHeaders: ["Content-Disposition"],
  }));

  app.get("/", (_req, res) => {
    res.json({ name: "SaveX", status: "ok" });
  });

  // Keep the original route and defaults so existing clients continue to work.
  app.get("/download", async (req, res) => {
    let directory;
    let acquired = false;
    const controller = new AbortController();
    const onClose = () => {
      if (!res.writableFinished) controller.abort();
    };
    res.on("close", onClose);

    try {
      const options = parseDownloadOptions(req.query);
      if (activeDownloads >= maxDownloads) {
        res.set("Retry-After", "15");
        throw new MediaError("All download slots are busy. Try again in a few seconds.", 503);
      }
      activeDownloads += 1;
      acquired = true;
      directory = await mkdtemp(path.join(tmpdir(), "savex-"));

      let stdout;
      try {
        ({ stdout } = await runDownload(
          process.env.YT_DLP_PATH || "yt-dlp",
          buildDownloadArgs(options, directory),
          { timeout: 10 * 60 * 1000, maxBuffer: 1024 * 1024, signal: controller.signal },
        ));
      } catch (error) {
        if (controller.signal.aborted) return;
        throw downloadError(error);
      }

      // yt-dlp reports the actual path after merging or conversion, not the input extension.
      const result = stdout.trim().split(/\r?\n/).at(-1);
      if (!result) {
        throw new MediaError("No downloadable file was found. Try a public, recorded video under 500 MB.", 422);
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
      res.set("Cache-Control", "no-store");
      await new Promise((resolve, reject) => {
        res.download(filename, path.basename(filename), (error) => error ? reject(error) : resolve());
      });
    } catch (error) {
      if (!res.headersSent && !res.destroyed) {
        res.status(error instanceof MediaError ? error.status : 500).json({
          error: error instanceof MediaError ? error.message : "The download could not be completed. Please try again.",
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
