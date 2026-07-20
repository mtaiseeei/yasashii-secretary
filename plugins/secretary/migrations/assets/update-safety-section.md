<!-- yasashii-secretary:update-safety:v1:start -->
## プラグインを更新するとき

- 最初の更新診断は読むだけで行い、現在版・最新版・変更点・影響を確認する。
- 実更新は、対象・カスタマイズ・pushしない保護commit・戻し方を確認した後だけ行う。
- 変更済みまたは判定できないファイルは「現状を残す」を既定にし、無回答を上書きの了承とみなさない。
- migrationはdry-run（変更予定の確認）を先に行い、成功確認前にpushしない。
<!-- yasashii-secretary:update-safety:v1:end -->
