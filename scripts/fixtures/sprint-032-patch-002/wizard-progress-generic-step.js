// 負fixture: フェーズ名のない汎用「STEP」系列は、接続フェーズとの後戻りを曖昧にするため拒否する。
progress(0);
show("a", '<p class="eyebrow">接続 1 / 1</p><h1>接続します。</h1>');
progress(1);
show("b", '<p class="eyebrow">STEP 1 / 1</p><h1>選びます。</h1>');
