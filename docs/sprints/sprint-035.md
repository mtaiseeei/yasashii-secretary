# Sprint 035 — 2 edition最終parity・安全・公開gate

- Type: main
- Risk: high（2 repo、実plugin、公開、後始末）
- 主眼: agentic／yasashiiの共通性、差分、系譜、未配布段階から整えた `0.8.0` candidate、安全性、会話可読性を証明し、明示許可された場合だけ公開する。
- 依存: sprint-034 done。Sprint 029〜034のfeedbackが全てpass。

## 外から見える成果

2 editionが対象ユーザーに合わせた完成品として安全に導入・更新でき、互いのworkspaceを壊さない。保守者は公開可否を証拠から判断できる。

## Scope

- 両repoのcommon／edition／archive／official validator suiteを同一の `0.8.0` candidateで実行する。
- Git共通祖先、別repo、fetch専用upstream、overlay冪等性、repo-owned docs、LICENSE／単段クレジットを確認する。
- wizard DOM／copy／OAuth scope／同期／安全ruleのparityと、4面だけのedition差分を確認する。
- neutral／legacy／反対edition／混在／不明、新規0.8.0導入、equal／downgrade副作用0停止を確認する。旧 `0.7.0` raw CHANGELOGは歴史的互換fileとして正本とbyte一致を確認するが、未検証のlive update成功を公開条件にしない。
- 両editionの全会話面に段落・改行・必要なMarkdown箇条書きがあり、Chatwork Secret入力案内が共通で具体的であることを確認する。
- README、mapping、CHANGELOG、manifest、配布ID、version、repository／homepageを最終照合する。
- 許可された場合だけpush、plugin install、公開／releaseを行い、後始末する。

## Non-scope

- edition switching、co-install、反対edition ledger／marker／履歴のmigration。
- 公開gate中の新機能追加、根拠なしの `forkedFrom` 変更。
- same-version bootstrap bridge、公開済み `0.7.0` のin-place差替え、version downgrade／equal update。
- 旧0.7.0利用者向けexternal recovery／bootstrapと、未検証の標準live update互換の主張。

## 受入基準

1. 両repoの全suite、Git archive相当、official validatorが0 FAIL、未実行0件。
2. common parityは完全一致し、edition差分は4面のallowlist内だけ。
3. Git merge-base、agentic別directory／repo、yasashii fetch専用upstream、overlay二回適用同一digestが証拠化される。
4. 旧raw CHANGELOGが正本とbyte一致し、0.7.0の歴史記録が不変で、新規0.8.0導入とequal／downgrade副作用0停止が合格する。旧0.7.0 updaterの既知blockerを対応済みまたはlive互換PASSと誤表示しない。
5. 反対edition、混在、不明は両方向で副作用0件。co-install／切替UI 0件。
6. LICENSE、単段クレジット、README／mapping、version／URL／IDが `0.8.0` candidateで整合。公開済み `0.7.0` の記録・fixture・履歴は不変で、`forkedFrom` はvalidator証拠と一致する。
7. 外部操作は明示許可の範囲だけ。Secret、schedule、OAuth、test選択、不要なsession／test artifactの後始末が完了する。
8. 既知High〜Low、未検証、cleanup残りが0件の場合だけ `ready`。それ以外は理由別に不合格。
9. 同一版 `0.8.0 → 0.8.0` とdowngrade `0.8.0 → 0.7.0` は両editionで副作用0件で停止し、bridge、再導入、更新成功として扱われない。
10. agentic／yasashiiの全会話面がMarkdown可読性を満たし、内容と対象ユーザーの差を維持する。Chatwork wizardは `Name` 欄=`CHATWORK_API_TOKEN`、`Secret` 欄=本人が公式画面で取得したTokenと明示し、実値を製品側へ入力させない。

## 回帰保護

- 両repoのmaster offline／online、edition suite、archive、overlay、新規0.8.0導入、equal／downgrade停止、反対edition、conversation readability、secret／Git／wizard suiteを実行する。
- manifest／CHANGELOG／README／mappingのcross-repo整合と壊したfixtureを検査する。

## 手動・browser証跡

- agentic／yasashiiの4面を同一scenarioで比較し、意図した差分と共通安全情報を記録する。
- 両edition×両wizardをdesktop／mobile／200%で操作し、screenshots、DOM、computed style、focus、44px、OAuth scopeを記録する。
- 新規0.8.0導入、equal／downgrade停止、反対edition停止を会話・実file状態で確認する。旧0.7.0 updater blockerは未解消として正直に区別する。

## External live gate

GitHub repo／remote、push、public設定、release、実plugin install／update、private test workspace、Secret、OAuth、workflow dispatchは、各操作直前に対象・候補commit・副作用・rollback・後始末を示してユーザーへ再確認する。許可不足は `external-live-gate-unavailable`。履歴／test workspaceの削除は別の明示許可が必要。公開後も後始末未完了なら `ready` にしない。
