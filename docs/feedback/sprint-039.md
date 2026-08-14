# Sprint 039 fresh独立評価

## 判定

- Sprint contract result: **FAIL**
- Failure kind: **implementation-issue**
- Evaluated candidate: `e23bdafd4d853d30eecbfa8ed97b534f739fa78f`
- Evaluated at: `2026-08-14`（Asia/Tokyo）
- Product findings: **2件**
- Blocking verification-infra findings: **0件**
- External write: **0件**
- Escalation Recommendation: **none**

名前Skill、stable identity、AI author、canonical resolver、Codex／Claude managed block、routing、A〜D rename、
overlay、report-schemaは、checkoutとGit-free archiveの専用検査で成立した。一方、現行のrelease integrityが
名前Skill追加後の配布surfaceを受理せず、renameのcommit失敗注入が実際にはcommitを通らないため、必須の
rollbackを実証できない。いずれも既存の受入基準に直接反する製品実装の欠陥であり、検証形式の不足ではない。

## Blocking product findings

### P1 — release integrityが追加された名前Skillを拒否する

- Classification: **product**
- Severity: **High**
- Status: **OPEN**
- Affected acceptance criteria: **AC13、AC14、AC17**
- Affected rubric: **C2、C6**

`scripts/check-release-integrity.py` はSkill数を15に固定したままで、Sprint 039が追加した正式な名前Skillを
現行配布surfaceとして受理しない。開始commitではexit 0だが、同じ検査はcandidateのcheckoutとGit-free archiveで
exit 1になった。`check-report-schema.py` の21 surfacesと名前Skill専用検査が通っても、出荷時に使う既存の
release integrityがcandidateを拒否するため、正式surface inventory同士が不整合である。

証跡:

```text
python3 scripts/check-release-integrity.py --root <start-commit-checkout>
exit 0

python3 scripts/check-release-integrity.py --root <candidate-checkout>
exit 1
result: 15 Skills固定のため新しい name Skillを拒否

python3 scripts/check-release-integrity.py --root <candidate-git-free-archive>
exit 1
result: checkoutと同じ name Skill rejection
```

必要な修正は、名前Skillを正式inventoryへ加え、checkoutとGit-free archiveの両方で現行candidateを受理しつつ、
unknownへの差し替えを引き続きmissingとunexpectedの両方で拒否することである。検査を削除したり、archive側だけ
skipしたりして通す修正はAC13／AC14を満たさない。

### P2 — renameにGit commit phaseがなく、commit失敗時rollbackが成立しない

- Classification: **product**
- Severity: **High**
- Status: **OPEN**
- Affected acceptance criteria: **AC12、AC17**
- Affected rubric: **C5、C17**

独立fixtureで `rename-apply --fail-at commit` を実行するとexit 0になり、renameが適用されたままworking treeがdirtyに
なった。CLI／libraryには実際のGit commit phaseがないため、`commit` のfailure injectionは失敗を発生させず、
契約が要求する「commit失敗で全対象とGit状態を開始前へrollback」を検証可能な挙動として実装していない。

証跡:

```text
rename-apply --fail-at commit
exit 0
rename result: applied
git result: working tree dirty
rollback result: not performed
```

必要な修正は、rename transactionに実在するcommit phaseを設け、commit失敗時に対象bytes、identity、aliases、
managed block、index／working treeを開始前へ戻すことである。失敗後のbackup／temporary file、旧名／新名混在、
retry追加差分も0件でなければならない。

## 独立確認で成立した面

- 固定Agentic candidate、handoff digest、commonPaths分類、overlay check／apply／reapply、未分類0、二回目差分0。
- 名前SkillのYasashii edition解決、stable identity、AI author、aliases、利用者の呼び方との分離。
- canonical workspace resolver、別repo cwd副作用0、registry異常のsafe stop。
- Codex override／Claude user-scope managed blockの明示確認、拒否、disable、冪等、既存内容保護。
- direct／delegation routingの正case、人間・顧客・author・引用・code等の負case、曖昧時の一度確認。
- rename previewのA〜D分類、選択B、C保持＋alias、D不変、未作成／disabled routing維持。
- `check-report-schema.py` の正式21 surfacesと、unknown差し替えのmissing／unexpected拒否。
- Yasashii固有copy、style、identity、manifest／marketplace、README、LICENSE、Harness導線の保持。
- checkoutとGit-free archiveの専用Sprint 039、overlay、schema、name Skill、managed block検査。

これらの合格はP1／P2を相殺しない。1つでも必須閾値を下回ればSprint全体をFAILにするrubricに従う。

## Acceptance Criteria

| AC | 結果 | 根拠 |
|---:|---|---|
| 1 | PASS | 固定Agentic SHA、handoff candidate、common digestの対応を確認。 |
| 2 | PASS | commonPaths限定、全path分類、overlay check／reapply、未分類0、二回目差分0を確認。 |
| 3 | PASS | Yasashii固有surfaceとrepo-owned docsを保護し、Agentic docs／state／release記録の同期0。 |
| 4 | PASS | 指定／提案、保存前確認、拒否、不適格名、既存利用者の名前Skillを確認。 |
| 5 | PASS | display name、stable identity、AI種別、aliases、AI authorと過去author主体の保持を確認。 |
| 6 | PASS | user-scope enableの説明・明示確認・拒否、Codex override、Claude user-scope fileを確認。 |
| 7 | PASS | managed blockのcreate／update／disable、冪等、既存内容・改行・mode保護を確認。 |
| 8 | PASS | canonical resolverと異常系safe stop、別repo cwdへの副作用0を確認。 |
| 9 | PASS | routing正負caseと曖昧時一度確認を確認。 |
| 10 | PASS | rename previewのA〜D分類、read-only snapshot、blind replacement 0を確認。 |
| 11 | PASS | Aの所有field、選択B、C保持＋alias、D不変、未作成／disabled routing維持を確認。 |
| 12 | **FAIL** | `--fail-at commit` がexit 0でrenameを残し、Git working treeもdirty。commit失敗rollback未実装。 |
| 13 | **FAIL** | report-schemaは通るが、release integrityが15 Skills固定で新しい名前Skillを拒否。 |
| 14 | **FAIL** | checkout／Git-free archiveのrelease integrityがともにexit 1で、全対象0 FAILではない。 |
| 15 | PASS | Yasashii固有copy、製品identity、repository、marketplace、README、LICENSE、Harness導線を維持。 |
| 16 | PASS | 実行OS、既存Windows suite、Sprint 039 identity面のWindows native not-run、残余リスクを分離。全環境PASSへ昇格していない。 |
| 17 | **FAIL** | product finding 2件、C2／C5／C6／C17が5/5未達。 |
| 18 | PASS | private版、実HOME／cache／workspace、Mac mini、remote、release、Secret、Actions、OAuth、実APIへのwrite 0。 |

## Rubric score

Sprint 039契約が5/5を必須とする重点軸を採点した。

| ID | 基準 | Score | Threshold | 判定根拠 |
|---|---|---:|---:|---|
| C2 | 構文・整合 | **4/5** | 5 | report-schemaと名前Skill専用面は合格したが、release integrityの正式Skill inventoryが不整合。 |
| C5 | 安全・規律 | **4/5** | 5 | renameのcommit失敗時に変更とdirty Git状態が残り、transactionの安全境界を満たさない。 |
| C6 | 無回帰 | **4/5** | 5 | candidate checkout／archiveの現行release integrityがexit 1。 |
| C9 | 配布チャネル非依存 | **5/5** | 5 | Yasashii identity、一般向け公開面、README、LICENSE、creditを維持。 |
| C10 | 更新の安全性 | **5/5** | 5 | version更新経路は変更せず、既存の確認・rollback境界に新しい回帰を確認しなかった。 |
| C13 | edition分離・互換 | **5/5** | 5 | commonPaths限定overlay、未分類0、Yasashii固有surface保護、外部write 0。 |
| C14 | 会話のMarkdown可読性 | **5/5** | 5 | Yasashii固有の説明・段落・edition差を維持し、対象検査が合格。 |
| C16 | Windows native保存・0.9.2下流同期 | **5/5** | 5 | 既存12 labelsの結果とSprint 039 identity面のWindows native not-runを分離し、未実行を解消済みにしていない。 |
| C17 | 秘書identity・routing・安全な改名 | **4/5** | 5 | identity／routing／通常renameは成立したが、commit失敗時の完全rollbackが成立しない。 |

4軸が必須閾値を下回るため、総合判定はFAILである。

## 既知のverification-infra／historical failures

開始前からある広い旧回帰の失敗は、Sprint 039のproduct findingへ重複計上していない。

- `scripts/sprint-035-patch-001-regression.sh`: 5 PASS / 6 FAIL。
- 内訳は既存wizard assetの固定digest差、sandboxのloopback bind `EPERM 127.0.0.1`、現在のAgentic checkout HEADを読む
  旧Sprint 034 overlay testの`UPSTREAM_ADVANCE`／fixture drift、旧README Cloud説明期待との不一致。
- これらは既知のhistorical／verification-infraとして分離し、PASSへ言い換えていない。
- P1は現candidateの名前Skillとrelease integrityの直接不整合であり、historical failureには分類しない。

## UI／screenshot

Sprint 039にbrowser画面の追加・変更はない。対象は会話Skill、identity、file管理、routing、renameのCLI／library面であり、
contractのEvidence safe harborもbrowser操作とscreenshotを必須としていない。このためUI採点とscreenshot取得は **not applicable**。

## External operations

private版、実HOME、installed plugin／cache、実利用workspace、Mac mini、origin／upstream remote、Secret、Actions、OAuth、
実API、commit、push、PR、merge、tag、Release、marketplace、install／updateはすべて **not-run / write 0**。

## Evaluator self-review

- P1とP2はSprint着手時点のAC12〜14、AC17、rubric C2／C5／C6／C17に直接対応し、新しい証拠形式や合格条件を追加していない。
- checkoutとGit-free archiveの同一失敗を別findingへ水増ししていない。
- historical／verification-infraの失敗を現candidateのproduct findingへ誤分類していない。
- 専用面のPASSをrelease integrity／rollbackのFAILの代替にしていない。
- Evaluatorは製品、test、spec、state、progress、Gitを変更していない。
