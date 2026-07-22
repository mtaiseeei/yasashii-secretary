#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const root = mkdtempSync(join(tmpdir(), "agentic-chatwork-ime-"));
mkdirSync(join(root, "chatwork", "state"), { recursive: true });
writeFileSync(join(root, "chatwork", "config.json"), `${JSON.stringify({ version: 1, selectedRoomIds: ["101", "102"], interval: "3h", scheduleEnabled: false }, null, 2)}\n`);
writeFileSync(join(root, "chatwork", "rooms.json"), `${JSON.stringify({ version: 1, status: "ready", fetchedAt: "2026-07-22T00:00:00.000Z", rooms: [
  { roomId: "101", name: "営業チーム" },
  { roomId: "102", name: "商品開発" },
  { roomId: "103", name: "経営会議" },
  { roomId: "104", name: "採用プロジェクト" },
] }, null, 2)}\n`);
writeFileSync(join(root, "chatwork", "state", "sync.json"), `${JSON.stringify({ version: 1, status: "success", attemptedAt: "2026-07-22T00:00:00.000Z", lastSuccessAt: "2026-07-22T00:00:00.000Z", results: [] }, null, 2)}\n`);

const server = resolve(process.cwd(), "plugins/secretary/skills/chatwork/scripts/wizard-server.mjs");
const port = process.argv[2] || "18835";
const child = spawn(process.execPath, [server, "--root", root, "--port", port], {
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_ENV: "test",
    YASASHII_CHATWORK_TEST_PRIVATE: "1",
    YASASHII_CHATWORK_SKIP_DISPATCH: "1",
    YASASHII_CHATWORK_SKIP_GIT: "1",
    YASASHII_CHATWORK_TEST_SECRET: "1",
  },
});
const cleanup = () => rmSync(root, { recursive: true, force: true });
process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
child.on("exit", (code) => { cleanup(); process.exit(code || 0); });
