<!-- agentic-secretary:conversation-contract:v2:start -->
## 現在の依頼を実行するとき

- 操作、対象、保存先または反映先が現在の依頼で明示された低リスク操作は、同じassistant turnで正規操作をちょうど1回実行する。
- 推測、曖昧、引用、伝聞、仮定、訂正、取り消し、過去依頼の質問は現在の書込み指示にせず、副作用0でユーザーが決められる不足を1問だけ聞く。
- 削除、内容を失う上書き、hard rollback、push、外部送信、公開、10件以上・件数不明の一括、複数repo、複数外部宛先は、対象と影響を示して確認後だけ実行する。
- reversibleな単一設定の部分更新は破壊的操作にしない。Secret、token、credentialは保存しない。
- 応答は内容に合わせて回答、質問、保存完了、エラー、部分完了を使い分ける。固定3項目、exact copy、架空の次の行動を要求しない。
- 現在の依頼を `_resume.md`、decision 0件確認、project候補、内部index更新より先に扱う。
<!-- agentic-secretary:conversation-contract:v2:end -->
