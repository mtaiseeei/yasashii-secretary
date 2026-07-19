# Sprint 021 — 0.7.0安全性1: secret検査とGit変更範囲の分離

- Type: main
- Risk: high（資格情報、Git commit、remote push）
- 主眼: 通常の設定・publish・commitでsecret実値を残さず、製品が所有する変更だけを安全にcommit・pushする。
- 依存: sprint-020-patch-002 done。single private workspace、両チャットのsecret非露出、既存stageを守る設定導線を維持する。
- 2026-07-19仕様改訂: 補助scannerの責任を「通常利用で合理的に起こり得る誤混入の防止」へ明確化し、任意コードの意図的難読化を完全解析する要求を非ゴールにした。

## 外から見える成果

1. Google ChatのOAuth実値はlocal wizard sessionのmemoryから `gh` のstdin経由でRepository Secretへ直接登録される。Chatwork API Tokenはwizardが取得・受領・登録せず、利用者本人がGitHubのRepository Secret画面へ直接入力する。両サービスとも実値はrepo、Git履歴、ログ、製品側DOM、会話に残らない。
2. 初回publishや製品管理ファイルに資格情報が通常の形で誤混入した場合、commit／push前に値を表示せず停止する。
3. 製品が生成する正規のruntime secret参照と通常文書は、secretと誤認されず利用できる。
4. チャット設定や記憶の節目commitを行っても、別作業でstage済みの変更はcommitへ混ざらず、そのまま残る。
5. push失敗やcommit失敗でも、操作対象外の変更を失わない。

## 確定した保証境界

### A. サービス別のRepository Secret登録導線

- Google ChatのOAuth実値はlocal wizard sessionのmemory内だけで受け渡し、`gh` のstdin経由で現在のprivate repoのRepository Secretへ直接登録する。利用者のコピー／貼り付けを求めない。
- Chatwork API Tokenはwizardが自動取得・受領・登録しない。F24の既存導線どおり、利用者本人がChatwork公式画面で取得し、GitHubのRepository Secret画面へ `CHATWORK_API_TOKEN` として直接入力する。Tokenをwizard、AI会話、repo本文、ログ、製品側DOMへ入力・貼り付けさせない。
- 両サービスともRepository Secretを正本とする。成功・失敗・キャンセルの通常フローで、repo、Git差分／履歴、ログ、journal、fixture出力、製品側DOM、会話、評価証跡へ実値を残さない。

### B. commit前の合理的な誤混入検査

- 強制検査対象は、製品が生成・管理するworkflow／config／historyと、初回publish時に確定したcommit候補inventoryである。
- OAuth client JSON、client secret、認可コード、access／refresh token、Chatwork API Token、private key／秘密鍵、credential URL、known token field、通常のliteral assignment等、通常利用で合理的に起こり得る誤混入をcommit／push前に拒否する。
- `${{ secrets.NAME }}` 等の製品が生成する正規のruntime参照、通常文書、合理的な非機密metadataは許可する。
- 補助scannerはdefense-in-depthであり、通常フローの値非露出の代替でも、万能secret detectorでもない。

### C. 所有変更だけのGit操作

- 初回publish、Chatwork設定、Google Chat設定、memory commit、更新は、各操作が所有するpathだけをcommit対象にする。
- 操作前からstage／unstageされていた無関係変更、別サービス、一般PJ、repo rootの無関係ファイルを混ぜない。操作後も既存indexの内容とstage状態を維持する。
- commit不能、競合、push失敗では所有変更だけを戻すか再試行可能な状態にし、既存変更をunstage・上書き・削除しない。
- secret検査後にcommit候補が変わった場合は再検査し、検査済みでないcommitをpushしない。

## 非ゴール

- 利用者がローカル／private repoで作成した任意のJS／TS／shell／JSONの全構文解析、難読化解除、実行時値の追跡は行わない。
- 利用者が意図的に特殊構文、難読化、computed／escaped key、偽placeholderを使い、補助scannerを回避するケースまで完全検出することは保証しない。通常利用でそのような改変を行う合理性はないと扱う。
- symlink write/deleteの一般境界はSprint 022、OAuth callback・loopback HTTP防御はSprint 023、`0.7.0`へのversion更新はSprint 025で扱う。これら後続Sprintの意図は変更しない。

## Generatorへの契約

- 既存実装が補助scannerを万能parserに近づける過剰な複雑さを持つ場合、本契約の保証境界を満たす最小で予測可能な振る舞いへ整理してよい。実装手段はGeneratorが選ぶ。
- 意図的な回避パターンの網羅だけのために、通常文書／metadataの誤拒否や保守不能な複雑性を増やさない。

## 受入基準

1. **サービス別のRepository Secret導線（C5/C11/C12）**: Google Chatではsynthetic OAuth実値がlocal wizard sessionのmemoryから `gh` のstdin経由で現在のprivate repoのRepository Secretへ直接登録され、コピー／貼り付け要求が0件である。ChatworkではwizardがTokenの自動取得・受領・登録をせず、現在のowner／repoに対応するGitHub Repository Secret画面を開き、利用者本人が `CHATWORK_API_TOKEN` を直接入力する既存F24導線が維持される。今回、Chatwork wizardへToken取得・登録機能を新設しない。
2. **通常フロー値非露出（C5/C11/C12）**: Google Chatの登録成功・失敗・キャンセル、およびChatworkのSecret画面案内・登録確認・キャンセルで、実値がrepo／Git差分・履歴／ログ／journal／fixture出力／製品側DOM／AI会話／エラー／スクリーンショット／評価証跡に0件。Chatwork Tokenの入力欄・貼り付け要求は製品側に0件である。
3. **製品管理対象の誤混入拒否（C5/C12）**: workflow／config／historyに通常の形で混入したOAuth client JSON、private key、known token field、literal token／credential URLがcommit 0件・push 0件で停止する。
4. **初回publish inventory（C5/C12）**: 確定した全commit候補inventoryに合理的な資格情報誤混入が1件でもあればcommit 0件・push 0件で停止する。
5. **正規参照の許可（C3/C5）**: `${{ secrets.NAME }}` 等の製品が生成する正規runtime参照がinspect・commit・pushを通過し、実値を含まない。
6. **誤拒否0件（C1/C4/C5）**: 通常文書、説明文、非機密の名前／label、合理的なmetadataが、token風の文字種・長さ・entropyの推測だけで誤拒否されない。
7. **候補変更後の再検査（C5/C12）**: 検査後にcommit候補が変わるfixtureで、未検査commit／push 0件。
8. **初回publishの所有範囲（C2/C5）**: 意図したworkspace inventoryだけが初回commitに入り、無関係なrootファイル、別repo、境界外symlinkが0件。
9. **Chatwork／Google Chat既存stage維持（C5/C6/C12）**: 初回設定・通常設定変更で、各設定の所有pathだけがcommitされ、別サービス、既存staged／unstaged／untracked変更が混ざらず、既存indexがbyte単位で不変。
10. **memory commit限定（C5/C12）**: `secretary/`がworkspace repoのsubdirectoryでも、memory commitは許可されたsecretary変更だけを対象にし、repo rootの既存stageをcommitしない。
11. **失敗rollback（C3/C5）**: commit失敗、push失敗、non-fast-forwardで、所有pathの状態を正直に示し、既存stage／unstaged変更／別commitを変更しない。
12. **既存導線回帰（C6）**: 正常な初回publish、Chatwork／Google Chat設定、memory commitの成功経路が維持され、対象専用回帰と引き継ぎ指定の全既存回帰が0 FAIL。

## 失格条件

- 通常wizardで扱う実値が、repo、Git履歴、ログ、DOM、会話、fixture出力、評価証跡のいずれかへ1件でも残る。
- 製品管理workflow／config／historyまたは初回publish inventoryの合理的な誤混入をcommit／pushできる。
- 製品生成の正規runtime参照や、通常文書／合理的metadataが誤拒否され、通常利用を続行できない。
- 操作対象外のpath、既存stage／unstaged／untracked変更、別commitの内容または状態を変更する。
- 利用者が意図的に作った難読化、computed／escaped key、偽placeholderの未検出だけは失格条件にしない。その形式を製品が生成した場合や、通常導線の値露出を難読化と呼び替えている場合はこの例外に入らない。

## 評価証跡

- Google Chatについて、local wizard sessionのmemoryから `gh` のstdin経由でRepository Secretへ登録する成功／失敗／キャンセルの実操作と、コピー／貼り付け要求0件、値非露出scan。証跡には実値を残さない。
- Chatworkについて、現在のowner／repoに対応するGitHub Repository Secret画面を開き、wizardがTokenを取得・受領・登録しない既存F24導線の実操作。製品側のToken入力欄／貼り付け要求／実値取得0件と、repo／Git履歴／ログ／製品側DOM／AI会話の値非露出scanを残す。GitHub画面へ入力した値そのものは証跡へ記録しない。
- 製品管理対象と初回publish inventoryにおける、OAuth client JSON、private key、known token field、通常のliteral assignment、credential URLの種別判定、commit／push 0件、local／remote履歴0件。
- `${{ secrets.NAME }}` 等の正規参照、通常文書、合理的metadataが実Git経路を通過した結果。
- staged／unstaged／untrackedを混在させた操作前後のindex・working tree snapshotと、正常、commit失敗、push失敗、競合の所有変更／既存変更不変結果。
- Evaluatorが非ゴールの意図的回避例を探索的に試す場合は、保証対象の証跡と分けて「非ゴール」と記録する。その成否だけでC1／C5／C6／C11／C12を下げない。
