import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

export const INVENTORY_PATH = "plugins/secretary/collaboration-inventory.json";

const EXPECTED = {
  "secretary-router": ["plugins/secretary/skills/secretary/SKILL.md", "plugins/secretary/scripts/collaboration-router.mjs", "plugins/secretary/scripts/lib/collaboration-router.mjs"],
  "clarity-skill": ["plugins/secretary/skills/clarity/SKILL.md"],
  "projects-lifecycle": ["plugins/secretary/skills/projects/SKILL.md", "plugins/secretary/scripts/project-tools.mjs", "plugins/secretary/scripts/clarity-secretary.mjs", "plugins/secretary/scripts/lib/clarity-secretary.mjs", "plugins/secretary/clarity/secretary-adapter.json"],
  "daily-attention": ["plugins/secretary/skills/daily/SKILL.md", "plugins/secretary/scripts/clarity-secretary.mjs", "plugins/secretary/scripts/lib/clarity-secretary.mjs"],
  "weekly-portfolio": ["plugins/secretary/skills/weekly/SKILL.md", "plugins/secretary/scripts/clarity-secretary.mjs", "plugins/secretary/scripts/lib/clarity-secretary.mjs"],
  "task-seams": ["plugins/secretary/skills/projects/SKILL.md", "plugins/secretary/scripts/clarity-secretary.mjs", "plugins/secretary/scripts/lib/clarity-secretary.mjs", "plugins/secretary/clarity/secretary-adapter.json", "plugins/secretary/edition.json"],
  "memory-care": ["plugins/secretary/skills/memory-care/SKILL.md", "plugins/secretary/rules/conversation-contract.md"],
  "build-harness": ["plugins/secretary/skills/build/SKILL.md", "plugins/secretary/edition.json"],
  "update-release": ["plugins/secretary/skills/update/SKILL.md", "plugins/secretary/release-inventory.json"],
  "onboarding-templates": ["plugins/secretary/skills/onboarding/SKILL.md", "plugins/secretary/templates/AGENTS.md", "plugins/secretary/templates/CLAUDE.md", "plugins/secretary/edition.json"],
  "rules-serializer": ["plugins/secretary/rules/plain-language.md", "plugins/secretary/rules/common-language.md", "plugins/secretary/rules/conversation-contract.md", "plugins/secretary/rules/safety.md", "plugins/secretary/rules/rule-manifest.json", "adapters/neutral-base.json", "plugins/secretary/rules/styles/yasashii.md"],
  "host-inventory": ["plugins/secretary/host-inventory.json", "plugins/secretary/.claude-plugin/plugin.json", "plugins/secretary/.codex-plugin/plugin.json"],
  "edition-handoff": ["plugins/secretary/release-inventory.json", "plugins/secretary/edition.json", "scripts/fixtures/sprint-041/yasashii-prewrite-receipt.json"],
  "external-connectors": ["plugins/secretary/skills/chatwork/SKILL.md", "plugins/secretary/skills/google-chat/SKILL.md", "plugins/secretary/skills/connections/SKILL.md", "plugins/secretary/skills/setup-google/SKILL.md", "plugins/secretary/skills/setup-microsoft/SKILL.md", "plugins/secretary/skills/setup-notion/SKILL.md"],
  "clarity-hook": ["plugins/secretary/hooks/hooks.json", "plugins/secretary/scripts/clarity-hook.mjs", "plugins/secretary/scripts/lib/clarity-hook.mjs"],
  "xmind-editions": ["plugins/secretary/release-inventory.json", "plugins/secretary/edition.json", "plugins/secretary/skills/clarity/SKILL.md"],
  "package-release-inventory": ["plugins/secretary/release-inventory.json", "plugins/secretary/.claude-plugin/plugin.json", "plugins/secretary/.codex-plugin/plugin.json", ".claude-plugin/marketplace.json", ".agents/plugins/marketplace.json"],
  "canonical-repo-reader": ["plugins/secretary/scripts/clarity-secretary.mjs", "plugins/secretary/scripts/lib/clarity-secretary.mjs", "plugins/secretary/clarity/secretary-adapter.json"],
  "clarity-root-policy": ["plugins/secretary/scripts/clarity.mjs", "plugins/secretary/scripts/lib/clarity-core.mjs", "plugins/secretary/scripts/lib/clarity-drift.mjs", "plugins/secretary/scripts/lib/clarity-hook.mjs", "plugins/secretary/scripts/lib/clarity-link.mjs", "plugins/secretary/scripts/lib/clarity-projection.mjs", "plugins/secretary/scripts/lib/clarity-root.mjs", "plugins/secretary/scripts/lib/clarity-secretary.mjs", "plugins/secretary/scripts/lib/safe-fs.mjs"],
};

const EXPECTED_CASES = Array.from({ length: 20 }, (_, index) => `CLX-${String(index + 1).padStart(3, "0")}`);
const TARGET_CASES = [
  ...Array.from({ length: 7 }, (_, index) => `yasashii-CF-${String(index + 1).padStart(3, "0")}`),
  ...Array.from({ length: 14 }, (_, index) => `yasashii-AR-${String(index + 1).padStart(3, "0")}`),
];
const INVENTORY_CASES = [...EXPECTED_CASES, ...TARGET_CASES];
const OLD_CONTRACTS = ["topic-save=confirm-first", "save-copy=exact-copy", "explicit-memory-request=next-turn-confirmation"];
const COORDINATION_PATHS = new Set([INVENTORY_PATH, "scripts/fixtures/sprint-041/yasashii-prewrite-receipt.json", "plugins/secretary/edition.json", "plugins/secretary/release-inventory.json", "plugins/secretary/rules/styles/yasashii.md"]);
const PRIVATE_LITERALS = ["vault/10_sources", "/Users/", "rules/copy/my-vault"];

function fail(code, detail = "") {
  throw new Error(`${code}${detail ? `:${detail}` : ""}`);
}

function mode(path) {
  return lstatSync(path).mode & 0o111 ? "100755" : "100644";
}

function safeRelative(path) {
  return typeof path === "string" && path.length > 0 && !path.startsWith("/") && !path.includes("..") && !path.includes("\\");
}

export function digestSurface(rootValue, pathsValue) {
  const root = resolve(rootValue);
  const paths = [...pathsValue].sort((a, b) => Buffer.from(a).compare(Buffer.from(b)));
  const hash = createHash("sha256");
  for (const path of paths) {
    if (!safeRelative(path)) fail("inventory-path-unsafe", path);
    const absolute = join(root, path);
    if (!existsSync(absolute)) fail("inventory-path-missing", path);
    const stat = lstatSync(absolute);
    if (!stat.isFile() || stat.isSymbolicLink()) fail("inventory-path-not-regular", path);
    hash.update(path).update("\0").update(mode(absolute)).update("\0").update(readFileSync(absolute)).update("\0");
  }
  return hash.digest("hex");
}

export function loadCollaborationInventory(rootValue) {
  const root = resolve(rootValue);
  return JSON.parse(readFileSync(join(root, INVENTORY_PATH), "utf8"));
}

export function expectedSurfacePaths() {
  return structuredClone(EXPECTED);
}

export function validateCollaborationInventory(rootValue, inventoryValue = null) {
  const root = resolve(rootValue);
  const inventory = inventoryValue ?? loadCollaborationInventory(root);
  if (inventory.schemaVersion !== 1 || inventory.inventoryId !== "yasashii-secretary-clarity-collaboration-v1"
    || inventory.marker !== "yasashii-secretary:clarity-collaboration-inventory:v1") fail("inventory-schema");
  if (!Array.isArray(inventory.surfaces)) fail("inventory-surfaces");
  const ids = inventory.surfaces.map((surface) => surface?.id);
  if (new Set(ids).size !== ids.length) fail("inventory-surface-duplicate");
  if (JSON.stringify([...ids].sort()) !== JSON.stringify(Object.keys(EXPECTED).sort())) fail("inventory-surface-omission-or-extra");

  const coveredCases = new Set();
  for (const surface of inventory.surfaces) {
    const expectedPaths = EXPECTED[surface.id];
    if (JSON.stringify(surface.paths) !== JSON.stringify(expectedPaths)) fail("inventory-path-contract", surface.id);
    for (const field of ["role", "edition", "delegation"]) if (typeof surface[field] !== "string" || !surface[field]) fail("inventory-field", `${surface.id}:${field}`);
    if (!Array.isArray(surface.noTouch) || surface.noTouch.length === 0 || surface.noTouch.some((value) => typeof value !== "string" || !value)) fail("inventory-no-touch", surface.id);
    if (!Array.isArray(surface.tests) || surface.tests.length === 0) fail("inventory-tests", surface.id);
    for (const id of surface.tests) {
      if (!INVENTORY_CASES.includes(id)) fail("inventory-test-unknown", `${surface.id}:${id}`);
      coveredCases.add(id);
    }
    if (!Array.isArray(surface.markers) || surface.markers.length === 0) fail("inventory-marker-missing", surface.id);
    for (const marker of surface.markers) {
      if (!surface.paths.includes(marker.path) || typeof marker.token !== "string" || !marker.token) fail("inventory-marker-invalid", surface.id);
      if (!readFileSync(join(root, marker.path), "utf8").includes(marker.token)) fail("inventory-marker-stale", `${surface.id}:${marker.path}`);
    }
    const observed = digestSurface(root, surface.paths);
    if (surface.contentDigest !== observed) fail("inventory-digest-stale", surface.id);

    for (const path of surface.paths) {
      const body = readFileSync(join(root, path), "utf8");
      for (const old of OLD_CONTRACTS) if (body.includes(old)) fail("inventory-old-contract", `${surface.id}:${path}`);
      if (!COORDINATION_PATHS.has(path)) {
        for (const literal of PRIVATE_LITERALS) if (body.includes(literal)) fail("inventory-private-literal", `${surface.id}:${path}`);
        if (/(?:^|\D)05\/02(?:\D|$)/u.test(body)) fail("inventory-private-literal", `${surface.id}:${path}`);
      }
    }
  }
  if (JSON.stringify([...coveredCases].sort()) !== JSON.stringify([...INVENTORY_CASES].sort())) fail("inventory-case-omission");
  return { surfaceCount: inventory.surfaces.length, caseCount: coveredCases.size, digestsValid: true, markersValid: true };
}
