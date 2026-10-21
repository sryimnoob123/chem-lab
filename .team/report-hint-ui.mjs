/**
 * 报告页「提示 k 次（−X 分）」渲染验收（Playwright）：
 *   登录 → 开 run → 上报 L1/L2 两次提示 → 交卷 → 打开报告页读文案。
 * 期望：操作分说明里出现「提示 2 次（−4 分）」（1+3=4）。
 */
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3001";

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

const errors = [];
page.on("pageerror", (error) => errors.push(String(error)));

// 1. 登录：直接打 API（比在登录页找按钮稳），cookie 会进 context
const login = await page.request.post(`${BASE}/api/session`, {
  headers: { "content-type": "application/json" },
  data: { studentNo: "20250101", name: "周若曦" },
});
if (!login.ok()) throw new Error(`登录失败: ${login.status()}`);

// 2. 直接用 API 造一个带提示的 run（比点 UI 稳）
const opened = await page.request.post(`${BASE}/api/runs`, {
  headers: { "content-type": "application/json" },
  data: { experimentId: "exp01" },
});
const { runId } = await opened.json();

for (const level of [0, 1]) {
  await page.request.post(`${BASE}/api/runs/${runId}/events`, {
    headers: { "content-type": "application/json" },
    data: { kind: "hint", hint: { stepIndex: 0, level } },
  });
}

const finished = await page.request.post(`${BASE}/api/runs/${runId}/finish`);
const scores = (await finished.json())?.scores ?? {};

// 3. 打开报告页
await page.goto(`${BASE}/exp/exp01/report?run=${runId}`, { waitUntil: "networkidle" });
const text = await page.locator("body").innerText();

const hintLine = text.split("\n").find((line) => line.includes("提示")) ?? "";
const checks = [
  ["接口返回 hints 明细", Array.isArray(scores.detail?.hints)],
  ["报告页出现「提示 2 次」", /提示\s*2\s*次/.test(text)],
  ["报告页出现「−4 分」", /−\s*4\s*分|-4\s*分/.test(text)],
  ["无 pageerror", errors.length === 0],
];

console.log("hints:", JSON.stringify(scores.detail?.hints));
console.log("命中的说明行:", hintLine.trim());
console.log("pageerror:", errors);
console.log("");

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) failed += 1;
}
console.log(`\n${checks.length - failed}/${checks.length} 通过`);

await browser.close();
process.exit(failed === 0 ? 0 : 1);
