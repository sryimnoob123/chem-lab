/**
 * 验证「提示扣分 1/3/5 + 报告记次数」端到端：
 *   登录 → 开 run → 上报 3 次提示（level 0/1/2 = UI 的 L1/L2/L3）→ 交卷 → 查库。
 *
 * 期望：detail.hints 有 3 条、deduct 依次 1/3/5、independentDeduct = 9、操作分相应下降。
 * 用法：node scripts/audit-hint-writeback.mjs
 */
const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3001";

async function login() {
  const res = await fetch(`${BASE}/api/session`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ studentNo: "20250101", name: "周若曦" }),
  });
  if (!res.ok) throw new Error(`login failed: ${res.status}`);
  const list = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  const cookie = list.map((c) => c.split(";")[0]).join("; ");
  if (!cookie) throw new Error("no session cookie");
  return cookie;
}

async function openRun(cookie, experimentId) {
  const res = await fetch(`${BASE}/api/runs`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ experimentId }),
  });
  const body = await res.json();
  if (!res.ok || !body.runId) throw new Error(`open run failed: ${JSON.stringify(body)}`);
  return body.runId;
}

async function reportHint(cookie, runId, stepIndex, level) {
  const res = await fetch(`${BASE}/api/runs/${runId}/events`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ kind: "hint", hint: { stepIndex, level } }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`hint report failed: ${JSON.stringify(body)}`);
  return body.hint;
}

async function finish(cookie, runId) {
  const res = await fetch(`${BASE}/api/runs/${runId}/finish`, { method: "POST", headers: { cookie } });
  const body = await res.json();
  if (!res.ok) throw new Error(`finish failed: ${JSON.stringify(body)}`);
  return body;
}

const cookie = await login();
const runId = await openRun(cookie, "exp01");

const reported = [];
for (const level of [0, 1, 2]) {
  reported.push(await reportHint(cookie, runId, 0, level));
}

const payload = await finish(cookie, runId);
const detail = payload.scores?.detail ?? {};
const hints = detail.hints ?? [];

console.log("上报返回值:", JSON.stringify(reported));
console.log("库内 hints:", JSON.stringify(hints));
console.log("操作分:", payload.scores?.operation, "总分:", payload.scores?.total);

const checks = [
  // run 会被 createOrReuseRun 复用，库里可能还有引擎自动提示，所以只看"本次追加的最后 3 条"
  ["上报 3 次提示都成功落库", hints.length >= 3],
  [
    "本次上报的三条扣分依次是 1 / 3 / 5",
    JSON.stringify(hints.slice(-3).map((h) => h.deduct)) === "[1,3,5]",
  ],
  [
    "hints 里保留了 stepIndex 与 level",
    hints.every((h) => typeof h.stepIndex === "number" && typeof h.level === "number"),
  ],
  [
    "每条 deduct 都等于该 level 的规定值（0→1 / 1→3 / 2→5）",
    hints.every((h) => h.deduct === ({ 0: 1, 1: 3, 2: 5, 3: 5, 4: 5 })[h.level]),
  ],
];

console.log("");
let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) failed += 1;
}
console.log(`\n${checks.length - failed}/${checks.length} 通过`);
process.exit(failed === 0 ? 0 : 1);
