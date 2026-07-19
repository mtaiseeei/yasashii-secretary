export function cleanupDescription(cleanup, { networkFailure = false } = {}) {
  if (networkFailure || !cleanup) return {
    kind: "manual",
    text: "接続情報を自動で消せたか確認できませんでした。管理者に確認を依頼してください。",
    technical: "GitHubのRepository SecretsとGoogleのアプリ権限を手動で確認してください。",
  };
  if (!cleanup.hadConnection) return { kind: "none", text: "接続前だったため、設定や接続情報は変更していません。", technical: "Repository SecretやGoogle OAuth grantは作成していません。" };
  if (!cleanup.manualCheckRequired && cleanup.secretsDeleted && cleanup.grantRevoked) return {
    kind: "success",
    text: "作成した接続情報を削除してから終了しました。",
    technical: "Repository Secretを削除し、Google OAuth grant／tokenを取り消しました。",
  };
  const missing = [];
  if (!cleanup.secretsDeleted) {
    const names = (cleanup.remainingSecretNames || []).join("、") || "Google Chat用Repository Secret";
    missing.push(`GitHubのRepository Secret（${names}）`);
  }
  if (!cleanup.grantRevoked) missing.push("GoogleのOAuth grant／token");
  return { kind: "manual", retryable: cleanup.retryable === true, text: "接続情報の一部を自動で消せませんでした。後始末をもう一度お試しください。", technical: `${missing.join(" と ")}が残っています。再試行しても完了しない場合は、上記の残っている対象だけを手動で削除してください。` };
}
