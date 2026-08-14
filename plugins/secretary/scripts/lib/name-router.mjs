import { foldName, parseIdentity } from "./secretary-identity.mjs";

const HUMAN_CONTEXT = /(?:人間|人物|顧客|取引先|担当者|著者|作者|author|customer|client|person|さん|氏|様|先生|社長|さんのメール|さんが|さんに会)/iu;
const QUOTE_OR_CODE = /```|`[^`]+`|「[^」]+」|『[^』]+』|^\s*>|(?:引用|コード|file本文|ファイル本文)/iu;

function escaped(value) { return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"); }

export function classifyNameRouting(textValue, identityValue, { alreadyAsked = false } = {}) {
  const identity = parseIdentity(identityValue);
  const text = String(textValue ?? "").normalize("NFKC").trim();
  if (!text) return { action: "none", reason: "empty", sideEffects: 0 };
  const name = identity.display_name;
  const patternName = escaped(name);
  const contains = new RegExp(`(?:^|[^A-Za-z])${patternName}(?:$|[^A-Za-z])`, "iu").test(text);
  if (!contains) return { action: "none", reason: "name-not-mentioned", sideEffects: 0 };

  // 文頭の直接呼びかけは、その後ろの依頼本文と分けて判定する。依頼本文に顧客名や引用が
  // 含まれても、呼びかけ先が秘書である事実は変わらない。
  const directPattern = new RegExp(`^${patternName}(?:[、,:：!！?？]|\\s+(?:お願い|教えて|調べて|確認して|やって|まとめて|聞いて))`, "iu");
  if (directPattern.test(text)) {
    return { action: "route", reason: "direct-address", secretary_id: identity.secretary_id, sideEffects: 0 };
  }

  if (QUOTE_OR_CODE.test(text)) return { action: "none", reason: "quote-code-or-body", sideEffects: 0 };
  if (HUMAN_CONTEXT.test(text)) return { action: "none", reason: "human-or-business-context", sideEffects: 0 };

  const askPattern = new RegExp(`(?:^|[、,。.!！?？\\s])${patternName}に(?:聞いて|確認して|頼んで|相談して)(?:$|[、,。.!！?？\\s])`, "iu");
  if (askPattern.test(text)) {
    return { action: "route", reason: "ask-secretary", secretary_id: identity.secretary_id, sideEffects: 0 };
  }

  if (foldName(text.replace(/[、,。.!！?？]/gu, "")) === foldName(name)
    || new RegExp(`^${patternName}(?:について|の件|はどう)$`, "iu").test(text)) {
    return alreadyAsked
      ? { action: "none", reason: "ambiguity-already-asked", sideEffects: 0 }
      : { action: "confirm", reason: "ambiguous", question: `秘書の${name}への依頼ですか？`, sideEffects: 0 };
  }
  return { action: "none", reason: "incidental-mention", sideEffects: 0 };
}
