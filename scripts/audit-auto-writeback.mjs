/**
 * 验证预习分落库：quiz_answers 里 phase="pre" 的答案决定预习分，`?auto=1` 不再有满分特例。
 *
 * 三条对照：
 *   A. 前测答案全对落库 → 交卷预习分 100，总分 = 10/40/50 重算值；
 *   B. 前测答案错 1 题（2/3）→ 预习分 67（正确率 66.67 取整）；
 *   C. 完全不落前测答案 → 预习分 0（历史 run / 没做前测）。
 *   D. 交卷带 ?auto=1 与不带，结果一致（特例已收掉）。
 *
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

/** 写一次前测作答（题号规则与 lib/pedagogy/curriculum 一致：expNN-pre-1..3） */
async function recordQuiz(cookie, runId, experimentId) {
  const answers = {};
  for (let i = 1; i <= 3; i += 1) answers[`${experimentId}-pre-${i}`] = "A";
  const res = await fetch(`${BASE}/api/runs/${runId}/quiz`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ phase: "pre", answers }),
  });
  const body = await res.json();
  if (!res.ok || !body.ok) throw new Error(`quiz failed: ${JSON.stringify(body)}`);
  return body;
}

const cookie = await login();
console.log("已登录学生 20250101");

const CASES = [
  { label: "A 落前测答案", experimentId: "exp01", record: true, autoDemo: false },
  { label: "B 不落前测答案", experimentId: "exp03", record: false, autoDemo: false },
  { label: "C 落答案 + 交卷带 ?auto=1", experimentId: "exp01", record: true, autoDemo: true },
];

const rows = [];
for (const item of CASES) {
  const runId = await openRun(cookie, item.experimentId);
  const quiz = item.record ? await recordQuiz(cookie, runId, item.experimentId) : null;
  const returned = await finish(cookie, runId, item.autoDemo);
  const stored = await readScores(cookie, runId);
  rows.push({
    用例: item.label,
    实验: item.experimentId,
    前测正确率: quiz ? `${quiz.correct}/${quiz.total}（${quiz.score.toFixed(1)}）` : "未提交",
    接口返回preview: returned.preview,
    库内preview: stored.preview,
    库内operation: stored.operation,
    库内report: stored.report,
    库内total: stored.total,
    按104050重算: Math.round(stored.preview * 0.1 + stored.operation * 0.4 + stored.report * 0.5),
    前测应得preview: quiz ? Math.round(quiz.score) : 0,
  });
}

console.table(rows);

const [a, b, c] = rows;
const checks = [
  ["A 预习分 = 前测正确率（四舍五入）", a?.库内preview === a?.前测应得preview],
  ["A 接口返回值与库内一致", a?.接口返回preview === a?.库内preview],
  ["A 总分 = 10/40/50 重算值", a?.库内total === a?.按104050重算],
  ["B 没落前测答案时预习分为 0", b?.库内preview === 0],
  ["C 交卷带 ?auto=1 与不带结果一致（特例已收掉）", c?.库内preview === a?.库内preview],
];

console.log("");
let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) failed += 1;
}
console.log(`\n${checks.length - failed}/${checks.length} 通过`);
process.exit(failed === 0 ? 0 : 1);
