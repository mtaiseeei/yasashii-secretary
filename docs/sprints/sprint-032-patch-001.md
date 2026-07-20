# Sprint 032 Patch 001 — 全会話のMarkdown可読性とChatwork Secret入力案内

- Type: regular patch
- Risk: medium（全ユーザー会話面、共通wizard copy、両edition継承）
- 主眼: Repo分割前の共通正本で、全ユーザー会話を過不足ない改行・段落・箇条書きで読みやすくし、ChatworkのGitHub Actions Secret登録画面で入力先を迷わない案内にする。
- 依存: sprint-032 done。sprint-033のagentic別directory／別repo作成より前に完了する。

## ユーザー決定

- 改行とMarkdownによる可読性は既定かつ必須であり、ユーザーの好みとして質問しない。
- 複数の情報を改行なしの平文へ詰め込まない。過剰な見出し・箇条書き・装飾も避け、情報構造に応じて必要な分だけ使う。
- yasashii／agenticの思想、対象ユーザー、正式名称の出し方、4つのedition可変面は変えない。
- agentic repoは未作成のため、共通正本へ先に実装し、後のRepo分割で両editionへ継承する。
- Chatwork wizardでは、GitHub ActionsのSecret追加画面を開いた後、`Name` と `Secret` の各欄に何を入れるかを具体的に示す。Token実値をwizardや会話へ貼らせない安全境界は維持する。

## 外から見える成果

利用者は、秘書との会話、診断、確認、進行、結果、エラー、handoffを、段落と箇条書きのある自然なMarkdownとして読める。ChatworkのSecret登録では、GitHub画面の2つの欄へ何を入力するか迷わない。

## Scope

- `plugins/secretary/` のskills、rules、templates、commands相当、edition copy、会話用文例、handoff、エラー／進行／完了案内を全体調査する。
- 「改行しない」「1行にまとめる」「平文で返す」「箇条書きを使わない」等、複数要素を一続きの文章にするユーザー向け指示を是正する。
- 1要点だけの短い確認は1段落でよい。複数の手順、選択肢、変更点、結果、エラー原因、次の行動は、空行で分けた段落またはMarkdown箇条書きにする。
- 既定3行報告は、3つの意味を物理的にも別行または3項目で表示する。3行分を1行へ連結しない。
- agenticは結論・正式名称・証拠を早めに、yasashiiは何が起きたか・影響・次にすることを先に示す既存差を維持し、両方へ同じ可読性の最低基準を適用する。
- Chatwork wizardのSecret登録stepで、GitHub画面の `Name` 欄は `CHATWORK_API_TOKEN`、`Secret` 欄は利用者本人がChatwork公式画面で取得したAPI Tokenを入力する、と明示する。
- `Secret` 欄の値はGitHub画面へだけ入力し、wizard、AI会話、repo、ログへ貼らないことを、入力例や実値をDOMへ出さず説明する。

## Non-scope

- yasashii／agenticの対象ユーザー、思想、語彙の深さ、診断順序、報告内容、developer handoff情報量の同一化。
- Chatwork／Google Chat wizardのflow、DOM骨格、OAuth scope、同期、安全動作、CTA色の変更。
- Tokenの取得、受領、自動登録、表示、検証をwizardへ追加すること。
- 内部データの1行record、commit message、index、machine-readable出力まで複数行に変えること。可読性要件はユーザー向け会話出力を対象にし、機械契約を壊さない。
- agentic別directory／repo作成、remote変更、push、公開。

## 受け入れ基準

1. ユーザー向け会話を形作るrules、skills、templates、commands、edition copy、handoffを対象にしたinventoryがあり、改行禁止・一行圧縮・平文強制の指示が0件になる。内部record等の対象外は理由つきで分類される。
2. 会話、診断、確認、進行、成功、部分失敗、エラー、検索結果、更新、プロジェクト、各接続案内、developer handoffの代表scenarioで、複数要素が段落またはMarkdown箇条書きに分かれ、改行なしの長い平文が0件である。
3. 既定3行報告は3つの意味が別行または別項目で表示される。短い1要点を不必要に箇条書き化せず、過剰な見出し、1文ごとのbullet、装飾目的のMarkdownを増やさない。
4. agentic／yasashiiの同一scenario比較で、思想・対象・4面のedition差分が維持され、変わるのは共通の可読性基準だけである。
5. ユーザー設定に改行有無を追加せず、既存preferencesの口調・専門用語・報告詳しさを変えても、複数要素の改行・段落・箇条書き最低基準を無効にできない。
6. Chatwork wizardのSecret登録stepで、画面を開いた後の入力が次のように明示される。
   - `Name` 欄: `CHATWORK_API_TOKEN`
   - `Secret` 欄: Chatwork公式画面で利用者本人が取得したAPI Token
7. Token実値をwizard／会話へ貼る指示、Token入力欄、サンプルToken、DOM／ログ／fixture／screenshotへの実値出力が0件で、GitHub Repository Secret画面への本人直接入力を維持する。
8. Chatwork／Google Chat wizardのflow、DOM骨格、OAuth scope、同期、安全ruleは無回帰。両wizardの共通性とedition parityを壊さない。
9. common master、archive、edition、copy、wizard、secret安全の全必須回帰が0 FAILである。

## 回帰保護

- 会話surface inventoryと禁止指示scanを配布対象で実行し、負fixtureとして一行圧縮指示を再混入させると失敗することを確認する。
- 同じ複数要素scenarioをagentic／yasashiiで実行し、Markdown構造とedition固有の内容を別々に検査する。文面の全文一致だけを合格根拠にしない。
- Chatwork Secret案内は、`Name`／`Secret`ラベルと値の意味を検査し、Token実値や入力例のfixture混入を拒否する。
- Sprint 029〜032、master、archive、Chatwork／Google Chat wizard、secret／Git安全suiteを実行する。

## 手動・browser証跡

- agentic／yasashiiの代表会話を、短い確認、複数手順、診断、部分失敗、完了、handoffで比較し、レンダリング後の改行・段落・箇条書きと内容差を記録する。
- Chatwork wizardをdesktop／mobile／200%で操作し、Secret登録stepで `Name` と `Secret` の入力先、GitHub画面だけへ入力する安全案内、focus、44px、overflowを確認する。
- Google Chat wizardはcopy・flow無変更とresponsive／accessibility無回帰を確認する。

## External live gate

実Token、Repository Secret、Actions、OAuth、API、remote、pushは不要。合成の非機密placeholderとlocal browser fixtureだけを使う。外部操作が必要になった場合は、対象と副作用を示してユーザーの新しい明示許可を得るまで実行しない。
