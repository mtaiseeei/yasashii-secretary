// Sprint 032 Patch 001: 実際に配布されるrules／copyから会話契約を読み出し、
// 会話Markdownの構造を検査する共有ライブラリ。
// テスト側が模範Markdownを生成するのではなく、plugin実体（rule-manifest.json →
// rules → active edition copy）から適用場面・項目名を導出して検査する。

import { readFileSync } from "node:fs";
import { join } from "node:path";

export function loadConversationContract(repo) {
  const plugin = join(repo, "plugins", "secretary");
  const manifest = JSON.parse(readFileSync(join(plugin, "rules", "rule-manifest.json"), "utf8"));
  const ruleText = {};
  for (const [key, rule] of Object.entries(manifest.rules)) {
    ruleText[key] = readFileSync(join(plugin, "rules", rule.path), "utf8");
  }
  const styleKeys = (manifest.priority || []).filter((key) => {
    const rule = manifest.rules[key];
    return rule && typeof rule.copy === "string" && Array.isArray(rule.copySurfaces)
      && ["conversation", "diagnosis", "report", "developerHandoff"].every((surface) => rule.copySurfaces.includes(surface));
  });
  if (styleKeys.length !== 1) throw new Error(`rule manifest must select exactly one active edition style, found: ${styleKeys.join(", ") || "none"}`);
  const styleKey = styleKeys[0];
  const styleRule = manifest.rules[styleKey];
  const copy = JSON.parse(readFileSync(join(plugin, "rules", styleRule.copy), "utf8"));

  const states = copy.surfaces.report.states;
  if (!states || JSON.stringify(Object.keys(states).sort()) !== JSON.stringify(["answered", "error", "partial", "question", "saved"])) {
    throw new Error("report states must define answered/question/saved/error/partial");
  }
  // 現役copyから固定labelを導出しない。旧shapeの再混入検出だけに歴史的labelを使う。
  const labels = ["やったこと", "結果", "次に何が起きるか"];
  const detailLabel = copy.surfaces.report.detailedSuffix.split(/[:：]/)[0].trim();

  const style = ruleText[styleKey];
  return {
    plugin,
    manifest,
    ruleText,
    copy,
    styleKey,
    styleRule,
    labels,
    states,
    detailLabel,
    applyScenes: sectionBullets(style, "serializerを適用する場面"),
    generalScenes: sectionBullets(style, "serializerを適用しない場面"),
  };
}

export function sectionBullets(markdown, headingIncludes) {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((line) => /^#{2,6}\s/.test(line) && line.includes(headingIncludes));
  if (start === -1) return [];
  const bullets = [];
  for (const line of lines.slice(start + 1)) {
    if (/^#{2,6}\s/.test(line)) break;
    const match = line.match(/^-\s+(.*)$/);
    if (match) bullets.push(match[1].trim());
  }
  return bullets;
}

export function parseBlocks(markdown) {
  const lines = markdown.replace(/\s+$/, "").split(/\r?\n/);
  const blocks = [];
  let current = [];
  for (const line of lines) {
    if (line.trim() === "") {
      if (current.length) blocks.push(current);
      current = [];
    } else {
      current.push(line);
    }
  }
  if (current.length) blocks.push(current);
  return blocks;
}

export function lineKinds(markdown) {
  return markdown
    .replace(/\s+$/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "")
    .map((line) => {
      if (/^- /.test(line)) return "bullet";
      if (/^\s{2,}[-*] /.test(line)) return "nested";
      if (/^\d+[.)] /.test(line)) return "numbered";
      if (/^#{1,6}\s/.test(line)) return "heading";
      return "text";
    });
}

function topBulletLabels(markdown) {
  return markdown
    .split(/\r?\n/)
    .filter((line) => /^- /.test(line))
    .map((line) => line.replace(/^- /, "").split(/[:：]/)[0].replace(/[`*_]/g, "").trim());
}

// 固定3項目のserialize（3ラベルが応答の骨格として現れている）かを判定する。
export function usesFixedThreeSchema(markdown, labels) {
  const bulletPrefixes = topBulletLabels(markdown);
  const asBullets = labels.every((label) => bulletPrefixes.includes(label));
  const inline = labels.every((label) => new RegExp(`(?:^|[\\s。]|- )${label}\\s*[:：]`).test(markdown));
  return asBullets || inline;
}

// 複数論点が改行なしの長文へ潰れているかを判定する。
export function isCollapsedProse(markdown) {
  const lines = markdown.trim().split(/\r?\n/).filter((line) => line.trim() !== "");
  if (lines.length !== 1) return false;
  const line = lines[0];
  const sentences = (line.match(/[。！？]/g) ?? []).length;
  return sentences >= 3 || line.length > 160;
}

const NEEDS = {
  "short-answer": { scene: "一般的な質問への回答", scope: "general" },
  "complex-question": { scene: "複雑な説明", scope: "general" },
  diagnosis: { scene: "複数原因の診断", scope: "general" },
  "search-results": { scene: "検索結果", scope: "general" },
  "partial-failure": { scene: "部分失敗の詳細報告", scope: "general" },
  "completion-report": { scene: "作業完了報告", scope: "apply" },
  "status-report": { scene: "状態報告", scope: "apply" },
  "developer-handoff": { scene: "developer handoff", scope: "general" },
};

export function scenarioScene(kind) {
  return NEEDS[kind];
}

export function validateScenario(kind, markdown, contract) {
  const problems = [];
  const { labels, detailLabel } = contract;
  const kinds = lineKinds(markdown);
  const blocks = parseBlocks(markdown);
  const bullets = kinds.filter((k) => k === "bullet").length;
  const nested = kinds.filter((k) => k === "nested").length;
  const fixed = usesFixedThreeSchema(markdown, labels);
  const collapsed = isCollapsedProse(markdown);

  const requireGeneral = () => {
    if (fixed) problems.push("一般回答が固定3項目schemaへserializeされている");
    if (collapsed) problems.push("複数論点が改行なしの1行へ潰れている");
  };

  switch (kind) {
    case "short-answer":
      if (fixed) problems.push("1要点の回答が固定3項目化されている");
      if (bullets + nested > 0) problems.push("1要点の回答に不要な箇条書きがある");
      if (blocks.length !== 1) problems.push("1要点の回答が複数ブロックへ分かれている");
      if (kinds.includes("heading")) problems.push("不要な見出しがある");
      break;
    case "complex-question":
      requireGeneral();
      if (blocks.length < 2 && bullets < 2) problems.push("複数の論点が段落または箇条書きへ構造化されていない");
      break;
    case "diagnosis": {
      requireGeneral();
      if (bullets < 2) problems.push("複数原因が並列項目として読み分けられない");
      if (nested < 2) problems.push("原因ごとの根拠・対応がネストで区別されていない");
      break;
    }
    case "search-results":
      requireGeneral();
      if (bullets < 3) problems.push("3件以上の検索結果が項目として読み分けられない");
      if (nested < 1) problems.push("各結果の補足が親項目と区別されていない");
      break;
    case "partial-failure": {
      if (fixed && bullets <= labels.length + 1) {
        problems.push("成功・失敗・影響・次の行動が固定3項目へ圧縮されている");
      }
      if (collapsed) problems.push("部分失敗の内訳が1行へ潰れている");
      const units = bullets + nested + blocks.filter((b) => !/^[-\d\s]/.test(b[0])).length;
      if (units < 4) problems.push("成功・失敗・影響・次の行動を読み分ける単位が足りない");
      break;
    }
    case "completion-report":
    case "status-report": {
      if (fixed) problems.push("完了報告が旧固定3項目schemaを使っている");
      if (collapsed) problems.push("完了報告の複数の意味が1行へ連結されている");
      if (bullets + nested > 1 && blocks.length === 1) problems.push("単純な完了報告に不要な複数項目がある");
      if (blocks.length === 0) problems.push("完了報告が空です");
      break;
    }
    case "developer-handoff": {
      requireGeneral();
      const units = bullets + nested + blocks.filter((block) => !/^[-\d\s]/.test(block[0])).length;
      if (units < 4) problems.push("developer handoffの再現条件・証跡・影響・残課題を読み分ける単位が足りない");
      if (!/(?:command|コマンド)/.test(markdown) || !/(?:path|パス)/.test(markdown) || !/(?:error|エラー)/.test(markdown)) {
        problems.push("developer handoffにcommand、path、errorの正式名称が不足している");
      }
      break;
    }
    default:
      problems.push(`unknown scenario kind: ${kind}`);
  }
  return { ok: problems.length === 0, problems };
}
