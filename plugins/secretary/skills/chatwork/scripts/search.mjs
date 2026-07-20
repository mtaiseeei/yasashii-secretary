#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

function parse(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    if (!argv[index]?.startsWith("--") || argv[index + 1] === undefined) {
      process.stderr.write("検索条件は --query などの名前つきで指定してください。\n");
      process.exit(2);
    }
    values.set(argv[index], argv[index + 1]);
  }
  return values;
}

function dateOf(epoch) {
  return new Date(Number(epoch) * 1000).toISOString().slice(0, 10);
}

const args = parse(process.argv.slice(2));
const query = (args.get("--query") || "").trim();
if (!query) {
  process.stderr.write("検索キーワードを --query で指定してください。\n");
  process.exit(2);
}
const root = resolve(args.get("--root") || process.cwd());
const history = join(root, "chatwork", "history");
const roomFilter = (args.get("--room") || "").toLocaleLowerCase("ja");
const accountFilter = (args.get("--account") || "").toLocaleLowerCase("ja");
const from = args.get("--from") || "0000-00-00";
const to = args.get("--to") || "9999-99-99";
const needle = query.toLocaleLowerCase("ja");
const matches = [];

if (existsSync(history)) {
  for (const file of readdirSync(history).filter((name) => /^\d+\.json$/.test(name)).sort()) {
    let data;
    try {
      data = JSON.parse(readFileSync(join(history, file), "utf8"));
    } catch {
      continue;
    }
    for (const message of data.messages || []) {
      const date = dateOf(message.sentAt);
      const room = `${message.roomName || ""} ${message.roomId || ""}`.toLocaleLowerCase("ja");
      const account = `${message.accountName || ""} ${message.accountId || ""}`.toLocaleLowerCase("ja");
      if (!String(message.body || "").toLocaleLowerCase("ja").includes(needle)) continue;
      if (roomFilter && !room.includes(roomFilter)) continue;
      if (accountFilter && !account.includes(accountFilter)) continue;
      if (date < from || date > to) continue;
      matches.push({
        roomId: String(message.roomId),
        roomName: String(message.roomName),
        accountName: String(message.accountName),
        date,
        excerpt: String(message.body).replace(/\s+/g, " ").slice(0, 240),
        messageId: String(message.messageId),
      });
    }
  }
}

matches.sort((a, b) => b.date.localeCompare(a.date) || b.messageId.localeCompare(a.messageId));
if (matches.length === 0) {
  process.stdout.write(`${JSON.stringify({ status: "not-found-locally", query, message: "現在の保存済み履歴には見つかりません。導入前や最新100件より前の履歴には存在する可能性があります。" }, null, 2)}\n`);
} else {
  process.stdout.write(`${JSON.stringify({ status: "found", query, count: matches.length, matches }, null, 2)}\n`);
}
