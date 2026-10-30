import { downloadDiagnostic } from "./media.js";

export function logInfo(event) {
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), level: "info", ...event }));
}

export function logError(event) {
  console.error(JSON.stringify({ timestamp: new Date().toISOString(), level: "error", ...event }));
}

export async function observeDownload(execution, onLine) {
  const stderr = execution.child?.stderr;
  if (!stderr) return await execution;
  let pending = "";
  const emit = (line) => {
    if (line.trim()) onLine(downloadDiagnostic({ stderr: line }));
  };
  const onData = (chunk) => {
    pending += chunk;
    const lines = pending.split(/\r?\n/);
    pending = lines.pop();
    // Redact complete lines so a secret split across stream chunks is still removed.
    lines.forEach(emit);
  };
  stderr.setEncoding("utf8");
  stderr.on("data", onData);
  try {
    return await execution;
  } finally {
    stderr.off("data", onData);
    emit(pending);
  }
}
