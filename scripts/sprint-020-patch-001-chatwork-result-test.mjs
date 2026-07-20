#!/usr/bin/env node

import { chatworkInitialResultModel } from "../plugins/secretary/skills/chatwork/assets/wizard/result-model.js";

let passed = 0;
let failed = 0;
function check(name, condition) {
  if (condition) { passed += 1; process.stdout.write(`  PASS ${name}\n`); }
  else { failed += 1; process.stdout.write(`  FAIL ${name}\n`); }
}

const adversarial = {
  status: "partial",
  results: [
    { roomId: "101", roomName: "営業チーム", status: "success", fetched: 0 },
    { roomId: "102", roomName: "商品開発", status: "success", fetched: 1 },
    { roomId: "999", roomName: "未選択の混入結果", status: "failed", fetched: 500, message: "表示してはいけない" },
  ],
};
const selected101 = chatworkInitialResultModel({ sync: adversarial, selectedRoomIds: ["101"], dispatchStatus: "fixture" });
const selected102 = chatworkInitialResultModel({ sync: adversarial, selectedRoomIds: ["102"], dispatchStatus: "fixture" });
check("101選択時は101だけを表示", selected101.results.length === 1 && selected101.results[0].roomId === "101" && selected101.hiddenResultCount === 2);
check("101選択時の0件判定は101だけに基づく", selected101.status === "empty" && selected101.totalFetched === 0);
check("102選択時は102だけを表示", selected102.results.length === 1 && selected102.results[0].roomId === "102" && selected102.hiddenResultCount === 2);
check("102選択時の件数は102だけに基づく", selected102.status === "success" && selected102.totalFetched === 1);

const partial = chatworkInitialResultModel({ sync: { results: [
  { roomId: "101", status: "success", fetched: 2 },
  { roomId: "102", status: "failed", fetched: 900 },
] }, selectedRoomIds: ["101", "102"], dispatchStatus: "fixture" });
check("選択roomの部分失敗を区別", partial.status === "partial" && partial.totalFetched === 2 && partial.results.length === 2);

const allFailed = chatworkInitialResultModel({ sync: { results: [
  { roomId: "101", status: "failed", fetched: 100 },
  { roomId: "102", status: "failed", fetched: 200 },
] }, selectedRoomIds: ["101", "102"], dispatchStatus: "fixture" });
check("選択roomの全失敗を区別し件数を0にする", allFailed.status === "failed" && allFailed.totalFetched === 0);

const unselectedFailure = chatworkInitialResultModel({ sync: { results: [
  { roomId: "101", status: "success", fetched: 0 },
  { roomId: "102", status: "failed", fetched: 99 },
] }, selectedRoomIds: ["101"], dispatchStatus: "fixture" });
check("未選択roomの失敗で選択roomの成功表示を変えない", unselectedFailure.status === "empty" && unselectedFailure.results.length === 1);

process.stdout.write(`SPRINT020_PATCH001_CHATWORK_RESULT_PASS=${passed} SPRINT020_PATCH001_CHATWORK_RESULT_FAIL=${failed}\n`);
process.exit(failed === 0 ? 0 : 1);
