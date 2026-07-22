import { bindWizardSearch, escapeHtml as escape, externalLink, installWizardShell, nowCopy, renderWizardScreen, safetyList, setProgress as progress, technicalDetails, wizardActions as actions } from "/common.js";
import { cleanupDescription } from "/cleanup.js";

const { app } = installWizardShell("google-chat");
const state = { oauth: null, cleanup: null, config: null, sync: null, spaces: [], selected: new Set(), interval: "3h", query: "", saveConsent: false, commitPushConsent: false, automaticPushConsent: false, testing: false };
let oauthPollGeneration = 0;
const frequencies = [["1h", "1時間ごと"], ["3h", "3時間ごと（おすすめ・初期値）"], ["6h", "6時間ごと"], ["12h", "12時間ごと"], ["manual", "手動のみ"]];
const links = {
  permissions: "https://myaccount.google.com/permissions",
};

function errorMessage(error) {
  return `<p class="error" data-copy-role="error" role="alert">処理を完了できませんでした。</p><p class="notice">通信や設定を確認して、もう一度お試しください。</p>${technicalDetails("管理者向け: エラーの詳しい内容", `<p>${escape(error.message || "詳しい原因を確認できませんでした。")}</p>`, "admin")}`;
}

function show(id, html, stateName = "ready") {
  renderWizardScreen(app, { id: `google-chat-${id}`, state: stateName, html });
}

async function json(url, options = {}) {
  const request = { ...options };
  if (String(request.method || "GET").toUpperCase() === "POST") {
    request.headers = { ...(request.headers || {}), "content-type": "application/json" };
    if (request.body === undefined) request.body = "{}";
  }
  const response = await fetch(url, request);
  const result = await response.json();
  if (!response.ok) throw Object.assign(new Error(result.error || result.message), { code: result.code, details: result });
  return result;
}

function renderPrepareFile() {
  progress(0);
  show("prepare-file", `<p class="eyebrow">接続 1 / 3</p><h1>Google Cloudから取得した接続用ファイルを選びます。</h1>
    ${nowCopy("AIと一緒に準備した接続用JSONを、このPCから選びます。")}
    <div class="panel"><label class="search-label" for="client-json">Google Cloudから取得した接続用ファイル</label><input id="client-json" type="file" accept="application/json,.json"><p class="hint">ファイルの内容は外部へ送らず、この画面にも表示しません。</p>
    ${technicalDetails("管理者向け: ファイルの正式名称と安全な扱い", "<p>正式名称は <strong>OAuth client JSON</strong> です。内容はこのPCのloopback内だけで読み、外部へuploadしません。client secretやclient IDを画面、ログ、リポジトリへ残しません。</p>", "admin")}</div>
    <p class="notice">まだ接続用JSONがない場合は、設定を終了してAIへ「Google Chatを設定したい」と伝えてください。</p>
    <div class="actions" data-copy-role="actions"><button class="button button-secondary" data-action="back" aria-label="Google Chatの設定を終了してAIの案内へ戻る">設定を終了する</button><button class="button button-primary" data-action="next" aria-label="Google Cloudの接続用ファイルを確認する" disabled>接続用ファイルを確認する</button></div>`);
  const input = app.querySelector("#client-json");
  const next = app.querySelector('[data-action="next"]');
  input.onchange = () => { next.disabled = !input.files?.[0]; };
  next.onclick = async () => {
    next.disabled = true;
    try {
      const clientJson = await input.files[0].text();
      state.oauth = await json("/api/oauth/client", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ clientJson }) });
      input.value = "";
      renderAuthorize();
    } catch (error) { next.disabled = false; app.insertAdjacentHTML("beforeend", errorMessage(error)); }
  };
  app.querySelector('[data-action="back"]').onclick = cancel;
}

function renderAuthorize() {
  oauthPollGeneration += 1;
  progress(0);
  show("authorize", `<p class="eyebrow">接続 2 / 3</p><h1>Googleアカウントで接続を許可します。</h1>
    ${nowCopy("Googleの確認画面を開き、Google Chatを読むことを許可します。")}
    <div class="panel"><p class="panel-title">許可すること</p><ul><li>参加中の通常スペースを確認する</li><li>選んだ通常スペースのメッセージを読む</li><li>発言者名を確認する</li></ul><p class="hint">メッセージの投稿、編集、削除は行いません。</p>
    ${technicalDetails("管理者向け: 認証と安全機構", "<p>Googleのパスワードを渡さず、許可した範囲だけ読む仕組み（OAuth）を使います。read-only scope、PKCE、state検証、loopbackを使い、認可コードとtokenは記録しません。membership権限や書き込み権限は求めません。</p>", "admin")}</div>
    <div class="actions" data-copy-role="actions"><button class="button button-secondary" data-action="back" aria-label="Google Cloudの接続用ファイルへ戻る">戻る</button>${state.testing ? '<button class="button button-primary" data-action="synthetic" aria-label="合成データでGoogle接続後の画面を確認する">合成データで接続を確認する</button>' : '<button class="button button-primary" data-action="authorize" aria-label="Googleの確認画面を新しいタブで開く">Googleの確認画面を開く</button>'}</div>`);
  app.querySelector('[data-action="back"]').onclick = renderPrepareFile;
  if (state.testing) app.querySelector('[data-action="synthetic"]').onclick = async () => { try { state.oauth = await json("/api/oauth/synthetic", { method: "POST", headers: { "content-type": "application/json" }, body: '{"mode":"success"}' }); await discoverSpaces(); } catch (error) { app.insertAdjacentHTML("beforeend", errorMessage(error)); } };
  else app.querySelector('[data-action="authorize"]').onclick = startOAuth;
}

async function startOAuth() {
  let authWindow = null;
  try { authWindow = window.open("about:blank", "yasashii-google-chat-oauth"); } catch { /* popup拒否は下で案内 */ }
  if (!authWindow) {
    renderOAuthWaiting({ popupBlocked: true });
    return;
  }
  try {
    await json("/api/oauth/authorize", { method: "POST" });
    authWindow.location.replace("/api/oauth/authorize");
    authWindow.opener = null;
  } catch (error) {
    try { authWindow.close(); } catch { /* 既に閉じられている */ }
    renderOAuthFailure(error.message);
    return;
  }
  const generation = ++oauthPollGeneration;
  renderOAuthWaiting({ authWindow, generation });
  window.setTimeout(() => waitForOAuth({ authWindow, generation }), 300);
}

function renderOAuthWaiting({ authWindow = null, generation = ++oauthPollGeneration, popupBlocked = false } = {}) {
  progress(0);
  show(popupBlocked ? "authorize-popup-failure" : "authorize-waiting", `<p class="eyebrow">接続 2 / 3</p><h1>${popupBlocked ? "Googleの確認画面を開けませんでした。" : "Googleの許可を待っています。"}</h1>
    <p class="lead ${popupBlocked ? "error" : ""}" data-copy-role="${popupBlocked ? "error" : "status"}" data-oauth-status>${popupBlocked ? "ブラウザで新しい画面を開けませんでした。" : "新しい画面でGoogle Chatへの接続を許可してください。"}</p>
    <p class="notice">${popupBlocked ? "ブラウザのポップアップを許可して、もう一度開いてください。" : "許可が終わると、通常スペースの選択へ自動で進みます。"}</p>
    ${technicalDetails("詳しい説明: 新しい画面を閉じた場合", "<p>確認画面を閉じても、この設定画面は残ります。許可の途中で閉じた場合は、もう一度開いてやり直せます。</p>")}
    <div class="actions" data-copy-role="actions"><button class="button button-secondary" data-action="cancel" aria-label="Google Chatの接続を中止して後始末する">接続を中止する</button><button class="button button-primary" data-action="reopen" aria-label="Googleの確認画面を新しいタブでもう一度開く">Googleの確認画面を${popupBlocked ? "開く" : "もう一度開く"}</button></div>`, popupBlocked ? "error" : "loading");
  app.querySelector('[data-action="cancel"]').onclick = cancel;
  app.querySelector('[data-action="reopen"]').onclick = startOAuth;
  if (!popupBlocked && !authWindow) window.setTimeout(() => waitForOAuth({ authWindow: null, generation }), 300);
}

async function waitForOAuth({ authWindow = null, generation = oauthPollGeneration } = {}) {
  let closedReported = false;
  for (let retry = 0; retry < 240; retry += 1) {
    if (generation !== oauthPollGeneration) return;
    try { state.oauth = await json("/api/oauth/status"); }
    catch (error) {
      const status = app.querySelector("[data-oauth-status]");
          if (status) status.textContent = "Googleの許可状態を確認できませんでした。通信を確認してください。";
      await new Promise((wait) => window.setTimeout(wait, 1000));
      continue;
    }
    if (state.oauth.status === "connected") return discoverSpaces();
    if (state.oauth.status === "failed") { renderOAuthFailure(); return; }
    if (state.oauth.status === "cleanup-required" || state.oauth.status === "closed") { renderCancelled(state.oauth.cleanup); return; }
    if (authWindow && !closedReported) {
      try {
        if (authWindow.closed) {
          closedReported = true;
          const status = app.querySelector("[data-oauth-status]");
          if (status) status.textContent = "Googleの確認画面が閉じられました。許可済みか確認を続けています。";
        }
      } catch { /* cross-originのWindowProxyは状態APIで確認する */ }
    }
    await new Promise((wait) => window.setTimeout(wait, 1000));
  }
  renderOAuthFailure("認証結果を確認できませんでした。設定画面を再読み込みしてください。");
}

function renderOAuthFailure(message = state.oauth?.message) {
  progress(0);
  const checklist = state.oauth?.managerChecklist ? `<div data-volatile="manager-checklist"><p>管理者には、対象のGoogle Cloud projectで次の読み取り権限が許可されているか確認を依頼してください。</p><ul>${state.oauth.managerChecklist.scopes.map((scope) => `<li><code>${escape(scope)}</code></li>`).join("")}</ul><p>秘密の値、認可URL、callback URLは表示していません。</p></div>` : "";
  show("authorize-failure", `<p class="eyebrow">接続できませんでした</p><h1>Google Chatとの接続を確認できませんでした。</h1><p class="lead error" data-copy-role="error" role="alert">Googleの許可を完了できませんでした。</p><p class="notice">表示された理由を確認し、必要なら管理者へ伝えてから接続をやり直してください。</p>${technicalDetails("管理者向け: エラーの詳しい内容", `<p>${escape(message || "詳しい原因を確認できませんでした。")}</p><p>拒否、Audience不一致、管理者ブロック、API無効、<code>redirect_uri_mismatch</code> では対応が異なります。</p>${checklist}`, "admin")}${actions("Google Chatの接続を最初から確認する", "Google Chatの設定を変更せず終了する")}`, "error");
  app.querySelector('[data-action="next"]').onclick = renderPrepareFile;
  app.querySelector('[data-action="back"]').onclick = cancel;
}

async function discoverSpaces() {
  progress(0);
  show("discover-loading", '<p class="eyebrow">接続 3 / 3</p><h1>Google Chatの通常スペースを確認しています。</h1><p class="lead" data-copy-role="status">参加している通常スペースの一覧を取得しています。</p><p class="notice">ダイレクトメッセージとグループDMは読みません。</p>', "loading");
  try {
    const result = await json("/api/spaces", { method: "POST" });
    state.spaces = result.spaces;
    state.selected = new Set(state.config?.selectedSpaceNames || []);
    if (result.zero) return renderNoSpaces(result.cleanup);
    if (state.config) return renderSettingsSpaces({ refreshed: true });
    renderSpaces();
  } catch (error) { renderDiscoverFailure(error); }
}

function renderDiscoverFailure(error) {
  progress(0);
  const code = error.code ? `<p>エラー種別: <code>${escape(error.code)}</code></p>` : "";
  show("discover-failure", `<p class="eyebrow">接続を確認できません</p><h1>Google Chatの通常スペースを確認できませんでした。</h1><p class="lead error" data-copy-role="error" role="alert">参加している通常スペースの一覧を取得できませんでした。</p><p class="notice">通信やGoogle Chatの設定を確認して、もう一度お試しください。</p>${technicalDetails("管理者向け: エラーの詳しい内容", `<p>${escape(error.message || "詳しい原因を確認できませんでした。")}</p>${code}`, "admin")}<div class="actions" data-copy-role="actions"><button class="button button-secondary" data-action="back" aria-label="Google Chatの接続を後始末して設定を終了する">設定を終了する</button><button class="button button-primary" data-action="retry" aria-label="Google Chatの通常スペースをもう一度確認する">通常スペースをもう一度確認する</button></div>`, "error");
  app.querySelector('[data-action="back"]').onclick = cancel;
  app.querySelector('[data-action="retry"]').onclick = discoverSpaces;
}

function renderNoSpaces(cleanup) {
  progress(0);
  const detail = cleanupDescription(cleanup);
  show("discover-empty", `<p class="eyebrow">接続 3 / 3</p><h1>選べるGoogle Chatスペースはまだありません。</h1><p class="lead" data-copy-role="result">通常スペースが0件でも、接続の失敗ではありません。</p><p class="notice">参加状況と管理者の設定を確認してから、もう一度接続できます。</p><p class="${detail.kind === "manual" ? "error" : "notice"}" role="${detail.kind === "manual" ? "alert" : "status"}">${escape(detail.text)}</p>${technicalDetails("管理者向け: 接続の後始末", `<p>${escape(detail.technical || "接続情報の後始末結果を確認してください。")}</p><p>${externalLink(links.permissions, "Googleのアプリ権限を確認する")}</p>`, "admin")}<div class="actions" data-copy-role="actions"><button class="button button-secondary" data-action="back" aria-label="Google Chatの設定を終了する">設定を終了する</button><button class="button button-primary" data-action="retry" aria-label="${detail.kind === "manual" ? "Google Chatの接続情報の後始末をもう一度試す" : "Google Chatの接続を最初から確認する"}">${detail.kind === "manual" ? "後始末をもう一度試す" : "接続を最初から確認する"}</button></div>`, detail.kind === "manual" ? "error" : "empty");
  app.querySelector('[data-action="back"]').onclick = () => renderCancelled(cleanup);
  app.querySelector('[data-action="retry"]').onclick = detail.kind === "manual" ? cancel : renderPrepareFile;
}

function renderSpaces() {
  progress(1);
  const shown = filteredSpaces();
  show("select-spaces", `<p class="eyebrow">設定 1 / 4</p><h1>保存するGoogle Chatスペースを選びます。</h1>${nowCopy("保存したい通常スペースにチェックを入れます。")}
    <div class="panel"><label class="search-label" for="space-search">通常スペースを検索</label><input class="search" id="space-search" data-focus-key="space-search" type="search" value="${escape(state.query)}" placeholder="スペース名"><button class="text-button" data-action="clear" type="button" aria-label="Google Chatスペースの選択をすべて外す">選択をすべて外す</button><ul class="room-list" data-search-results>${spaceResultsHtml(shown, "space-")}</ul><p class="hint" data-selected-count role="status">選択中: ${state.selected.size}スペース</p>${technicalDetails("管理者向け: スペースの識別子", `<ul data-search-identifiers>${spaceIdentifiersHtml(shown)}</ul>`, "admin")}</div><p class="notice">選んだ通常スペースだけを読みます。ダイレクトメッセージとグループDMは対象外です。</p>${actions("Google Chatの取得間隔を選ぶ", "Google Chatの設定をキャンセル")}`);
  bindSpaceSearch("#space-search", "space-");
  app.querySelector('[data-action="clear"]').onclick = () => { state.selected.clear(); renderSpaceResults("space-"); };
  const next = app.querySelector('[data-action="next"]'); next.disabled = state.selected.size === 0; next.onclick = renderFrequency;
  app.querySelector('[data-action="back"]').onclick = cancel;
}

function filteredSpaces() {
  const query = state.query.toLocaleLowerCase("ja");
  return state.spaces.filter((space) => `${space.displayName} ${space.name}`.toLocaleLowerCase("ja").includes(query));
}

function spaceResultsHtml(spaces, focusPrefix) {
  return spaces.map((space) => `<li><label class="choice"><input data-focus-key="${focusPrefix}${escape(space.name)}" type="checkbox" value="${escape(space.name)}" ${state.selected.has(space.name) ? "checked" : ""}><span class="choice-copy"><span class="choice-title">${escape(space.displayName)}</span></span></label></li>`).join("");
}

function spaceIdentifiersHtml(spaces) {
  return spaces.map((space) => `<li>${escape(space.displayName)}: <code>${escape(space.name)}</code></li>`).join("");
}

function bindSpaceCheckboxes() {
  app.querySelectorAll('[data-search-results] input[type="checkbox"]').forEach((input) => input.onchange = () => {
    input.checked ? state.selected.add(input.value) : state.selected.delete(input.value);
    updateSpaceSelectionState();
  });
}

function updateSpaceSelectionState() {
  app.querySelector("[data-selected-count]").textContent = `選択中: ${state.selected.size}スペース`;
  const next = app.querySelector('[data-action="next"]');
  if (next && app.dataset.screen === "google-chat-select-spaces") next.disabled = state.selected.size === 0;
  if (next && app.dataset.screen === "google-chat-settings-select-spaces") {
    const noSelection = state.selected.size === 0;
    const label = noSelection ? "取得の停止方法を確認する" : "取得間隔を確認する";
    next.textContent = label;
    next.setAttribute("aria-label", `Google Chatの${label}`);
    const notice = app.querySelector("[data-selection-notice]");
    notice.textContent = noSelection
      ? "0件のまま手動のみを選ぶと、今後の取得を止めます。取得済み履歴は削除しません。"
      : "選択を外したスペースは今後読みません。取得済み履歴は削除しません。";
  }
}

function renderSpaceResults(focusPrefix) {
  const shown = filteredSpaces();
  app.querySelector("[data-search-results]").innerHTML = spaceResultsHtml(shown, focusPrefix);
  app.querySelector("[data-search-identifiers]").innerHTML = spaceIdentifiersHtml(shown);
  updateSpaceSelectionState();
  bindSpaceCheckboxes();
}

function bindSpaceSearch(selector, focusPrefix) {
  bindWizardSearch(app.querySelector(selector), { setQuery: (value) => { state.query = value; }, renderResults: () => renderSpaceResults(focusPrefix) });
  bindSpaceCheckboxes();
}

function renderFrequency() {
  progress(2);
  show("select-interval", `<p class="eyebrow">設定 2 / 4</p><h1>Google Chatの取得間隔を選びます。</h1>${nowCopy("新しいメッセージを自動で確認する間隔を選びます。")}
    <div class="panel"><ul class="frequency-list">${frequencies.map(([value, label]) => `<li><label class="choice"><input type="radio" name="interval" value="${value}" ${state.interval === value ? "checked" : ""}><span class="choice-copy"><span class="choice-title">${label}</span></span></label></li>`).join("")}</ul>${technicalDetails("詳しい説明: 自動取得の仕組み", "<p>定期取得はGitHub Actionsで動きます。初回の取得だけは、接続情報をこのPCのメモリに保持している間に行います。</p>")}</div><p class="notice">3時間ごとは、負担と新しさのバランスを取りやすいおすすめ設定です。</p>${actions("Google Chatの保存内容を確認する")}`);
  app.querySelectorAll('input[name="interval"]').forEach((input) => input.onchange = () => { state.interval = input.value; });
  app.querySelector('[data-action="next"]').onclick = renderReview;
  app.querySelector('[data-action="back"]').onclick = renderSpaces;
}

function renderReview() {
  progress(3);
  const names = state.spaces.filter((space) => state.selected.has(space.name)).map((space) => escape(space.displayName)).join("、");
  const frequency = frequencies.find(([value]) => value === state.interval)?.[1];
  show("review", `<p class="eyebrow">設定 3 / 4</p><h1>Google Chatの保存内容を確認します。</h1>${nowCopy("読むスペース、保存先、自動取得の設定を確認します。")}
    <dl class="summary"><div class="summary-row"><dt>選んだスペース</dt><dd>${names}</dd></div><div class="summary-row"><dt>取得間隔</dt><dd>${escape(frequency)}</dd></div><div class="summary-row"><dt>保存内容</dt><dd>本文、スレッド、発言者、添付情報。添付ファイルの中身は保存しません。</dd></div></dl>
    ${safetyList([
      { label: "読む対象", text: `選んだGoogle Chat通常スペース（${state.spaces.filter((space) => state.selected.has(space.name)).map((space) => space.displayName).join("、")}）だけです。` },
      { label: "保存先", text: "現在の非公開GitHubリポジトリです。" },
      { label: "見える人", text: "リポジトリの共同編集者にも保存内容が見えます。" },
      { label: "自動取得・保存", text: state.interval === "manual" ? "自動取得は行わず、必要なときだけ取得して保存します。" : `${frequency}に新しいメッセージを取得して保存します。` },
      { label: "履歴の保持", text: "対象を外したり手動のみに変えたりしても、取得済み履歴を削除しません。" },
    ])}
    <p class="notice">Google Chatは読むだけです。投稿、編集、削除は行いません。</p>
    ${technicalDetails("詳しい説明: 保存処理と取得範囲", "<p>Google Chat APIと組織の保持設定が返せる範囲だけを取得します。取得できない過去を「存在しない」とは扱いません。</p><p>取得結果をこのリポジトリへ保存します（Gitのcommit・push）。</p>")}
    <label class="consent"><input id="save-consent" type="checkbox"><span>この内容でGoogle Chatのメッセージを読み、保存することに同意します。</span></label><label class="consent"><input id="git-consent" type="checkbox"><span>取得結果と設定を非公開GitHubリポジトリへ保存することに同意します。</span></label>${state.interval === "manual" ? "" : '<label class="consent"><input id="automatic-consent" type="checkbox"><span>選んだ間隔でGoogle Chatを自動取得し、保存することに同意します。</span></label>'}${actions("この設定で始める")}`);
  const confirm = app.querySelector('[data-action="next"]');
  const automatic = state.interval !== "manual";
  const update = () => { state.saveConsent = app.querySelector("#save-consent").checked; state.commitPushConsent = app.querySelector("#git-consent").checked; state.automaticPushConsent = automatic ? app.querySelector("#automatic-consent").checked : false; confirm.disabled = !(state.saveConsent && state.commitPushConsent && (!automatic || state.automaticPushConsent)); };
  app.querySelector("#save-consent").checked = state.saveConsent; app.querySelector("#git-consent").checked = state.commitPushConsent;
  app.querySelector("#save-consent").onchange = update; app.querySelector("#git-consent").onchange = update;
  if (automatic) { app.querySelector("#automatic-consent").checked = state.automaticPushConsent; app.querySelector("#automatic-consent").onchange = update; }
  update();
  confirm.onclick = initialSync; app.querySelector('[data-action="back"]').onclick = renderFrequency;
}

async function initialSync() {
  progress(4);
  show("initial-sync-loading", '<p class="eyebrow">設定 4 / 4</p><h1>Google Chatの最初の取得を進めています。</h1><p class="lead" data-copy-role="status">選んだ通常スペースのメッセージを確認しています。</p><p class="notice">取得できる範囲を最後まで確認するため、この画面を開いたままお待ちください。</p>', "loading");
  try {
    const result = await json("/api/initial-sync", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ selectedSpaceNames: [...state.selected], interval: state.interval, saveConsent: state.saveConsent, commitPushConsent: state.commitPushConsent, automaticPushConsent: state.automaticPushConsent }) });
    renderResult(result);
  } catch (error) { renderInitialSyncFailure(error); }
}

function renderInitialSyncFailure(error) {
  progress(4);
  const detail = error.details || {};
  const git = detail.git || {};
  const saved = detail.savedLocally === true ? "取得結果や設定はこのPCに残っています。" : "このPCへの保存も確認できませんでした。";
  const gitState = git.pushed ? "非公開GitHubリポジトリへの保存は完了しています。" : git.committed ? "このPCには保存しましたが、GitHubへ送れていません。" : "GitHubへの保存は完了していません。";
  const token = detail.tokenDiscarded === true ? "接続に使った秘密の情報は、このPCのメモリから消去しました。" : "接続情報の消去結果を確認できませんでした。";
  show("initial-sync-failure", `<p class="eyebrow">保存できませんでした</p><h1>Google Chatの最初の取得を完了できませんでした。</h1><p class="lead error" data-copy-role="error" role="alert">取得または保存の途中で問題が起きました。</p><p class="notice">接続先とGitHubの状態を確認してから、最初からやり直してください。</p><ul class="result-list"><li>${escape(saved)}</li><li>${escape(gitState)}</li><li>${escape(token)}</li></ul>${technicalDetails("管理者向け: エラーと保存状態", `<p>${escape(error.message)}</p><p>commit: ${git.committed ? "完了" : "未完了"}、push: ${git.pushed ? "完了" : "未完了"}</p>`, "admin")}<div class="actions" data-copy-role="actions"><button class="button button-secondary" data-action="close" aria-label="Google Chatの設定を終了する">設定を終了する</button><button class="button button-primary" data-action="restart" aria-label="Google Chatの接続を最初から確認する">接続を最初から確認する</button></div>`, "error");
  app.querySelector('[data-action="close"]').onclick = renderComplete;
  app.querySelector('[data-action="restart"]').onclick = renderPrepareFile;
}

function renderResult(result) {
  progress(4);
  const rows = result.sync.results.map((item) => `<li><strong>${escape(item.displayName)}</strong> — ${item.status === "success" ? `成功・${item.messages}件・${item.files}日分` : `失敗・${escape(item.message)}`}</li>`).join("");
  const zero = result.sync.results.every((item) => item.status !== "success" || item.messages === 0);
  state.config = result.config;
  state.sync = result.sync;
  const failed = result.sync.status === "failed";
  const partial = result.sync.status === "partial";
  const scheduleFailed = result.schedule?.status === "failed";
  const automatic = state.config?.scheduleEnabled === true;
  const scheduleText = scheduleFailed ? "自動取得の設定は完了していません。接続先を確認し、設定変更からもう一度お試しください。" : automatic ? `${frequencies.find(([value]) => value === state.config.interval)?.[1]}の自動取得も有効にしました。` : "手動のみのため、自動取得は行いません。";
  const resultState = scheduleFailed || failed ? "error" : zero ? "empty" : "success";
  show(failed ? "initial-result-failure" : partial || scheduleFailed ? "initial-result-partial" : zero ? "initial-result-empty" : "initial-result", `<p class="eyebrow">設定 4 / 4</p><h1>${scheduleFailed ? "最初の取得は保存しましたが、自動取得を設定できませんでした。" : failed ? "Google Chatの最初の取得を完了できませんでした。" : partial ? "一部のGoogle Chatスペースを取得できませんでした。" : "Google Chatの設定が完了しました。"}</h1><p class="lead" data-copy-role="result">${failed ? "接続を確認してください。自動取得は次の実行時にもう一度取得します。" : partial ? "取得できた内容は保存しました。失敗したスペースは次の取得で再試行します。" : zero ? "まだ保存するメッセージはありません。" : "取得したメッセージを保存しました。"}</p><p class="notice" data-schedule-result>${escape(scheduleText)}</p><ul class="result-list">${rows}</ul>${zero ? '<p class="empty">次回以降の取得で、新しい内容を保存します。</p>' : ""}${technicalDetails("詳しい説明: 取得結果と接続情報", "<p>接続に使ったtokenはセッションのメモリから破棄しました。組織の保持設定やAPIが返せる範囲により、過去履歴が含まれないことがあります。</p>")}<div class="actions" data-copy-role="actions"><button class="button button-primary" data-action="close" aria-label="Google Chatの設定を終了する">設定を終了する</button></div>`, resultState);
  app.querySelector('[data-action="close"]').onclick = renderComplete;
}

function renderSettingsSpaces({ refreshed = false } = {}) {
  progress(1);
  const shown = filteredSpaces();
  const noSelection = state.selected.size === 0;
  show("settings-select-spaces", `<p class="eyebrow">設定変更 1 / 3</p><h1>取得するGoogle Chatスペースを見直します。</h1>${nowCopy("今後も取得する通常スペースだけにチェックを入れます。")}${refreshed ? '<p class="notice" role="status">Googleへ接続し直し、最新の通常スペースを確認しました。以前の選択と履歴は残しています。</p>' : ""}
    <div class="panel"><label class="search-label" for="settings-space-search">通常スペースを検索</label><input class="search" id="settings-space-search" data-focus-key="settings-space-search" type="search" value="${escape(state.query)}" placeholder="スペース名"><button class="text-button" data-action="clear" type="button" aria-label="Google Chatスペースの選択をすべて外す">選択をすべて外す</button><ul class="room-list" data-search-results>${spaceResultsHtml(shown, "settings-space-")}</ul><p class="hint" data-selected-count role="status">選択中: ${state.selected.size}スペース</p>${technicalDetails("管理者向け: スペースの識別子と一覧更新", `<ul data-search-identifiers>${spaceIdentifiersHtml(shown)}</ul><p>新しいスペースが見えない場合は再認証して一覧を更新します。</p>`, "admin")}</div>
    <p class="notice" data-selection-notice role="status">${noSelection ? "0件のまま手動のみを選ぶと、今後の取得を止めます。取得済み履歴は削除しません。" : "選択を外したスペースは今後読みません。取得済み履歴は削除しません。"}</p>
    <div class="actions" data-copy-role="actions"><button class="button button-secondary" data-action="reauthorize" aria-label="Googleへ接続し直して通常スペース一覧を更新する">Googleへ接続し直す</button><button class="button button-primary" data-action="next" aria-label="${noSelection ? "Google Chatの取得停止方法を確認する" : "Google Chatの取得間隔を確認する"}">${noSelection ? "取得の停止方法を確認する" : "取得間隔を確認する"}</button></div>`);
  bindSpaceSearch("#settings-space-search", "settings-space-");
  app.querySelector('[data-action="clear"]').onclick = () => { state.selected.clear(); renderSpaceResults("settings-space-"); };
  const next = app.querySelector('[data-action="next"]');
  next.onclick = renderSettingsFrequency;
  app.querySelector('[data-action="reauthorize"]').onclick = renderPrepareFile;
}

function renderSettingsFrequency() {
  progress(2);
  const noSelection = state.selected.size === 0;
  show("settings-select-interval", `<p class="eyebrow">設定変更 2 / 3</p><h1>Google Chatの取得間隔を見直します。</h1>${nowCopy("新しいメッセージを確認する間隔を選び直します。")}<div class="panel"><ul class="frequency-list">${frequencies.map(([value, label]) => `<li><label class="choice"><input type="radio" name="settings-interval" value="${value}" ${state.interval === value ? "checked" : ""}><span class="choice-copy"><span class="choice-title">${label}</span></span></label></li>`).join("")}</ul>${technicalDetails("詳しい説明: 自動取得の時刻", "<p>手動のみでは定期scheduleを作りません。自動取得は毎時0分を避けて実行します。</p>")}</div><p class="notice">3時間ごとは、負担と新しさのバランスを取りやすいおすすめ設定です。</p>${noSelection ? '<p class="notice" data-selection-guidance role="status">対象が0件です。手動のみを選ぶと今後の取得を止め、取得済み履歴は残します。</p>' : ""}${actions("Google Chatの変更内容を確認する")}`);
  const next = app.querySelector('[data-action="next"]');
  const update = () => {
    const blocked = state.selected.size === 0 && state.interval !== "manual";
    next.disabled = blocked;
    const guidance = app.querySelector("[data-selection-guidance]");
    if (guidance) guidance.textContent = blocked ? "対象が0件です。Google Chatの取得を停止し、履歴を残すには「手動のみ」を選んでください。" : "手動のみで今後の取得を停止します。取得済み履歴は削除しません。";
  };
  app.querySelectorAll('input[name="settings-interval"]').forEach((input) => input.onchange = () => { state.interval = input.value; update(); });
  next.onclick = renderSettingsReview;
  app.querySelector('[data-action="back"]').onclick = renderSettingsSpaces;
  update();
}

function renderSettingsReview() {
  progress(3);
  const selectedNames = state.spaces.filter((space) => state.selected.has(space.name)).map((space) => escape(space.displayName)).join("、");
  const names = selectedNames || "なし（今後の取得を停止）";
  const frequency = frequencies.find(([value]) => value === state.interval)?.[1];
  const automatic = state.interval !== "manual";
  const selectedDisplayNames = state.spaces.filter((space) => state.selected.has(space.name)).map((space) => space.displayName).join("、");
  show("settings-review", `<p class="eyebrow">設定変更 3 / 3</p><h1>Google Chatの変更内容を確認します。</h1>${nowCopy("読むスペース、保存先、自動取得の変更を確認します。")}<dl class="summary"><div class="summary-row"><dt>選んだスペース</dt><dd>${names}</dd></div><div class="summary-row"><dt>取得間隔</dt><dd>${escape(frequency)}</dd></div><div class="summary-row"><dt>保存内容</dt><dd>本文、スレッド、発言者、添付情報。添付ファイルの中身は保存しません。</dd></div></dl>
    ${safetyList([
      { label: "読む対象", text: state.selected.size ? `選んだGoogle Chat通常スペース（${selectedDisplayNames}）だけです。` : "今後はGoogle Chatのスペースを読みません。" },
      { label: "保存先", text: "現在の非公開GitHubリポジトリです。" },
      { label: "見える人", text: "リポジトリの共同編集者にも保存内容が見えます。" },
      { label: "自動取得・保存", text: automatic ? `${frequency}に新しいメッセージを取得して保存します。` : state.selected.size === 0 ? "自動取得を止め、今後は取得しません。" : "自動取得を止め、必要なときだけ取得して保存します。" },
      { label: "履歴の保持", text: "対象を外したり手動のみに変えたりしても、取得済み履歴を削除しません。" },
    ])}
    ${technicalDetails("詳しい説明: 保存処理と差分の範囲", `<p>確定するまで設定、workflow、commit、pushは0件です。確定後、GitHub ActionsとGitのcommit・pushで保存します。</p><p>編集・削除は、その取得でAPIが返した範囲だけ反映します。差分範囲より古い変更が反映されないことは正常な仕様です。</p>`)}
    <label class="consent"><input id="settings-git-consent" type="checkbox"><span>この変更を非公開GitHubリポジトリへ保存することに同意します。</span></label>${automatic ? '<label class="consent"><input id="settings-auto-consent" type="checkbox"><span>選んだ間隔でGoogle Chatを自動取得し、保存することに同意します。</span></label>' : ""}${actions("この変更をGoogle Chatへ反映する")}`);
  const confirm = app.querySelector('[data-action="next"]');
  const update = () => {
    state.commitPushConsent = app.querySelector("#settings-git-consent").checked;
    state.automaticPushConsent = automatic ? app.querySelector("#settings-auto-consent").checked : false;
    confirm.disabled = !(state.commitPushConsent && (!automatic || state.automaticPushConsent));
  };
  app.querySelector("#settings-git-consent").onchange = update;
  if (automatic) app.querySelector("#settings-auto-consent").onchange = update;
  update();
  confirm.onclick = applySettings;
  app.querySelector('[data-action="back"]').onclick = renderSettingsFrequency;
}

async function applySettings() {
  progress(3);
  show("settings-saving", '<p class="eyebrow">設定反映中</p><h1>Google Chatの変更を保存しています。</h1><p class="lead" data-copy-role="status">選んだスペースと取得間隔を保存しています。</p><p class="notice">保存結果を確認するまで、この画面を開いたままお待ちください。</p>', "loading");
  try {
    const result = await json("/api/settings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ selectedSpaceNames: [...state.selected], interval: state.interval, commitPushConsent: state.commitPushConsent, automaticPushConsent: state.automaticPushConsent }) });
    state.config = result.current.config;
    state.sync = result.current.sync;
    state.spaces = result.current.spaces;
    renderSettingsResult();
  } catch (error) {
    show("settings-failure", `<p class="eyebrow">保存できませんでした</p><h1>Google Chatの変更を保存できませんでした。</h1><p class="lead error" data-copy-role="error" role="alert">変更前の設定へ戻しました。</p><p class="notice">以前の設定と履歴は残っています。接続先を確認してから、変更内容をもう一度お確かめください。</p>${technicalDetails("管理者向け: エラーの詳しい内容", `<p>${escape(error.message)}</p><p>Gitの競合やGitHub権限を確認してください。</p>`, "admin")}${actions("Google Chatの変更を確認し直す", "Google Chatの設定を終了する")}`, "error");
    app.querySelector('[data-action="next"]').onclick = renderSettingsSpaces;
    app.querySelector('[data-action="back"]').onclick = renderComplete;
  }
}

function renderSettingsResult() {
  progress(4);
  const selectedNames = state.spaces.filter((space) => state.config.selectedSpaceNames.includes(space.name)).map((space) => escape(space.displayName)).join("、");
  const names = selectedNames || "なし（取得を停止）";
  const frequency = frequencies.find(([value]) => value === state.config.interval)?.[1];
  const syncStatus = state.sync?.status === "partial" ? "一部失敗" : state.sync?.status === "failed" ? "失敗" : state.sync?.status === "success" ? "成功" : "まだありません";
  const stopped = state.config.selectedSpaceNames.length === 0;
  const manual = !stopped && !state.config.scheduleEnabled;
  show(stopped ? "settings-result-stopped" : manual ? "settings-result-manual" : "settings-result", `<p class="eyebrow">設定完了</p><h1>${stopped ? "Google Chatの今後の取得を停止しました。" : manual ? "Google Chatを手動で取得する設定にしました。" : "Google Chatの設定を保存しました。"}</h1><p class="lead" data-copy-role="result">${stopped ? "取得済み履歴は削除していません。" : manual ? "必要なときだけ取得でき、これまでの履歴は残ります。" : "次は保存したGoogle Chatメッセージを検索できます。"}</p><dl class="summary"><div class="summary-row"><dt>現在の対象</dt><dd>${names}</dd></div><div class="summary-row"><dt>現在の間隔</dt><dd>${escape(frequency)}</dd></div><div class="summary-row"><dt>自動実行</dt><dd>${state.config.scheduleEnabled ? "有効" : stopped ? "無効（取得停止）" : "無効（手動のみ）"}</dd></div><div class="summary-row"><dt>直近の取得</dt><dd>${syncStatus}</dd></div></dl><p class="notice">選択を外したスペースの取得済み履歴も削除していません。</p><div class="actions" data-copy-role="actions"><button class="button button-primary" data-action="close" aria-label="Google Chatの設定を終了して検索案内を見る">設定を終了する</button></div>`, "success");
  app.querySelector('[data-action="close"]').onclick = renderComplete;
}

async function cancel() {
  oauthPollGeneration += 1;
  try {
    const result = await json("/api/cancel", { method: "POST" });
    renderCancelled(result.cleanup);
  } catch {
    renderCancelled(null, { networkFailure: true });
  }
}
function renderCancelled(cleanup, options = {}) {
  progress(0);
  const detail = cleanupDescription(cleanup, options);
  show("cancelled", `<p class="eyebrow">${detail.kind === "manual" ? "後始末が必要" : "キャンセル"}</p><h1>${detail.kind === "manual" ? "Google Chatの接続情報が一部残っています。" : "Google Chatの設定を終了しました。"}</h1><p class="lead ${detail.kind === "manual" ? "error" : ""}" data-copy-role="${detail.kind === "manual" ? "error" : "result"}" role="${detail.kind === "manual" ? "alert" : "status"}">${escape(detail.text)}</p>${technicalDetails("管理者向け: 接続情報の後始末", `<p>${escape(detail.technical || "接続情報の後始末はありません。")}</p><p>${externalLink(links.permissions, "Googleのアプリ権限を確認する")}</p>`, "admin")}<div class="actions" data-copy-role="actions"><button class="button button-primary" data-action="restart" aria-label="${detail.kind === "manual" ? "Google Chatの接続情報の後始末をもう一度試す" : "Google Chatの設定を最初から確認する"}">${detail.kind === "manual" ? "後始末をもう一度試す" : "Google Chatの設定に戻る"}</button></div>`, detail.kind === "manual" ? "error" : "cancelled");
  app.querySelector('[data-action="restart"]').onclick = detail.kind === "manual" ? cancel : renderPrepareFile;
}
function renderComplete() { show("complete", '<p class="eyebrow">完了</p><h1>Google Chatの設定は完了です。</h1><p class="lead" data-copy-role="result">次は /google-chat search から保存済みメッセージを検索できます。</p>', "success"); }

json("/api/bootstrap").then((result) => {
  state.oauth = result.oauth;
  state.cleanup = result.cleanup;
  state.config = result.config || null;
  state.sync = result.sync || null;
  state.spaces = result.spaces || [];
  state.interval = result.config?.interval || result.defaultInterval;
  state.selected = new Set(result.config?.selectedSpaceNames || []);
  state.testing = result.testing === true;
  if (result.configured && state.oauth.status !== "connected") renderSettingsSpaces();
  else if (state.oauth.status === "connected") discoverSpaces();
  else if (state.oauth.status === "client-ready") renderAuthorize();
  else if (["authorization-pending", "callback-processing"].includes(state.oauth.status)) renderOAuthWaiting();
  else if (state.oauth.status === "failed") renderOAuthFailure();
  else if (["closed", "cleanup-required"].includes(state.oauth.status)) renderCancelled(state.cleanup);
  else if (state.oauth.status === "completed") renderComplete();
  else renderPrepareFile();
}).catch((error) => { show("bootstrap-failure", `<p class="eyebrow">開始できません</p><h1>Google Chatの設定を読み込めませんでした。</h1>${errorMessage(error)}`, "error"); });
