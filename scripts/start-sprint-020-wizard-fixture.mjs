#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const root = mkdtempSync(join(tmpdir(), "yasashii-google-chat-settings-"));
mkdirSync(join(root, "google-chat", "state"), { recursive: true });
writeFileSync(join(root, "google-chat", "config.json"), `${JSON.stringify({ version: 2, selectedSpaceNames: ["spaces/space-a", "spaces/space-b"], selectedSpaces: [{ name: "spaces/space-a", displayName: "営業共有", spaceType: "SPACE" }, { name: "spaces/space-b", displayName: "企画共有", spaceType: "SPACE" }], interval: "3h", scheduleEnabled: true, automaticPushConsent: true }, null, 2)}\n`);
writeFileSync(join(root, "google-chat", "spaces.json"), `${JSON.stringify({ version: 1, capturedAt: "2026-07-17T00:00:00.000Z", spaces: [{ name: "spaces/space-a", displayName: "営業共有", spaceType: "SPACE" }, { name: "spaces/space-b", displayName: "企画共有", spaceType: "SPACE" }, { name: "spaces/space-c", displayName: "全社連絡", spaceType: "SPACE" }] }, null, 2)}\n`);
writeFileSync(join(root, "google-chat", "state", "sync.json"), `${JSON.stringify({ version: 2, status: "partial", attemptedAt: "2026-07-17T06:00:00.000Z", lastSuccessAt: "2026-07-17T03:00:00.000Z", cursors: { "spaces/space-a": { lastSuccessAt: "2026-07-17T06:00:00.000Z" }, "spaces/space-b": { lastSuccessAt: "2026-07-17T03:00:00.000Z" } }, results: [{ name: "spaces/space-a", status: "success" }, { name: "spaces/space-b", status: "failed", code: "network" }] }, null, 2)}\n`);

const server = resolve(process.cwd(), "plugins/secretary/skills/google-chat/scripts/wizard-server.mjs");
const port = process.argv[2] || "18770";
const child = spawn(process.execPath, [server, "--root", root, "--port", port], { stdio: "inherit", env: { ...process.env, YASASHII_GOOGLE_CHAT_SYNTHETIC: "1", YASASHII_GOOGLE_CHAT_TEST_PRIVATE: "1", YASASHII_GOOGLE_CHAT_TEST_SECRETS: "1", YASASHII_GOOGLE_CHAT_SKIP_GIT: "1" } });
const cleanup = () => { rmSync(root, { recursive: true, force: true }); };
process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
child.on("exit", (code) => { cleanup(); process.exit(code || 0); });
