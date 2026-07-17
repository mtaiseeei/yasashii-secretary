#!/usr/bin/env node

import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export function createTestOnlyDesktopClientFile() {
  const directory = mkdtempSync(join(tmpdir(), "yasashii-google-chat-test-only-"));
  const path = join(directory, "TEST_ONLY_SYNTHETIC_DESKTOP_CLIENT.json");
  const marker = [Date.now(), process.pid].join("-");
  const body = {
    TEST_ONLY_DO_NOT_USE_WITH_GOOGLE: "Synthetic file for local evaluator file-chooser testing only. It cannot identify a real OAuth client.",
    installed: {
      client_id: ["TEST", "ONLY", "SYNTHETIC", "CLIENT", marker].join("_"),
      client_secret: ["TEST", "ONLY", "NOT", "A", "SECRET", marker].join("_"),
      auth_uri: "https://accounts.google.com/o/oauth2/v2/auth",
      token_uri: "https://oauth2.googleapis.com/token",
      redirect_uris: ["http://localhost"],
    },
  };
  writeFileSync(path, `${JSON.stringify(body, null, 2)}\n`, { mode: 0o600 });
  chmodSync(path, 0o600);
  return { directory, path };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const fixture = createTestOnlyDesktopClientFile();
  process.stdout.write(`${fixture.path}\n`);
}
