import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { buildDownloadArgs, downloadDiagnostic, downloadError, parseDownloadOptions } from "../media.js";
import { prepareYouTubeSession } from "../youtube.js";

const url = "https://www.youtube.com/watch?v=b52WH2gAim4";

test("separates YouTube bot checks, account restrictions, session failures, and runtime setup errors", () => {
  for (const [stderr, code, status] of [
    ["ERROR: [youtube] Sign in to confirm you're not a bot. Use --cookies-from-browser or --cookies for authentication", "YOUTUBE_BOT_CHECK", 503],
    ["ERROR: [youtube] This is a private video. Sign in if you've been granted access", "AUTH_REQUIRED", 422],
    ["ERROR: [youtube] Sign in to confirm your age", "AUTH_REQUIRED", 422],
    ["ERROR: [youtube] HTTP Error 403: Forbidden", "YOUTUBE_SESSION_REJECTED", 503],
    ["ERROR: [youtube] A PO Token is required", "YOUTUBE_SESSION_REJECTED", 503],
    ["ERROR: [youtube] HTTP Error 429: Too Many Requests", "UPSTREAM_RATE_LIMIT", 503],
    ["WARNING: [youtube] No supported JavaScript runtime could be found\nERROR: Requested format is not available", "YOUTUBE_RUNTIME_ERROR", 503],
    ["WARNING: Try --cookies for authentication\nERROR: Requested format is not available", "FORMAT_UNAVAILABLE", 422],
    ["WARNING: Use cookies for authentication\nERROR: HTTP Error 404: Not Found", "DOWNLOAD_FAILED", 422],
  ]) {
    const error = downloadError({ stderr }, { url });
    assert.equal(error.code, code, stderr);
    assert.equal(error.status, status);
  }
});

test("does not pass YouTube session settings to other platforms", async () => {
  const otherUrl = "https://www.instagram.com/reel/example/";
  assert.deepEqual(await prepareYouTubeSession(otherUrl, "/unused", { cookiesFile: "/missing", proxyUrl: "invalid" }), {});
  const args = buildDownloadArgs(parseDownloadOptions({ url: otherUrl }), "/tmp/savex-test", { cookiesFile: "/secret", proxyUrl: "http://proxy.example" });
  assert.ok(!args.includes("--cookies"));
  assert.ok(!args.includes("--proxy"));
  assert.ok(args.includes(`node:${process.execPath}`));
});

test("rejects missing or malformed session files and invalid proxies with safe configuration errors", async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), "savex-session-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const invalidFile = path.join(directory, "invalid.txt");
  await writeFile(invalidFile, "not a cookie file; secret-value");
  for (const config of [{ cookiesFile: path.join(directory, "missing") }, { cookiesFile: invalidFile }, { proxyUrl: "not a proxy" }, { proxyUrl: "file:///secret" }]) {
    await assert.rejects(prepareYouTubeSession(url, directory, config), (error) => {
      assert.equal(error.code, "YOUTUBE_CONFIG_ERROR");
      assert.equal(error.status, 503);
      assert.ok(!error.message.includes("secret-value"));
      return true;
    });
  }
});

test("copies cookies independently for concurrent downloads and normalizes a UTF-8 BOM", async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), "savex-cookies-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const cookiesFile = path.join(directory, "source.txt");
  await writeFile(cookiesFile, "\uFEFF# Netscape HTTP Cookie File\n");
  const firstDirectory = await mkdtemp(path.join(directory, "first-"));
  const secondDirectory = await mkdtemp(path.join(directory, "second-"));
  const [first, second] = await Promise.all([
    prepareYouTubeSession(url, firstDirectory, { cookiesFile }),
    prepareYouTubeSession(url, secondDirectory, { cookiesFile }),
  ]);
  assert.notEqual(first.cookiesFile, second.cookiesFile);
  await writeFile(first.cookiesFile, "changed");
  assert.equal(await readFile(second.cookiesFile, "utf8"), "# Netscape HTTP Cookie File\n");
  assert.equal(await readFile(cookiesFile, "utf8"), "\uFEFF# Netscape HTTP Cookie File\n");
});

test("redacts signed media URLs, proxy credentials, cookie headers, and tokens from diagnostics", () => {
  const detail = downloadDiagnostic({ stderr: "ERROR: https://user:secret@proxy.example/video?sig=secret\nCookie: SID=secret\nAuthorization: Bearer secret\npo_token=secret visitor_data=secret" });
  assert.ok(!detail.includes("secret"));
  assert.ok(detail.includes("[redacted]"));
});
