# Sprint 018 — G8後半 確認後だけ行う安全な更新

- Type: main
- 主眼: Sprint 017の読み取り専用説明を受け、利用者が明示了承した場合だけ、復元地点を作り、カスタマイズを既定で守りながらplugin更新・version別migration・検証・rollbackを安全に行う。
- 依存: sprint-017 done。version整合、CHANGELOG、最小台帳、読み取り専用診断と実更新漏出0件が独立評価で成立していること。

## 外から見える成果

1. 利用者は変更点・影響・衝突可能性・戻し方を理解してから実更新を選べる。
2. 更新直前にpushしないローカルcommitが作られ、失敗時の復元地点が分かる。
3. カスタマイズ済みまたは判定不能なファイルは「現状を残す」が既定で、利用者が選んだものだけ変わる。
4. plugin更新後のreload／restartと再開方法が分かり、migrationはdry-run後だけ実行される。
5. 台帳のない0.2.0利用者も安全側の判定で更新でき、失敗時はpluginとworkspaceを区別して戻せる。

## スコープ

### A. 実更新の開始条件

- Sprint 017の診断結果として、現在版、最新版、変更点、影響、衝突可能性、必要操作、rollback方法を表示した後だけ実更新確認を出す。
- 明示了承前、拒否、キャンセル、最新版未確認、影響判定不能、更新前version不明では変更しない。
- 更新対象、カスタマイズ判定、保護commitの範囲、pushしないことを最終確認に含める。

### B. pushしないローカル保護commit

- 更新直前のworkspaceを復元できるローカルcommitを作り、commit hashと対象を利用者へ示す。pushは行わない。
- secret・資格情報らしきファイル、意図不明の変更、commit不能状態を検出した場合は、勝手に含めたり除外したりせず更新を止めて理由と選択肢を示す。
- 保護commitを安全に作れない場合はplugin更新やmigrationへ進まない。

### C. カスタマイズの個別保護

- 管理対象を `unchanged`、`customized`、`unknown-baseline` に分類する。
- `customized` と `unknown-baseline` は、ファイルごとに「現状を残す（既定）／新版へ置き換える／差分を見る／中止」を選べるようにする。
- 無応答、曖昧な返答、一括確認の失敗を上書き同意とみなさない。私的内容・secretを差分表示やログへ露出しない。

### D. plugin更新・reload／restart

- 明示了承と保護commit成立後だけ、公式のplugin更新経路で対象pluginを更新する。
- 更新前versionを保持し、plugin更新の成功を確認する。失敗時はworkspace migrationへ進まない。
- reload／restartが必要な場合は理由、操作、再開時に伝える言葉、残っている処理を示し、再開後に状態を再確認する。

### E. version別migration

- 対象のfrom／to version、追加・変更・維持するファイルをdry-runで示し、利用者の確認後だけ本実行する。
- dry-runと本実行の対象が一致し、同じmigrationを再実行した時の追加変更は0件とする。
- 利用者が「現状を残す」としたファイル、管理対象外、記憶、会話、成果物、外部データ、Chatwork本文、secret、資格情報を変更しない。
- 台帳無し0.2.0は、既知の0.2.0基準と一致を証明できるファイルだけ未変更とし、それ以外は `unknown-baseline` として既定で残す。bootstrap台帳は確認済み結果だけで作る。

### F. 検証とrollback

- 更新後にplugin version、台帳、選択結果、migration状態、主要導線を検証し、全て成立してから成功を報告する。
- 失敗時はpluginとworkspaceの変更状態を分けて示し、workspaceは更新直前commit、pluginは更新前versionを基準に復元する。
- 自動復元できない範囲は隠さず、コピー可能な手動手順と未復元項目を示す。rollback後もpushしない。

## スコープ外

- 説明・明示確認なしの更新、silent update、全管理ファイルの一括上書き。
- push、自動release、remote変更、履歴書換え、force push。
- 管理対象外ファイル、記憶、会話、成果物、外部データ、secret、資格情報のmigration。
- Chatwork同期設定の変更、一般PJ／別repo開発PJの正本変更。
- Google Chat、OAuth、Google Chat同期・設定画面。

## 受入基準

1. **開始前説明と明示確認（C4/C5/C10）**: 変更点、影響、衝突可能性、対象、保護commit、pushなし、rollbackを示す。了承前、拒否、キャンセル、最新版未確認ではplugin／workspace／Git／設定0変更。
2. **安全な保護commit（C2/C5/C10）**: 更新直前にpushなしのlocal commitが1件作られ、hashと対象が分かる。secret疑い、意図不明変更、commit不能では更新停止し、plugin update／migration 0件。
3. **customized個別選択（C4/C5/C10）**: customized／unknown-baselineをファイルごとに確認し、既定は現状維持。明示選択したファイルだけ変わり、無応答・曖昧回答で上書き0件。
4. **secret非露出（C5/C10）**: syntheticなtoken、password、secret、資格情報、私的本文が台帳、差分表示、ログ、エラー、commit対象へ0件。
5. **plugin更新境界（C2/C3/C10）**: 保護commitと了承後だけ公式経路を実行し、更新前後versionを記録する。plugin更新失敗時のworkspace migrationは0件。
6. **reload／restartと再開（C1/C4）**: 必要性、操作、再開方法、残処理を平易に説明し、再開後にversionと状態を再確認して重複実行しない。
7. **dry-run一致（C2/C3/C10）**: from／to version、追加・変更・維持対象がdry-runと本実行で一致し、確認前のmigration変更0件。
8. **冪等migration（C3/C6/C10）**: clean、customized、部分選択、途中失敗からの再開で、同じmigration再実行時の追加変更0件。管理対象外・現状維持対象への変更0件。
9. **台帳なし0.2.0 bootstrap（C2/C3/C5/C10）**: 既知基準一致だけをunchangedとし、それ以外をunknownとして残す。確認済み結果だけで台帳を作り、私的内容・secretを保存しない。
10. **更新後検証（C1/C3/C6）**: version、台帳、個別選択、migration状態、秘書、記憶、settings、Chatwork、一般PJ、別repo開発PJ、buildの主要導線を検証し、失敗が1件でもあれば成功と報告しない。
11. **rollback（C3/C5/C10）**: plugin更新後、migration途中、検証失敗の各fixtureで、pluginとworkspaceを区別して更新前へ復元できる。自動復元不能時は正確な手動手順と未復元項目を示す。
12. **push 0件（C5/C10）**: 更新、migration、検証、rollbackの全経路でpush、remote変更、force pushが0件。
13. **既存境界と全回帰（C5/C6/C9）**: 配布チャネル非依存、MIT、単段クレジット、`forkedFrom`、記憶保護、single private workspace、Chatwork、PJ境界を維持し、全回帰0 FAIL。
14. **Google Chat漏出0件（C6）**: Google Chat、OAuth、同期、設定画面のskill、script、manifest、wizard、案内の追加が0件。

## 評価証跡

- 承認／拒否／キャンセル／最新版未確認の前後snapshot。
- local保護commitのhash・対象・push 0件と、commit不能時の停止結果。
- unchanged／customized／unknown-baselineの判定とファイル別選択結果。
- synthetic secretの台帳・表示・ログ・commit非露出検査。
- plugin更新前後version、失敗時migration 0件、reload／restart後の再開。
- dry-runと本実行の対象比較、migration初回／再実行／途中再開の差分。
- 台帳なし0.2.0 bootstrapの安全側判定と台帳内容。
- 更新後検証、plugin／workspace別rollback、push／remote変更0件。
- Google Chat漏出0件と全回帰のPASS／FAIL集計。

## 参照

- `docs/spec/features.md` F31
- `docs/spec/constraints.md` 更新の安全境界
- `docs/spec/domain.md` 更新の状態モデル
- `docs/spec/ui.md` 更新の対話導線
- `docs/spec/rubric.md` C1/C2/C3/C4/C5/C6/C9/C10
