- 朝は`_resume.md`の中断点、journalの`next`、未完TODOを分けて確認する。日中は外部予定・タスクとTODOを
  根拠つきで突き合わせ、夕方は当日のtimeline、決定、未完TODO、申し送りを確認する。
- canonical rootから安全に必要な原本を取得済みなら、日次・週次・timelineの整理やPJ昇格理由をLLMがその内容から組み立てる。
  `timeline` / `weekly` / `promotion-status` は任意のread-only helperであり、期間抽出・大量記録・再現可能な診断が必要な場合だけ使う。
  安全境界で拒否された対象を直接Readで迂回せず、保存・削除・reindex・Git・昇格は既存の決定的シームと確認を保つ。
- 朝・日中・夕方のモードに入っただけではjournalへ追記しない。成功した正規シームの事実だけを1回記録し、二重追記しない。

<!-- yasashii-secretary:update-safety:v1:start -->
