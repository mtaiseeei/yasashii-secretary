# Agentic Harness Guidance

Use this file when the repository already has `CLAUDE.md` or `AGENTS.md` and the harness initializer must not overwrite them.

通常はインストール済み`harness:using-harness`の入口を使い、現在の操作に必要な参照だけを読む。
このファイルは既存の所有・検証・安全境界を保持した補足であり、毎回すべての参照を再読する指示ではない。
旧pluginに条件付きreferenceが無い場合は、実在する既存entryから進み、存在しないpathを推測しない。

## Suggested Block For Existing Guidance Files

```markdown
## Harness-Driven Development

For substantial app, site, tool, or multi-step feature work, use Agentic Harness.

- Normal flow: the user can simply ask to build the app or feature; the harness entry skill should detect it.
- Explicit flow: use `/harness <idea>` (Claude Code) or `$using-harness <idea>` (Codex).
- Planner writes the specification source of truth and focuses on what the product should do:
  `docs/spec.md` as a short index, `docs/spec/*.md` for cross-sprint product details (including the
  scoring rubric `docs/spec/rubric.md`), and `docs/sprints/sprint-NNN.md` or
  `docs/sprints/sprint-NNN-patch-PPP.md` for sprint contracts.
- Follow the installed plugin's `agents/planner.md` Grilling gate: assess unresolved decisions before interviewing and use the bundled `skills/grilling/SKILL.md` when needed.
- Planner chooses scope and canonical destinations within the user's instructions; consult the orchestrator when skipping or scope authority is doubtful. Preserve settled decisions and explicit delegation; silence or a bare instruction to proceed is not delegation.
- Use available host-native question UI, concise chat, or parent relay. Batch limits are not a total interview limit. Project-local role limits remain authoritative.
- Generator writes the matching `docs/progress/sprint-*.md`, implements one sprint at a time, and grows
  an automated regression suite that protects accepted acceptance criteria.
- Evaluator writes the matching `docs/feedback/sprint-*.md` after operating the real app. A pass requires
  recorded evidence (commands, URL/DOM interactions, screenshots when visual quality is scored).
- The orchestrator (main agent) is the only writer of `docs/sprints/state.md`, the execution-state source
  of truth (Current ID, per-sprint status, retry count). Record every pass/fail there before moving on.
  Three consecutive failures on one sprint escalate to the user; spec-issue failures go back to Planner.
- Failure classes are `implementation-issue` (Generator), `spec-issue` (Planner), and
  `verification-scope-issue` (one bounded repair under AGENTS.md when eligible; otherwise user options). Classify findings as `product` or
  `verification-infra`; when unsure, use `product`.
- Evidence formats listed in the rubric and Sprint contract are sufficient safe harbor. Do not make a new
  collector, attestation, or unified evidence schema a pass condition. Tightening an active Sprint's criteria,
  thresholds, or evidence formats requires user approval.
- Re-evaluate changed surfaces and required affected regression, carrying forward evidence only when its evaluated files, dependencies and environment remain identifiable and unchanged. Protect unrelated dirty work; global cleanliness is not the reuse condition. Required failed or unexecuted checks never count as PASS.
- The orchestrator owns `Spec-Issue Count` and `Lineage Dispatches`. Stop at the configured limits in
  `.harness/config.toml` (10 lineage dispatches, 2 spec-issue returns) and present options to the user.
- `done-by-user-decision` is only for explicit user acceptance with remaining shortfalls recorded; it is not an Evaluator PASS.
- Use zero-padded sprint IDs like `sprint-005.md`; do not create decimal IDs like `sprint-5.10.md`.
- In a harness-managed repository, classify small follow-ups instead of fixing them outside the loop:
  direct fix (non-behavioral), micro patch (`Type: micro`, lightweight evaluation), or a regular patch
  sprint such as `sprint-005-patch-001.md`.
- Treat an older `docs/sprints/current.md` as a legacy pointer (convert to `state.md` once) and any older
  `docs/progress.md` as a legacy reference log; do not append new sprint progress there.
- Do not cross file ownership boundaries.
- Do not mark work complete until Evaluator verifies the running product with evidence.
- Browser verification priority: app-native browser preview first, CLI Playwright second, manual fallback last.
- Read shared runtime settings from `.harness/config.toml` and optional personal leaf overrides from the git-ignored
  `.harness/config.local.toml`. Default to `balanced`; Claude Code inherits model/effort, while Codex uses the role defaults
  written in the shared config only when a confirmed dispatch surface can accept them. Treat resolver output as
  dispatch-ready or dispatch-attempt, not launch-verified, until host metadata proves the actual model and effort.
- Do not ask Codex to identify App versus CLI. Codex CLI may omit `model` and `reasoning_effort` from the displayed spawn
  schema even when its runtime parser accepts them; omission alone must not force inheritance. Dispatch the actual
  built-in/default Agent once with the resolver's exact `dispatch-attempt` model and reasoning effort. If and only if the
  host rejects a model value before child creation, rerun the same-host
  resolver with `--launch-rejected-model` or `--launch-rejected-effort`. An `unknown field` rejection instead removes that
  application path from capabilities. Never classify implementation failure as launch rejection, and never auto-fallback
  to Terra or `codex exec`.
- Apply this exact-value dispatch contract to every model/effort selected by shared config, personal config, or the user;
  it applies to all explicit role values. Never rename or guess a requested model. Mark `launch-verified` only
  after child host metadata matches the dispatched values.
- For Codex, use the strong Generator tier for a high-risk Sprint, the second consecutive implementation failure, or an
  evidence-verified Evaluator recommendation. Compare it with the last dispatched tier retained in state; record the new
  `Model Tier` and `Rotate: model-escalation` before fresh dispatch when the desired tier differs.
- If the standard Generator model is unavailable and routing falls back to the strong tier, record
  `Rotate: model-availability` instead. If Generator is not the next role, do not persist its null routing tier.
- Even at the same tier, resume only when `resume: true` is backed by host metadata proving that routed model/effort is
  preserved. Follow-up support alone is insufficient, and unverified paths use a fresh role work unit.
- Codex applies explicit role values through native direct dispatch to a built-in/default Agent. A legacy
  `hosts.codex.custom_agents` table is ignored with a deprecation warning and never changes routing. Existing settings
  and Agent definitions do not need to be deleted.
- If an older state has no `Model Tier`, pass resolver-only `unknown`, persist the returned tier with
  `Rotate: runtime-migration`, and fresh-dispatch once; never persist `unknown`. If only `Rotate` is missing, add `none`.
- Do not overwrite existing guidance, Agent definitions, or Harness settings to apply runtime configuration.
```

## No-Overwrite Policy

- During automated initialization, if `CLAUDE.md` or `AGENTS.md` already exists, do not overwrite it. Explicitly authorized maintenance may apply the necessary local changes while preserving project rules and unrelated edits.
- Add the suggested block manually only after checking that it does not conflict with existing project rules.
- Keep project-specific commands and conventions in the existing guidance file. Harness guidance should only define the Planner -> Generator -> Evaluator workflow.
