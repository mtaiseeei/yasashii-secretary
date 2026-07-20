#!/usr/bin/env node

import { runExternal } from "./external-ops.mjs";

let source = "";
for await (const chunk of process.stdin) source += chunk;

function encoded(value) {
  return Buffer.from(String(value || "")).toString("base64");
}

try {
  const payload = JSON.parse(source || "{}");
  const options = payload.options || {};
  if (options.input !== null && options.input !== undefined) {
    options.input = Buffer.from(options.input, "base64");
  } else {
    delete options.input;
  }
  const result = await runExternal(payload.binary, payload.args || [], options);
  process.stdout.write(JSON.stringify({ ok: true, ...result, stdout: encoded(result.stdout), stderr: encoded(result.stderr) }));
} catch (error) {
  process.stdout.write(JSON.stringify({
    ok: false,
    name: error?.name,
    message: error?.message,
    code: error?.code,
    timeoutMs: error?.timeoutMs,
    killed: error?.killed,
    status: error?.status,
    signal: error?.signal,
    stdout: encoded(error?.stdout),
    stderr: encoded(error?.stderr),
  }));
}
