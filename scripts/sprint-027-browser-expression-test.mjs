#!/usr/bin/env node

import assert from "node:assert/strict";
import vm from "node:vm";
import { buildObserveExpression } from "./sprint-027-browser-expression.mjs";

const expression = buildObserveExpression();
// This is the parse step Chrome performs for Runtime.evaluate.  `node --check`
// on the outer script cannot catch syntax errors inside this string.
assert.doesNotThrow(() => new vm.Script(expression), "Runtime.evaluate expression must parse");

class FixtureNode {
  constructor(tagName, { rect = { left: 0, top: 0, width: 100, height: 48 }, textContent = "", attrs = {}, open = false } = {}) {
    this.tagName = tagName.toUpperCase();
    this.rect = { left: rect.left, top: rect.top, width: rect.width, height: rect.height, right: rect.left + rect.width, bottom: rect.top + rect.height };
    this.textContent = textContent;
    this.attrs = attrs;
    this.open = open;
    this.hidden = false;
    this.inert = false;
    this.disabled = false;
    this.parentElement = null;
    this.children = [];
  }
  append(child) { child.parentElement = this; this.children.push(child); return child; }
  getAttribute(name) { return this.attrs[name] ?? null; }
  contains(node) { return node === this || this.children.some((child) => child.contains(node)); }
  getBoundingClientRect() { return this.rect; }
  querySelector(selector) {
    if (selector === "h1") return this.children.find((child) => child.tagName === "H1") || null;
    return this.querySelectorAll(selector)[0] || null;
  }
  querySelectorAll(selector) {
    const wanted = selector.split(",").map((item) => item.trim());
    const result = [];
    const visit = (node) => {
      for (const child of node.children) {
        if (wanted.includes(child.tagName.toLowerCase()) ||
            (wanted.includes("label.choice") && child.tagName === "LABEL" && child.attrs.class === "choice") ||
            (wanted.includes("label.consent") && child.tagName === "LABEL" && child.attrs.class === "consent")) result.push(child);
        visit(child);
      }
    };
    visit(this);
    return result;
  }
}

const app = new FixtureNode("div", { attrs: { "aria-label": "Chatwork" } });
app.dataset = { screen: "select-rooms" };
app.append(new FixtureNode("h1", { textContent: "Chatworkの部屋を選ぶ" }));
app.append(new FixtureNode("button", { rect: { left: 0, top: 0, width: 180, height: 48 }, textContent: "続ける" }));
const details = app.append(new FixtureNode("details", { open: false }));
details.append(new FixtureNode("summary", { rect: { left: 0, top: 60, width: 180, height: 48 }, textContent: "詳しい説明" }));
details.append(new FixtureNode("a", { rect: { left: 0, top: 0, width: 180, height: 48 }, textContent: "不可視リンク" }));
const active = app.children[0];
const documentFixture = {
  activeElement: active,
  documentElement: { scrollWidth: 390 },
  querySelector(selector) { return selector === "#app" ? app : null; },
};

const result = vm.runInNewContext(expression, {
  document: documentFixture,
  innerWidth: 390,
  getComputedStyle() { return { display: "block", visibility: "visible", opacity: "1", pointerEvents: "auto" }; },
});
assert.equal(result.controls, 2, "closed details descendants must not count as controls");
assert.equal(result.overlapCount, 0, "hidden details link must not create a false overlap");
assert.equal(result.controlMinHeight, 48);
assert.equal(result.summaryClosed, true);
assert.equal(result.serviceName, "Chatwork");

process.stdout.write("SPRINT027_BROWSER_EXPRESSION_PASS=6 SPRINT027_BROWSER_EXPRESSION_FAIL=0\n");
