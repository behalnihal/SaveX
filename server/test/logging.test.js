import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";
import { observeDownload } from "../logging.js";

const run = promisify(execFile);

test("streams redacted stderr lines while preserving the downloader's stdout", async () => {
  const lines = [];
  const execution = run(process.execPath, ["-e", `
    process.stderr.write('WARNING: Cookie: SID=sec');
    setTimeout(() => {
      process.stderr.write('ret\\nWARNING: https://user:secret@proxy.example/?token=secret');
      process.stdout.write('"/tmp/video.mp4"\\n');
    }, 20);
  `]);
  const result = await observeDownload(execution, (line) => lines.push(line));
  assert.equal(result.stdout, '"/tmp/video.mp4"\n');
  assert.equal(lines.length, 2);
  assert.ok(lines.every((line) => !line.includes("secret")));
  assert.ok(lines[0].includes("[redacted]"));
  assert.ok(lines[1].includes("[url]"));
});

test("preserves failed execution errors after reporting incomplete stderr lines", async () => {
  const lines = [];
  const execution = run(process.execPath, ["-e", "process.stderr.write('ERROR: failed'); process.exitCode = 1;"]);
  await assert.rejects(observeDownload(execution, (line) => lines.push(line)), (error) => {
    assert.equal(error.code, 1);
    assert.equal(error.stderr, "ERROR: failed");
    return true;
  });
  assert.deepEqual(lines, ["ERROR: failed"]);
});
