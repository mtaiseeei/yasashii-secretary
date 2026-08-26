# Sprint 040 Feedback — schema 3 Yasashii実source独立評価

## 最終Verdict

**PASS**

- Failure classification: `none`
- Product findings: **0**
- Verification-infra findings: **1（非阻害、後述V-01）**
- 評価対象product／test candidate commit: `9089a05f85b307d52aba0b02b54a9670c60d4fad`
- 評価開始時docs-state HEAD: `7f9f656a039b4eacff3ca2679d9a212b7fce9aac`
- Branch: `codex/sprint-040-memory-authorization`
- UI変更: なし。browser、DOM、screenshotは対象外

schema 2停止履歴とGenerator自己評価をVerdict根拠へ流用せず、改訂Sprint契約、rubric、公開固定入力、
Yasashii実source、固定baseからの隔離candidate、commit `9089a05` のGit-free archiveを独立に実行評価した。
AC1〜20とC2／C5／C6／C13／C14／C19はすべて合格した。

## 固定入力とcandidate identity

| 項目 | 独立観測値 | 判定 |
|---|---|---|
| 公開製品commit | `9acea13477cd7730bf064a32c170b752586fa116` | 完全SHA一致 |
| 公開candidate ID | `36a5c5f5482fcd510e5b361bdf9e24620be696046e248fb29b3b557800cc083d`、628 files | 一致 |
| Yasashii固定base | `3c472dd9a2b5299f27741ae2c418094486b7d035` | 一致 |
| Yasashii隔離candidate ID | `4bc87169d87baf90f9681f7ba07d3154c71df34eac78bad15b435732e876faf2`、604 files | 一致 |
| schema 3 manifest digest | `e515842b147393ac77dddfb94d000188916d4aa837fda17d7e8fb4015f844982` | 一致 |
| inventory digest | `1c77e1df553a517f65b22d078f75e94f18df6f1f3c775b358deef79769cb12cb` | schema 1、17/17 unique |

公開commitは `git archive` で `/tmp` のGit-free treeへ展開し、その実bytesから3版candidateをfresh構築した。
Yasashii実repoの後続Planner docs／stateは公開製品入力へ混ぜず、product commitとdocs-state HEADを分離した。

## schema 3 manifest／実action／actual diff

同じbuilder runのreportから次を独立集計した。

| 項目 | Yasashii観測値 |
|---|---:|
| parity | 29 |
| adapted | 3 |
| supporting | 5 |
| declared input union | 37 |
| actual diff | 28 |
| read／copy／write／execute／protect | 37／31／32／1／5 |
| parity-adapted／parity-supporting／adapted-supporting intersection | 0／0／0 |
| unclassified mutation／unused declaration／stale path | 0／0／0 |

- parityは公開candidateとpath、mode、bytesが全件一致した。
- actual diff 28 pathはparityまたはadaptedだけで、supportingとのintersectionは0件だった。
- supporting 5 pathは実際に`read`／`protect`され、固定digestを維持した。
- `plugins/secretary/skills/secretary/SKILL.md` と `scripts/sprint-010-regression.sh` は
  copy後adaptであり、各role actionとtraceの`read`／`copy`／`write`が一致した。
- `scripts/sprint-038-test.mjs` はfixed-base入力のadapted 1件で、parityへの二重分類は0件だった。
- adapted 3 pathは宣言transformerと実transformerが一致し、全anchorの`occurrenceCount=1`、
  anchor／変換recordの`applicationCount=1`、final digestと実candidate bytesの一致を確認した。
- `publicWholeTree`はroot `.`、exclusions 4件を実列挙へ使用し、628 pathと公開candidate identityへ接続された。

正例と負例は、公開固定commitのGit-free treeで個別実行した。

- `node scripts/sprint-040-handoff-test.mjs ...`: exit 0、12/12 PASS。
- 正常manifest、legacy schema 2の実観測、未宣言mutation、role overlap、unused、stale path、
  stale／複数anchor、stale public root、空exclusions、transformer不一致、実変換点外anchorを検証した。
- copy→adaptのtraceからsecretary Skillを1件除いた独立tamper reportは、inventory testが
  `yasashii:...:copy-trace`でexit 1、7/8となり、偽PASSしなかった。
- `node scripts/sprint-040-inventory-test.mjs --candidate-report ...`: 正常reportはexit 0、8/8 PASS。

## Yasashii実sourceの会話・memory評価

実sourceとcommit `9089a05` のGit-free archiveの両方で、次を独立再実行した。

| Command／surface | Exit | 結果 |
|---|---:|---|
| `node scripts/sprint-040-yasashii-source-test.mjs --candidate-report ...` | 0 | 9/9、実source 28 pathのbytes／mode、Planner正本保持、保護面、overlay、inventoryを確認 |
| `node scripts/sprint-040-test.mjs` | 0 | 15/15 |
| `bash scripts/sprint-038-regression.sh` | 0 | 67/67、historical classifier 14/14、historical path 3/3 |
| `bash scripts/sprint-010-regression.sh` | 0 | 56/56 |
| `node scripts/sprint-021-git-safety-test.mjs` | 0 | Git／Secret安全境界71/71 |
| `python3 scripts/check-release-integrity.py --root .` | 0 | manifest／CHANGELOG整合PASS |
| 固定Yasashii隔離candidateのedition fixture | 0 | 3/3 |
| 固定Yasashii隔離candidateのprivate相当 | 0 | 9/9 |

実runtimeで次の利用者向け挙動を確認した。

- 「これ覚えて」のdecision相当／topic相当は、内部分類質問0、同じturnで各1 write。
- request hedgeは質問前0 write。推量／伝聞を含む明示保存は各1 writeで、情報源・確実性を保持。
- 引用、非現在仮定、取消、過去照会は0 write。保存済み取消は削除2段階。
- pendingは同時に1件、別話題で失効し、「はい、ただしX」は修正版1件・再確認0。
- topic訂正は旧eventを変更せず新event 1件、同じ訂正retryは追加0。
- topic／decisionは表記違い、別turn、別operation、再起動相当retryを内容keyでdedupeし、
  情報源・確実性・否定・条件・訂正関係が違う内容を誤dedupeしない。
- checkpoint failureは`partial`でmemory／journal／commit=`1/1/0`、retry=`0/0/1`、
  再retry=`0/0/0`。
- memoryの2表現×6 destination×scopeChange 3状態、36組合せをmemory専用gateへ通し、
  memory／decision／topicは保存、TODO／Notion TaskDB／projectは質問前0 write。
- 既存6操作はscopeChange 3状態でも各`explicit / saved / 1`を維持した。
- Sprint 038全goldenは実runtime classifierを通り、classifierInput欠落、runtime tamper、
  旧save-memory限定実装再注入の負fixtureを拒否した。

## overlay、clean tree、保護境界

commit `9089a05` のGit-free archiveをdownstream root、accepted Agentic candidateをread-only入力として、
overlayを独立実行した。

| Operation | Exit | 結果 |
|---|---:|---|
| `--record` | 0 | `files=628` |
| `--check` | 0 | `managed=290`、`handoffPaths=20`、remote push disabled |
| `--apply` | 0 | `changed=0` |
| `--reapply` | 0 | `secondChanged=0` |

実Yasashii repoの開始／終了snapshotはともにHEAD `7f9f656a039b4eacff3ca2679d9a212b7fce9aac`、
branch `codex/sprint-040-memory-authorization`、status／staged空、remote一致だった。
private repoも開始／終了ともHEAD `8e0796c9aba49d9a3dccb020912b0e1cf3989abf`、branch `main`、
status／staged／remote一致でwrite 0件だった。

Yasashiiの次の固定digestは評価前後で一致した。

| Path | SHA-256 |
|---|---|
| `README.md` | `35361391ad9a74c9403f8a2cc20616b5e3aa0635d76a067c1022fb35b794b527` |
| `LICENSE` | `b6d97ac224e82462221382f7af3c40051489be2312daf6e706c5a5ad15c13ec9` |
| `AGENTS.md` | `dd4343eb57b108bc54f867f458040d3315060da4ccf3df476106323401f7b5da` |
| `docs/spec.md` | `1e19127963414b51b152806f30d272d23a4f6119c32180d9ec28364390ceb027` |
| `plugins/secretary/edition.json` | `663c14cc51b92a936a1dbaf34d5ab4f7ded65f20d57ad0ed645dfd3e8d9bf7b7` |
| `plugins/secretary/rules/styles/yasashii.md` | `50c9df0ff79fb43d5e051eb0c42070e31393b210a7fb78076c6e7e6996b1699c` |
| `plugins/secretary/rules/copy/yasashii.json` | `b730ece91753ab562da363b6b085adbffbbe9c3958c3983abef31098a6224e7a` |

README、LICENSE、AGENTS、edition、Yasashii style／copy、Claude／Codex manifest／marketplace、
repo-owned docs、Harness履歴、overlay正本の許可外変化は0件だった。`git diff --check`もexit 0。

## Findings

### V-01 `verification-infra` — fixed-base edition fixtureは現行Planner docsへ直接適用できない

実Yasashii sourceで `node scripts/sprint-040-edition-test.mjs --edition yasashii` を直接実行すると、
`docs/spec.md`の実digest `1e191279...` と固定base digest `694c582a...` の比較だけでexit 1になることを独立再現した。
このfixtureは固定baseから作った隔離product candidate用であり、現行Plannerが承認済みschema 3正本へ更新した
`docs/spec.md`を含む実repo全体へ直接使うと責務が混ざる。

次の証拠により、これは製品欠陥や必要回帰の不足ではなく、検証面の適用範囲不一致と分類した。

- 同じfixtureは固定Yasashii隔離candidateで3/3 PASS。
- 実source専用fixtureは現行Planner docs保持とproduct 28 path一致を分離して9/9 PASS。
- その専用fixtureと全実runtime回帰は、実repoだけでなくcommit `9089a05` のGit-free archiveでもPASS。
- fixed-base docsを現行repoへ戻す変更は行わず、Planner正本とHarness履歴を保護した。

契約のsafe harborに列挙された実source、固定candidate、Git-free、全回帰の証拠は満たしている。
新しいcollectorや証拠形式を合格条件へ追加していないため、V-01は本SprintのPASSを阻害しない。

## Acceptance Criteria

| AC | 判定 | 根拠 |
|---:|---|---|
| 1 | PASS | 固定commit／両candidate ID／base／manifest／inventoryをfresh build前に照合。 |
| 2 | PASS | 3 roleを同じrunから機械算出し、intersection、unused、staleが0。 |
| 3 | PASS | read／copy／write／execute／protectとrole actionが一致。diff28、未分類0、anchor／digest／copy trace一致。 |
| 4 | PASS | whole-tree／anchor／transformer等12/12とtrace tamperを非0で拒否。overlay secondChanged 0、ID再現。 |
| 5 | PASS | decision／topicの明示保存は質問0、同turn各1件。 |
| 6 | PASS | request hedge 0 write、content hedge各1 write、意味属性欠落・反転・追加0。 |
| 7 | PASS | 引用／仮定／取消／過去照会0 write、削除2段階維持。 |
| 8 | PASS | pending 1件、別話題失効、修正付き了承1件・再確認0。 |
| 9 | PASS | topic訂正は旧byte不変、新event 1、retry 0。 |
| 10 | PASS | 内容dedupeは別turn等でも追加0、異なる意味を誤dedupeしない。 |
| 11 | PASS | checkpoint partial=`1/1/0`、retry=`0/0/1`、再retry=`0/0/0`。 |
| 12 | PASS | 強い確認境界は副作用0、memory scope 36組合せPASS。 |
| 13 | PASS | 既存6操作はscopeChange 3状態でも各`explicit / saved / 1`。 |
| 14 | PASS | Sprint 038全caseが実runtimeを通り、必須3負fixtureを拒否。 |
| 15 | PASS | 実Yas source inventory 17/17、digest／marker／tracked、漏れ／stale／偽root 0。 |
| 16 | PASS | 実sourceとGit-freeで15/15、67/67、56/56、71/71、release integrityが0 FAIL。 |
| 17 | PASS | Yasashii固有surface、overlay、repo docs、Harness履歴の許可外変化0。 |
| 18 | PASS | remote／release／cache／workspace／Mac mini／new session／external／private write 0。 |
| 19 | PASS | source offline、公開入力、未release、cache未反映、new session未確認、private未実施を分離。 |
| 20 | PASS | fresh独立Evaluatorが同一candidateでAC1〜19と重点rubricをすべて合格判定。 |

## Rubric scores

本Sprint指定の6軸はすべて5/5必須。

| Rubric | Score | 根拠 |
|---|---:|---|
| C2 構文・整合 | **5/5** | 固定入力、schema、digest、role、実action、actual diff、anchor、candidate identityが一致。 |
| C5 安全・規律 | **5/5** | 強い確認境界、Secret／path guard、所有commit、push禁止、外部write 0。 |
| C6 無回帰 | **5/5** | 実source、固定candidate、Git-free archiveの既存＋追加回帰がすべて0 FAIL。 |
| C13 edition分離・互換 | **5/5** | Yasashii固有surfaceとoverlayを保護し、3 role排他、二回適用差分0、private実repo不変。 |
| C14 会話のMarkdown可読性 | **5/5** | Yasashii style／copy／identityを保持し、Sprint 010 56/56、会話fixtureに可読性回帰なし。 |
| C19 明示memory authorization・内容冪等性・Yasashii下流分離 | **5/5** | run-once、hedge、pending、訂正、dedupe、partial、scope36、既存6操作、schema 3、独立評価が全PASS。 |

## 外部操作と昇格境界

- push、tag、GitHub Release、marketplace公開、installed cache、利用者workspace、Mac mini、new session、
  loaded version、external serviceは未実行／write 0。
- private repoは固定base readだけで、製品適用、stage、commit、branch、remote変更は0。
- source／offline PASSをrelease済み、cache反映済み、new session確認済み、private版完了へ昇格していない。
- 一時candidate、負fixture、overlay隔離root、Git-free archiveは`/tmp`だけに作成した。
- Evaluatorが変更した正本は本feedbackだけで、product、test、fixture、overlay、spec、progress、stateは変更していない。

## Evaluator self-review

- Generator自己評価と公開版feedbackをVerdictへ流用せず、実commandと実candidateを独立再実行した。
- 同じproduct candidateを実source、固定base隔離candidate、commitのGit-free archiveで分離検証した。
- schema 2停止履歴を削除・上書きしていない。
- V-01を`verification-infra`へ分類し、製品findingと混同していない。
- safe harborにない統一attestation、collector、browser、live cacheを追加条件にしていない。
