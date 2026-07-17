import { installWizardShell, nowCopy, renderWizardScreen, safetyList, technicalDetails } from "/common.js";
import { chatworkInitialResultModel } from "/result-model.js";

const { app } = installWizardShell("chatwork");
const state = {
  step: 0,
  rooms: [],
  selected: new Set(),
  originalSelected: new Set(),
  interval: "3h",
  consent: false,
  query: "",
  repository: null,
};
const frequencies = [
  ["30m", "30分ごと", 1440], ["1h", "1時間ごと", 720], ["3h", "3時間ごと（おすすめ・初期値）", 240],
  ["6h", "6時間ごと", 120], ["12h", "12時間ごと", 60], ["manual", "手動のみ", 0],
];
const officialLinks = {
  token: "https://www.chatwork.com/service/packages/chatwork/subpackages/api/token.php",
  tokenHelp: "https://help.chatwork.com/hc/ja/articles/115000172402-API%E3%83%88%E3%83%BC%E3%82%AF%E3%83%B3%E3%82%92%E7%99%BA%E8%A1%8C%E3%81%99%E3%82%8B",
  application: "https://help.chatwork.com/hc/ja/articles/115000169501-API%E3%81%AE%E5%88%A9%E7%94%A8%E7%94%B3%E8%AB%8B%E3%82%92%E6%89%BF%E8%AA%8D-%E5%8D%B4%E4%B8%8B%E3%81%99%E3%82%8B",
  tokenHandling: "https://developer.chatwork.com/docs/endpoints",
  billing: "https://docs.github.com/en/billing/concepts/product-billing/github-actions",
};

function escape(value) {
  return String(value).replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[character]));
}

function externalLink(url, label, className = "text-link") {
  return `<a class="${className}" href="${escape(url)}" target="_blank" rel="noopener noreferrer" aria-label="${escape(label)}（新しいタブで開く）">${escape(label)}</a>`;
}

function progress(step) {
  document.querySelectorAll("[data-progress]").forEach((item) => {
    if (Number(item.dataset.progress) === step) item.setAttribute("aria-current", "step");
    else item.removeAttribute("aria-current");
  });
}

function actions(primary, secondary = "戻る") {
  return `<div class="actions" data-copy-role="actions"><button class="button button-secondary" data-action="back" aria-label="${escape(secondary)}">${escape(secondary)}</button><button class="button button-primary" data-action="next" aria-label="${escape(primary)}">${escape(primary)}</button></div>`;
}

function show(id, html, stateName = "ready") {
  renderWizardScreen(app, { id: `chatwork-${id}`, state: stateName, html });
}

function renderToken() {
  state.step = 0; progress(0);
  show("prepare-connection", `<p class="eyebrow">接続 1 / 4</p><h1>Chatworkの接続情報を用意します。</h1>
    ${nowCopy("Chatworkの公式ページで、接続に使う情報を発行します。")}
    <div class="panel"><p class="panel-title">用意できたら、この設定画面へ戻ってください。</p>
      <p class="link-list">${externalLink(officialLinks.token, "Chatworkで接続情報を発行する")}<br>${externalLink(officialLinks.tokenHelp, "発行方法を見る")}</p>
      ${technicalDetails("詳しい説明: 接続情報の正式名称と安全な扱い", `<p>正式名称は <strong>API Token</strong> です。Chatworkを読むための秘密の情報なので、第三者へ見せず、この画面や会話にも貼り付けません。次の画面でGitHubへ直接登録します。${externalLink(officialLinks.tokenHandling, "Chatwork公式のAPI Token取扱いを見る")}</p>`)}
    </div>${actions("接続情報の登録へ進む", "管理者への申請を確認する")}`);
  app.querySelector('[data-action="next"]').onclick = renderSecret;
  app.querySelector('[data-action="back"]').onclick = renderApplication;
}

function renderApplication() {
  state.step = 0; progress(0);
  show("admin-approval", `<p class="eyebrow">接続 1 / 4</p><h1>Chatworkの管理者へ利用を申請します。</h1>
    ${nowCopy("組織でChatworkを使っている場合は、管理者の承認を確認します。")}
    <div class="panel"><p class="panel-title">実際に使うアカウントで申請し、承認後に戻ってください。</p><p>${externalLink(officialLinks.application, "管理者への利用申請方法を見る")}</p><p class="hint">ここまでの選択は保持します。</p>
    ${technicalDetails("管理者向け: API利用の条件", "<p>パーソナルプランを除き、Chatwork APIの利用に管理者承認が必要です。承認前はルーム一覧を取得しません。</p>", "admin")}</div>
    ${actions("承認後に接続情報を用意する", "申請せず終了する")}`);
  app.querySelector('[data-action="next"]').onclick = renderToken;
  app.querySelector('[data-action="back"]').onclick = renderCancelled;
}

function renderSecret() {
  state.step = 0; progress(0);
  const available = Boolean(state.repository?.secretUrl);
  show("register-connection", `<p class="eyebrow">接続 2 / 4</p><h1>接続情報をGitHubへ登録します。</h1>
    ${nowCopy("Chatworkの接続情報を、現在の非公開GitHubリポジトリへ登録します。")}
    <div class="panel"><p class="panel-title">GitHubで使う登録名</p><p><code>CHATWORK_API_TOKEN</code></p><p class="hint">接続情報の値はGitHubの画面だけで入力します。</p>
    ${technicalDetails("詳しい説明: GitHubでの保管方法", "<p>GitHub上の安全な保管場所は <strong>Repository Secret</strong> です。この画面やリポジトリのファイルには秘密の値を保存しません。</p>")}</div>
    ${available ? '<div class="actions" data-copy-role="actions"><button class="button button-secondary" data-action="back" aria-label="接続情報の準備へ戻る">戻る</button><a id="secret-link" class="button button-primary" href="#" target="_blank" rel="noopener noreferrer" aria-label="GitHubの登録画面を新しいタブで開く">GitHubの登録画面を開く</a></div>' : '<p class="error" role="alert">現在の非公開GitHubリポジトリを確認できませんでした。</p><p class="notice">GitHubへの接続先を確認してから、もう一度お試しください。</p><details data-copy-role="technical"><summary>管理者向け: 接続先の確認</summary><p>Git remoteの <code>origin</code> がGitHub.comのリポジトリを指しているか確認します。</p></details><div class="actions"><button class="button button-secondary" data-action="back" aria-label="接続情報の準備へ戻る">戻る</button></div>'}`);
  app.querySelector('[data-action="back"]').onclick = renderToken;
  if (available) {
    const link = app.querySelector("#secret-link");
    link.href = state.repository.secretUrl;
    link.addEventListener("click", () => window.setTimeout(renderSecretConfirmation, 100));
  }
}

function renderSecretConfirmation() {
  state.step = 0; progress(0);
  show("confirm-registration", `<p class="eyebrow">接続 3 / 4</p><h1>GitHubへの登録を確認します。</h1>
    ${nowCopy("GitHubで、Chatworkの接続情報を保存できたことを確認します。")}
    <label class="consent"><input id="secret-confirmed" type="checkbox"><span><code>CHATWORK_API_TOKEN</code> として登録しました</span></label>
    ${technicalDetails("詳しい説明: 確認する内容", "<p>秘密の値は読み戻しません。GitHubの登録名だけを照合します。</p>")}
    ${actions("Chatworkのルーム確認へ進む")}`);
  const checkbox = app.querySelector("#secret-confirmed");
  const next = app.querySelector('[data-action="next"]');
  next.disabled = true;
  checkbox.onchange = () => { next.disabled = !checkbox.checked; };
  next.onclick = renderDiscovery;
  app.querySelector('[data-action="back"]').onclick = renderSecret;
}

function renderDiscovery() {
  state.step = 0; progress(0);
  show("discover", `<p class="eyebrow">接続 4 / 4</p><h1>Chatworkのルームを確認します。</h1>
    ${nowCopy("参加しているChatworkルームの一覧を取得します。")}
    <p class="notice">この操作で初めてChatworkを読みます。</p>
    ${technicalDetails("詳しい説明: ルーム一覧の取得方法", "<p>自動取得処理（GitHub Actions）が登録済みの接続情報を使います。まだメッセージ本文は保存しません。</p>")}
    ${actions("参加ルームを取得する")}`);
  app.querySelector('[data-action="back"]').onclick = renderSecretConfirmation;
  app.querySelector('[data-action="next"]').onclick = discoverRooms;
}

async function discoverRooms() {
  const button = app.querySelector('[data-action="next"]');
  button.disabled = true;
  show("discover-loading", `<p class="eyebrow">接続 4 / 4</p><h1>Chatworkのルームを確認しています。</h1><p class="lead" data-copy-role="status">参加しているルームの一覧を取得しています。</p><p class="notice">確認が終わるまで、この画面を開いたままお待ちください。</p>`, "loading");
  try {
    const response = await fetch("/api/discover", { method: "POST" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "ルーム一覧を取得できませんでした。");
    state.rooms = result.rooms.rooms || [];
    if (state.rooms.length === 0) {
      show("discover-empty", '<p class="eyebrow">接続 4 / 4</p><h1>選べるChatworkルームはまだありません。</h1><p class="lead" data-copy-role="result">ルームが0件でも、接続の失敗ではありません。</p><p class="notice">Chatworkで参加ルームを確認してから、もう一度取得できます。</p><div class="actions" data-copy-role="actions"><button class="button button-secondary" data-action="back" aria-label="Chatworkの接続準備へ戻る">接続準備へ戻る</button><button class="button button-primary" data-action="retry" aria-label="Chatworkの参加ルームをもう一度取得する">参加ルームをもう一度取得する</button></div>', "empty");
      app.querySelector('[data-action="back"]').onclick = renderToken;
      app.querySelector('[data-action="retry"]').onclick = renderDiscovery;
      return;
    }
    renderRooms();
  } catch (error) {
    show("discover-failure", `<p class="eyebrow">接続を確認できません</p><h1>Chatworkのルームを取得できませんでした。</h1><p class="lead error" data-copy-role="error" role="alert">接続情報または通信状態を確認できませんでした。</p><p class="notice">GitHubへの登録と通信を確認して、もう一度お試しください。</p>${technicalDetails("管理者向け: エラーの詳しい内容", `<p>${escape(error.message)}</p>`, "admin")}${actions("Chatworkの接続を確認し直す", "接続準備へ戻る")}`, "error");
    app.querySelector('[data-action="next"]').onclick = renderDiscovery;
    app.querySelector('[data-action="back"]').onclick = renderToken;
  }
}

function renderRooms() {
  state.step = 1; progress(1);
  const shown = state.rooms.filter((room) => room.name.toLocaleLowerCase("ja").includes(state.query.toLocaleLowerCase("ja")) || room.roomId.includes(state.query));
  show("select-rooms", `<p class="eyebrow">STEP 1 / 4</p><h1>保存するChatworkルームを選びます。</h1>${nowCopy("保存したいChatworkルームにチェックを入れます。")}
    <div class="panel"><label class="search-label" for="room-search">ルームを検索</label><input class="search" id="room-search" type="search" value="${escape(state.query)}" placeholder="ルーム名またはルームID">
    <ul class="room-list">${shown.map((room) => `<li><label class="choice"><input type="checkbox" value="${escape(room.roomId)}" ${state.selected.has(room.roomId) ? "checked" : ""}><span class="choice-copy"><span class="choice-title">${escape(room.name)}</span></span></label></li>`).join("")}</ul>
    <p class="hint" role="status">選択中: ${state.selected.size}ルーム</p>${technicalDetails("管理者向け: ルームを識別する番号", `<ul>${shown.map((room) => `<li>${escape(room.name)}: <code>${escape(room.roomId)}</code></li>`).join("")}</ul>`, "admin")}</div><p class="notice">選んだルームだけを読みます。選んでいないルームは読みません。</p>${actions("Chatworkの取得間隔を選ぶ", "Chatworkの設定をキャンセル")}`);
  app.querySelector("#room-search").addEventListener("input", (event) => { state.query = event.target.value; renderRooms(); app.querySelector("#room-search").focus(); });
  app.querySelectorAll('input[type="checkbox"]').forEach((input) => input.addEventListener("change", () => { input.checked ? state.selected.add(input.value) : state.selected.delete(input.value); renderRooms(); }));
  app.querySelector('[data-action="next"]').disabled = state.selected.size === 0;
  app.querySelector('[data-action="next"]').onclick = renderFrequency;
  app.querySelector('[data-action="back"]').onclick = renderCancelled;
}

function renderFrequency() {
  state.step = 2; progress(2);
  show("select-interval", `<p class="eyebrow">STEP 2 / 4</p><h1>Chatworkの取得間隔を選びます。</h1>${nowCopy("新しいメッセージを自動で確認する間隔を選びます。")}
    <div class="panel"><ul class="frequency-list">${frequencies.map(([value, label, runs]) => `<li><label class="choice"><input type="radio" name="interval" value="${value}" ${state.interval === value ? "checked" : ""}><span class="choice-copy"><span class="choice-title">${label}</span><span class="choice-meta">約${runs.toLocaleString("ja-JP")}回 / 30日</span></span></label></li>`).join("")}</ul>
    ${technicalDetails("詳しい説明: 料金と実行時間について", `<p>実行回数とGitHub Actionsの処理時間は別です。GitHub Freeの非公開リポジトリでは、2026年7月時点で月2,000分の処理時間が含まれます。2,000回の実行枠ではありません。実使用量はプラン、runner、1回あたりの処理時間で変わり、料金や利用枠も変更される可能性があります。</p><p>${externalLink(officialLinks.billing, "GitHub Actionsの料金と利用枠を見る")}</p>`)}
    </div><p class="notice">3時間ごとは、負担と新しさのバランスを取りやすいおすすめ設定です。</p>${actions("Chatworkの保存内容を確認する")}`);
  app.querySelectorAll('input[name="interval"]').forEach((input) => input.addEventListener("change", () => { state.interval = input.value; }));
  app.querySelector('[data-action="next"]').onclick = renderReview;
  app.querySelector('[data-action="back"]').onclick = renderRooms;
}

function renderReview() {
  state.step = 3; progress(3);
  const selectedRooms = state.rooms.filter((room) => state.selected.has(room.roomId));
  const frequency = frequencies.find(([value]) => value === state.interval);
  const removed = state.rooms.filter((room) => state.originalSelected.has(room.roomId) && !state.selected.has(room.roomId));
  const automatic = state.interval !== "manual";
  const reading = selectedRooms.map((room) => room.name).join("、");
  show("review", `<p class="eyebrow">STEP 3 / 4</p><h1>Chatworkの保存内容を確認します。</h1>${nowCopy("読むルーム、保存先、自動取得の設定を確認します。")}
    <dl class="summary"><div class="summary-row"><dt>選んだルーム</dt><dd>${escape(reading)}</dd></div><div class="summary-row"><dt>取得間隔</dt><dd>${frequency[1]}（約${frequency[2].toLocaleString("ja-JP")}回 / 30日）</dd></div></dl>
    ${safetyList([
      { label: "読む対象", text: `選んだChatworkルーム（${reading}）だけです。` },
      { label: "保存先", text: "現在の非公開GitHubリポジトリです。" },
      { label: "見える人", text: "リポジトリの共同編集者にも保存内容が見えます。" },
      { label: "自動取得・保存", text: automatic ? `${frequency[1]}に新しいメッセージを取得して保存します。` : "自動取得は行わず、必要なときだけ取得して保存します。" },
      { label: "履歴の保持", text: removed.length ? "選択を外したルームの取得済み履歴も削除しません。" : "設定変更や手動のみへの変更では、取得済み履歴を削除しません。" },
    ])}
    ${technicalDetails("詳しい説明: 保存処理と取得範囲", `<p>各ルームの最新100件以内を取得します。導入前や100件より前の履歴は含まれないことがあります。</p><p>取得結果をこのリポジトリへ自動保存します（Gitのcommit・push）。自動取得処理はGitHub Actionsで動きます。</p>`)}
    ${automatic ? '<label class="consent"><input id="automatic-consent" type="checkbox"><span>この内容でChatworkの自動取得と保存を始めることに同意します。</span></label>' : '<p class="notice">手動のみでは自動取得を止めます。必要なときだけ取得でき、これまでの履歴は残ります。</p>'}
    ${actions("この設定でChatworkを始める")}`);
  const confirmButton = app.querySelector('[data-action="next"]');
  if (automatic) {
    const checkbox = app.querySelector("#automatic-consent");
    checkbox.checked = state.consent;
    confirmButton.disabled = !state.consent;
    checkbox.onchange = () => { state.consent = checkbox.checked; confirmButton.disabled = !state.consent; };
  } else {
    state.consent = false;
  }
  confirmButton.onclick = confirm;
  app.querySelector('[data-action="back"]').onclick = renderFrequency;
}

async function confirm() {
  const button = app.querySelector('[data-action="next"]');
  button.disabled = true;
  show("saving", '<p class="eyebrow">STEP 4 / 4</p><h1>Chatworkの設定を保存しています。</h1><p class="lead" data-copy-role="status">選んだルームと取得間隔を保存しています。</p><p class="notice">保存結果を確認するまで、この画面を開いたままお待ちください。</p>', "loading");
  const response = await fetch("/api/confirm", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ selectedRoomIds: [...state.selected], interval: state.interval, automaticPushConsent: state.consent }) });
  const result = await response.json();
  if (!response.ok) {
    show("save-failure", `<p class="eyebrow">保存できませんでした</p><h1>Chatworkの設定を保存できませんでした。</h1><p class="lead error" data-copy-role="error" role="alert">設定の保存中に問題が起きました。</p><p class="notice">接続先とGitHubの状態を確認して、保存内容をもう一度お確かめください。</p>${technicalDetails("管理者向け: エラーの詳しい内容", `<p>${escape(result.error || "原因を確認できませんでした。")}</p>`, "admin")}${actions("Chatworkの保存内容を確認し直す", "取得間隔へ戻る")}`, "error");
    app.querySelector('[data-action="next"]').onclick = renderReview;
    app.querySelector('[data-action="back"]').onclick = renderFrequency;
    return;
  }
  renderResult();
}

async function renderResult() {
  state.step = 4; progress(4);
  const response = await fetch("/api/status");
  const result = await response.json();
  const configurationChange = result.dispatch.operation === "configuration-change";
  if (configurationChange) {
    const config = result.dispatch.config || {};
    const selected = new Set((config.selectedRoomIds || []).map(String));
    const selectedRooms = state.rooms.filter((room) => selected.has(room.roomId));
    const frequency = frequencies.find(([value]) => value === config.interval) || frequencies[2];
    const automaticExecution = config.scheduleEnabled === true;
    const done = ["success", "failed", "fixture"].includes(result.dispatch.status);
    const failed = result.dispatch.status === "failed";
    if (!done) {
      show("result-loading", '<p class="eyebrow">STEP 4 / 4</p><h1>Chatworkの保存結果を確認しています。</h1><p class="lead" data-copy-role="status">新しい設定が使える状態になったか確認しています。</p><p class="notice">確認が終わるまで、この画面を開いたままお待ちください。</p>', "loading");
      window.setTimeout(renderResult, 2000);
      return;
    }
    show(failed ? "settings-result-failure" : "settings-result", `<p class="eyebrow">STEP 4 / 4</p><h1>${failed ? "Chatworkの設定は保存しましたが、最新メッセージを確認できませんでした。" : "Chatworkの設定を保存しました。"}</h1><p class="lead" data-copy-role="result">${failed ? "設定は残っています。接続を確認してから、もう一度取得できます。" : "次は保存したChatworkメッセージを検索できます。"}</p>
      <dl class="summary"><div class="summary-row"><dt>現在の対象ルーム</dt><dd>${selectedRooms.map((room) => escape(room.name)).join("、")}</dd></div><div class="summary-row"><dt>現在の自動取得の間隔</dt><dd>${frequency[1]}</dd></div><div class="summary-row"><dt>自動実行</dt><dd>${automaticExecution ? "有効（自動取得・commit・push）" : "無効（手動のみ）"}</dd></div></dl>
      <p class="notice">ルームの選択を外した場合も、保存済み履歴は削除していません。</p>${technicalDetails("詳しい説明: 保存結果", `<p>${escape(result.dispatch.message || "詳しい結果はありません。")}</p><p>自動実行が有効な場合は、GitHub ActionsがGitのcommit・pushで保存します。</p>`)}<div class="actions" data-copy-role="actions"><button class="button button-primary" data-action="close" aria-label="Chatworkの設定を終了して検索案内を見る">設定を終了する</button></div>`, failed ? "error" : "success");
    app.querySelector('[data-action="close"]').onclick = renderComplete;
    return;
  }
  const done = ["success", "failed", "fixture"].includes(result.dispatch.status);
  if (!done) {
    show("initial-result-loading", '<p class="eyebrow">STEP 4 / 4</p><h1>Chatworkの最初の取得を進めています。</h1><p class="lead" data-copy-role="status">選んだルームの新しいメッセージを確認しています。</p><p class="notice">取得結果が出るまで、この画面を開いたままお待ちください。</p>', "loading");
    window.setTimeout(renderResult, 2000);
    return;
  }
  const model = chatworkInitialResultModel({ sync: result.sync, selectedRoomIds: [...state.selected], dispatchStatus: result.dispatch.status });
  const failed = model.status === "failed";
  const partial = model.status === "partial";
  const zero = model.status === "empty";
  const screen = failed ? "initial-result-failure" : partial ? "initial-result-partial" : zero ? "initial-result-empty" : "initial-result";
  const heading = failed ? "選んだChatworkルームを取得できませんでした。" : partial ? "一部のChatworkルームを取得できませんでした。" : "Chatworkの最初の取得が完了しました。";
  const primary = failed ? "接続を確認してから、もう一度取得してください。" : partial ? "取得できたメッセージは保存しました。失敗したルームは接続を確認してください。" : zero ? "まだ保存するメッセージはありません。" : "取得したメッセージを保存しました。";
  show(screen, `<p class="eyebrow">STEP 4 / 4</p><h1>${heading}</h1><p class="lead" data-copy-role="result">${primary}</p>
    <p class="hint" data-copy-role="selected-result-count">選んだルームで保存できたメッセージ: ${model.totalFetched}件</p>
    ${model.results.length ? `<ul class="result-list">${model.results.map((item) => `<li><strong>${escape(item.roomName)}</strong> — ${item.status === "success" ? `成功・${Number(item.fetched) || 0}件` : `失敗・${escape(item.message || "再実行してください")}`}</li>`).join("")}</ul>` : ""}
    ${zero ? '<p class="empty">次回以降の取得で、新しい内容を保存します。</p>' : ""}
    ${technicalDetails("詳しい説明: 取得結果", `<p>${escape(result.dispatch.message || "詳しい結果はありません。")}</p>`)}
    <div class="actions" data-copy-role="actions"><button class="button button-primary" data-action="close" aria-label="Chatworkの設定を終了して検索案内を見る">設定を終了する</button></div>`, failed ? "error" : partial ? "warning" : zero ? "empty" : "success");
  app.querySelector('[data-action="close"]').onclick = renderComplete;
}

function renderComplete() {
  show("complete", '<p class="eyebrow">完了</p><h1>Chatworkの設定は完了です。</h1><p class="lead" data-copy-role="result">次は /chatwork から保存済みメッセージを検索できます。</p>', "success");
}

function renderCancelled() {
  progress(0);
  show("cancelled", '<p class="eyebrow">キャンセル</p><h1>Chatworkの設定を変更せず終了しました。</h1><p class="lead" data-copy-role="result">ルーム、取得間隔、保存済み履歴は変更していません。</p><details data-copy-role="technical"><summary>詳しい説明: 変更していない内容</summary><p>自動取得処理（GitHub Actions）の設定や保存済み履歴にも変更はありません。</p></details><div class="actions" data-copy-role="actions"><button class="button button-primary" data-action="restart" aria-label="Chatworkの設定を最初から確認する">Chatworkの設定に戻る</button></div>', "cancelled");
  app.querySelector('[data-action="restart"]').onclick = renderToken;
}

fetch("/api/bootstrap").then((response) => response.json()).then(({ rooms, config, repository }) => {
  state.rooms = rooms.rooms || [];
  state.selected = new Set((config.selectedRoomIds || []).map(String));
  state.originalSelected = new Set((config.selectedRoomIds || []).map(String));
  state.interval = config.interval || "3h";
  state.consent = config.automaticPushConsent === true;
  state.repository = repository;
  if (state.selected.size > 0 && rooms.status === "ready") renderRooms();
  else renderToken();
}).catch(() => {
  show("bootstrap-failure", '<p class="eyebrow">開始できません</p><h1>Chatworkの設定を読み込めませんでした。</h1><p class="lead error" data-copy-role="error" role="alert">現在の設定を確認できませんでした。</p><p class="notice">設定画面を開き直してください。</p><details data-copy-role="technical"><summary>管理者向け: 起動場所の確認</summary><p>設定用のローカル画面を再起動し、GitHubリポジトリのrootを確認してください。</p></details>', "error");
});
