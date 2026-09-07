# Sprint 044 — Yasashii 0.12.0 downstream整合

- Type: standard
- Risk: high（Clarity、Git取り込み、Secretary Voice、LLM中心の読取整理、edition overlay、両host配布面を一つの候補へ束ねる）
- Candidate version: `0.12.0`
- 開始HEAD: `21d28913a8c7e8fcaa4299d5f235e44555407cc9`
- 依存: 公開側のexact source candidateに対する技術gateのfresh独立評価PASS。公開Sprint 054の3版公開・install完了は後段であり、本Sprintの開始条件にしない。`sprint-043-patch-003`の未了criteriaは最終統合candidateへ持ち越し、旧headの追加独立PASSは要求しない。
- 対象: F82（Git取り込み）、F83（Secretary Voice）、F84（LLM中心の読み取り・整理）、既存F64〜F81（Project Clarity）をYasashiiへ適応する。

## ゴール

公開Sprint 054のGenerator／Evaluatorが確定した最終candidateを、Yasashiiの狭いoverlayとして0.12.0候補へ適応する。Clarity、Git取り込み、Secretary Voice、LLMによる安全な読み取り・整理を欠落させず、Yasashiiのやさしいcopy／style／identity、README／LICENSE、mapping、owned filesを保つ。CodexとClaude Codeの両hostで使えるcandidateを作るが、公開Claude Code用one-paste promptとinfographicはpublic guide側だけが所有する。

## 固定入力と状態分離

- 公開候補の完全SHA／treeは、公開側の技術gate独立評価PASS後（公開・install前）にOrchestratorが供給する値を実行開始時に固定する。過去のpublic／private PASS、PR本文、推測したSHAを代用しない。
- `sprint-043-patch-003` のYasashii候補と未了criteria、既存17 Skills／62 behavior、Clarityの20 surface／57 case、Yasashii Windows workflowを入力・保護面として扱い、最終統合candidateで再評価する。
- この契約はstate／progress／feedbackを更新しない。current patchの未評価、NOT-RUN、verification-infra、過去FAILをPASSへ読み替えない。

## Scope

1. 公開candidateからF82〜F84と、既存Clarityのaccepted behaviorを一つのYasashii candidateへ適応し、common pathのbyte-sync、Yasashii adapted path、supporting pathを実差分で説明する。blind copy、public docs／state／progress／feedbackの製品同期はしない。
2. `harness@yasashii-harness`、Yasashiiのcopy／style／identity、README／LICENSE、overlay／mapping／manifest／marketplace識別子、generic storage、Xmind既定OFFを保持する。private `05/02`、Notion、vault、private値、顧客本文は持ち込まない。
3. Git取り込み、Voice、LLM-led read／organizeの既存共通意味を保ち、Yasashiiの平易さ・段落・進行説明を維持する。安全に取得済みの原本だけを整理し、保存・削除・Git・Clarityの決定的シームと確認を任意化しない。
4. Codex／Claude Codeの正式manifest、Hookのhost互換、supported／verifiedの分離をcandidate内で整合させる。Hookのunknown field、重複Hook、network／LLM／重処理の追加を許さない。
5. version／manifest／候補配布面を`0.12.0`へ揃える。ただしpush、merge、tag、Release、Marketplace反映、install、cache、実workspace反映は行わない。

## Acceptance Criteria

1. 実行開始時に供給された公開candidate SHA／treeを一意に固定し、Yasashii開始HEADと実差分を記録できる。未供給または不一致なら安全に停止する。
2. Git取り込み、Secretary Voice、LLM-led read／organize、Project Clarityの既存機能が同一candidateに存在し、日付・種類・出典・訂正・状態・取得不足の意味を壊さない。Clarity 17機能／62 behavior、Yasashii既存surfaceの単一割当を維持する。
3. Yasashii固有のcopy／style／identity、README／LICENSE、overlay／mapping、generic storage、Xmind policy、17 Skills／62 behaviorに許可外変更が0件である。private-specific path／value／本文の混入は0件。
4. Codex／Claude Codeのplugin読込で未知Hook fieldとparser warningが0件、Clarity専用Hookとmanual fallbackが有効で、hostの結果を相互昇格しない。public Claude用prompt／infographicをYasashii固有成果物へ複製しない。
5. `0.12.0`候補のversion／manifest／edition metadataが一致し、旧release履歴・tag・fixtureを変更しない。同一版・downgrade・customization保護の既存update意味を緩めない。
6. `sprint-043-patch-003`由来の未了criteriaをHarness reserved lane、source／clean／Git-free、inventory、Clarity／0.9.2回帰とともに同じ最終candidateで独立評価する。Windows nativeは最終candidate branch上の既存workflow runだけを根拠にし、開始時のPR #12 runは履歴証拠として保持する。portable／NOT-RUNをWindows PASSへ昇格しない。
7. 変更後も保存・削除・Git・Clarity apply、symlink／path／Secret、Xmind、外部同期、明示確認、rollbackの既存安全境界と副作用0条件が保たれる。
8. 新runner、framework、collector、統一attestation、全組合せmatrix、Macでの64 actor stress、test case／actor／round／timeoutの削減を追加しない。

## 検証スコープ（着手時に固定）

- 対象: Yasashii source、detached clean、Git-free archive、既存Clarity／edition／会話／update回帰、最終candidate branch上の既存Windows workflow（PR #12の開始runは履歴入力）。
- 必須: 現行`Sprint 043 Patch 003`回帰とその既存Sprint 041〜043／Patch 001〜002／0.9.2回帰、inventory／overlay／manifest／`git diff --check`。最終diffに応じて既存入口だけを選ぶ。
- WindowsはNode 22・既存timeout・16 HSと既存会話／update面をexact candidateで実行する。symlink／junction capability、SKIP／NOT-RUN、runner基盤障害はproduct PASSへ数えない。
- 証拠: 開始／最終SHA、actual diffとpath role、既存commandのexit／PASS／FAIL／NOT-RUN、Windows run／job／head、保護面digest。新しい証拠schemaは作らない。

## 非ゴールと状態handoff推奨

- Project Clarity、Git取り込み、Voice、LLM読取の新機能設計、Chatwork／Google Chat、private adapter、実Xmind、release／install、public repoの変更は行わない。
- Orchestratorは、`sprint-043-patch-003`の未了criteriaを最終統合candidateの独立評価へ持ち越す。旧headの追加独立完了を待つ条件は置かず、評価結果、NOT-RUN、既知FAILを履歴から削除せず、最終candidateの技術gate後にのみ次main候補として`Current ID: sprint-044`／`Next Planned`を判断する。
- 公開候補のfinal SHAが未供給であることが唯一の開始前open itemであり、供給後に追加の製品判断を要求しない。
