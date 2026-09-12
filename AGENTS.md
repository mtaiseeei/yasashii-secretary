# Harness-Driven Development

This repository can use Agentic Harness for substantial app or feature work. When the user asks to build an app, site, tool, or multi-step feature, prefer the harness loop instead of a single unstructured implementation pass.

Load the installed `harness:using-harness` entry and follow its conditional links. The installed plugin is the workflow source; this file retains the repository's ownership, verification, authorization and resource boundaries. Read runtime, migration and failure references only when that operation needs them. If an older installed plugin has no split references, use its existing entry rather than guessing missing paths.

In Codex, normally just ask Codex to build the app or feature. The harness entry skill should detect the request and start the loop. For explicit startup, use:

```text
$using-harness <short product idea>
```

or:

```text
$harness-loop <short product idea>
```

## Loop

1. Planner turns the idea into a short `docs/spec.md` index, detailed `docs/spec/*.md` files (including `docs/spec/rubric.md`), and sprint contracts in `docs/sprints/`.
2. Generator implements one sprint, grows the automated regression suite, and updates the matching `docs/progress/sprint-*.md`.
3. Evaluator runs the app, verifies behavior against the rubric with recorded evidence, and writes the matching `docs/feedback/sprint-*.md`.
4. The orchestrator records the outcome in `docs/sprints/state.md` before moving on. Failed sprints go back to Generator (or to Planner when feedback is classified as a spec issue). A `verification-scope-issue` follows the bounded-repair rule below; new requirements, uncertain scope or a failed bounded repair go to the user with options. Passed sprints move forward. Three consecutive failures and the configured lineage/spec-issue limits escalate to the user.

If the host cannot dispatch subagents, run the three roles as strictly separated work units using the role definitions in the plugin's `agents/*.md`: one role per work unit, each writing only its own canonical files, and never reusing Generator's self-evaluation as the verdict.

## Canonical Files

| File | Purpose | Only writer |
|---|---|---|
| `docs/spec.md` | Short canonical index and links to required spec files | Planner |
| `docs/spec/product.md` | Product purpose, users, goals, non-goals, success state | Planner |
| `docs/spec/features.md` | Cross-sprint feature list and user-visible behavior | Planner |
| `docs/spec/constraints.md` | Cross-cutting constraints, prohibitions, safety and privacy rules | Planner |
| `docs/spec/domain.md` | Domain rules, conceptual data, KPI/calculation definitions | Planner |
| `docs/spec/ui.md` | Product-wide UI/UX requirements | Planner |
| `docs/spec/rubric.md` | Scoring thresholds and per-score anchor examples | Planner |
| `docs/sprints/state.md` | Execution state: Current ID, per-sprint status, retry count | Orchestrator (main agent) |
| `docs/sprints/sprint-NNN.md` | Main sprint contract, e.g. `sprint-005.md` | Planner |
| `docs/sprints/sprint-NNN-patch-PPP.md` | Patch sprint contract, e.g. `sprint-005-patch-001.md` | Planner |
| `docs/progress/sprint-*.md` | Implementation progress, self-evaluation, startup/test handoff | Generator |
| `docs/feedback/sprint-*.md` | Evaluator result, scores, evidence, bugs, reproduction steps | Evaluator |

Do not cross these ownership boundaries. If a role finds a problem outside its file, record it in its own handoff instead of editing another role's source of truth.
Sprint statuses in `state.md` are: `planned`, `active`, `awaiting-eval`, `done`, `done-by-user-decision`, `deferred`, `superseded`. Never skip or reorder sprints silently; record `deferred`/`superseded` with a reason. Use `done-by-user-decision` only when the user explicitly accepts recorded shortfalls; keep Evaluator feedback unchanged.
An older `docs/sprints/current.md` is a legacy pointer: convert it into `docs/sprints/state.md` once, then treat it as read-only reference. If an older `docs/progress.md` exists, treat it as a legacy reference log and do not append new sprint progress there.
If an existing `state.md` has no `Model Tier`, pass `unknown` to the resolver once, persist only the returned `standard` or `strong` tier with `Rotate: runtime-migration`, and fresh-dispatch Generator. Never persist `unknown`. If only `Rotate` is absent, add `Rotate: none`. If `Spec-Issue Count` or `Lineage Dispatches` is absent, the orchestrator adds it once using `0` or a value supported by recorded history.
For a real Generator tier change, record `Rotate: model-escalation` for failure/risk/recommendation routing and `Rotate: model-availability` for an unavailable standard-model fallback. When Generator is not the next role, the resolver returns `modelTier: null`; this must not replace the last dispatched tier in state. A `spec-issue` route also keeps the last dispatched tier and returns to Planner.
Use zero-padded sprint IDs. Do not create decimal sprint IDs such as `sprint-5.1` or `sprint-5.10`.
For work between main sprints, use `sprint-NNN-patch-PPP`.

## Small Changes In A Harness-Managed Repository

Do not default to fixing things outside the loop. Classify every follow-up request:

1. Direct fix — typos, comments, docs, config values that do not change app behavior.
2. Micro patch (`Type: micro`) — a low-risk behavior/UI change confined to one screen and one flow (or one command/function area without a UI), independently verifiable by an existing check or a reproducible direct operation. Gets a lightweight evaluation (completeness, stability, no-regression only). Authentication, permissions and destructive data changes remain regular patches.
3. Regular patch sprint or next main sprint — everything else.

## Planning Rules

- Planner describes what the product should do, not how to implement it.
- Follow the installed plugin's `agents/planner.md` Grilling gate: assess unresolved decisions before interviewing and use the bundled `skills/grilling/SKILL.md` when needed.
- Planner chooses scope and canonical destinations within the user's instructions; consult the orchestrator when skipping or scope authority is doubtful. Preserve settled decisions and explicit delegation; silence or a bare instruction to proceed is not delegation.
- Use available host-native question UI, concise chat, or parent relay. Batch limits are not a total interview limit. Project-local role limits remain authoritative.
- Planner generates `docs/spec/rubric.md` at initialization, adjusting design/originality thresholds to the project type. Evaluator proposes rubric changes in feedback; only Planner applies them.
- Invariants confirmed by accepted sprints ("never regress this") are promoted into `docs/spec/constraints.md`, not accumulated in state files.
- Avoid premature stack, schema, endpoint, or component decisions in the spec files.
- Keep verification infrastructure out of product requirements unless the user explicitly requests it. The rubric and Sprint contract list sufficient evidence formats (safe harbor); tightening an active Sprint's acceptance criteria, thresholds, or evidence formats requires explicit user approval.
- If a decision changes the product direction, ask the user before implementation.
- Prefer ambitious but testable product behavior over a tiny CRUD-only MVP.

## Implementation Rules

- Generator works one sprint at a time.
- Keep the app runnable at the end of every sprint.
- Before editing code, establish the current contract from `docs/spec.md`, its relevant required `docs/spec/*.md`, `docs/sprints/state.md`, and the target `docs/sprints/sprint-*.md`. On continuation, reread changed or uncertain dependencies; reuse already-read, unchanged documents without dropping their constraints. Read current state and counters before each dispatch.
- When acceptance criteria pass, add automated checks that protect them to the regression suite, and record the suite's run command in the progress handoff. Checks assert behavior and data, not fragile visual string matches.
- Update the matching `docs/progress/sprint-*.md` with implemented features, known issues, startup command, test URL, regression-check command, and concrete evaluation scenarios.
- Fix failing feedback before starting a new sprint.
- Prefix Generator-authored commit messages with the sprint ID, e.g. `[sprint-010-patch-008]`. Never run `git init` inside an existing repository.
- Do not silently include user-requested work that is outside the current acceptance criteria. Record it as a scope change and route it to Planner for an automatically numbered patch sprint (micro when it qualifies).

## Evaluation Rules

- Evaluator must operate the real app before marking a sprint complete.
- Score against `docs/spec/rubric.md`; one failed threshold means the sprint fails.
- A pass requires recorded evidence: executed commands with results, and the concrete URL/DOM/browser interactions checked. Screenshots are mandatory whenever UI, responsiveness, or visual quality is scored. A pass without evidence is invalid.
- Treat the evidence formats already listed in the rubric and Sprint contract as sufficient safe harbor. Do not invent a unified attestation, collector, or additional evidence format as a pass condition.
- Classify every finding as `product` or `verification-infra`; when unsure, use `product`. A verification-infra problem alone does not become a product failure. Apply the bounded-repair rule below; severe or unresolved verification-only blockers go to the user with options.
- Re-evaluate incrementally: use the actual diff to retest changed surfaces and affected regression, carrying forward evidence only when the evaluated files, dependencies and environment remain identifiable and unchanged. Protect unrelated dirty work; a globally clean tree is not required for evidence reuse. Invalidate evidence when its dependencies change.
- Use the handed-over regression as the baseline, identifying required affected checks and valid unchanged evidence, then directly verify the touched surfaces. Required checks that fail or cannot run never become a no-regression PASS.
- Evaluator performs evidence-backed evaluation and self-review; it never implements fixes.
- Classify failures as `implementation-issue` (Generator), `spec-issue` (Planner via the orchestrator), or `verification-scope-issue` (bounded repair when eligible; otherwise user options). Meaning-preserving typo/reference corrections in an already-approved specification need no repeated approval; changed behavior, acceptance, thresholds or evidence requirements still require user approval.
- For patch sprints such as `sprint-005-patch-001`, verify the patch behavior, base sprint regression, and absence of next-main-sprint feature leakage. `Type: micro` patches get the lightweight scoring set.

Browser verification priority:

1. Codex App: Browser Use / `@Browser`.
2. Codex CLI: Playwright test or Playwright script; use a Playwright MCP only if the host already provides one.
3. Exceptions: real Chrome or Computer Use only when signed-in browser state or GUI-only behavior is required.
4. Fallback: build, HTTP checks, static screenshots, and explicit manual verification notes.

## Done Means Verified

Do not declare completion only because code was written. A sprint is complete only after Evaluator verifies the running product with evidence and the orchestrator records the result in `docs/sprints/state.md`.

The exception is `done-by-user-decision`: the user may explicitly accept recorded shortfalls. The orchestrator records the reasons and remaining risks in `state.md`; it is not an Evaluator PASS.

## Proportional Verification

- Bounded verification repair: the orchestrator may record and return a local path, fixture or startup defect to Generator once per Sprint when expected results, acceptance criteria and evidence requirements stay unchanged and no new verification framework is needed. Keep the finding classified as `verification-infra` / `verification-scope-issue`; Evaluator never repairs it and independently re-evaluates it. Do not consume Retry Count or Spec-Issue Count, but count the dispatch. A repeated failure, uncertain repair scope or new requirement goes to the user with options.

- Before each Generator/Evaluator dispatch, the orchestrator checks `Lineage Dispatches`. At `limits.max_lineage_dispatches` (10), stop and present user options; otherwise increment it for the actual dispatch. A synchronous pre-child launch rejection does not consume the limit.
- Each spec-issue return increments `Spec-Issue Count` without consuming Retry Count. At `limits.max_spec_issue_returns` (2), stop the Planner round trip and ask the user.
- The counters are owned only by the orchestrator. Generator and Evaluator never edit `state.md`.
- If two consecutive rounds change only verification code, or verification code outgrows product code, report that before another dispatch.

## Model Policy

Do not infer or translate model names across hosts. Claude Code and Codex both inherit the user's current model and effort for every role by default. Do not ask Codex to identify itself as App or CLI. Codex CLI may omit `model` and `reasoning_effort` from its displayed spawn schema even when the runtime parser accepts them; schema omission alone must not force an explicitly configured value back to `inherit`. When native `spawn_agent` is available, dispatch the actual built-in/default Agent once with the resolver's exact `dispatch-attempt` values, passing the exact model and reasoning_effort directly. Apply this rule to every exact model/effort selected by shared config, personal config, or the user.

Feed an `Unknown model` or invalid-effort refusal back through `--launch-rejected-model` or `--launch-rejected-effort` only when it occurs before child creation. An `unknown field` rejection instead means that application path is unavailable. Never treat implementation failure as launch rejection, and never use Terra or `codex exec` as an automatic fallback. Neither `dispatch-ready` nor `dispatch-attempt` proves which model actually launched; mark `launch-verified` only after child host metadata matches the dispatched values.

Shared Harness runtime settings live in `.harness/config.toml`; personal leaf overrides live in the git-ignored
`.harness/config.local.toml`. The default lifecycle is `balanced`. A high-risk Sprint, the second consecutive implementation failure, or an evidence-verified Evaluator recommendation selects the strong tier. A tier change always starts fresh. The same tier may resume only when host metadata proves that resume preserves the routed model and effort; follow-up support alone is insufficient. The third consecutive failure stops for user input; a spec issue returns to Planner without consuming Generator escalation.
Codex uses native direct dispatch for explicit role values. A legacy `hosts.codex.custom_agents` table is accepted only for compatibility, ignored with a deprecation warning, and never changes routing. Users do not need to delete the old setting or an existing Agent definition.
Never overwrite existing guidance, `.claude/agents/`, `.codex/agents/`, or Harness configuration to apply these settings.

## Low-concurrency execution hosts

- On a Mac mini, measure hostname, short user name, architecture and home path; do not infer the host from a display label.
- Before heavy local work, measure the Node process count. If measurement fails, do not treat it as zero. Above 40, investigate only owned unnecessary processes before starting; above 60 during execution, stop the owned job and diagnose it.
- Keep heavy local pipelines at three or fewer; a shared heavy-job lock, when assigned, serializes the participating jobs to one. Never delete another worker's lock or stop another project's processes. Keep Playwright workers at two or fewer, reuse an existing dev server, and keep at most one dev server per project.
- Do not recursively launch npm, npx or Playwright from tests/scripts. End owned servers, browsers and watchers after use. Cloud agents and remote CI do not consume a local test slot; their local builds/tests still follow these limits.
