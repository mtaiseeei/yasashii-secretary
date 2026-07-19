# Sprint 024 — 0.7.0データ保護: 履歴markerとActions runの因果整合

- Type: main
- Risk: high（チャット履歴欠落、誤runによるcommit・push）
- 主眼: 非信頼のGoogle Chat本文で履歴構造を壊さず、Chatwork／Google Chatが今回dispatchしたActions runだけを追跡する。
- 依存: sprint-023 done。OAuth sessionとloopback保護が成立していること。

## 外から見える成果

1. メッセージ本文にMarkdownや内部markerらしい文字列があっても、前後の履歴を失わず検索できる。
2. 設定直後に古い成功runが残っていても、今回の処理が成功したように見せない。
3. 今回runを確認できない場合はtimeout／未確認として安全に止まる。

## スコープ

- Google Chatの日付別Markdownに保存する本文、発言者、添付メタデータを非信頼入力として扱う。
- 初回、差分、同日複数回、thread、編集・削除、部分失敗の履歴統合を守る。
- Chatwork／Google Chatのdiscovery、初回取得、設定変更、手動再取得のrun相関を統一する。

## 非ゴール

- 保存形式をMarkdown以外へ変更しない。
- workflow providerやGitHub Actionsを別基盤へ置き換えない。
- 取得対象、scope、room／space選択仕様を広げない。

## 受入基準

1. **marker本文（C3/C5/C11/C12）**: 内部開始／終了marker、HTML comment、見出し、区切り線を本文へ含む複数messageで、全messageが1回ずつ保存・検索できる。
2. **表示名・添付名（C3/C5）**: 発言者名と添付名に同じ敵対文字列があってもblock境界を変更しない。
3. **既存履歴保持（C6/C11）**: 敵対messageの前後、同日既存投稿、thread、削除metadataが欠落・結合・上書きされない。
4. **冪等再取得（C3/C6）**: 初回＋同条件再実行＋差分でmessage resource name単位の重複0件、byte上の不要な増殖0件。
5. **Chatwork run相関（C3/C5/C12）**: dispatch前run、時刻欠落／不正、別workflow／branch、失敗run＋古い成功runを採用しない。
6. **Google Chat run相関（C3/C5/C11）**: discovery、初回、設定変更、検索再取得で今回dispatchに対応するrunだけを採用する。
7. **未確認停止（C4/C5）**: 対応runを確認できない場合はtimeout／未確認を示し、pull、検索、成功表示へ進まない。
8. **失敗優先（C5）**: 今回runが失敗した場合、別の古い成功runへfallbackせず失敗理由と次の操作を示す。
9. **live資産非露出（C5/C11）**: run相関の証跡にSecret値、room／space本文、OAuth URLが0件。
10. **全回帰（C6）**: Chatwork／Google Chat専用、全offline／online回帰0 FAIL。

## 評価証跡

- 敵対文字列入りfixtureのmessage一覧、生成file、検索結果、再実行差分。
- run一覧fixtureのdispatch時刻／workflow／branch／IDと採用・拒否理由。
- timeout、今回失敗、今回成功のevent順とpull／検索有無。
