// 負fixture: 系列の欠番（接続 2 / 3 が存在しない）を拒否する。
progress(0);
show("a", '<p class="eyebrow">接続 1 / 3</p><h1>接続します。</h1>');
progress(0);
show("b", '<p class="eyebrow">接続 3 / 3</p><h1>確認します。</h1>');
