// Sprint 032 Patch 001: 実際に配布されるrules／copyから会話契約を読み出し、
// 会話Markdownの構造を検査する共有ライブラリ。
// テスト側が模範Markdownを生成するのではなく、plugin実体（rule-manifest.json →
// rules → copy/yasashii.json）から適用場面・項目名を導出して検査する。

import { readFileSync } from "node:fs";
import { join } from "node:path";

export function loadConversationContract(repo) {
  const plugin = join(repo, "plugins", "secretary");
  const manifest = JSON.parse(readFileSync(join(plugin, "rules", "rule-manifest.json"), "utf8"));
  const ruleText = {};
  for (const [key, rule] of Object.entries(manifest.rules)) {
    ruleText[key] = readFileSync(join(plugin, "rules", rule.path), "utf8");
  }
  const styleRule = manifest.rules["yasashii-style"];
  const copy = JSON.parse(readFileSync(join(plugin, "rules", styleRule.copy), "utf8"));

  const shortLines = copy.surfaces.report.shortLines;
  const labels = shortLines.map((line) => line.split(/[:：]/)[0].trim());
  const detailLabel = copy.surfaces.report.detailedSuffix.split(/[:：]/)[0].trim();

  const style = ruleText["yasashii-style"];
  return {
    plugin,
    manifest,
    ruleText,
    copy,
    labels,
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
    case "completion-report": {
      const bulletPrefixes = topBulletLabels(markdown);
      const expected = [...labels];
      const allowed = [...labels, detailLabel];
      if (!fixed) problems.push("完了報告が固定3項目schema（存在と順序）を使っていない");
      if (bulletPrefixes.length < 3) problems.push("完了報告の3項目が物理的な別項目になっていない");
      if (!expected.every((label, index) => bulletPrefixes[index] === label)) {
        problems.push("完了報告の項目名または順序がcopyのschemaと一致しない");
      }
      if (!bulletPrefixes.every((prefix) => allowed.includes(prefix))) {
        problems.push("完了報告にschema外の固定項目がある");
      }
      if (collapsed) problems.push("完了報告の3つの意味が1行へ連結されている");
      break;
    }
    default:
      problems.push(`unknown scenario kind: ${kind}`);
  }
  return { ok: problems.length === 0, problems };
}
