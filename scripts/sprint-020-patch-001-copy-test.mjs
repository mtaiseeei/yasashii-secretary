import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderWizardScreen } from "../plugins/secretary/skills/chatwork/assets/wizard/common.js";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const files = {
  chatwork: join(repo, "plugins/secretary/skills/chatwork/assets/wizard/app.js"),
  google: join(repo, "plugins/secretary/skills/google-chat/assets/wizard/app.js"),
  common: join(repo, "plugins/secretary/skills/chatwork/assets/wizard/common.js"),
  style: join(repo, "plugins/secretary/skills/chatwork/assets/wizard/style.css"),
  resultModel: join(repo, "plugins/secretary/skills/chatwork/assets/wizard/result-model.js"),
  launcher: join(repo, "scripts/start-sprint-020-patch-001-google-chat-fixture.mjs"),
  clientHelper: join(repo, "scripts/create-sprint-020-patch-001-google-chat-test-client.mjs"),
  browserCheck: join(repo, "scripts/sprint-020-patch-001-browser-check.mjs"),
  googleFixture: join(repo, "scripts/fixtures/google-chat-wizard/google-chat.json"),
  googleServer: join(repo, "plugins/secretary/skills/google-chat/scripts/wizard-server.mjs"),
  readme: join(repo, "README.md"),
  inventory: join(repo, "docs/progress/sprint-020-patch-001-copy-inventory.md"),
};

const expectedScreens = {
  chatwork: [
    "prepare-connection", "admin-approval", "register-connection", "confirm-registration", "discover", "discover-loading",
    "discover-empty", "discover-failure", "select-rooms", "select-interval", "review", "saving", "save-failure",
    "result-loading", "settings-result", "settings-result-failure", "initial-result-loading", "initial-result",
    "initial-result-empty", "initial-result-partial", "initial-result-failure", "complete", "cancelled", "bootstrap-failure",
  ],
  google: [
    "prepare-file", "authorize", "authorize-waiting", "authorize-popup-failure",
    "authorize-failure", "discover-loading", "discover-failure", "discover-empty", "select-spaces", "select-interval", "review",
    "initial-sync-loading", "initial-sync-failure", "initial-result", "initial-result-empty", "initial-result-partial",
    "initial-result-failure", "settings-select-spaces", "settings-select-interval", "settings-review", "settings-saving",
    "settings-failure", "settings-result", "settings-result-manual", "settings-result-stopped", "cancelled", "complete",
    "bootstrap-failure",
  ],
};

const forbidden = /\b(?:wizard|workflow|commit|push|Repository Secret|loopback|runtime|scope|token|OAuth client JSON|Sprint[- ]?\d*)\b/i;
const primaryPatterns = [
  /<h1>([\s\S]*?)<\/h1>/g,
  /nowCopy\("([^"]*)"\)/g,
  /<p class="lead[^>]*>([\s\S]*?)<\/p>/g,
  /<(?:button|a)[^>]*class="[^"]*button[^"]*"[^>]*>([\s\S]*?)<\/(?:button|a)>/g,
];

function plain(value) {
  return value.replace(/<[^>]*>|\$\{[^}]*\}/g, " ").replace(/\s+/g, " ").trim();
}

export function validateCopyFixture({ chatwork, google, common, style, resultModel, launcher, clientHelper, browserCheck, googleFixture, googleServer, readme, inventory }) {
  const errors = [];
  const sources = { chatwork, google };
  for (const [service, screens] of Object.entries(expectedScreens)) {
    for (const screen of screens) {
      if (!sources[service].includes(`"${screen}"`)) errors.push(`${service}: screen ${screen} がありません`);
      if (!inventory.includes(`| ${service === "chatwork" ? "Chatwork" : "Google Chat"} | ${screen} |`)) errors.push(`${service}: inventory ${screen} がありません`);
    }
  }

  for (const [service, source] of Object.entries(sources)) {
    for (const pattern of primaryPatterns) {
      for (const match of source.matchAll(pattern)) {
        const text = plain(match[1]);
        if (forbidden.test(text)) errors.push(`${service}: primary禁止語: ${text}`);
      }
    }
    const customButtons = [...source.matchAll(/<button\b([^>]*)>/g)];
    if (customButtons.some((match) => !/aria-label=/.test(match[1]))) errors.push(`${service}: accessible nameのないbuttonがあります`);
  }

  const combined = `${chatwork}\n${google}`;
  const requiredMeanings = [
    "読む対象", "保存先", "見える人", "自動取得・保存", "履歴の保持",
    "現在の非公開GitHubリポジトリ", "共同編集者にも保存内容が見えます", "取得済み履歴を削除しません",
    "3時間ごと（おすすめ・初期値）", "ダイレクトメッセージとグループDMは対象外", "投稿、編集、削除は行いません",
  ];
  for (const meaning of requiredMeanings) if (!combined.includes(meaning)) errors.push(`必須意味がありません: ${meaning}`);
  for (const [service, source] of Object.entries(sources)) {
    for (const meaning of ["現在の非公開GitHubリポジトリ", "共同編集者にも保存内容が見えます", "取得済み履歴を削除しません"]) {
      if (!source.includes(meaning)) errors.push(`${service}: 安全上の必須意味がありません: ${meaning}`);
    }
  }
  if ((chatwork.match(/label: "読む対象"/g) || []).length !== 1 || (google.match(/label: "読む対象"/g) || []).length !== 2) errors.push("安全5要素の画面別構造が不正です");
  if (!common.includes('app.setAttribute("aria-label", detail.context)') || !common.includes("app.dataset.screen") || !common.includes("app.dataset.state")) errors.push("service accessible nameまたはDOM状態がありません");
  if (!common.includes('app.querySelectorAll("details > summary")') || !common.includes('["Enter", " "]') || !common.includes("summary.parentElement.open")) errors.push("native detailsのkeyboard開閉補助がありません");
  if (!combined.includes('data-copy-role="technical"') && !common.includes('data-copy-role="technical"')) errors.push("technical detailsがありません");
  if (!combined.includes("API Token") || !combined.includes("Repository Secret") || !google.includes("OAuth client JSON") || !google.includes("PKCE")) errors.push("管理者向け正式名称が不足しています");
  if (!google.includes('function renderDiscoverFailure(error)') || !google.includes('show("discover-failure"') || !google.includes('data-action="retry"') || !google.includes("catch (error) { renderDiscoverFailure(error); }")) errors.push("Google Chatのspace取得失敗が独立error stateへ遷移しません");
  if (!google.includes("app.querySelector('[data-action=\"back\"]').onclick = cancel") || !google.includes("app.querySelector('[data-action=\"retry\"]').onclick = discoverSpaces")) errors.push("Google Chatのspace取得失敗に戻る／再試行の操作がありません");
  if (/\.actions\s*\{\s*flex-direction:\s*column-reverse\s*;\s*\}/.test(style) || !/\.actions\s*\{\s*flex-direction:\s*column\s*;\s*\}/.test(style)) errors.push("mobileのCTA視覚順がDOM順と一致しません");
  if (!chatwork.includes("用意できたら、この設定画面へアクセスしてください") || /戻ってください/.test(chatwork)) errors.push("Chatworkの外部準備後が自然なアクセス案内ではありません");
  if (!style.includes("summary::after") || !style.includes("details[open] summary::after") || !style.includes("summary:focus-visible") || !style.includes("summary::-webkit-details-marker")) errors.push("全detailsのclosed／open表示またはvisible focusが不足しています");
  if (!google.includes("Google Cloudから取得した接続用ファイルを選びます") || !google.includes("Google Chatを設定したい") || google.includes("Google Cloud準備 1 / 3") || google.includes("google-cloud-setup-guide")) errors.push("Google Chat wizardが接続用JSON選択から始まりません");
  if (!readme.includes("AIへ **「Google Chatを設定したい」**") || !readme.includes("この設定で始める") || !readme.includes("初回取得と自動取得の設定をまとめて行います")) errors.push("READMEのAI主導線または初回一体型説明が不足しています");
  if (!google.includes('id="automatic-consent"') || !google.includes('actions("この設定で始める")') || google.includes("自動取得を設定する")) errors.push("Google Chat初回の自動取得同意または一体型CTAが不正です");
  if (!googleServer.includes('input.automaticPushConsent !== true') || !googleServer.includes("applyGoogleChatConfig") || !googleServer.includes('status: input.interval === "manual" ? "manual" : "configured"')) errors.push("Google Chat初回APIが自動／手動設定を同じ確定処理で保存しません");
  if (!browserCheck.includes("DOM.setFileInputFiles") || !browserCheck.includes("createTestOnlyDesktopClientFile")) errors.push("Google Chat browser回帰がfile chooserへ合成fileを入力していません");
  if (!chatwork.includes("chatworkInitialResultModel") || !resultModel.includes("selected.has(String(item?.roomId))") || !resultModel.includes("hiddenResultCount") || !resultModel.includes('status: allFailed ? "failed" : partial ? "partial" : zero ? "empty" : "success"')) errors.push("Chatwork完了結果が選択roomだけに絞られていません");
  if (!launcher.includes("YASASHII_GOOGLE_CHAT_FIXTURE: fixture") || !launcher.includes('scripts/fixtures/google-chat-wizard/google-chat.json')) errors.push("Google Chat初回fixture launcherが同梱fixture pathを渡していません");
  if (!launcher.includes('YASASHII_GOOGLE_CHAT_SYNTHETIC: "1"') || !launcher.includes('YASASHII_GOOGLE_CHAT_TEST_PRIVATE: "1"') || !launcher.includes('YASASHII_GOOGLE_CHAT_SKIP_GIT: "1"')) errors.push("Google Chat初回fixture launcherの外部接続防止条件が不足しています");
  if (!launcher.includes("createTestOnlyDesktopClientFile") || !launcher.includes("TEST ONLY file chooser")) errors.push("Google Chat初見評価launcherがTEST ONLY file chooser pathを示しません");
  if (!clientHelper.includes("TEST_ONLY_DO_NOT_USE_WITH_GOOGLE") || !clientHelper.includes("TEST_ONLY_SYNTHETIC_DESKTOP_CLIENT.json") || !clientHelper.includes("mode: 0o600")) errors.push("Google Chat初見評価用fileがTEST ONLYまたは権限制限を明示していません");
  if (!browserCheck.includes("DOM.setFileInputFiles") || !browserCheck.includes("createTestOnlyDesktopClientFile")) errors.push("Google Chat browser回帰がfile chooserへ合成fileを入力していません");
  const fixtureData = JSON.parse(googleFixture);
  const fixtureTypes = new Set((fixtureData.spaces || []).map((space) => space.spaceType));
  if (!["SPACE", "DIRECT_MESSAGE", "GROUP_CHAT"].every((type) => fixtureTypes.has(type))) errors.push("Google Chat同梱fixtureにSPACE／DM／グループDMが揃っていません");

  const inventoryRows = inventory.split("\n").filter((line) => /^\| (?:Chatwork|Google Chat) \|/.test(line));
  const expectedCount = expectedScreens.chatwork.length + expectedScreens.google.length;
  if (inventoryRows.length < expectedCount) errors.push(`inventory件数 ${inventoryRows.length}/${expectedCount}`);
  return errors;
}

const fixture = Object.fromEntries(Object.entries(files).map(([key, path]) => [key, readFileSync(path, "utf8")]));
const errors = validateCopyFixture(fixture);
if (errors.length) {
  for (const error of errors) process.stderr.write(`  FAIL ${error}\n`);
  process.exit(1);
}

const fakeApp = { dataset: {}, innerHTML: "" };
renderWizardScreen(fakeApp, { id: "chatwork-review", state: "ready", html: "<h1>確認</h1>" });
if (fakeApp.dataset.screen !== "chatwork-review" || fakeApp.dataset.state !== "ready" || fakeApp.innerHTML !== "<h1>確認</h1>") throw new Error("DOM状態遷移を記録できません");
renderWizardScreen(fakeApp, { id: "chatwork-saving", state: "loading", html: "<h1>保存中</h1>" });
if (fakeApp.dataset.screen !== "chatwork-saving" || fakeApp.dataset.state !== "loading") throw new Error("DOM loading状態へ遷移できません");

const brokenMeaning = { ...fixture, chatwork: fixture.chatwork.replace("共同編集者にも保存内容が見えます", "保存内容が見えます") };
const brokenScreen = { ...fixture, google: fixture.google.replace('"settings-result-manual"', '"settings-result-removed"') };
const brokenForbidden = { ...fixture, chatwork: fixture.chatwork.replace("Chatworkの公式ページで、接続に使う情報を発行します。", "wizardでtokenを発行します。") };
const brokenGoogleLauncher = { ...fixture, launcher: fixture.launcher.replace("YASASHII_GOOGLE_CHAT_FIXTURE: fixture,", "") };
const brokenDiscoverFailure = { ...fixture, google: fixture.google.replace("renderDiscoverFailure(error);", 'app.insertAdjacentHTML("beforeend", errorMessage(error));') };
const brokenMobileOrder = { ...fixture, style: fixture.style.replace("flex-direction: column;", "flex-direction: column-reverse;") };
const brokenRoomFilter = { ...fixture, resultModel: fixture.resultModel.replace(".filter((item) => selected.has(String(item?.roomId)))", "") };
const brokenFileChooser = { ...fixture, browserCheck: fixture.browserCheck.replace("DOM.setFileInputFiles", "DOM.describeNode") };
const brokenAccessCopy = { ...fixture, chatwork: fixture.chatwork.replace("この設定画面へアクセスしてください", "この設定画面へ戻ってください") };
const brokenDetailsToggle = { ...fixture, style: fixture.style.replace("details[open] summary::after", "details[data-open] summary::after") };
const brokenUnifiedFlow = { ...fixture, google: fixture.google.replace('actions("この設定で始める")', 'actions("自動取得を設定する")') };
const brokenFixtures = [
  ["安全意味", brokenMeaning], ["画面state", brokenScreen], ["primary禁止語", brokenForbidden],
  ["Google fixture path", brokenGoogleLauncher], ["Google discovery failure", brokenDiscoverFailure], ["mobile CTA order", brokenMobileOrder],
  ["Chatwork selected room result", brokenRoomFilter], ["Google file chooser", brokenFileChooser], ["Chatwork access copy", brokenAccessCopy],
  ["details toggle", brokenDetailsToggle], ["Google unified initial flow", brokenUnifiedFlow],
];
const missed = brokenFixtures.filter(([, value]) => validateCopyFixture(value).length === 0).map(([name]) => name);
if (missed.length) throw new Error(`壊したfixtureを検出できません: ${missed.join("、")}`);

process.stdout.write(`SPRINT020_PATCH001_COPY_PASS=${expectedScreens.chatwork.length + expectedScreens.google.length + 17} SPRINT020_PATCH001_COPY_FAIL=0 INVENTORY=${expectedScreens.chatwork.length + expectedScreens.google.length}\n`);
