import assert from "node:assert/strict";
import { once } from "node:events";
import { writeFile, stat } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import { createApp } from "../app.js";
import { buildDownloadArgs, parseDownloadOptions } from "../media.js";

const url = "https://www.youtube.com/watch?v=example";

async function startApp(t, options) {
  const server = createApp(options).listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}

async function assertRemoved(directory) {
  // Response completion and filesystem cleanup happen on adjacent event-loop turns.
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try { await stat(directory); } catch (error) {
      if (error.code === "ENOENT") return;
      throw error;
    }
    await delay(10);
  }
  assert.fail(`Temporary directory was not removed: ${directory}`);
}

test("accepts supported platforms and preserves original MP4 defaults", () => {
  for (const link of [url, "https://youtu.be/example", "https://m.youtube.com/shorts/example", "https://www.instagram.com/reel/example/", "https://x.com/user/status/1", "https://twitter.com/user/status/1", "https://vm.tiktok.com/example", "https://vimeo.com/1", "https://www.reddit.com/r/videos/comments/1", "https://redd.it/1"]) {
    assert.deepEqual(parseDownloadOptions({ url: link }), { url: new URL(link).href, format: "mp4", quality: "best", audio: false });
  }
});

test("rejects malformed, non-public, lookalike, and credential URLs", () => {
  for (const link of [undefined, [url, url], "not a URL", "file:///etc/passwd", "ftp://youtube.com/a", "https://youtube.com.evil.example/a", "https://evilyoutube.com/a", "http://127.0.0.1/a", "http://localhost/a", "https://user:pass@youtube.com/a", "https://youtube.com:8080/a", "https://youtube.com@evil.example/a"]) {
    assert.throws(() => parseDownloadOptions({ url: link }), { status: 400 });
  }
});

test("rejects arbitrary formats, qualities, and repeated query parameters", () => {
  for (const query of [{ format: "mp4;touch /tmp/unsafe" }, { quality: "1080;whoami" }, { format: ["mp3", "mp4"] }, { quality: ["best"] }, { format: "mp3", quality: "1080" }, { format: "mp4", quality: "320" }]) {
    assert.throws(() => parseDownloadOptions({ url, ...query }), { status: 400 });
  }
});

test("keeps shell metacharacters inside one URL argument", () => {
  const options = parseDownloadOptions({ url: `${url}&text=$(whoami);echo` });
  const args = buildDownloadArgs(options, "/tmp/savex-test");
  assert.deepEqual(args.slice(-2), ["--", options.url]);
  assert.equal(args.filter((item) => item === options.url).length, 1);
  assert.ok(args.includes("--ignore-config"));
  assert.ok(args.includes("--no-playlist"));
});

test("applies the height cap to every video selection fallback", () => {
  for (const format of ["mp4", "webm"]) {
    const args = buildDownloadArgs(parseDownloadOptions({ url, format, quality: "720" }), "/tmp/savex-test");
    const selector = args[args.indexOf("--format") + 1];
    for (const fallback of selector.split("/")) assert.ok(fallback.includes("[height<=720]"));
    assert.equal(args[args.indexOf("--recode-video") + 1], format);
  }
});

test("extracts audio at the selected bitrate", () => {
  for (const format of ["mp3", "m4a"]) {
    const args = buildDownloadArgs(parseDownloadOptions({ url, format, quality: "192" }), "/tmp/savex-test");
    assert.ok(args.includes("--extract-audio"));
    assert.equal(args[args.indexOf("--audio-format") + 1], format);
    assert.equal(args[args.indexOf("--audio-quality") + 1], "192K");
    assert.ok(!args.includes("--recode-video"));
  }
});

test("parses optional timestamps and open-ended clips", () => {
  for (const [query, clip] of [
    [{ start: "90", end: "120" }, { start: 90, end: 120 }],
    [{ start: " 01:30 ", end: "2:00.250" }, { start: 90, end: 120.25 }],
    [{ start: "01:02:03.125", end: "01:03:00" }, { start: 3723.125, end: 3780 }],
    [{ start: "90:00" }, { start: 5400, end: null }],
    [{ start: "0.001" }, { start: 0.001, end: null }],
    [{ start: "00:00" }, { start: 0, end: null }],
    [{ end: "00:30" }, { start: 0, end: 30 }],
    [{ start: "", end: "10" }, { start: 0, end: 10 }],
    [{ start: "15", end: " " }, { start: 15, end: null }],
  ]) {
    assert.deepEqual(parseDownloadOptions({ url, ...query }).clip, clip);
  }
  assert.deepEqual(parseDownloadOptions({ url, start: " ", end: "" }), parseDownloadOptions({ url }));
});

test("rejects invalid timestamps and empty or reversed ranges", () => {
  for (const value of ["-1", "1e2", "NaN", "Infinity", "00:60", "01:60:00", "1:2", "1:00:60", "1:02:03:04", "1.1234", "9007199254740991", "1;whoami", "1-20", "*intro", ["1", "2"], { time: "1" }]) {
    for (const field of ["start", "end"]) {
      assert.throws(() => parseDownloadOptions({ url, [field]: value }), { status: 400 });
    }
  }
  for (const query of [{ end: "0" }, { start: "10", end: "10" }, { start: "01:00", end: "59" }]) {
    assert.throws(() => parseDownloadOptions({ url, ...query }), { status: 400, message: "End time must be later than start time." });
  }
});

test("builds bounded and one-sided clips for video and audio without changing full downloads", () => {
  for (const format of ["mp4", "webm", "mp3", "m4a"]) {
    const fullArgs = buildDownloadArgs(parseDownloadOptions({ url, format }), "/tmp/savex-test");
    assert.ok(!fullArgs.includes("--download-sections"));
    assert.ok(!fullArgs.includes("--force-keyframes-at-cuts"));
    for (const [query, range] of [
      [{ start: "1:02.500", end: "70" }, "*62.5-70"],
      [{ start: "10" }, "*10-inf"],
      [{ end: "20" }, "*0-20"],
    ]) {
      const args = buildDownloadArgs(parseDownloadOptions({ url, format, ...query }), "/tmp/savex-test");
      assert.equal(args[args.indexOf("--download-sections") + 1], range);
      assert.match(args[args.indexOf("--match-filters") + 1], /duration>\?/);
      assert.equal(args.includes("--force-keyframes-at-cuts"), ["mp4", "webm"].includes(format));
      assert.deepEqual(args.slice(-2), ["--", url]);
    }
  }
});

test("returns validation errors without starting yt-dlp", async (t) => {
  const base = await startApp(t, { runDownload: () => assert.fail("Must not run for invalid input") });
  for (const query of ["", "?url=https://localhost/a", `?url=${encodeURIComponent(url)}&format=wav`, `?url=${encodeURIComponent(url)}&url=${encodeURIComponent(url)}`, `?url=${encodeURIComponent(url)}&start=20&end=10`, `?url=${encodeURIComponent(url)}&start=1&start=2`, `?url=${encodeURIComponent(url)}&end=00:60`]) {
    const response = await fetch(`${base}/download${query}`);
    assert.equal(response.status, 400);
    assert.equal(typeof (await response.json()).error, "string");
  }
});

test("streams each requested format with the actual filename and cleans up", async (t) => {
  const directories = [];
  const base = await startApp(t, { runDownload: async (_executable, args, options) => {
    assert.ok(options.signal instanceof AbortSignal);
    const directory = args[args.indexOf("--paths") + 1];
    directories.push(directory);
    const format = args[args.indexOf(args.includes("--extract-audio") ? "--audio-format" : "--recode-video") + 1];
    const filename = path.join(directory, `Example-video.${format}`);
    await writeFile(filename, `media-${format}`);
    return { stdout: `${JSON.stringify(filename)}\n` };
  } });
  for (const format of ["mp4", "webm", "mp3", "m4a"]) {
    const response = await fetch(`${base}/download?${new URLSearchParams({ url, format })}`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("Content-Disposition"), new RegExp(`Example-video\\.${format}`));
    assert.equal(response.headers.get("Access-Control-Expose-Headers"), "Content-Disposition");
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal(await response.text(), `media-${format}`);
  }
  assert.equal(new Set(directories).size, 4);
  await Promise.all(directories.map(assertRemoved));
});

test("passes clip timestamps through the HTTP route and returns the prepared clip", async (t) => {
  let directory;
  const base = await startApp(t, { runDownload: async (_executable, args) => {
    assert.equal(args[args.indexOf("--download-sections") + 1], "*62.5-70");
    assert.equal(args[args.indexOf("--match-filters") + 1], "!is_live & duration>?62.5s");
    assert.ok(args.includes("--extract-audio"));
    directory = args[args.indexOf("--paths") + 1];
    const filename = path.join(directory, "clip.mp3");
    await writeFile(filename, "audio clip");
    return { stdout: JSON.stringify(filename) };
  } });
  const response = await fetch(`${base}/download?${new URLSearchParams({ url, format: "mp3", start: "1:02.5", end: "70" })}`);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "audio clip");
  await assertRemoved(directory);
});

test("explains empty time ranges when yt-dlp produces no clip", async (t) => {
  const base = await startApp(t, { runDownload: async () => ({ stdout: "" }) });
  const response = await fetch(`${base}/download?${new URLSearchParams({ url, start: "9999" })}`);
  assert.equal(response.status, 422);
  assert.match((await response.json()).error, /start time is within/);
});

test("cleans partial files on failure and never exposes yt-dlp stderr", async (t) => {
  let directory;
  const base = await startApp(t, { runDownload: async (_executable, args) => {
    directory = args[args.indexOf("--paths") + 1];
    await writeFile(path.join(directory, "partial.part"), "incomplete");
    throw Object.assign(new Error("internal path /private/secret"), { stderr: "ERROR: Sign in to confirm you are not a bot /private/secret" });
  } });
  const response = await fetch(`${base}/download?${new URLSearchParams({ url })}`);
  assert.equal(response.status, 422);
  const body = await response.json();
  assert.match(body.error, /sign-in/);
  assert.ok(!body.error.includes("secret"));
  await assertRemoved(directory);
});

test("does not stream files outside its download folder or with the wrong extension", async (t) => {
  const base = await startApp(t, { runDownload: async () => ({ stdout: JSON.stringify("/etc/passwd") }) });
  const response = await fetch(`${base}/download?${new URLSearchParams({ url })}`);
  assert.equal(response.status, 422);
});

test("returns actionable dependency and timeout errors", async (t) => {
  for (const [error, status, message] of [
    [{ code: "ENOENT" }, 503, /yt-dlp/],
    [{ killed: true }, 504, /too long/],
    [{ stderr: "ffmpeg not found" }, 503, /FFmpeg/],
    [{ stderr: "Requested format is not available" }, 422, /quality is unavailable/],
    [{ stderr: "certificate verify failed: CERTIFICATE_VERIFY_FAILED" }, 502, /secure connection/],
  ]) {
    const base = await startApp(t, { runDownload: async () => { throw error; } });
    const response = await fetch(`${base}/download?${new URLSearchParams({ url })}`);
    assert.equal(response.status, status);
    assert.match((await response.json()).error, message);
  }
});

test("limits simultaneous downloads and releases the slot after failure", async (t) => {
  let started;
  const didStart = new Promise((resolve) => { started = resolve; });
  let release;
  const hold = new Promise((resolve) => { release = resolve; });
  let calls = 0;
  const base = await startApp(t, { maxDownloads: 1, runDownload: async () => {
    calls += 1;
    started();
    await hold;
    throw new Error("fixture failure");
  } });
  const endpoint = `${base}/download?${new URLSearchParams({ url })}`;
  const first = fetch(endpoint);
  await didStart;
  const second = await fetch(endpoint);
  assert.equal(second.status, 503);
  assert.equal(second.headers.get("Retry-After"), "15");
  await second.json();
  release();
  await (await first).json();
  const third = await fetch(endpoint);
  assert.equal(third.status, 422);
  await third.json();
  assert.equal(calls, 2);
});

test("cancels yt-dlp on disconnect and removes partial downloads", async (t) => {
  let directory;
  let notifyStarted;
  const started = new Promise((resolve) => { notifyStarted = resolve; });
  let calls = 0;
  const base = await startApp(t, { maxDownloads: 1, runDownload: async (_executable, args, options) => {
    calls += 1;
    if (calls > 1) return { stdout: "" };
    directory = args[args.indexOf("--paths") + 1];
    await writeFile(path.join(directory, "partial.part"), "incomplete");
    notifyStarted();
    await new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    });
  } });
  const controller = new AbortController();
  const endpoint = `${base}/download?${new URLSearchParams({ url })}`;
  const download = fetch(endpoint, { signal: controller.signal });
  await started;
  controller.abort();
  await assert.rejects(download, { name: "AbortError" });
  await assertRemoved(directory);
  const next = await fetch(endpoint);
  assert.equal(next.status, 422);
  await next.json();
  assert.equal(calls, 2);
});
