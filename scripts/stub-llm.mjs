/**
 * 本机 stub 的 OpenAI 兼容端点 —— 只用来验证「真实 provider 链路」，不进生产。
 *
 * 背景：本机没有任何扣子 / 方舟凭据，不能打真模型。把 COZE_LLM_URL 指到这里，
 * `/api/plan/assess` 就会走**真实 fetch + 真实 socket + 真实 JSON 解析**，
 * 证明「配好 COZE_LLM_URL + COZE_LLM_KEY 就会用模型点评」这条路径在运行中的应用里是通的。
 *
 * 用法（另开两个终端）：
 *   node scripts/stub-llm.mjs 8899
 *   cd .next/standalone && PORT=3002 HOSTNAME=127.0.0.1 PGLITE_DIR=../.pgdata-stub \
 *     PLAN_ASSESS_PROVIDER=ark COZE_LLM_URL=http://127.0.0.1:8899/v1/chat/completions \
 *     COZE_LLM_KEY=stub-key node server.js
 * 打开 http://127.0.0.1:3002/plan → 选主题 → 载入参考方案 → 点评标题显示「AI 点评」。
 *
 * 每个请求的 prompt 追加进 scripts/stub-llm-requests.log（验收证据：prompt 真的随主题变）。
 * 停掉 stub 再改一次方案，UI 会显示「AI 连不上，已用离线点评」。
 */
import { createServer } from "node:http";
import { appendFileSync } from "node:fs";

const port = Number(process.argv[2] ?? 8899);
const logPath = new URL("./stub-llm-requests.log", import.meta.url);

/** 故意给一个「能执行但缺空白」的答案，好验证 points 指到块、questions 带追问 */
const answer = {
  text: "结论：这份方案现在还不能执行 —— 空白没做，系统误差会直接算进 c(HCl)。其余结构与顺序可用。",
  points: [
    { kind: "good", pieceId: "piece-na2co3-primary", text: "基准物选无水 Na₂CO₃，称量相对误差压得住。" },
    { kind: "risk", pieceId: "piece-step-blank", ruleId: "blank-test", text: "缺空白试验：水和指示剂耗掉的酸没有扣。" },
    { kind: "todo", pieceId: "piece-step-blank", ruleId: "blank-test", text: "先补一块空白试验，再谈平行极差。" },
  ],
  questions: ["空白里没加样品却有读数，这个体积是从哪来的？"],
};

const server = createServer((req, res) => {
  let raw = "";
  req.on("data", (chunk) => {
    raw += String(chunk);
  });
  req.on("end", () => {
    appendFileSync(logPath, `${new Date().toISOString()} ${req.method} ${req.url}\n${raw}\n\n`);
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content: JSON.stringify(answer) } }] }));
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`stub llm on http://127.0.0.1:${port}/v1/chat/completions`);
});
