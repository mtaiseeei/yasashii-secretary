# Sprint 033 — agentic-secretary上流edition

- Type: main
- Risk: high（別directory／GitHub repo、remote、push）
- 主眼: 共通祖先と全Git履歴を持つ別repo `agentic-secretary` を成立させ、技術者向けの4表現面だけを実装する。
- 依存: sprint-032-patch-001 done。neutralization commit、未配布段階の `0.8.0` release preparation、共通会話可読性とChatwork Secret入力案内が合格していること。

## 外から見える成果

エンジニア／AI活用に慣れた利用者が、共通の安全性とwizardを保ったまま、技術的に直接的な会話・診断・報告・handoffを使える。

## Scope

- `/Users/taisei/workspace/agentic-secretary` の別directoryを、neutralization commitのGit履歴から作る。
- GitHubの別repoは `mtaiseeei/agentic-secretary`。yasashii内のmonorepo／subdirectoryにしない。
- agentic用marketplace／external plugin ID／repository／update／ledger／session／commit prefix／Harness設定。
- 会話、診断、報告、developer handoffのtechnical style。
- Repo分割前に共通実装したMarkdown可読性とChatwork Secret入力案内を、そのままagenticへ継承する。
- README／mappingで上流関係、対象ユーザー、共通面、edition差分、MIT／単段クレジットを説明する。
- 共通plugin、安全回帰、wizard parity、公式validatorを `0.8.0` candidateで実行する。

## Non-scope

- wizard copy／flow／OAuth scope／同期、skill／command名、workspace root、migration filenameのagentic分岐。
- yasashii overlayの実装、edition switching、co-installation。
- `forkedFrom` の推測変更。
- same-version bootstrap bridge、公開済み `0.7.0` のin-place差替え、version downgrade／equal update。
- 旧0.7.0利用者向けexternal recovery／bootstrapと、未検証の標準live update互換の主張。

## 受入基準

1. agenticは指定の別directory／別repoで、neutralization commitが両repoのmerge-baseとして到達可能。履歴を1 commitへ潰していない。
2. 共通plugin pathは `plugins/secretary/`、外部IDはagentic固有で、yasashii IDの漏れをallowlist外で検出する。
3. 技術差分は4面だけ。wizard file／DOM／copy、OAuth scope、同期、安全ruleのdigestがneutral baseと一致する。
4. technical styleは正式名称、command、path、error、証拠、残課題を示すが、確認・secret・根拠規律を弱めない。
5. agenticの全回帰、archive、official validatorが0 FAIL。LICENSEと単段クレジットが存在する。
6. 外部操作は明示許可されたものだけで、無許可のrepo作成／remote／push／公開0件。
7. agentic側のcandidate／latest／manifest／CHANGELOG／ledgerが `0.8.0` で整合し、旧 `0.7.0` の記録・fixture・履歴を変更していない。同一版とdowngradeは副作用0件で停止する。
8. 全会話面のMarkdown可読性とChatwork wizardの `Name`／`Secret` 入力案内が共通baseから継承され、technical styleを保ったまま改行なし平文へ戻っていない。

## 回帰保護

- neutral baseとagentic treeの差分allowlistを検査する。
- common master suiteとagentic edition suiteを実行し、yasashii用fixtureの反対edition停止も確認する。
- wizard assets、copy inventory、OAuth scope、safety ruleのdigest parityを検査する。

## 手動・browser証跡

- agenticの会話、diagnose、報告、developer handoffを各1件実行し、段落・改行・必要な箇条書きのレンダリングを確認する。
- Chatwork／Google Chat wizardをdesktop／mobile／200%で操作し、neutral／yasashii基準との可視差分0件を記録する。

## External live gate

別directory作成、GitHub repo `mtaiseeei/agentic-secretary` 作成、remote追加／変更、push、public設定、plugin installは、それぞれ実行直前に対象と副作用を示してユーザーへ再確認する。一部だけ許可された場合はその範囲だけ実行し、残りは `external-live-gate-unavailable`。公開releaseはSprint 035まで行わない。
