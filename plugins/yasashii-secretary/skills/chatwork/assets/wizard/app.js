const app = document.querySelector("#app");
const state = { step: 1, rooms: [], selected: new Set(), originalSelected: new Set(), interval: "1h", consent: false, query: "" };
const frequencies = [
  ["30m", "30分", 1440], ["1h", "1時間（おすすめ）", 720], ["3h", "3時間", 240],
  ["6h", "6時間", 120], ["12h", "12時間", 60], ["manual", "手動のみ", 0],
];

function escape(value) {
  return String(value).replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[character]));
}

function progress(step) {
  document.querySelectorAll("[data-progress]").forEach((item) => {
    if (Number(item.dataset.progress) === step) item.setAttribute("aria-current", "step");
    else item.removeAttribute("aria-current");
  });
}

function actions(primary, secondary = "戻る") {
  return `<div class="actions"><button class="button button-secondary" data-action="back">${secondary}</button><button class="button button-primary" data-action="next">${primary}</button></div>`;
}

function renderRooms() {
  state.step = 1; progress(1);
  const shown = state.rooms.filter((room) => room.name.toLocaleLowerCase("ja").includes(state.query.toLocaleLowerCase("ja")) || room.roomId.includes(state.query));
  app.innerHTML = `<p class="eyebrow">STEP 1 / 4</p><h1>保存するroomを選びます。</h1><p class="lead">チェックしたroomだけをGitHub Actionsが読みます。初期状態では1件も選びません。</p>
    <div class="panel"><label class="search-label" for="room-search">roomを検索</label><input class="search" id="room-search" type="search" value="${escape(state.query)}" placeholder="room名またはRoom ID">
    <ul class="room-list">${shown.map((room) => `<li><label class="choice"><input type="checkbox" value="${escape(room.roomId)}" ${state.selected.has(room.roomId) ? "checked" : ""}><span class="choice-copy"><span class="choice-title">${escape(room.name)}</span><span class="choice-meta">Room ID ${escape(room.roomId)}</span></span></label></li>`).join("")}</ul>
    <p class="hint">選択中: ${state.selected.size} room</p></div>${actions("頻度を選ぶ", "キャンセル")}`;
  app.querySelector("#room-search").addEventListener("input", (event) => { state.query = event.target.value; renderRooms(); app.querySelector("#room-search").focus(); });
  app.querySelectorAll('input[type="checkbox"]').forEach((input) => input.addEventListener("change", () => { input.checked ? state.selected.add(input.value) : state.selected.delete(input.value); renderRooms(); }));
  app.querySelector('[data-action="next"]').disabled = state.selected.size === 0;
  app.querySelector('[data-action="next"]').onclick = renderFrequency;
  app.querySelector('[data-action="back"]').onclick = renderCancelled;
}

function renderFrequency() {
  state.step = 2; progress(2);
  app.innerHTML = `<p class="eyebrow">STEP 2 / 4</p><h1>同期の間隔を選びます。</h1><p class="lead">1時間がおすすめです。月間run数は30日換算の概算で、実際の課金分数ではありません。</p>
    <div class="panel"><ul class="frequency-list">${frequencies.map(([value, label, runs]) => `<li><label class="choice"><input type="radio" name="interval" value="${value}" ${state.interval === value ? "checked" : ""}><span class="choice-copy"><span class="choice-title">${label}</span><span class="choice-meta">約 ${runs.toLocaleString("ja-JP")} runs / 30日</span></span></label></li>`).join("")}</ul>
    <p class="hint">GitHub Free privateの2,000分は変更される可能性がある参考値です。この設定ではまだ定期scheduleを有効にしません。</p></div>${actions("内容を確認する")}`;
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
  app.innerHTML = `<p class="eyebrow">STEP 3 / 4</p><h1>保存内容を確認してください。</h1><p class="lead">確定するまでrepoや履歴は変更しません。確定後、設定とworkflowを同じcommitへ反映します。</p>
    <dl class="summary"><div class="summary-row"><dt>対象room</dt><dd>${selectedRooms.map((room) => escape(room.name)).join("、")}</dd></div><div class="summary-row"><dt>同期間隔</dt><dd>${frequency[1]}（約 ${frequency[2].toLocaleString("ja-JP")} runs / 30日）</dd></div><div class="summary-row"><dt>保存先</dt><dd>秘書・通常projectと同じprivate GitHub repo</dd></div></dl>
    <p class="notice">共同編集者は保存された本文を読めます。各roomの最新100件以内を取得し、導入前や100件より前の履歴は含まれないことがあります。${removed.length ? `${removed.map((room) => escape(room.name)).join("、")} は今後の取得だけを止め、保存済み履歴は削除しません。` : ""}</p>
    ${automatic ? '<label class="consent"><input id="automatic-consent" type="checkbox"> <span>選択roomの履歴を、この頻度で自動取得・commit・pushすることに同意します。</span></label>' : '<p class="notice">手動のみではscheduleを作らず、検索時も確認後だけ同期します。</p>'}
    ${actions("設定を確定する")}`;
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
  button.disabled = true; button.textContent = "設定を反映中…";
  const response = await fetch("/api/confirm", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ selectedRoomIds: [...state.selected], interval: state.interval, automaticPushConsent: state.consent }) });
  const result = await response.json();
  if (!response.ok) { button.disabled = false; button.textContent = "設定を確定する"; app.insertAdjacentHTML("beforeend", `<p class="error" role="alert">${escape(result.error)}</p>`); return; }
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
    const frequency = frequencies.find(([value]) => value === config.interval) || frequencies[1];
    const schedule = config.scheduleEnabled === true;
    const done = ["success", "failed", "fixture"].includes(result.dispatch.status);
    const heading = result.dispatch.status === "failed"
      ? "設定は変更しましたが、同期を完了できませんでした。"
      : done ? "設定変更が完了しました。" : "設定変更を進めています。";
    app.innerHTML = `<p class="eyebrow">STEP 4 / 4</p><h1>${heading}</h1><p class="lead">${escape(result.dispatch.message || "設定の反映状態を確認しています。")}</p>
      <dl class="summary"><div class="summary-row"><dt>現在の対象room</dt><dd>${selectedRooms.map((room) => escape(room.name)).join("、")}</dd></div><div class="summary-row"><dt>現在の同期間隔</dt><dd>${frequency[1]}</dd></div><div class="summary-row"><dt>schedule</dt><dd>${schedule ? "有効（自動取得・commit・push）" : "無効（手動のみ）"}</dd></div></dl>
      <p class="notice">roomを解除しても、保存済み履歴は削除していません。</p>
      <div class="actions"><button class="button button-secondary" data-action="close">設定を終了</button></div>`;
    app.querySelector('[data-action="close"]').onclick = () => { app.innerHTML = '<p class="eyebrow">COMPLETE</p><h1>設定画面を閉じて大丈夫です。</h1><p class="lead">次は /chatwork から保存済み履歴を検索できます。</p>'; };
    if (!done) window.setTimeout(renderResult, 2000);
    return;
  }
  const sync = result.sync;
  const done = ["success", "failed", "fixture"].includes(result.dispatch.status);
  const results = ["success", "fixture"].includes(result.dispatch.status) ? (sync?.results || []) : [];
  const zero = sync?.status === "success" && results.reduce((sum, item) => sum + item.fetched, 0) === 0;
  app.innerHTML = `<p class="eyebrow">STEP 4 / 4</p><h1>${done ? "初回設定の結果です。" : "初回取得を進めています。"}</h1><p class="lead">${escape(result.dispatch.message || "GitHub Actionsの状態を確認しています。")}</p>
    ${results.length ? `<ul class="result-list">${results.map((item) => `<li><strong>${escape(item.roomName)}</strong> — ${item.status === "success" ? `成功・${item.fetched}件` : `失敗・${escape(item.message || "再実行してください")}`}</li>`).join("")}</ul>` : ""}
    ${zero ? '<p class="empty">0件でも設定は成功です。今後の同期から履歴が蓄積されます。</p>' : ""}
    <div class="actions"><button class="button button-secondary" data-action="close">設定を終了</button></div>`;
  app.querySelector('[data-action="close"]').onclick = () => { app.innerHTML = '<p class="eyebrow">COMPLETE</p><h1>設定画面を閉じて大丈夫です。</h1><p class="lead">次は /chatwork から保存済み履歴を検索できます。</p>'; };
  if (!done) window.setTimeout(renderResult, 2000);
}

function renderCancelled() {
  progress(1);
  app.innerHTML = '<p class="eyebrow">CANCELLED</p><h1>変更せずに終了しました。</h1><p class="lead">room設定、workflow、履歴は変更していません。</p><div class="actions"><button class="button button-secondary" data-action="restart">選択に戻る</button></div>';
  app.querySelector('[data-action="restart"]').onclick = renderRooms;
}

fetch("/api/bootstrap").then((response) => response.json()).then(({ rooms, config }) => {
  if (rooms.status !== "ready") {
    app.innerHTML = '<p class="eyebrow">ROOM DISCOVERY</p><h1>room一覧をまだ確認できません。</h1><p class="lead">/chatwork に戻り、Repository Secret登録後のroom discoveryを実行してください。</p>';
    return;
  }
  state.rooms = rooms.rooms || [];
  state.selected = new Set(config.selectedRoomIds || []);
  state.originalSelected = new Set(config.selectedRoomIds || []);
  state.interval = config.interval || "1h";
  state.consent = config.automaticPushConsent === true;
  if (state.rooms.length === 0) {
    app.innerHTML = '<p class="eyebrow">ROOM DISCOVERY</p><h1>参加中のroomは0件でした。</h1><p class="lead">これは正常な取得結果です。Chatworkの参加roomを確認してからroom一覧を更新してください。</p>';
    return;
  }
  renderRooms();
}).catch(() => {
  app.innerHTML = '<p class="eyebrow">CONNECTION ERROR</p><h1>設定を読み込めませんでした。</h1><p class="lead error">wizardを再起動し、repo rootを確認してください。</p>';
});
