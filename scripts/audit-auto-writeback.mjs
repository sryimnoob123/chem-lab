/**
 * 验证 ?auto=1 写库：交卷时带 auto=1，预习分应按满分 100 落库，且总分按 10/40/50 重算。
 *
 * 对照：不带 auto=1 时，同一实验预习分应为 0（演示路径不走前测门禁）。
 * 用法：node scripts/audit-auto-writeback.mjs
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
  if (!cookie) throw new Error("no session cookie returned");
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

async function finish(cookie, runId, autoDemo) {
  const url = `${BASE}/api/runs/${runId}/finish${autoDemo ? "?auto=1" : ""}`;
  const res = await fetch(url, { method: "POST", headers: { cookie } });
  const body = await res.json();
  if (!res.ok) throw new Error(`finish failed: ${JSON.stringify(body)}`);
  return body.scores ?? {};
}

async function readScores(cookie, runId) {
  const res = await fetch(`${BASE}/api/runs/${runId}`, { headers: { cookie } });
  const body = await res.json();
  return body.scores ?? {};
}

const cookie = await login();
console.log("已登录学生 20250101");

const rows = [];
for (const autoDemo of [true, false]) {
  const experimentId = autoDemo ? "exp01" : "exp03";
  const runId = await openRun(cookie, experimentId);
  const returned = await finish(cookie, runId, autoDemo);
  const stored = await readScores(cookie, runId);
  rows.push({
    实验: experimentId,
    "auto=1": autoDemo ? "是" : "否",
    接口返回preview: returned.preview,
    库内preview: stored.preview,
    库内operation: stored.operation,
    库内report: stored.report,
    库内total: stored.total,
    按104050重算: Math.round(stored.preview * 0.1 + stored.operation * 0.4 + stored.report * 0.5),
  });
}

console.table(rows);

const auto = rows.find((r) => r["auto=1"] === "是");
const plain = rows.find((r) => r["auto=1"] === "否");
const checks = [
  ["auto=1 时预习分落库为 100", auto?.库内preview === 100],
  ["auto=1 时接口返回值与库内一致", auto?.接口返回preview === auto?.库内preview],
  ["auto=1 时总分 = 10/40/50 重算值", auto?.库内total === auto?.按104050重算],
  ["不带 auto=1 时预习分仍为 0（真实学生不受影响）", plain?.库内preview === 0],
];

console.log("");
let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) failed += 1;
}
console.log(`\n${checks.length - failed}/${checks.length} 通过`);
process.exit(failed === 0 ? 0 : 1);
