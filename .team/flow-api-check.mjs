/**
 * 纯 HTTP 跑完 exp01 七步 → 交卷 → 读分数。
 * 目的：把「评分 / 交卷」跟 UI 解耦，能在数据库出问题时一眼看出是接口还是界面。
 *
 * 用法： BASE_URL=http://127.0.0.1:3000 node .team/flow-api-check.mjs [--demo]
 */
const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const DEMO = process.argv.includes("--demo");

const STEPS = [
  { choiceId: "step1-dry", type: "wash" },
  { choiceId: "step2-calibrate", type: "calibrate" },
  { choiceId: "step3-compute", type: "compute" },
  { choiceId: "step4-rinse", type: "dissolve" },
  { choiceId: "step5-shake", type: "dilute" },
  { choiceId: "step6-drain", type: "transfer" },
  { choiceId: "step7-label", type: "transfer" },
];

const post = async (path, body) => {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-student-no": "20250101" },
    body: JSON.stringify(body ?? {}),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* 非 JSON 原样返回 */
  }
  return { status: res.status, json, text: text.slice(0, 300) };
};

const run = await post("/api/runs", { experimentId: "exp01", isDemo: true });
if (!run.json?.runId) {
  console.error("创建 run 失败：", run.status, run.text);
  process.exit(1);
}
const runId = run.json.runId;
console.log("runId:", runId);

for (const step of STEPS) {
  const res = await post(`/api/runs/${runId}/events`, {
    events: [{ type: step.type, choiceId: step.choiceId, competency: "S2" }],
  });
  const ev = res.json?.events?.[0];
  console.log(
    `${step.choiceId.padEnd(18)} HTTP ${res.status}  step=${res.json?.state?.stepIndex ?? "?"} ` +
      `verdict=${ev?.verdict ?? ev?.kind ?? "?"} ${ev?.message ?? ""}`.slice(0, 140),
  );
}

const fin = await post(`/api/runs/${runId}/finish${DEMO ? "?auto=1" : ""}`);
const scores = fin.json?.scores ?? {};
console.log("finish:", fin.status, JSON.stringify(scores).slice(0, 400));
console.log(
  `总分 ${scores.total ?? "?"} = 预习 ${scores.preview ?? "?"} / 操作 ${scores.operation ?? "?"} / 报告 ${scores.report ?? "?"}`,
);

const rep = await fetch(`${BASE}/api/report/${runId}`).then((r) => r.json());
console.log("report API 总分:", rep?.scores?.total ?? rep?.total ?? "?");
