#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(join(repo, relative), "utf8");
const files = {
  common: read("plugins/yasashii-secretary/skills/chatwork/assets/wizard/common.js"),
  chatwork: read("plugins/yasashii-secretary/skills/chatwork/assets/wizard/app.js"),
  google: read("plugins/yasashii-secretary/skills/google-chat/assets/wizard/app.js"),
  style: read("plugins/yasashii-secretary/skills/chatwork/assets/wizard/style.css"),
  mcp: JSON.parse(read("plugins/yasashii-secretary/.mcp.json")),
  onboarding: read("plugins/yasashii-secretary/skills/onboarding/SKILL.md"),
  readme: read("README.md"),
  guide: ["README.md", "features.md", "connectors.md", "getting-started.md", "updates.md"].map((name) => read(`docs/guide/${name}`)).join("\n"),
  marketplace: JSON.parse(read(".claude-plugin/marketplace.json")),
  plugin: JSON.parse(read("plugins/yasashii-secretary/.claude-plugin/plugin.json")),
};

let pass = 0;
let fail = 0;
function check(label, condition) {
  if (condition) { pass += 1; process.stdout.write(`PASS ${label}\n`); }
  else { fail += 1; process.stderr.write(`FAIL ${label}\n`); }
}

const combinedWizard = `${files.common}\n${files.chatwork}\n${files.google}`;
check("画面状態とheadingのaccessible nameを設定", files.common.includes("app.setAttribute?.(\"aria-labelledby\", heading.id)") && files.common.includes("heading.tabIndex = -1"));
check("画面遷移でheadingへfocus", files.common.includes("app.querySelector(\"h1\")?.focus?.({ preventScroll: true })"));
check("同一画面で入力focusとcaretを復元", files.common.includes("selectionStart") && files.common.includes("setSelectionRange") && files.common.includes("sameScreen && target"));
check("検索・選択のfocus keyを持つ", combinedWizard.includes("data-focus-key=\"room-") && combinedWizard.includes("data-focus-key=\"space-") && combinedWizard.includes("data-focus-key=\"settings-space-"));
check("両wizardが共通shellを使う", files.chatwork.includes('installWizardShell("chatwork")') && files.google.includes('installWizardShell("google-chat")'));
check("buttonはaccessible nameを持つ", [...combinedWizard.matchAll(/<button\b([^>]*)>/g)].every((match) => /aria-label=/.test(match[1])));
check("外部linkはaccessible nameと新しいtab説明を持つ", combinedWizard.includes("新しいタブで開く") && combinedWizard.includes("rel=\"noopener noreferrer\""));
check("主要操作領域は44px以上", /\.button\s*\{[^}]*min-height:\s*48px/.test(files.style) && /summary\s*\{[^}]*min-height:\s*48px/.test(files.style) && /\.choice\s*\{[^}]*min-height:\s*64px/.test(files.style) && /\.consent\s*\{[^}]*min-height:\s*48px/.test(files.style) && /a\.text-link\s*\{[^}]*min-height:\s*44px/.test(files.style));
check("長いラベルを折り返し横overflowを防止", files.style.includes("overflow-wrap: anywhere") && !files.style.includes("overflow-x: visible"));
check("hoverだけで操作を成立させていない", !combinedWizard.match(/onmouseover|onmouseenter|onmouseleave|addEventListener\(["']mouseover|addEventListener\(["']mouseenter/));
check("detailsはkeyboard開閉とvisible focusを持つ", files.common.includes('["Enter", " "]') && files.style.includes("summary:focus-visible") && files.style.includes("summary::after"));

check(".mcp.jsonの公式connector説明が現行", files.mcp.mcpServers && Object.keys(files.mcp.mcpServers).length === 0 && /Microsoft 365/.test(files.mcp._NOTE) && /Notion/.test(files.mcp._NOTE) && /Chatwork/.test(files.mcp._NOTE) && /Google Chat/.test(files.mcp._NOTE) && !/後続で対応予定|今のところ Google のみ/.test(files.mcp._NOTE));
check("onboardingが両チャットとCloud準備を説明", /Chatwork／Google Chat/.test(files.onboarding) && /Cloud準備/.test(files.onboarding) && /Google Chatを設定したい/.test(files.onboarding));
check("READMEが0.7.0と更新復元を説明", /0\.7\.0/.test(files.readme) && /更新/.test(files.readme) && /復元/.test(files.readme));
check("READMEがCloud準備と配布前gateを説明", /Google Cloud/.test(files.readme) && /配布前/.test(files.readme) && /private test workspace/.test(files.readme));
check("公開guideが両チャット・Cloud・更新復元を説明", /Google Chat/.test(files.guide) && /Cloud/.test(files.guide) && /更新/.test(files.guide) && /復元/.test(files.guide));
check("公開guideに古い後続予定説明がない", !/後続で対応予定|今のところ Google のみ/.test(files.guide));
check("配布metadataのauthor・MIT・forkedFromが一致", JSON.stringify(files.marketplace.plugins?.[0]?.author) === JSON.stringify(files.plugin.author) && files.marketplace.plugins?.[0]?.license === "MIT" && files.plugin.license === "MIT" && files.marketplace.plugins?.[0]?.forkedFrom === "https://github.com/Shin-sibainu/cc-company");

const screenMarkers = {
  Chatwork: ["prepare-connection", "admin-approval", "register-connection", "confirm-registration", "discover-loading", "discover-empty", "discover-failure", "select-rooms", "select-interval", "review", "saving", "save-failure", "result-loading", "settings-result", "settings-result-failure", "initial-result", "initial-result-empty", "initial-result-partial", "initial-result-failure", "complete", "cancelled"],
  "Google Chat": ["prepare-file", "authorize", "authorize-waiting", "authorize-popup-failure", "authorize-failure", "discover-loading", "discover-failure", "discover-empty", "select-spaces", "select-interval", "review", "initial-sync-loading", "initial-sync-failure", "initial-result", "initial-result-empty", "initial-result-partial", "initial-result-failure", "settings-select-spaces", "settings-select-interval", "settings-review", "settings-saving", "settings-failure", "settings-result", "settings-result-manual", "settings-result-stopped", "cancelled", "complete"],
};
for (const [service, screens] of Object.entries(screenMarkers)) {
  const source = service === "Chatwork" ? files.chatwork : files.google;
  for (const screen of screens) check(`${service} screen inventory: ${screen}`, source.includes(`"${screen}"`));
}

process.stdout.write(`SPRINT027_COPY_PASS=${pass} SPRINT027_COPY_FAIL=${fail}\n`);
process.exitCode = fail ? 1 : 0;
