# Sprint 045 — Sprint 055／Stop Hook修正のYasashii 0.13.0差分適応

- Type: standard
- Risk: high（Yasashii overlayと配布candidateを扱う）
- Candidate version: `0.13.0`
- 開始HEAD: `b80f5da4b173ec2e3b1c6404e21b29f7d99240c5`
- 依存: public Sprint 056のAgentic Phase Aとprivate Sprint 052をfresh独立EvaluatorがそれぞれPASSした固定candidate。

## ゴール

publicで受入・固定されたF85〜F87とStop Hook authorization修正をYasashiiへ差分適応し、やさしい会話copyとoverlay所有物を保った`0.13.0` source candidateを独立評価する。公開、tag、Release、このMacへのprivate版導入はpublic Sprint 056のPhase Bへ集約し、本Sprintでは行わない。

## 固定入力と境界

- Orchestratorがpublic Phase A PASSの完全SHA／tree、共通path、変更digestと、private Sprint 052 PASSを開始時に固定する。一方の未達、PASS前、candidate不一致では製品writeを開始しない。
- 開始時のYasashii CLI／core／projection／Hookはpublicとbyte一致し、Skillにはedition差分がある。この関係を保持し、public fileの盲目的copyでSkillやoverlayを壊さない。
- 利用者は必要な候補commit／通常pushと後段の三版公開を承認済みである。同じ許可を再質問しない。main統合／tag／Release／導入は本Sprintの担当外である。

## 含む変更

1. F85〜F87の選択source要件候補、Validationと件数の正直な表示、履歴を保つ自然言語訂正をYasashiiの表現とoverlay境界へ差分適応する。
2. Hook／tool／引用は新しい承認を作らず、既存承認は対象・操作・範囲・文脈内だけで継承する修正を、Yasashii Skillのedition差分を保って適応する。
3. current manifest／marketplace、正本・互換CHANGELOG、release inventory、README／更新案内、既存のcurrent-version検査を`0.13.0`へ必要最小限揃える。旧release履歴は変えない。
4. public固定内容との共通意味、Yasashii adapted path、protected pathを固定し、専用小回帰と既存の小さいedition／release／archive入口で検証する。

## Acceptance Criteria

1. public Phase Aとprivate Sprint 052のexact PASS receiptを入力にし、Yasashii開始差分への適応関係を説明できる。一版のPASSをYasashii PASSへ流用しない。
2. F85〜F87とStop Hook authorization境界がYasashii candidateに存在し、Sprint 055／Patch 001相当の小規模直接回帰が0 FAILである。
3. CLI／core／projection／Hookの共通意味と、Skillのedition差分、会話copy、identity、README／LICENSE／mapping、overlay、repo固有spec／state／progress／feedback／evidence／release判断を保持し、未分類変更とprivate値混入が0件である。
4. version／manifest／marketplace／CHANGELOG／inventory／案内／Git-free archiveが`0.13.0`で一致し、`0.12.0`以前のtag、artifact、fixture、履歴を変更しない。
5. 構文、変更した直接回帰、必要最小のYasashii保護検査、release integrity、既存の小さいarchive gateが0 FAILである。version／hash pinは今回の差分に直接因果するものだけ更新する。
6. private my-vault固有path／値／Notion／vault routing、実利用者データ、SecretのYasashii source／log／証拠混入が0件である。
7. fresh独立Evaluatorがexact Yasashii candidateを判定し、public／private PASSやGenerator自己評価をYasashii PASSへ流用しない。

## 検証スコープ（着手時に固定）

- 必須: public／private fixed receipt照合、Sprint 055／Patch 001相当の小規模直接回帰、変更したedition境界の代表case、構文、release integrity、既存の小さいGit-free archive gate、protected surfaceの前後照合。
- 証拠: 開始HEAD、入力receipt、candidate SHA／tree、変更pathと分類、protected digestまたは同等snapshot、実command／exit code／件数、archive内metadata。
- full Sprint 044／050、64 actor、Windows native、全Yasashii suite、新runner／CI／collector／attestationは対象外。OS固有製品コード変更が必要ならscope changeとして停止する。

## 完了条件

fixed Yasashii candidateと小規模証拠をGeneratorがprogressへ記録し、fresh独立Evaluatorが本契約と既存rubricのC1／C2／C5／C6／C10／C12／C13／C14／C15／C25の該当面をPASSした後だけ、Orchestratorはpublic Sprint 056のPhase Bへ進める。
