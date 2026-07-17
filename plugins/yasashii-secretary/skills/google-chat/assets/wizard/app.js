import { escapeHtml as escape, externalLink, installWizardShell, setProgress as progress, wizardActions as actions } from "/common.js";
import { cleanupDescription } from "/cleanup.js";

const { app } = installWizardShell("google-chat");
const state = { oauth: null, cleanup: null, config: null, sync: null, spaces: [], selected: new Set(), interval: "3h", query: "", saveConsent: false, commitPushConsent: false, automaticPushConsent: false, testing: false };
let oauthPollGeneration = 0;
const frequencies = [["1h", "1時間ごと"], ["3h", "3時間ごと（おすすめ・初期値）"], ["6h", "6時間ごと"], ["12h", "12時間ごと"], ["manual", "手動のみ"]];
const links = {
  cloud: "https://console.cloud.google.com/projectcreate",
  chatApi: "https://console.cloud.google.com/apis/library/chat.googleapis.com",
  peopleApi: "https://console.cloud.google.com/apis/library/people.googleapis.com",
  consent: "https://developers.google.com/workspace/guides/configure-oauth-consent",
  desktop: "https://developers.google.com/identity/protocols/oauth2/native-app",
  permissions: "https://myaccount.google.com/permissions",
};

function errorMessage(error) {
  return `<p class="error" role="alert">${escape(error.message || "処理を完了できませんでした。")}</p>`;
}

async function json(url, options = {}) {
  const response = await fetch(url, options);
  const result = await response.json();
  if (!response.ok) throw Object.assign(new Error(result.error || result.message), { code: result.code, details: result });
  return result;
}

function renderPrepare() {
  progress(0);
  app.innerHTML = `<p class="eyebrow">接続 1 / 4</p><h1>管理者準備を確認します。</h1>
    <p class="lead">Google Workspace管理者、またはGoogle Cloudプロジェクトを作成できる方が必要です。会社のGoogle Workspace組織が所有するプロジェクトを使います。</p>
    <div class="panel"><p class="panel-title">管理者へ渡すチェックリスト</p><ol class="check-list"><li>${externalLink(links.cloud, "Google Cloudでプロジェクトを作る")}</li><li>${externalLink(links.chatApi, "Google Chat APIを有効にする")}</li><li>${externalLink(links.peopleApi, "Google People APIを有効にする")}</li><li>OAuth Audienceを <code>Internal</code> にする</li><li>OAuth Clientを <code>Desktop app</code> で作る</li></ol><p class="hint">読み取り専用でも <code>chat.messages.readonly</code> はRestricted scopeです。管理者のAPI access controlsで許可が必要な場合があります。</p></div>
    <div class="panel"><label class="search-label" for="client-json">ダウンロードしたOAuth client JSONを選ぶ</label><input id="client-json" type="file" accept="application/json,.json"><p class="hint">内容はこのPCのloopback内だけで読み、外部へuploadしません。client secretやclient IDを画面・ログ・リポジトリへ残しません。</p></div>
    <div class="actions"><button class="button button-secondary" data-action="cancel">あとで行う</button><button class="button button-primary" data-action="next" disabled>OAuth clientを確認する</button></div>`;
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
  app.querySelector('[data-action="cancel"]').onclick = cancel;
}

function renderAuthorize() {
  oauthPollGeneration += 1;
  progress(0);
  app.innerHTML = `<p class="eyebrow">接続 2 / 4</p><h1>Googleで認証します。</h1>
    <p class="lead">OAuth、つまりGoogleのパスワードを渡さず、許可した範囲だけ読み取る認証を使います。認可コードは受信後すぐtokenへ交換し、記録しません。</p>
    <div class="panel"><p class="panel-title">許可を求める範囲</p><ul><li>参加中スペースの一覧を読む</li><li>選択した通常スペースのメッセージを読む</li><li>発言者名を連絡先から補完する</li></ul><p class="hint">投稿・編集・削除、管理者権限、membership権限は求めません。</p></div>
    <div class="actions"><button class="button button-secondary" data-action="back">戻る</button>${state.testing ? '<button class="button button-primary" data-action="synthetic">合成認証で画面確認</button>' : '<button class="button button-primary" data-action="authorize">新しいタブでGoogle認証を開く</button>'}</div>`;
  app.querySelector('[data-action="back"]').onclick = renderPrepare;
  if (state.testing) app.querySelector('[data-action="synthetic"]').onclick = async () => { try { state.oauth = await json("/api/oauth/synthetic", { method: "POST", headers: { "content-type": "application/json" }, body: '{"mode":"success"}' }); await discoverSpaces(); } catch (error) { app.insertAdjacentHTML("beforeend", errorMessage(error)); } };
  else app.querySelector('[data-action="authorize"]').onclick = startOAuth;
}

function startOAuth() {
  let authWindow = null;
  try { authWindow = window.open("/api/oauth/authorize", "yasashii-google-chat-oauth"); } catch { /* popup拒否は下で案内 */ }
  if (!authWindow) {
    renderOAuthWaiting({ popupBlocked: true });
    return;
  }
  try { authWindow.opener = null; } catch { /* 別originへ移動済み */ }
  const generation = ++oauthPollGeneration;
  renderOAuthWaiting({ authWindow, generation });
  window.setTimeout(() => waitForOAuth({ authWindow, generation }), 300);
}

function renderOAuthWaiting({ authWindow = null, generation = ++oauthPollGeneration, popupBlocked = false } = {}) {
  progress(0);
  app.innerHTML = `<p class="eyebrow">接続 2 / 4</p><h1>${popupBlocked ? "認証タブを開けませんでした。" : "別タブでGoogle認証を確認しています。"}</h1>
    <p class="lead" data-oauth-status>${popupBlocked ? "ブラウザでポップアップを許可して、もう一度開いてください。元の設定画面はこのまま残ります。" : "認証用の新しいタブで許可を進めてください。完了すると、この設定画面が自動的に通常スペースの選択へ進みます。"}</p>
    <p class="notice">認証タブを手動で閉じても、この画面は残ります。完了前に閉じた場合は「認証タブをもう一度開く」からやり直せます。</p>
    <div class="actions"><button class="button button-secondary" data-action="cancel">設定を終了する</button><button class="button button-primary" data-action="reopen">認証タブを${popupBlocked ? "開く" : "もう一度開く"}</button></div>`;
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
      if (status) status.textContent = `認証状態を確認できませんでした。元の画面は残っています。通信を確認してください。（${error.message}）`;
      await new Promise((wait) => window.setTimeout(wait, 1000));
      continue;
    }
    if (state.oauth.status === "connected") return discoverSpaces();
    if (state.oauth.status === "failed") { renderOAuthFailure(); return; }
    if (state.oauth.status === "cleanup-required" || state.oauth.status === "cancelled") { renderCancelled(state.oauth.cleanup); return; }
    if (authWindow && !closedReported) {
      try {
        if (authWindow.closed) {
          closedReported = true;
          const status = app.querySelector("[data-oauth-status]");
          if (status) status.textContent = "認証タブが閉じられました。認証済みなら確認を続けます。完了前に閉じた場合は、もう一度開いてください。";
        }
      } catch { /* cross-originのWindowProxyは状態APIで確認する */ }
    }
    await new Promise((wait) => window.setTimeout(wait, 1000));
  }
  renderOAuthFailure("認証結果を確認できませんでした。設定画面を再読み込みしてください。");
}

function renderOAuthFailure(message = state.oauth?.message) {
  progress(0);
  const checklist = state.oauth?.managerChecklist ? `<div class="panel" data-volatile="manager-checklist"><p class="panel-title">管理者へ一時的に伝える内容</p><p>client ID: <code>${escape(state.oauth.managerChecklist.clientId)}</code></p><ul>${state.oauth.managerChecklist.scopes.map((scope) => `<li><code>${escape(scope)}</code></li>`).join("")}</ul><p class="hint">この表示は再読み込み後に残りません。厳格secretやチャット本文は含みません。スクリーンショットへ残さないでください。</p></div>` : "";
  app.innerHTML = `<p class="eyebrow">接続を確認できません</p><h1>Google認証を完了できませんでした。</h1><p class="lead error" role="alert">${escape(message)}</p><p class="notice">拒否、Audience不一致、管理者ブロック、API無効、<code>redirect_uri_mismatch</code> は対応が異なります。表示された理由を管理者へ伝えてください。</p>${checklist}${actions("最初から確認する", "変更せず終了")}`;
  app.querySelector('[data-action="next"]').onclick = renderPrepare;
  app.querySelector('[data-action="back"]').onclick = cancel;
}

async function discoverSpaces() {
  progress(1);
  app.innerHTML = '<p class="eyebrow">接続 3 / 4</p><h1>通常スペースを確認しています。</h1><p class="lead">DMとグループDMは候補に出しません。</p>';
  try {
    const result = await json("/api/spaces", { method: "POST" });
    state.spaces = result.spaces;
    state.selected = new Set(state.config?.selectedSpaceNames || []);
    if (result.zero) return renderNoSpaces(result.cleanup);
    if (state.config) return renderSettingsSpaces({ refreshed: true });
    renderSpaces();
  } catch (error) { app.insertAdjacentHTML("beforeend", errorMessage(error)); }
}

function renderNoSpaces(cleanup) {
  progress(1);
  const detail = cleanupDescription(cleanup);
  app.innerHTML = `<p class="eyebrow">接続 3 / 4</p><h1>選べる通常スペースは0件でした。</h1><p class="lead">0件は正常です。参加状況と管理者設定を確認してください。</p><p class="${detail.kind === "manual" ? "error" : "notice"}" role="${detail.kind === "manual" ? "alert" : "status"}">${escape(detail.text)}</p><p>${externalLink(links.permissions, "Googleのアプリ権限を確認する")}</p><div class="actions"><button class="button button-secondary" data-action="back">終了する</button><button class="button button-primary" data-action="retry">最初から確認する</button></div>`;
  app.querySelector('[data-action="back"]').onclick = () => renderCancelled(cleanup);
  app.querySelector('[data-action="retry"]').onclick = renderPrepare;
}

function renderSpaces() {
  progress(1);
  const shown = state.spaces.filter((space) => `${space.displayName} ${space.name}`.toLocaleLowerCase("ja").includes(state.query.toLocaleLowerCase("ja")));
  app.innerHTML = `<p class="eyebrow">STEP 1 / 4</p><h1>保存する通常スペースを選びます。</h1><p class="lead">初期状態では1件も選びません。DMとグループDMは一覧にも履歴にも含めません。</p>
    <div class="panel"><label class="search-label" for="space-search">スペースを検索</label><input class="search" id="space-search" type="search" value="${escape(state.query)}" placeholder="スペース名またはspace ID"><button class="text-button" data-action="clear" type="button">選択をすべて外す</button><ul class="room-list">${shown.map((space) => `<li><label class="choice"><input type="checkbox" value="${escape(space.name)}" ${state.selected.has(space.name) ? "checked" : ""}><span class="choice-copy"><span class="choice-title">${escape(space.displayName)}</span><span class="choice-meta">space ID ${escape(space.name)}</span></span></label></li>`).join("")}</ul><p class="hint">選択中: ${state.selected.size}スペース</p></div>${actions("自動取得の間隔を選ぶ", "キャンセル")}`;
  app.querySelector("#space-search").oninput = (event) => { state.query = event.target.value; renderSpaces(); app.querySelector("#space-search").focus(); };
  app.querySelector('[data-action="clear"]').onclick = () => { state.selected.clear(); renderSpaces(); };
  app.querySelectorAll('.room-list input[type="checkbox"]').forEach((input) => input.onchange = () => { input.checked ? state.selected.add(input.value) : state.selected.delete(input.value); renderSpaces(); });
  const next = app.querySelector('[data-action="next"]'); next.disabled = state.selected.size === 0; next.onclick = renderFrequency;
  app.querySelector('[data-action="back"]').onclick = cancel;
}

function renderFrequency() {
  progress(2);
  app.innerHTML = `<p class="eyebrow">STEP 2 / 4</p><h1>自動取得の間隔を選びます。</h1><p class="lead">Chatworkと同じく3時間ごとがおすすめ・初期値です。負担と新しさのバランスを取りやすい間隔です。</p><div class="panel"><ul class="frequency-list">${frequencies.map(([value, label]) => `<li><label class="choice"><input type="radio" name="interval" value="${value}" ${state.interval === value ? "checked" : ""}><span class="choice-copy"><span class="choice-title">${label}</span></span></label></li>`).join("")}</ul><p class="hint">Sprint 019の初回取得はこのPCで行います。定期実行は次の運用設定で有効にします。</p></div>${actions("保存内容を確認する")}`;
  app.querySelectorAll('input[name="interval"]').forEach((input) => input.onchange = () => { state.interval = input.value; });
  app.querySelector('[data-action="next"]').onclick = renderReview;
  app.querySelector('[data-action="back"]').onclick = renderSpaces;
}

function renderReview() {
  progress(3);
  const names = state.spaces.filter((space) => state.selected.has(space.name)).map((space) => escape(space.displayName)).join("、");
  const frequency = frequencies.find(([value]) => value === state.interval)?.[1];
  app.innerHTML = `<p class="eyebrow">STEP 3 / 4</p><h1>初回取得と保存内容を確認してください。</h1><p class="lead">確定するまで設定、履歴、commit、pushは行いません。</p><dl class="summary"><div class="summary-row"><dt>対象スペース</dt><dd>${names}</dd></div><div class="summary-row"><dt>自動取得の間隔</dt><dd>${escape(frequency)}</dd></div><div class="summary-row"><dt>保存内容</dt><dd>本文、スレッド、発言者、添付メタデータ（添付本文は取得しません）</dd></div><div class="summary-row"><dt>保存先</dt><dd>秘書・一般プロジェクト・Chatworkと同じ非公開のGitHubリポジトリ</dd></div></dl><p class="notice">共同編集者は保存された本文を読めます。Google Chat APIと組織の保持設定が返せる範囲だけを取得し、取得できない過去を「存在しない」とは扱いません。</p><label class="consent"><input id="save-consent" type="checkbox"><span>選択した通常スペースの取得結果をこのリポジトリへ保存することに同意します。</span></label><label class="consent"><input id="git-consent" type="checkbox"><span>取得結果をこのリポジトリへ保存します（Gitのcommit・push）。</span></label>${actions("初回取得を開始する")}`;
  const confirm = app.querySelector('[data-action="next"]');
  const update = () => { state.saveConsent = app.querySelector("#save-consent").checked; state.commitPushConsent = app.querySelector("#git-consent").checked; confirm.disabled = !(state.saveConsent && state.commitPushConsent); };
  app.querySelector("#save-consent").checked = state.saveConsent; app.querySelector("#git-consent").checked = state.commitPushConsent;
  app.querySelector("#save-consent").onchange = update; app.querySelector("#git-consent").onchange = update; update();
  confirm.onclick = initialSync; app.querySelector('[data-action="back"]').onclick = renderFrequency;
}

async function initialSync() {
  progress(4);
  app.innerHTML = '<p class="eyebrow">STEP 4 / 4</p><h1>初回取得を進めています。</h1><p class="lead">同じwizardセッションのメモリ上にあるtokenだけを使い、全pageを確認しています。</p>';
  try {
    const result = await json("/api/initial-sync", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ selectedSpaceNames: [...state.selected], interval: state.interval, saveConsent: state.saveConsent, commitPushConsent: state.commitPushConsent }) });
    renderResult(result);
  } catch (error) { renderInitialSyncFailure(error); }
}

function renderInitialSyncFailure(error) {
  progress(4);
  const detail = error.details || {};
  const git = detail.git || {};
  const saved = detail.savedLocally === true ? "取得結果や設定ファイルはこのPCに残っています。" : "このPCへの保存完了も確認できませんでした。";
  const gitState = git.pushed ? "commit・push済みです。" : git.committed ? "ローカルcommitまでは完了していますが、pushできていません。" : "commit・pushは完了していません。";
  const token = detail.tokenDiscarded === true ? "認証tokenはメモリから破棄しました。" : "認証tokenの破棄結果を画面から確認できませんでした。";
  app.innerHTML = `<p class="eyebrow">STEP 4 / 4</p><h1>初回取得の保存を完了できませんでした。</h1><p class="lead error" role="alert">${escape(error.message)}</p><ul class="result-list"><li>${escape(saved)}</li><li>${escape(gitState)}</li><li>${escape(token)}</li></ul><p class="notice">Gitの状態と接続先を確認してください。再実行する場合は、Google認証からやり直します。</p><div class="actions"><button class="button button-secondary" data-action="close">設定を終了する</button><button class="button button-primary" data-action="restart">最初から確認する</button></div>`;
  app.querySelector('[data-action="close"]').onclick = renderComplete;
  app.querySelector('[data-action="restart"]').onclick = renderPrepare;
}

function renderResult(result) {
  progress(4);
  const rows = result.sync.results.map((item) => `<li><strong>${escape(item.displayName)}</strong> — ${item.status === "success" ? `成功・${item.messages}件・${item.files}日分` : `失敗・${escape(item.message)}`}</li>`).join("");
  const zero = result.sync.results.every((item) => item.status !== "success" || item.messages === 0);
  state.config = result.config;
  state.sync = result.sync;
  app.innerHTML = `<p class="eyebrow">STEP 4 / 4</p><h1>${result.sync.status === "success" ? "初回取得が完了しました。" : result.sync.status === "partial" ? "一部のスペースを取得できませんでした。" : "初回取得を完了できませんでした。"}</h1><p class="lead">認証tokenはセッションのメモリから破棄しました。定期取得の設定はまだ行っていません。</p><ul class="result-list">${rows}</ul>${zero ? '<p class="empty">0件でも正常な取得結果です。組織の保持設定やAPIが返せる範囲により、過去履歴が含まれないことがあります。</p>' : ""}<div class="actions"><button class="button button-secondary" data-action="close">設定を終了</button><button class="button button-primary" data-action="settings">定期取得を設定する</button></div>`;
  app.querySelector('[data-action="close"]').onclick = renderComplete;
  app.querySelector('[data-action="settings"]').onclick = renderSettingsSpaces;
}

function renderSettingsSpaces({ refreshed = false } = {}) {
  progress(1);
  const shown = state.spaces.filter((space) => `${space.displayName} ${space.name}`.toLocaleLowerCase("ja").includes(state.query.toLocaleLowerCase("ja")));
  app.innerHTML = `<p class="eyebrow">設定変更 1 / 3</p><h1>取得する通常スペースを見直します。</h1><p class="lead">確定するまで設定、workflow、履歴、commit、pushは変更しません。選択を外しても取得済み履歴は削除しません。</p>${refreshed ? '<p class="notice" role="status">再認証後の最新スペース一覧を確認しました。既存の選択と履歴は保持しています。</p>' : ""}
    <div class="panel"><label class="search-label" for="settings-space-search">スペースを検索</label><input class="search" id="settings-space-search" type="search" value="${escape(state.query)}" placeholder="スペース名またはspace ID"><button class="text-button" data-action="clear" type="button">選択をすべて外す</button><ul class="room-list">${shown.map((space) => `<li><label class="choice"><input type="checkbox" value="${escape(space.name)}" ${state.selected.has(space.name) ? "checked" : ""}><span class="choice-copy"><span class="choice-title">${escape(space.displayName)}</span><span class="choice-meta">space ID ${escape(space.name)}</span></span></label></li>`).join("")}</ul><p class="hint">選択中: ${state.selected.size}スペース。新しいスペースが見えない場合は再認証して一覧を更新します。</p></div>
    <div class="actions"><button class="button button-secondary" data-action="reauthorize">再認証して一覧を更新</button><button class="button button-primary" data-action="next">間隔を確認する</button></div>`;
  app.querySelector("#settings-space-search").oninput = (event) => { state.query = event.target.value; renderSettingsSpaces(); app.querySelector("#settings-space-search").focus(); };
  app.querySelector('[data-action="clear"]').onclick = () => { state.selected.clear(); renderSettingsSpaces(); };
  app.querySelectorAll('.room-list input[type="checkbox"]').forEach((input) => input.onchange = () => { input.checked ? state.selected.add(input.value) : state.selected.delete(input.value); renderSettingsSpaces(); });
  const next = app.querySelector('[data-action="next"]');
  next.disabled = state.selected.size === 0;
  next.onclick = renderSettingsFrequency;
  app.querySelector('[data-action="reauthorize"]').onclick = renderPrepare;
}

function renderSettingsFrequency() {
  progress(2);
  app.innerHTML = `<p class="eyebrow">設定変更 2 / 3</p><h1>自動取得の間隔を見直します。</h1><p class="lead">ChatworkとGoogle Chatは、どちらも3時間ごとがおすすめ・初期値です。</p><div class="panel"><ul class="frequency-list">${frequencies.map(([value, label]) => `<li><label class="choice"><input type="radio" name="settings-interval" value="${value}" ${state.interval === value ? "checked" : ""}><span class="choice-copy"><span class="choice-title">${label}</span></span></label></li>`).join("")}</ul><p class="hint">手動のみでは定期scheduleを作りません。自動取得は毎時0分を避けて実行します。</p></div>${actions("変更内容を確認する")}`;
  app.querySelectorAll('input[name="settings-interval"]').forEach((input) => input.onchange = () => { state.interval = input.value; });
  app.querySelector('[data-action="next"]').onclick = renderSettingsReview;
  app.querySelector('[data-action="back"]').onclick = renderSettingsSpaces;
}

function renderSettingsReview() {
  progress(3);
  const names = state.spaces.filter((space) => state.selected.has(space.name)).map((space) => escape(space.displayName)).join("、");
  const frequency = frequencies.find(([value]) => value === state.interval)?.[1];
  const automatic = state.interval !== "manual";
  const rangeNote = "編集・削除は、その取得でAPIが返した範囲だけ反映します。差分範囲より古い変更が反映されないことは正常な仕様です。";
  app.innerHTML = `<p class="eyebrow">設定変更 3 / 3</p><h1>現在の変更内容を確認してください。</h1><p class="lead">同意して確定するまで、設定、workflow、commit、pushは0件です。</p><dl class="summary"><div class="summary-row"><dt>対象スペース</dt><dd>${names}</dd></div><div class="summary-row"><dt>自動取得の間隔</dt><dd>${escape(frequency)}</dd></div><div class="summary-row"><dt>保存内容</dt><dd>本文、スレッド、発言者、添付メタデータ。添付本文は取得しません</dd></div><div class="summary-row"><dt>保存先</dt><dd>秘書・一般プロジェクト・Chatworkと同じ非公開のGitHubリポジトリ</dd></div><div class="summary-row"><dt>自動保存</dt><dd>${automatic ? "GitHub Actionsが取得結果をGitのcommit・pushで保存" : "手動取得時だけ保存"}</dd></div></dl><p class="notice">共同編集者は保存済み本文を読めます。${escape(rangeNote)}</p><label class="consent"><input id="settings-git-consent" type="checkbox"><span>設定ファイルと自動取得処理をこのリポジトリへcommit・pushすることに同意します。</span></label>${automatic ? '<label class="consent"><input id="settings-auto-consent" type="checkbox"><span>選択スペースを3時間等の指定間隔で取得し、結果を自動commit・pushすることに同意します。</span></label>' : ""}${actions("この内容で設定する")}`;
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
  app.innerHTML = '<p class="eyebrow">設定反映中</p><h1>現在の設定へ反映しています。</h1><p class="lead">設定、取得runtime、GitHub Actions workflowを同じ非公開リポジトリへ保存しています。</p>';
  try {
    const result = await json("/api/settings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ selectedSpaceNames: [...state.selected], interval: state.interval, commitPushConsent: state.commitPushConsent, automaticPushConsent: state.automaticPushConsent }) });
    state.config = result.current.config;
    state.sync = result.current.sync;
    state.spaces = result.current.spaces;
    renderSettingsResult();
  } catch (error) {
    app.innerHTML = `<p class="eyebrow">設定を変更していません</p><h1>変更前の状態へ戻しました。</h1>${errorMessage(error)}<p class="notice">履歴と以前の設定は保持しています。Gitの競合やGitHub権限を確認してから再実行してください。</p>${actions("設定を確認し直す", "終了する")}`;
    app.querySelector('[data-action="next"]').onclick = renderSettingsSpaces;
    app.querySelector('[data-action="back"]').onclick = renderComplete;
  }
}

function renderSettingsResult() {
  progress(4);
  const names = state.spaces.filter((space) => state.config.selectedSpaceNames.includes(space.name)).map((space) => escape(space.displayName)).join("、");
  const frequency = frequencies.find(([value]) => value === state.config.interval)?.[1];
  const syncStatus = state.sync?.status === "partial" ? "一部失敗" : state.sync?.status === "failed" ? "失敗" : state.sync?.status === "success" ? "成功" : "まだありません";
  app.innerHTML = `<p class="eyebrow">設定完了</p><h1>現在のGoogle Chat設定を保存しました。</h1><dl class="summary"><div class="summary-row"><dt>現在の対象</dt><dd>${names}</dd></div><div class="summary-row"><dt>現在の間隔</dt><dd>${escape(frequency)}</dd></div><div class="summary-row"><dt>自動実行</dt><dd>${state.config.scheduleEnabled ? "有効" : "無効（手動のみ）"}</dd></div><div class="summary-row"><dt>直近の取得</dt><dd>${syncStatus}</dd></div></dl><p class="notice">選択を外したスペースの既存履歴は削除していません。</p><div class="actions"><button class="button button-secondary" data-action="close">設定を終了</button></div>`;
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
  app.innerHTML = `<p class="eyebrow">キャンセル</p><h1>Google Chatの設定を終了しました。</h1><p class="lead ${detail.kind === "manual" ? "error" : ""}" role="${detail.kind === "manual" ? "alert" : "status"}">${escape(detail.text)}</p><p>${externalLink(links.permissions, "Googleのアプリ権限を確認する")}</p><div class="actions"><button class="button button-secondary" data-action="restart">設定に戻る</button></div>`;
  app.querySelector('[data-action="restart"]').onclick = renderPrepare;
}
function renderComplete() { app.innerHTML = '<p class="eyebrow">完了</p><h1>設定画面を閉じて大丈夫です。</h1><p class="lead">次は /google-chat search から保存済み履歴を検索できます。</p>'; }

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
  else if (state.oauth.status === "ready") renderAuthorize();
  else if (state.oauth.status === "authorizing") renderOAuthWaiting();
  else if (state.oauth.status === "failed") renderOAuthFailure();
  else if (["cancelled", "cleanup-required"].includes(state.oauth.status)) renderCancelled(state.cleanup);
  else if (state.oauth.status === "completed") renderComplete();
  else renderPrepare();
}).catch((error) => { app.innerHTML = `<p class="eyebrow">接続エラー</p><h1>設定を読み込めませんでした。</h1>${errorMessage(error)}`; });
