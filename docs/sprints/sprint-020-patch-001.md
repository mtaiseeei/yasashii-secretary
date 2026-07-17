# Sprint 020 Patch 001 — チャット設定wizardのMore Simpleな日本語

- Type: regular patch
- Base Sprint: sprint-020
- 主眼: Google Chatを起点に見つかった設定画面の難しさを、Chatworkにも共通する文章設計として直す。機能と安全境界は変えず、非エンジニアが主説明だけで今することと影響を理解できる画面へ揃える。
- 依存: sprint-020 done。現在修正中のlive cleanup、0件処理、手動のみの停止、履歴保持を含む機能上の不具合はsprint-020で解消・評価済みであること。本Patchはplanned契約だけを先に作り、sprint-020完了前に実装しない。

## 外から見える成果

1. Chatwork／Google Chatのどの設定画面でも、最初の1文だけで「今すること」が分かる。
2. 1画面で求められる判断は1つになり、1段落に複数の仕組みや注意事項が詰め込まれない。
3. API、OAuth、Google Cloud、GitHub Actions等の正式名称は必要な場面で確認できる一方、内部用語の列挙で主導線が読みにくくならない。
4. 読む対象、保存先、共同編集者への可視性、自動取得・自動保存、履歴保持の安全情報は、短く分かれて欠落しない。
5. エラーでは「何が起きたか→次にすること」、完了では「結果→次の一手」だけが先に見える。
6. ChatworkとGoogle Chatが同じ文章原則で動き、サービス固有の準備、対象範囲、CTA色は維持される。

## スコープ

### A. 全画面copy inventory

- Chatwork／Google Chatの設定開始から完了・失敗・再設定まで、利用者に見えるcopyを全件棚卸しする。
- 対象は可視見出し、primary body、補足、details／help、label、説明文、CTA、accessible name、empty、loading、error、success、確認・キャンセル、再認証、管理者向け案内である。
- inventoryは少なくとも次を追える形にする。
  - 対象サービス
  - 画面または状態
  - copyの役割
  - 現在の文面
  - primary path／technical detailの区分
  - 必ず残す意味
  - 修正方針または修正後文面
- 共通コンポーネントの1文を数えて終わらず、サービス固有分岐、0件、手動のみ、失敗、再試行、キャンセル、完了を別状態として確認する。
- Generatorの引き渡しにはinventoryの所在と件数を記録する。Evaluatorは実画面と突き合わせ、未棚卸しの表示文言0件を確認する。

### B. Primary pathの文章原則

- 各画面の主説明は、最初に `今すること: <1文>` の意味を持つ短い文を置く。ラベルの完全一致は要求しないが、その1文だけで利用者が行動を言い直せなければ不合格とする。
- 1画面1判断、1段落1要点とする。準備、選択、安全同意、実行、結果を同じ段落へ混ぜない。
- 主語や対象を省略して「登録してください」「続行します」のような曖昧な文にしない。Chatwork／Google Chat、ルーム／スペース、保存／接続等の対象が分かるようにする。
- 不自然な直訳、英語と日本語の不用意な混在、同じ意味の二重表現、名詞を並べただけの文をなくす。
- CTAは次に起きることが分かる短い動詞句にする。「次へ」「実行」「Submit」だけにせず、「接続を確認する」「保存内容を確認する」「この設定で始める」のように対象または結果を含める。

### C. 画面ごとの最大情報量

`docs/spec/ui.md` の「画面ごとの最大情報量」を全画面へ適用する。特に次を必須とする。

| 画面 | 主表示の上限 |
|---|---|
| 開始・状態 | 見出し1、今すること1文、現在状態1行、CTA最大2 |
| サービス固有準備 | 今すること1文、目的1段落、完了条件1行、CTA最大2。正式手順はdetails |
| 接続確認 | 今すること1文、安全な扱い1段落、確認結果1行、CTA最大2 |
| 対象選択 | 今すること1文、選択数1行、検索・一覧、CTA最大2 |
| 間隔選択 | 今すること1文、3時間推奨の理由1行、選択肢、CTA最大2 |
| 保存前確認 | 今すること1文、安全上の意味を最大5項目、選択内容、CTA最大2 |
| 処理中 | 現在行っていること1行、待つ理由または進捗1行、CTA最大1 |
| 0件・手動のみ | 止まる処理1文、履歴保持1文、次の行動1文、CTA最大2 |
| 失敗 | 何が起きたか1段落、次にすること1段落、CTA最大2 |
| 完了 | 結果1文、次の一手1文、CTA最大1 |

一覧、選択肢、安全上必須の短い項目は機械的な文数に含めないが、同じ意味の重複や内部説明を増やす理由にはしない。

### D. Technical detailの退避条件

- 次の用語は、その場の判断に不要ならprimary pathの見出し、本文、CTAから外す。
  `wizard`、`workflow`、`commit`、`push`、`Repository Secret`、`loopback`、`runtime`、`scope`、`token`、`OAuth client JSON`、Sprint番号。
- API、OAuth、Google Cloud、GitHub Actions等は完全削除しない。利用者がGoogleやGitHubの画面で正式名称を照合するとき、管理者へ依頼するとき、原因を診断するときだけ、短い役割説明とともに主表示またはtechnical detailへ出す。
- 長い識別子、scope名、設定key、英語エラー、内部状態、diagnostic dataは「詳しい説明」または「管理者向け」を既定の置き場とする。
- technical detailは閉じた状態を既定にし、通常利用者は開かなくても設定を完了できる。
- technical detailへ移したことで操作に必要な正式名称、管理者依頼の内容、トラブル解決手順が失われないことを確認する。

### E. サービス固有の準備を残す

#### Chatwork

- Chatworkで接続情報を取得すること、組織契約では管理者承認が必要な場合があること、安全な保管場所へ登録することを、1画面1判断で案内する。
- 主説明では目的を先に示し、`API Token` と `Repository Secret` の正式名称は取得画面や登録画面で照合が必要な箇所、または詳しい説明に残す。
- 取得対象は利用者が選んだルームだけであり、選択していないルームは読まない。

#### Google Chat

- 各社所有のGoogle Cloudプロジェクト、必要API、`Internal` Audience、Desktop app、接続用ファイルの準備を、管理者が順に実施できる画面へ分ける。
- 主説明ではOAuth client JSONを「Google Cloudから取得する接続用ファイル」のように目的から説明し、正式名称は管理者向け詳細に残す。
- Google Chatは読むだけで、投稿・編集・削除を行わない。候補と取得対象は `SPACE` の通常スペースだけで、DM／グループDMを含めない。
- read-only scope名、PKCE、state、loopback等は安全機構として維持するが、通常利用者の主説明へ並べない。

### F. 安全同意を短く分けて維持する

保存前の確認画面では、次の意味を1項目1要点で必ず示す。

1. 読む対象: 選択したChatworkルームまたはGoogle Chat通常スペースだけ。
2. 保存先: 現在の非公開のGitHubリポジトリ。
3. 見える人: リポジトリの共同編集者にも保存内容が見える。
4. 自動処理: 選んだ間隔で新しいメッセージを取得し保存する。手動のみなら自動取得しない。
5. 履歴保持: 対象の選択解除、0件、手動のみへの変更だけでは、取得済み履歴を削除しない。

明示同意前の取得、設定変更、履歴保存、commit・pushは0件とする既存境界を維持する。文面を短くするために同意を包括的な1文へ潰さない。

### G. 状態・失敗・完了copy

- 選択0件は「選択を0件にすると、今後の取得は止まります。これまでの履歴は削除しません。」の意味を自然な日本語で示す。
- 手動のみは「自動取得を止めます。必要なときだけ取得でき、これまでの履歴は残ります。」の意味を自然な日本語で示す。
- 0件を正常とする初回取得では、エラーに見せず「まだ保存するメッセージはありません。次回以降の取得で新しい内容を保存します。」の意味を示す。
- 失敗は「何が起きたか→次にすること」の順にする。原因が特定できないときは推測で断定せず、英語エラーと診断情報をdetailsへ分ける。
- 完了は現在の結果と次の一手だけを主表示にし、処理内部の成功ログ、実行ID、runtime、workflow等を並べない。
- sprint-020で修正するlive cleanup、0件処理、手動のみ停止、履歴保持の機能上の正しさを、本Patchのcopy変更で代替・再修正しない。

### H. Before / Afterの代表例

次は最終文言の全文一致を要求するものではなく、情報の順序と密度の基準である。Generatorはcopy inventory全体へ同じ原則を適用する。

| 場面 | Beforeの問題例 | Afterの方向 |
|---|---|---|
| Google Chat準備 | `OAuth client JSONを読み込み、loopback runtimeでscopeを認可します` | `今すること: Google Cloudで、接続に使う設定ファイルを用意します。` 正式名称と安全機構は管理者向け詳細へ |
| Chatwork接続 | `API TokenをRepository Secretへ登録してworkflowを実行します` | `今すること: Chatworkとの接続情報を、GitHubの安全な保管場所に登録します。` CTAは `登録画面を開く` |
| 自動保存の同意 | `GitHub Actions scheduleがcommit・pushします` | `3時間ごとに新しいメッセージを取得し、この非公開リポジトリに保存します。` 詳細で正式名称を確認できる |
| Google Chat対象 | `spaceType=SPACEのみ。DIRECT_MESSAGE/GROUP_CHAT除外` | `通常のスペースだけを読みます。ダイレクトメッセージとグループDMは対象外です。` 識別子は管理者向け詳細へ |
| 失敗 | `OAuth callback failed: invalid_grant` | `Google Chatとの接続を確認できませんでした。接続をやり直してください。` 原文は詳しい説明へ |
| 完了 | 実行ID・件数・内部状態を複数段落で列挙 | `設定が完了しました。次は保存したメッセージを検索できます。` 必要な現在値だけ補助表示 |

### I. 視覚・responsive・accessibility

- 共通骨格、4px radius、8px spacing、14px中心、CTA最大2、keyboard、visible focus、可視label、accessible name、エラー関連付けを維持する。
- desktop、mobile（768px未満）、200% zoom相当で、primary copy、details、CTA、安全同意が欠落・重複・横overflowしない。
- primary CTA背景はChatwork `#F03747`、Google Chat `#11BB62`、前景は `#000000`、contrast ratio 4.5:1以上を維持する。色だけでサービスや状態を伝えない。
- 見出し階層、ボタン順、読み上げ順が視覚順と一致する。detailsを閉じた状態でもフォームの目的とエラーの次行動がaccessible nameから分かる。

### J. 回帰検査と理解テスト

- 回帰は日本語全文の完全一致だけに依存しない。次を組み合わせる。
  - primary pathの禁止語scan。例外は正式名称が現在の判断に必要で、短い役割説明がある箇所だけallowlist化する。
  - 読む対象、保存先、共同編集者への可視性、自動取得・保存、履歴保持等の必須意味要素。
  - service名、heading、button、label、accessible name。
  - 1画面1判断、detailsの開閉、確認前副作用0件を守るDOM構造と状態遷移。
- criticalな短いCTAや安全文は全文一致で守ってよいが、テスト全体を一字一句の一致だけにしない。
- running UIをdesktop、mobile、200%相当で実操作し、両サービスの主要導線、0件、手動のみ、失敗、完了、戻る、キャンセル、detailsを確認する。
- 非エンジニア想定の初見理解テストを、実装担当ではない評価者による最低3回の独立セッションで行う。実参加者か独立Agentかを証跡に明記し、実参加者でない結果をhuman testと表現しない。
- 各セッションではtechnical detailを開く前に次を尋ね、ヒントなしで回答を記録する。
  1. 今することは何か。
  2. primary CTAのあとに何が起きるか。
  3. どのルーム／スペースを読むか。
  4. どこへ保存し、誰が見られるか。
  5. 自動取得を止めたとき、取得済み履歴はどうなるか。
- 合格は各サービスで平均4/5以上、かつ3〜5の安全項目の重大な誤解0件。誤解があればcopyを直して再評価する。

## スコープ外

- sprint-020で修正中のlive cleanup、0件処理、手動のみ停止、履歴保持、OAuth、schedule、API取得、commit・push等の機能修正。
- Google Chatのscope追加、DM／グループDM対応、write操作、External OAuth app、サービスアカウント。
- Chatwork／Google Chatの保存形式、取得間隔、3時間推奨・初期値、検索、再認証、後始末の振る舞い変更。
- CTA色、layout system、共通wizard骨格を別デザインへ作り直すこと。
- 設定wizardと隣接する開始・結果案内を超えたREADME／公開ガイド全体の書き直し。
- 内部ログ、コード、設定keyから正式な技術名を削除すること。

## 受入基準

1. **copy inventory完全性（C1/C2/C4）**: 両サービスの全可視・accessible copyが画面／状態と対応し、primary／technical、必須意味、修正結果を追える。実画面との突合で未棚卸し0件。
2. **今すること（C4/C8）**: 各画面の最初の主説明だけで行動を言い直せ、1画面1判断・1段落1要点・CTA最大2が全主要状態で成立する。
3. **難語除去と詳細退避（C2/C4）**: primary path禁止語scanが0件、または必要性・役割説明つきallowlistだけ。technical detailを開かずに通常導線を完了でき、開けば正式名称と管理者手順を確認できる。
4. **自然な日本語（C4/C7）**: 不自然な直訳、主語不足、英日混在、二重表現がinventoryレビューと実画面で0件。CTAだけを読んでも次の結果が分かる。
5. **画面別情報量（C4/C8）**: `docs/spec/ui.md` と本契約の上限を全画面で満たす。超過が必要な安全項目・選択肢は理由があり、同じ意味の重複0件。
6. **安全同意（C5/C11）**: 読む対象、private保存先、共同編集者可視性、自動取得・保存、履歴非削除が確認画面に別項目で揃う。簡潔化による欠落・意味の弱まり0件、明示同意前副作用0件。
7. **Chatwork固有準備（C1/C4/C5）**: 接続情報の取得、必要時の管理者承認、安全な登録、選択ルーム限定が、primary pathとdetailsを使い分けて完結する。秘密値の表示・保存0件。
8. **Google Chat固有準備（C1/C4/C11）**: 各社所有Cloud project、必要API、`Internal`、Desktop app、接続用ファイルの準備が1画面1判断で案内される。読むだけ、`SPACE`限定、DM／グループDM除外、厳格secret非露出を維持する。
9. **0件・手動のみ・履歴保持（C3/C4/C5）**: 初回0件を失敗扱いせず、選択0件／手動のみでは今後の自動取得停止と取得済み履歴保持を自然な日本語で区別する。機能はsprint-020受入結果から変わらない。
10. **失敗と完了（C4/C8）**: 失敗は「何が起きたか→次にすること」、完了は「結果→次の一手」の上限内。英語エラー・診断・実行IDは主説明より後ろ。
11. **両サービス整合（C2/C4/C8）**: 共通の画面役割では同じ情報順と用語原則を使い、サービス固有準備は混同しない。全画面でサービス名を可視・accessibleに明示する。
12. **CTA色・accessibility（C8）**: Chatwork `#F03747`、Google Chat `#11BB62`、前景 `#000000`、contrast 4.5:1以上。keyboard、focus、label、accessible name、error関連付け、読み上げ順が成立する。
13. **desktop／mobile／200%（C4/C8）**: 両サービスの主要導線と代表状態をrunning UIで操作し、欠落・重複・横overflowなし。各幅と200%相当の秘密値を含まないスクリーンショットがある。
14. **browser実操作（C3/C8）**: 開始→準備→接続→対象選択→間隔→確認→完了、0件、手動のみ、失敗、戻る、キャンセル、detailsをbrowserで確認する。静的grepだけで合格にしない。
15. **初見理解テスト（C4/C7）**: 実装担当ではない評価者による最低3回の独立セッションで、各サービス平均4/5以上、安全項目の重大な誤解0件。評価主体、質問、回答、修正・再試験を記録する。
16. **回帰の質（C2/C6）**: primary禁止語、必須意味、button／heading／label、DOM構造、状態遷移をassertし、全文一致だけへ依存しない。壊したfixtureがそれぞれ失敗する。
17. **機能漏出なし（C3/C5/C6/C11）**: sprint-020のlive cleanup、0件・手動のみ、履歴保持、OAuth、API、schedule、保存、検索、再認証、後始末の挙動を本Patch理由で変更しない。Chatwork／Google Chat以外へ文章規則を無断拡張しない。
18. **全回帰（C6）**: sprint-020までの全offline／online回帰＋本Patchのcopy／DOM／browser検査が0 FAIL、既知失敗0件。

## 評価証跡

- サービス、画面、状態、copy役割、primary／technical、必須意味、修正結果を含む全画面copy inventory。
- primary path禁止語scan、allowlistと理由、必須意味要素、heading／button／label／accessible name、DOM構造の検査結果。
- Before／After代表例と、inventory全体へ同じ原則を適用したレビュー記録。
- Chatwork／Google Chatの開始から完了まで、0件、手動のみ、失敗、戻る、キャンセル、detailsのbrowser操作記録。
- desktop、mobile、200%相当のスクリーンショットと、computed style／contrast／overflow／focusの確認結果。
- 3回以上の初見理解テスト。評価主体の種別、質問、回答、採点、安全上の誤解、修正後の再試験を含む。
- 同意前副作用0件、secret非露出、`SPACE`限定、DM／グループDM除外、選択解除・手動のみで履歴保持の回帰結果。
- sprint-020機能差分0件の確認と、全offline／online回帰のPASS／FAIL集計。

## 参照

- `docs/spec/features.md` F24/F26/F32/F33/F34
- `docs/spec/constraints.md` §2、§8、§12、§13
- `docs/spec/ui.md` Chatwork／Google Chat共通の文章設計、各サービス設定wizard
- `docs/spec/rubric.md` C1/C2/C3/C4/C5/C6/C7/C8/C11
- `docs/sprints/sprint-019.md` Google Chat接続・初回wizard
- `docs/sprints/sprint-020.md` 定期運用、0件・手動のみ、live cleanup、実API
