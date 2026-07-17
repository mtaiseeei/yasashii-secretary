#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createTestOnlyDesktopClientFile } from "./create-sprint-020-patch-001-google-chat-test-client.mjs";

const root = mkdtempSync(join(tmpdir(), "yasashii-google-chat-new-"));
const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const server = resolve(repo, "plugins/yasashii-secretary/skills/google-chat/scripts/wizard-server.mjs");
const fixture = resolve(repo, "scripts/fixtures/google-chat-wizard/google-chat.json");
const testClient = createTestOnlyDesktopClientFile();
const port = process.argv[2] || "18783";
const child = spawn(process.execPath, [server, "--root", root, "--port", port], {
  stdio: "inherit",
  env: {
    ...process.env,
    YASASHII_GOOGLE_CHAT_SYNTHETIC: "1",
    YASASHII_GOOGLE_CHAT_TEST_PRIVATE: "1",
    YASASHII_GOOGLE_CHAT_TEST_SECRETS: "1",
    YASASHII_GOOGLE_CHAT_SKIP_GIT: "1",
    YASASHII_GOOGLE_CHAT_FIXTURE: fixture,
  },
});

process.stdout.write(`TEST ONLY file chooser: ${testClient.path}\n`);

const cleanup = () => {
  rmSync(root, { recursive: true, force: true });
  rmSync(testClient.directory, { recursive: true, force: true });
};
process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
child.on("exit", (code) => {
  cleanup();
  process.exit(code || 0);
});
