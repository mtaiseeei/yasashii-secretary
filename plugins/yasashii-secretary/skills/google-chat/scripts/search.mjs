#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { runExternalSync } from "../../../scripts/lib/external-ops.mjs";

function files(root) {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? files(join(root, entry.name)) : entry.name.endsWith(".md") ? [join(root, entry.name)] : []);
}

export function searchGoogleChat({ root, query, space = "", sender = "", from = "", to = "", skipPull = false }) {
  root = resolve(root);
  if (!skipPull) {
    try {
      runExternalSync(process.env.YASASHII_GIT_BIN || "git", ["pull", "--ff-only"], {
        cwd: root,
        timeoutMs: Number(process.env.YASASHII_CLI_TIMEOUT_MS || 30_000),
        label: "git pull",
      });
    } catch (error) {
      if (error?.code === "timeout") return { status: "sync-failed", code: "timeout", message: "Gitの取り込みが時間切れになりました。保存済み履歴は変更していません。" };
      return { status: "pull-failed", message: "最新のGit状態を取り込めませんでした。保存済み履歴は変更していません。" };
    }
  }
  const matches = [];
  for (const path of files(join(root, "google-chat", "history"))) {
    const relative = path.slice(root.length + 1);
    const date = path.match(/(\d{4}-\d{2}-\d{2})\.md$/)?.[1] || "";
    const source = readFileSync(path, "utf8");
    if (space && !source.toLocaleLowerCase("ja").includes(space.toLocaleLowerCase("ja"))) continue;
    if (sender && !source.toLocaleLowerCase("ja").includes(sender.toLocaleLowerCase("ja"))) continue;
    if (from && date < from) continue;
    if (to && date > to) continue;
    const lines = source.split("\n");
    lines.forEach((line, index) => { if (line.toLocaleLowerCase("ja").includes(query.toLocaleLowerCase("ja"))) matches.push({ path: relative, date, line: index + 1, excerpt: line.slice(0, 240) }); });
  }
  if (matches.length) return { status: "found", matches: matches.slice(0, 50) };
  return { status: "not-found-locally", message: "保存済みのGoogle Chat履歴では見つかりませんでした。未選択スペース、組織の保持設定、APIが返さない履歴、検索条件の可能性があるため、Google Chatに存在しないとは断定できません。", possibleReasons: ["未選択スペース", "組織の保持設定", "APIが返さない履歴", "検索条件", "編集・削除"] };
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  const args = new Map();
  for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i], process.argv[i + 1]);
  process.stdout.write(`${JSON.stringify(searchGoogleChat({ root: args.get("--root") || process.cwd(), query: args.get("--query") || "", space: args.get("--space"), sender: args.get("--sender"), from: args.get("--from"), to: args.get("--to"), skipPull: args.get("--skip-pull") === "yes" }), null, 2)}\n`);
}
