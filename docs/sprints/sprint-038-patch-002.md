# Sprint 038 Patch 002 — Windows native保存互換の同期とYasashii Secretary 0.9.2

- Type: regular patch
- Risk: high（Windows固有のpath／改行処理と、project・記憶・TODO・settings・文書の複数保存面、rollback、下流overlay、release整合を同時に扱うため）
- 主眼: 独立評価PASS済みAgentic Secretary完全SHAからWindows native保存互換を宣言的overlayで取り込み、Yasashii固有差分を保ったままYasashii Secretary `0.9.2` の独立評価候補を作る。
- 依存: sprint-038 done。固定上流完全SHA `24520a1d06f8d3833568a1386bf814e1085f5da9` はAgentic側fresh独立EvaluatorでWindows native 12/12、macOS target 12/12、Git-free archive 291/291、product finding 0、blocking verification-infra 0のPASS済み。
- UI差分: なし。
- 公開状態: 本Patchの独立Evaluator PASSまではpush、PR、merge、tag、GitHub Release、marketplace、plugin install／updateを禁止する。PASS後も公開先とrollbackを別途ユーザー確認する。

## ユーザー決定とPatch判定

- Windowsでproject作成／journalがBashのpath解釈により失敗する問題だけでなく、同じ保存系統のmemory、TODO、settings、文書保存、recursive copy crash、CRLF preferencesまで同じPatchへ含める。
- Agentic側で合格済みの共通実装をYasashii専用に作り直さず、完全SHAを固定入力にして既存の宣言的overlay契約から同期する。
- 複数の保存面、Windows native実機、rollback、archive、releaseまで横断するため、`Type: micro` ではなく通常Patch、`Risk: high` とする。
- private `agentic-secretary-my-vault`、installed plugin／cache、利用者workspace、他repo、実サービスは対象外である。
- ユーザーは方向を承認済みであり、Plannerの追加質問は不要である。

## 外から見える成果

Windows利用者が日本語や空白を含むworkspace pathでも、project作成、journal、memory、TODO、settings、文書保存を正常に完了できる。Bashのpath解釈を前提にせず、recursive copyでcrashせず、途中失敗では開始前へ戻る。既存のCRLF preferencesはCRLFのまま更新される。

Yasashii Secretaryの言葉遣い、identity、README、LICENSE、配布先は従来どおりで、現行versionだけが `0.9.2` へ整合する。UIに変化はなく、private my-vault版へ対応済みとは表示しない。

## Scope

### A. PASS済みAgentic完全SHAを固定して同期する

- 同期元は完全SHA `24520a1d06f8d3833568a1386bf814e1085f5da9` だけとする。Agentic側のWindows native 12/12、macOS target 12/12、archive 291/291、finding 0の評価記録と対応を確認する。
- 現在のYasashii baseから固定candidateまでのancestry、tree、追加・削除・変更pathをreviewし、全pathをcommon、metadata overlay、anchor overlay、upstream-only、repo-owned、downstream-fileへ分類する。
- review後に限り、同じcandidateへoverlayのrecord／apply／check／reapplyを行う。common対象fileは固定candidateとbyte単位で一致させる。
- Yasashii固有copy、identity、README、LICENSE、repo-owned `docs/spec/**`、Sprint、progress、feedback、evidenceを同期前後digestで保護する。base／treeと必要な宣言変更をreviewして確定した後にoverlay定義digestを固定し、apply／check／reapplyの前後で不変にする。
- 未分類追加・削除、base／tree不一致、anchor不在／複数一致、metadata allowlist外変更、Yasashii固有surface変化、二回目の追加差分では、同期先に部分変更を残さず停止する。

### B. Windows native保存互換をYasashii版で成立させる

- Windows nativeで固定上流testと同じ12 labelsを同じ意味で実行し、skipなしで全件PASSする。
- 日本語・空白を含むpathでproject作成、journal、memory、TODO、settings、文書保存が成功し、Bash executableやBashのpath解釈を必要としない。
- project作成のrecursive copyはコピー先を再帰的に取り込まず、process access violation `0xC0000005`、crash、無限増殖、半端なprojectを残さない。
- 保存途中の失敗、拒否path、外向きsymlink、commit失敗では、対象project、journal、memory、TODO、preferences、文書、Git状態がtransaction開始前へrollbackする。
- 既存 `preferences.md` がCRLFなら設定更新後もCRLFを保ち、LFとの混在を作らない。既存LFも意図なく変更しない。
- macOS／Linuxの同じ保存導線、path guard、rollbackを回帰させない。

### C. Yasashii Secretary 0.9.2の配布面を整合する

- Claude／Codexのplugin manifestとmarketplace、edition metadata、正本CHANGELOG、旧raw CHANGELOG互換file、release gateの現行versionを `0.9.2` に一致させる。
- CHANGELOGはWindowsのproject／保存互換、recursive copy、CRLF保持を利用者向けに説明し、Yasashii固有identityと別配布のHarness導線を維持する。
- 0.9.1以前のCHANGELOG entry、version history、migration、fixture、評価記録、Git履歴を遡及変更しない。
- private `agentic-secretary-my-vault`、my-vault版、installed cache、利用者workspaceへ反映済みとは表示しない。

### D. 独立評価とrelease hold

- Generatorは同期、実装、回帰、progress handoffまでを担当し、外部公開を行わない。
- Generatorと別のfresh独立Evaluatorが、Windows native、macOS／Linux、archive、overlay、release integrityを実物で確認する。
- 機能完全性、動作安定性、エラーハンドリング、回帰なし、およびrubric C2／C5／C6／C10／C13／C16を各5/5とする。1項目でも5未満、product finding 1件以上、blocking verification-infra 1件以上、必須内部項目の未検証があればPASSにしない。
- UI差分がないためbrowser操作、DOM評価、screenshot、デザイン／独自性の再採点は要求しない。
- 独立Evaluator PASS後も自動releaseしない。公開先、対象candidate SHA、branch／PR／merge／tag／Release／marketplaceの範囲、失敗時rollbackをユーザーへ別途示して確認する。

## Non-scope

- Windows保存互換以外の新機能、UI／wizard／会話copy／workspace schemaの変更。
- Agentic共通実装のYasashii専用再実装、宣言外のoverlay差分、既存version historyや下流固有設計の変更。
- private `agentic-secretary-my-vault`、installed plugin／cache、利用者workspace、他repoへの反映・移行・書込み。
- Secret、Actions、OAuth、Chatwork／Google Chat API、外部サービス、実利用データへのアクセス・write。
- Harness本体、custom agent、Harness skills／agents／runtime／Git履歴の同梱・変更・release。
- 新しいcollector、統一attestation、approval manifest、外部署名、追加の証拠schema。
- 独立Evaluator PASS前のorigin／upstream push、PR、merge、tag、GitHub Release、marketplace公開、plugin install／update。

## Acceptance Criteria

1. 同期元が完全SHA `24520a1d06f8d3833568a1386bf814e1085f5da9` に固定され、Agentic側fresh独立EvaluatorのWindows 12/12、macOS 12/12、archive 291/291、product finding 0、blocking verification-infra 0と対応する。
2. 現在baseから固定candidateまでのancestry、tree差分、全path分類がreviewされ、`upstream-base.json` と `upstream-tree.json` は同じ固定candidateを表す。未分類pathは0件である。
3. overlayのrecord／apply／check／reapplyが同じcandidateで成功し、二回目の追加差分0件。common対象fileは固定candidateとbyte一致し、Yasashii固有copy、identity、README、LICENSE、repo-owned docs／spec／Sprint／progress／feedback／evidenceのdigestは同期前後で不変である。review済みのbase／tree／宣言変更を確定した後は、overlay定義digestもapply／check／reapplyの前後で不変である。
4. 未分類追加・削除、anchor不在／複数一致、metadata allowlist外変更、Yasashii固有surface変化、base／tree不一致の各負ケースが、同期先への副作用0件で停止する。
5. cleanなYasashii candidateをWindows nativeで実行し、固定上流と同じ12 labelsがskipなし12/12。exit 0で、`0xC0000005`、crash、hang、残存processは0件である。
6. Windowsの日本語・空白pathでproject作成、journal、memory、TODO、settings、文書保存が成功し、Bash依存0件。生成内容、日付、保存先、Git変更集合が各機能の既存契約に一致する。
7. recursive copyが自己再帰せず、成功時はprojectが1組だけ作られる。途中失敗、path拒否、symlink、commit失敗では対象file、journal、Git状態が開始前へrollbackし、半端なproject、backup、一時fileは0件である。
8. CRLFの `preferences.md` を更新してもCRLFを維持し、mixed EOL 0件。LF fixtureもLFを維持し、設定値・他の手書き行・初回decision・索引を回帰させない。
9. macOS／Linuxの対象保存回帰、path guard、rollback、Git-free archive、release integrityが0 FAILである。UI／wizard／会話copyの差分は0件である。
10. Claude／Codex manifest、marketplace、edition metadata、正本／旧raw CHANGELOG、release gateが `0.9.2` で一致し、旧raw CHANGELOGは正本とbyte一致する。0.9.1以前の履歴は不変である。
11. Yasashii固有identity、repository、marketplace、install ID、README、LICENSE、Harness導線を維持し、Agentic identity混入0件、private版／my-vault対応済み表示0件である。
12. private版、installed cache、利用者workspace、他repo、Secret、Actions、OAuth、実API、外部サービスへのwriteは0件。upstream pushはdisabledのままである。
13. fresh独立Evaluatorが同一candidateを全必須軸5/5、product finding 0、blocking verification-infra 0、未検証の必須内部項目0と判定する。PASS前のpush、PR、merge、tag、Release、marketplace、install／updateは0件である。
14. Windows実機証跡をユーザー宣言から採用する場合、OS／Node version、日時、cleanな固定Yasashii candidate SHA、実行command、同じ12 labels、exit、`0xC0000005` の有無を記録する。対象コードがそのSHAから変わった場合だけ関係証跡を失効させる。

## 必須回帰

- 固定上流candidateのSHA、独立PASS記録、現在baseからのancestry／tree／path分類。
- overlay record／apply／check／reapply、common byte parity、repo-owned／Yasashii固有surfaceの前後digest、負ケースの副作用0件。
- Windows nativeの同一12 labels。OS／Node／candidate SHA／command／exit／label集計／access violation有無を記録する。
- project、journal、memory、TODO、settings、文書保存のWindows日本語・空白path、Bash非依存、recursive copy、CRLF／LF、rollback、path guard。
- macOS／Linuxの対象保存回帰、既存Yasashii edition／overlay回帰、Git-free archive、release integrity。
- `0.9.2` manifest／marketplace／edition／CHANGELOG／release gate整合、旧raw CHANGELOG byte一致、0.9.1以前の履歴保護。
- private／cache／workspace／service write 0、Agentic identity混入0、my-vault対応済み表示0、upstream push disabled。
- `git diff --check`。

Generatorは実行command、exit、assert／label／suite集計、固定upstream SHA、Yasashii開始HEAD／candidate SHA、変更path、overlay digest、Windows実機証跡の状態、外部操作 `not-run` をprogressへ記録する。

## Evidence safe harbor

- 固定Agentic SHAと既存fresh独立EvaluatorのWindows 12/12、macOS 12/12、archive 291/291、finding 0の記録。
- Yasashii開始HEAD／candidate SHA、ancestry、tree、path分類、overlay record／apply／check／reapply結果、common parity、保護surface digest。
- Windows native実機のOS／Node／日時／clean candidate SHA／command／exit／12 label結果／`0xC0000005`有無。ユーザー所有Windowsの明示宣言を採用できる。
- macOS／Linux対象回帰、Git-free archive、release integrity、version／identity／CHANGELOG、外部write 0のcommandと結果。
- fresh独立Evaluatorのスコア、finding一覧、未検証一覧、release hold確認。
- UI差分がないためbrowser操作とscreenshotは不要とする。
- 上記で十分とし、新しいcollector、統一attestation、approval manifest、外部署名、追加の証拠schemaを合格条件にしない。

## Windows証跡の失効境界

ユーザー所有Windowsでcleanな固定Yasashii candidate SHAを実行した証跡は、そのSHAと12 labelsへ結びつける。project／journal／memory／TODO／settings／文書、safe filesystem、path guard、rollback、CRLF、Windows entrypointなど関係コードが変更された場合は、影響するlabelの証跡を失効させる。docs、CHANGELOG、release metadata等の無関係な変更だけでは再実行を要求しない。

## External release gate

この契約はlocal同期・実装・独立評価までを承認範囲とする。独立Evaluator PASS前は外部writeを行わない。PASS後は、Yasashii originのbranch push／PR／merge、`v0.9.2` tag、GitHub Release、marketplace公開、公開後read-only照合のうち実施する項目、対象candidate SHA、宛先、rollbackをユーザーへ別途示し、明示確認を得てから実行する。upstream push、private版、cache、利用者workspace、plugin install／update、Secret、Actions、OAuth、実APIはその承認範囲に含めない。
