const ZERO_EFFECT = Object.freeze({
  fileWrites: 0,
  adapterCalls: 0,
  commandCalls: 0,
  externalCalls: 0,
});

function normalized(value) {
  return String(value ?? "").normalize("NFKC").trim().toLowerCase();
}

function result(selectedSkill, route, reason, options = {}) {
  return {
    selectedSkill,
    route,
    reason,
    explicit: options.explicit === true,
    delegation: options.delegation || "none",
    confirmationBoundary: options.confirmationBoundary || "none",
    ...(options.followUp ? { followUp: options.followUp } : {}),
    sideEffect: { performed: false, ...ZERO_EFFECT },
  };
}

const CONNECTOR_ROUTES = [
  {
    skill: "chatwork",
    route: "chatwork-explicit-entry",
    service: /(?:chatwork|チャットワーク)/u,
    operation: /(?:(?:chatwork|チャットワーク)\s*(?:で|から)\s*.{0,24}(?:探|検索|取得|読|見|確認)|(?:chatwork|チャットワーク)\s*(?:の\s*)?(?:履歴|メッセージ|ルーム).{0,24}(?:探|検索|取得|読|見|確認)|(?:chatwork|チャットワーク).{0,24}(?:に|へ|と|を)?\s*(?:つな(?:い|ぎ|ぐ)|接続(?:して|したい|する|し直)|設定(?:して|したい|する|し直)|連携(?:して|したい|する|し直)|同期(?:して|したい|する)|再取得)|(?:探|検索|取得).{0,24}(?:chatwork|チャットワーク))/u,
  },
  {
    skill: "google-chat",
    route: "google-chat-explicit-entry",
    service: /(?:google\s*chat|gchat|グーグルチャット)/u,
    operation: /(?:(?:google\s*chat|gchat|グーグルチャット)\s*(?:で|から)\s*.{0,24}(?:探|検索|取得|読|見|確認)|(?:google\s*chat|gchat|グーグルチャット)\s*(?:の\s*)?(?:履歴|メッセージ|スペース).{0,24}(?:探|検索|取得|読|見|確認)|(?:google\s*chat|gchat|グーグルチャット).{0,24}(?:に|へ|と|を)?\s*(?:つな(?:い|ぎ|ぐ)|接続(?:して|したい|する|し直)|設定(?:して|したい|する|し直)|連携(?:して|したい|する|し直)|同期(?:して|したい|する)|再認証)|(?:探|検索|取得).{0,24}(?:google\s*chat|gchat|グーグルチャット))/u,
  },
  {
    skill: "setup-google",
    route: "google-explicit-entry",
    service: /(?:gmail|google\s*(?:calendar|drive)|google(?:カレンダー|ドライブ)|グーグル(?:カレンダー|ドライブ)|google|グーグル)/u,
    operation: /(?:gmail|google\s*(?:calendar|drive)|google(?:カレンダー|ドライブ)|グーグル(?:カレンダー|ドライブ)|google|グーグル).{0,24}(?:に|へ|と|を)?\s*(?:つな(?:い|ぎ|ぐ)|接続(?:して|したい|する|し直)|設定(?:して|したい|する|し直)|連携(?:して|したい|する|し直)|同期(?:して|したい|する)|再認証(?:して|したい|する))/u,
  },
  {
    skill: "setup-microsoft",
    route: "microsoft-explicit-entry",
    service: /(?:microsoft|outlook|onedrive|teams)/u,
    operation: /(?:microsoft|outlook|onedrive|teams).{0,24}(?:に|へ|と|を)?\s*(?:つな(?:い|ぎ|ぐ)|接続(?:して|したい|する|し直)|設定(?:して|したい|する|し直)|連携(?:して|したい|する|し直)|同期(?:して|したい|する)|再認証(?:して|したい|する))/u,
  },
  {
    skill: "setup-notion",
    route: "notion-connection-explicit-entry",
    service: /notion/u,
    operation: /(?:notion.{0,24}(?:に|へ|と|を)?\s*(?:つな(?:い|ぎ|ぐ)|接続(?:して|したい|する|し直)|設定(?:して|したい|する|し直)|連携(?:して|したい|する|し直))|(?:つな(?:い|ぎ|ぐ)|接続(?:して|したい|する|し直)|設定(?:して|したい|する|し直)|連携(?:して|したい|する|し直)).{0,24}notion)/u,
  },
];

// Google/Microsoftの単独read要求は接続設定と別の経路です。public editionには
// 専用read Skillがないため、hostの実コネクタを使う通常routerへ返す。setupと
// readの複合要求は、先にsetupを選び、setup結果のfollowUpへreadを保持する。
const CONNECTOR_READ_ROUTES = [
  {
    service: /(?:gmail|google\s*(?:calendar|drive)|google(?:カレンダー|ドライブ)|グーグル(?:カレンダー|ドライブ)|google|グーグル)/u,
    operation: /(?:(?:gmail|google\s*(?:calendar|drive)|google(?:カレンダー|ドライブ)|グーグル(?:カレンダー|ドライブ)|google|グーグル)\s*(?:を|で|から|の)\s*.{0,24}(?:探|検索|取得|読|見|確認)|(?:gmail|google\s*(?:calendar|drive)|google(?:カレンダー|ドライブ)|グーグル(?:カレンダー|ドライブ))\s*の\s*(?:メール|予定|ファイル).{0,24}(?:探|検索|取得|読|見|確認)|(?:探|検索|取得).{0,24}(?:gmail|google\s*(?:calendar|drive)|google(?:カレンダー|ドライブ)|グーグル(?:カレンダー|ドライブ)))/u,
    route: "google-read-only-handoff",
  },
  {
    service: /(?:microsoft|outlook|onedrive|teams)/u,
    operation: /(?:(?:microsoft|outlook|onedrive|teams)\s*(?:を|で|から|の)\s*.{0,24}(?:探|検索|取得|読|見|確認)|(?:探|検索|取得).{0,24}(?:microsoft|outlook|onedrive|teams))/u,
    route: "microsoft-read-only-handoff",
  },
];

const CLARITY = /(?:project\s*clarity|\bclarity\b|クラリティ|今(?:、)?人間が考える必要|今考える(?:必要|べき)こと|決定.*実行.*(?:状態|ずれ|ズレ)|\b(?:decision|execution|validation|attention|drift)\b)/u;
const CLARITY_INIT = /(?:project\s*clarity|\bclarity\b|クラリティ)\s*(?:を)?\s*(?:初期化|作って|始め)/u;
const PROJECT_LIFECYCLE = /(?:プロジェクト|project|案件).*(?:作成|作って|完了|終了|閉じ|再開|open|closed|canonicalrepo|正本repo)|(?:完了|再開).*(?:プロジェクト|project|案件)/u;
const PROJECT_SUMMARY = /(?:プロジェクト|project|案件).*(?:まとめ|整理|状況)/u;
const EXPLICIT_TASK = /(?:タスク化|todoに|todoへ|notion.*タスク|タスク.*notion|やることとして登録)/u;
const MEMORY = /(?:覚えて|記憶して|案件メモ|思い出して|前回の続き|決定として残)/u;
const BUILD = /(?:アプリ|ツール|サイト|機能).*(?:作って|開発|実装)|(?:作って|開発したい|実装して).*(?:アプリ|ツール|サイト|機能)/u;
const UPDATE = /(?:最新版|バージョン).*(?:確認|更新|して)|(?:プラグイン|agentic-secretary).*(?:更新|アップデート)|更新ある/u;
const DAILY = /(?:今日やること|今日の予定|朝の段取り|今日始め|今日はここまで|終わりにしよう|今日.*(?:要確認|段取り))/u;
const WEEKLY = /(?:今週|先週).*(?:振り返|活動|まとめ)|週次/u;
// 接続状態の確認は、個別サービスのread（予定・メール等）より先に共通診断へ送る。
// 「接続して、予定を見る」のような複合依頼はこの判定に入らず、明示setupを保持する。
const CONNECTIONS = /(?:繋がってる|つながってる|接続の調子|どれが使える|接続.*診断|(?:接続|連携)(?:の)?(?:状態|状況|可否|有無)?\s*(?:を)?\s*(?:確認|診断|チェック|調べ|見))/u;

function readFollowUp(text) {
  const connector = CONNECTOR_READ_ROUTES.find((candidate) => candidate.service.test(text) && candidate.operation.test(text));
  if (!connector) return null;
  return {
    selectedSkill: "secretary",
    route: connector.route,
    delegation: "host-connector-read",
    confirmationBoundary: "external-read-only",
    order: "after-setup",
  };
}

export function routeSecretaryIntent(input) {
  const text = normalized(input);
  if (!text) return result("secretary", "ask-current-request", "用件がまだ明示されていません。");

  // task／memory／build／update／project lifecycleは各既存Skillが所有し、Clarityが横取りしない。
  if (EXPLICIT_TASK.test(text)) {
    const notion = /notion/u.test(text);
    return result(notion ? "notion-tasks" : "projects", notion ? "downstream-notion-task-handoff" : "local-todo-handoff", "タスク化が明示されています。", {
      explicit: true,
      delegation: notion ? "fixed-downstream-task-adapter" : "project-tools:add-todo",
      confirmationBoundary: "existing-task-boundary",
    });
  }
  if (MEMORY.test(text)) {
    return result("memory-care", CLARITY.test(text) ? "clarity-reference-no-duplicate-memory" : "memory-explicit-entry", "記憶操作が現在の依頼で明示されています。", {
      explicit: true,
      delegation: CLARITY.test(text) ? "reference-existing-project-decision" : "memory-care",
      confirmationBoundary: "conversation-contract",
    });
  }
  if (BUILD.test(text)) return result("build", "harness-entry", "開発依頼はHarness入口が所有します。", { explicit: true, delegation: "using-harness" });
  if (UPDATE.test(text)) return result("update", "update-read-only-diagnosis", "plugin更新の依頼です。", { explicit: true, confirmationBoundary: "existing-update-boundary" });

  if (CONNECTIONS.test(text)) return result("connections", "connections-read-only-diagnosis", "接続診断が明示されています。", { explicit: true });

  // 明示setupは単独readより先に扱う。readも同じ依頼に含まれる場合は、setup後の
  // host connector readとしてroute意味を保持し、setup Skillが後続readを捨てない。
  for (const connector of CONNECTOR_ROUTES) {
    if (connector.service.test(text) && connector.operation.test(text)) {
      const followUp = connector.skill === "setup-google" || connector.skill === "setup-microsoft"
        ? readFollowUp(text)
        : null;
      return result(connector.skill, connector.route, followUp
        ? "接続設定を先に進め、完了後に指定されたread-only照会へ続けます。"
        : "外部サービスへの現在操作が明示されています。", {
        explicit: true,
        delegation: "existing-explicit-connector-entry",
        confirmationBoundary: "existing-connector-boundary",
        ...(followUp ? { followUp } : {}),
      });
    }
  }

  // 接続済みデータの単独readは setup Skill（認証・接続設定）へ送らない。
  for (const connector of CONNECTOR_READ_ROUTES) {
    if (connector.service.test(text) && connector.operation.test(text)) {
      return result("secretary", connector.route, "接続設定ではなく、現在のhostの公式コネクタで読む依頼です。", {
        explicit: true,
        delegation: "host-connector-read",
        confirmationBoundary: "external-read-only",
      });
    }
  }

  // 期間と集計が現在操作なら、Project／Clarityという名詞よりdaily／weeklyを優先する。
  if (DAILY.test(text)) return result("daily", "daily-existing-entry", "予定・TODO・中断点を扱う既存daily用件です。", { explicit: true });
  if (WEEKLY.test(text)) return result("weekly", "weekly-existing-entry", "journal原本を扱う既存weekly用件です。", { explicit: true });

  if (CLARITY_INIT.test(text)) return result("clarity", "clarity-manual-entry", "Project Clarityの初期化または状態操作です。", { explicit: true });
  if (PROJECT_LIFECYCLE.test(text) || (PROJECT_SUMMARY.test(text) && !CLARITY.test(text))) {
    return result("projects", "project-lifecycle", "Project lifecycleはprojectsが所有します。", { explicit: true, confirmationBoundary: "existing-project-boundary" });
  }

  if (CLARITY.test(text)) return result("clarity", "clarity-manual-entry", "Decision／Execution／Validation／Attention／Driftの確認です。", { explicit: true });
  return result("secretary", "secretary-general", "既存の薄いルーターで用件を確認します。");
}

export const COLLABORATION_ROUTER_MARKER = "yasashii-secretary:clarity-collaboration-router:v1";
