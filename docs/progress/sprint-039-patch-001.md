# Sprint 039 Patch 001 — Generator handoff

**状態:** 固定Agentic入力からの20 path overlay、既存`0.10.0` workspace完全migration、`0.10.1` candidate、clean checkout／Git-free archive／archive masterの検証まで完了。fresh独立Evaluator待ち。

## 固定入力と候補

- Yasashii開始HEAD: `a3e2ba37cf28ede32920db46ceecfb2924faf02f`
- accepted upstream candidate HEAD: `ba4fe4de39df483b984fef5045bb1e21fdde1373`
- Agentic product commit: `3ef792819a4a445df089f70aa74ca09176762e5e`
- 入力形: 上記2 commitをそれぞれ`git archive`で展開したread-onlyのGit-free tree
- handoff common digest: `a7d74a7a9bb42ea67815a75132acf588fe312314f98b7f9685cef97fdfca59c9`
- product／test commit: `7b840e36554d9ca8e37806ebc19770db3a86ac19`
- 最終product／test candidate: `372791fdcd99eb5deb42199a97257ff53b63612e`

後続のAgentic docs-only commit、moving checkout、dirty treeへ固定入力を読み替えていない。Agenticのspec、Sprint、progress、feedback、state、release記録は同期していない。

## 実装したこと

- Plugin更新後の新session、Plugin更新済み、ローカルidentity migration済みを別状態として扱うhandoffを`secretary`／`update`／`name` Skillsへ同期した。
- 既存workspaceをread-only診断し、identity未導入、`0.10.0` identity-only、`0.10.0` markerなしidentity節、`0.10.1`完全適用、衝突を区別するmigration coreを追加した。
- 英語名の確認とmigration apply確認を分離した。previewは対象4 path、追加／更新／維持／衝突、checkpoint、rollback、非対象を示し、確認前はwrite 0である。
- applyは次の4 pathだけを一transactionで`0.10.1`新規導入相当へ揃える。
  - `secretary/identity.json`
  - `secretary/AGENTS.md`の製品所有identity管理節
  - `secretary/CLAUDE.md`の製品所有identity管理節
  - `.secretary/update-ledger.json`のidentity関連record
- display name、stable ID、`ai-secretary`種別、created time、aliasesを保持する。AGENTS／CLAUDEは一意なmarker間だけを構造更新し、利用者本文、他managed block、周辺byte、改行、modeを保持する。
- 最小台帳にはpath、適用version、基準hash等だけを保存し、秘書名、stable ID、利用者本文、顧客名、記憶、Secretを保存しない。
- 正確なcanonical Git rootで今回の所有pathだけを1 local checkpointへ含める。開始前のstage／unstaged／untracked、対象外path、remote／branch／tagを保持し、push／fetchを行わない。
- file write、整合確認、ledger、stage、commit、post-commitの失敗でfile、HEAD、index、working treeを開始前へ戻す。failure後retryは1 checkpointで成功し、成功後rerunはfile差分、marker／ledger重複、stable ID変化、追加commitを0にする。
- target dirty、親Git root、nested別repo、Git-free target、edition不一致、symlink、read-only、marker／ledger重複、利用者編集衝突はwrite 0で停止する。
- user-scope registry／routingはmigrationへ含めず、別repo routingは完了後の別確認のまま維持した。
- Claude／Codex manifest、marketplace、正本／旧raw CHANGELOG、READMEの許可段落、current release gateを`0.10.1`へ揃えた。

## Overlay結果

- upstream snapshot: 725 files
- managed: 278 files
- handoff inventory: 20 paths
- byte parity: 16 paths
- 宣言anchor: 4 paths（`name`／`secretary`／`settings`／`update` Skills）
- 未分類: 0
- 最終check: PASS
- 最終reapply: `secondChanged=0`
- handoff digest: `a7d74a7a9bb42ea67815a75132acf588fe312314f98b7f9685cef97fdfca59c9`
- product／test candidate時点のrepo-owned digest: `abd87a3ac20d326e0e8f8a076a85cf668c8f0f04005aabdd3d8ce48f49e357bc`。本progressはrepo-owned正本のため、handoff commit後の値は意図どおり変わる。
- overlay definition digest: `bddbe3b5d3bc14385bdebbfe89f64fdd3cc12672c49da765ccd28219f21c8b1d`
- reapply digest: `461b3ab0727d22a784ac07c1bf6ffb6160a8532c3b42fc5149c5ab894ab09a02`

overlay apply後に現行Yasashii正本を参照していないhistorical testをarchive masterが検出した。5 test fileのedition固有差分はcommonのまま黙って変更せず、`anchors.json`と`mapping.json`へ正式anchorとして宣言し、固定Agentic archiveからの再適用で同じbytesを一意に生成できるようにした。

## 保護surface

開始HEADと最終candidateを比較し、次を確認した。

- `LICENSE`、repo root `AGENTS.md`／`CLAUDE.md`、`edition.json`、Yasashii copy／style、rule manifestは全byte不変。
- Claude marketplaceはversion以外のidentity、repository、author、license、sourceが不変。
- READMEは「現在のmanifest candidate」で始まる製品所有1段落だけを更新し、同段落以外の正規化SHA-256は開始HEADと一致した。
- 正本／旧raw CHANGELOGの`0.10.0`以前は開始HEADとbyte一致した。
- Agentic docs／state／release記録の同期は0件。

主なdigest:

- LICENSE: `b6d97ac224e82462221382f7af3c40051489be2312daf6e706c5a5ad15c13ec9`
- Yasashii copy: `46bd8eee125924305be5aaf1c4f345190bea53b31680d170dedf67716bbffab4`
- Yasashii style: `50c9df0ff79fb43d5e051eb0c42070e31393b210a7fb78076c6e7e6996b1699c`
- edition: `663c14cc51b92a936a1dbaf34d5ab4f7ded65f20d57ad0ed645dfd3e8d9bf7b7`
- README許可段落をsentinel化したdigest: `d56daf6f2c418481b0808d178846a8c442108a2580ba483d13544c15857c0002`
- `0.10.0`以前のCHANGELOG digest: `3fab1c9067352a083c0467736e9560e62fac3e503753b955eecc99743d69b0ca`

README許可段落には、`0.10.1` current、Plugin更新とローカルmigrationの分離、新session、read-only preview、migrationの別確認、任意のuser-scope routingをすべて残した。

## 回帰追加とtest追随

`scripts/sprint-039-patch-001-migration-test.mjs`へ23 caseを追加した。主な検査は次のとおり。

- 固定`0.9.2`／`0.10.0`状態とcurrent templateの区別。
- identity未導入、identity-only、legacy markerなし節、current、衝突の診断。
- 不適格名、確認拒否、previewのread-only、4所有pathの1 checkpoint。
- stable identity、CRLF、mode、利用者本文、他block、無関係ledger recordの保持。
- file 1〜4、ledger、consistency、stage、commit、post-commit failureの完全rollback。
- failure後retry、成功後rerun、完全適用済みrerun。
- marker／ledger重複、利用者編集、反対edition、symlink、read-only、target dirty、親／nested Git root、Git-free、未知failure pointの副作用0停止。

archive master初回は、開始HEADから存在したYasashii test期待値ずれを7 suite、10 assertionsで再現した。開始HEAD `a3e2ba3`の同じ7 suiteは次の内訳だった。

- Sprint 010: 55 PASS / 1 FAIL
- Sprint 027: 4 PASS / 1 FAIL
- Sprint 029: 2 PASS / 2 FAIL
- Sprint 030: 6 PASS / 1 FAIL
- Sprint 031: 6 PASS / 1 FAIL
- Sprint 032 Patch 001: 6 PASS / 1 FAIL
- Sprint 032 Patch 002: 7 PASS / 1 FAIL

追随内容はAgentic copy／styleを見ていたtestをYasashii active copy／styleへ切替え、Yasashii CHANGELOG URL、legacy state、READMEに実在する同義の安全文言を検査するようにしたもの。次は維持しており、製品意味、安全境界、history期待を緩和していない。

- 内容依存の5応答状態と旧`shortLines`不在。
- Google ChatのCloud準備、read-only scope、通常スペース限定、commit／pushの同意境界、初回取得と自動取得の一体設定。
- 正本／旧raw CHANGELOG byte一致とcurrent version一致。
- legacy Yasashiiを反対editionと誤判定しないedition guard。
- Sprint 029 historical fixed-shape fixtureそのものは未変更。

追随後は7 suiteがそれぞれ0 FAILとなり、最終archive master全体も0 FAILになった。残るhistorical failureは0件である。

## 最終実行結果

最終candidate `372791fdcd99eb5deb42199a97257ff53b63612e`から、隔離clean checkoutと同一bytesのGit-free archiveを新しく作成した。

- clean checkout overlay check／reapply: PASS、20=16+4、`secondChanged=0`、overlay専用6/0。
- Git-free archive overlay check／reapply: PASS、20=16+4、`secondChanged=0`、overlay専用6/0、`.git`なし。
- clean checkout `bash scripts/sprint-039-patch-001-regression.sh`: wrapper 10 PASS / 0 FAIL。
- Git-free archiveの同wrapper: 10 PASS / 0 FAIL。
- migration専用: 23 PASS / 0 FAIL。
- rename checkpoint: 16 PASS / 0 FAIL。
- Sprint 039: 69 PASS / 0 FAIL、wrapper 7/0。
- Git safety／secret scan: 71 PASS / 0 FAIL。
- Sprint 035: 15 PASS / 0 FAIL。
- report schema: 正式21 surfaces、1 PASS / 0 FAIL。
- release integrity: 正式16 Skills＋same-count unknown negative、2 PASS / 0 FAIL。
- `git diff --check`: PASS。
- clean checkoutはoverlay再適用と回帰後もGit差分0。

Git-free archive master:

- mode: `archive`
- status: PASS
- suites: 25
- required: 17
- passed: 17
- failed: 0
- verification-infra: 0
- assertions: 308 PASS / 0 FAIL
- archive checks: PASS

archive masterのlive conversation gateは製品合否と分離された既存`incomplete`表示であり、このPatchのrequired suite／assertionには含まれない。UI追加はないためbrowser、URL、screenshotはnot applicable。

## OSとnot-run

- 実行OS: macOS Darwin arm64
- Node.js: `v22.23.2`
- 既存Windows保存互換test: Darwinで12 PASS / 0 FAIL
- Windows native: **not-run**。Darwin結果をWindows PASSへ昇格していない。
- 実HOME、実利用者workspace、installed cache、private版、Mac mini、remote、external service、Secret、Actions、OAuth、実API、tag、GitHub Release、marketplace公開、plugin install／update: **not-run／write 0**。
- local source repoではproduct／test commitと本progressのhandoff commitだけを作成した。その他のGit操作は`/tmp`の隔離fixture、clean checkout、Git-free archiveだけで実行し、pushは行っていない。

## Evaluator handoff

常駐appはないためstartup command、test URLは該当なし。fresh Evaluatorは最終product／test candidate `372791fdcd99eb5deb42199a97257ff53b63612e`を固定し、次を確認する。

1. 固定Agentic archiveでoverlay check／reapply、20=16+4、handoff digest、`secondChanged=0`を確認する。
2. `0.10.0`の4状態をread-only診断し、名前確認とmigration確認が分離されることを確認する。
3. 4所有pathの一体移行、stable identity／AI author参照、利用者本文／改行／mode／無関係record保持を確認する。
4. checkpointの所有path限定、開始前Git状態保持、failure matrixの完全rollback、retry／rerunを確認する。
5. user-scope routingが不変で、別確認のままであることを確認する。
6. README許可段落、`0.10.1`配布面、`0.10.0`以前の履歴bytes、Yasashii protected surfaceを開始HEADと比較する。
7. clean checkout／Git-free archiveでPatch wrapperとarchive masterを再実行する。

Generator自己評価のproduct findingは0件。release、Mac mini同期、受講者向け文面は3版のfresh独立PASS後の別工程であり、本Generatorは実行・完了表示していない。
