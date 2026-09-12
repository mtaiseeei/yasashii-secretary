# Sprint 047 — Astra向け指示監査とYasashii局所適応

- Type: standard
- Risk: medium（共通意味とYasashii固有表現・overlayを同時に保護するため）
- 関連機能: F52、F63

## ゴール

Yasashii `plugins/secretary/` の現在有効な指示を、Astraで過剰停止・誤routing・過剰読込を起こさない形へ局所整理する。Agenticと共通の実行意味を保ちながら、非エンジニア向けの平易な説明、edition固有identity・metadata・repo所有文書、現在の`0.10.3`系譜を維持する。

## 固定前提と許可

- 利用者はAgenticとYasashii両local candidateの監査・修正・offline検証・独立評価を許可している。これはrelease-readyなupstream同期、公開、導入の許可ではない。
- 現在のYasashii source versionは`0.10.3`のままとし、Agentic `0.13.1`、新しいClarity機能、manifest、CHANGELOG、migrationを丸ごと移植しない。固定base SHA、handoff digest、overlay provenanceを作り替えたり、未評価Agentic candidateをaccepted upstreamと表示したりしない。
- 変更したローカル指示fileに対応するconversation／collaboration inventory等のcurrent-content checksumは、現在内容との整合に必要な範囲で更新できる。固定するSHA／digest／provenanceは、過去のaccepted candidate、base、handoff、公開・同期証跡を指し、current-content checksumを古い値のまま残す意味ではない。
- rootのdirtyなguidance／Harness config、installed cache、実利用者workspace、他repoは書き換えない。既存のprivacy、Secret、no-overwrite、external gate、rollbackを維持する。

## 含む変更

1. 既知15項目と追加発見をYasashiiの実sourceへ照合し、`fixed`／`already-correct`／`not-applicable`／`deferred`を理由付きで記録する。各項目はtrigger、現状の結果、正しい結果、source位置、共通／Yasashii所有を追跡できるようにする。
2. 現在依頼とresume、setup／接続済みread／Chatwork・Google Chat保存済み検索、明示された可逆設定・memory、途中失敗、長いread-only作業、条件付きcontext読込、Windows root解決について、Sprint 058と同じ実行意味へ揃える。tool unavailable／未確認を未接続と断定せず、実際の照会をprobeとして重複queryを避け、connectorと独立したlocal TODOは続行する。public版にないprivate専用Skillや機能へroutingしない。
3. Yasashiiの説明は「何が起きているか」「次に必要なこと」を先に示し、過度に技術化・幼児化しない。Agentic向けcopy、identity、repository／marketplace、README、版固有案内で置き換えない。
4. 共通pathを局所修正する場合は、将来の正式overlayが差分を誤認しないよう、対応するanchor／source定義と意味検査を必要範囲で保守する。ただし今回のlocal対応をrecord済みupstream syncとして記録せず、既存base SHA／digest／provenanceを偽更新しない。
5. exact文言の複製ではなく、Skill選択、現在task優先、run-once、partial、進捗、条件付き読込、host互換の意味を検証する。既存のYasashii固有surface保護、path guard、Secret非露出、外部操作前確認のassertは維持する。

## Acceptance Criteria

1. 既知15項目と追加発見がYasashii sourceで全件分類され、未適用・延期・別所有を修正済みと表示しない。
2. 代表instruction scenarioで、現在依頼が古いbookmarkに奪われず、setup／read／saved searchが正しく分かれ、明示された可逆設定・memoryは一度だけ完了する。connector unavailableを未接続と誤表示せず、queryを重ねず、独立したlocal処理を続ける。長いread-only作業には必要な進捗があり、途中失敗は副作用に一致する`partial`／`error`となる。
3. 共通の安全・実行意味とYasashii固有の平易な体験がともに保たれ、private専用機能、新Clarity機能、Agentic版固有値の流入が0件である。
4. overlayのanchor／source検査が局所変更後も正直に成立し、既存base SHA／digest／provenanceは不変である。正式upstream同期・反映済み・release-readyの表示を行わない。
5. 影響を受けた静的／runtime検査と現実的な会話fixtureがofflineで0 FAILとなり、Yasashii固有surfaceと既存安全assertが保持される。独立EvaluatorはAgenticのPASSを流用せずYasashii candidate自体を評価する。

## 検証スコープ（着手時に固定）

- 対象: Yasashii `plugins/secretary/` のSkills、rules／copy、commands／hooks、templates／adapters、overlay anchor／source定義、関連する既存検査。root guidance、installed cache、他repoはread-only比較対象とする。
- 必須シナリオ: 現在依頼とresume、setup／read／saved search、connector unavailableとlocal TODOの分離、可逆設定、明示memory、途中失敗、read-only進捗、Windows root解決、Agentic流入拒否、Yasashii表現保持。
- 証拠形式: 監査表、変更pathと因果、実command／exit／件数、scenarioのroute・副作用・応答状態、保護surfaceとprovenanceのbefore／after一致。新しいcollector、attestation、browser UI、live外部writeは要求しない。

## Non-scope

- 新機能、UI、Clarity機能の追加、runtime framework・migration・versionの変更。
- release-ready upstream同期、過去のaccepted candidate／base／handoffに属するSHA・digest・provenanceの更新、private版・installed cache・実workspaceへの反映。
- commit、stage、push、PR、tag、Release、plugin install、API／OAuth／connector write。

## 完了条件

Yasashii固有の局所修正と比例したoffline回帰が揃い、fresh独立Evaluatorがこのcandidateを独立にPASSし、Orchestratorがstateへ結果を記録した場合だけ完了する。
