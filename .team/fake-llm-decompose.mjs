/**
 * 假 OpenAI 兼容端点（2026-10-24 二轮证据用）
 *
 * 用途：本地没有模型 key 时验证 `/api/plan/decompose` 的 **LLM 路径**——
 * 真走一次 HTTP（请求格式、超时、解析、回落都要经过真实代码），
 * 只是对端换成这个固定回包的服务。
 *
 * 跑法：
 *   node .team/fake-llm-decompose.mjs 4321 > logs/fake-llm.log 2>&1 &
 *   COZE_LLM_URL=http://127.0.0.1:4321/v1/chat/completions COZE_LLM_KEY=fake-local \
 *   COZE_LLM_MODEL=fake-model npx next dev -p 3000
 *
 * 回包里的段标题故意和模板不同（「称量基准物」而不是「称量与干燥」），
 * 这样一眼能看出 source:"llm" 是真生效，而不是解析失败又回落到模板。
 */
import http from "node:http";

const PORT = Number(process.argv[2] ?? 4321);

const PHASES = [
  { id: "weigh", title: "称量基准物", note: "先干燥冷却，再差减称取三份" },
  { id: "prepare", title: "溶解并定容", note: "全量转移、洗三次、定容摇匀" },
  { id: "titrate", title: "滴定到终点", note: "先快后慢，近终点半滴控制" },
  { id: "record", title: "读数与取舍", note: "两位小数、平行三份、极差过关" },
];

const server = http.createServer((req, res) => {
  let body = "";
  req.on("data", (chunk) => { body += chunk; });
  req.on("end", () => {
    if (req.method !== "POST" || !req.url.includes("/chat/completions")) {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "not-found", url: req.url }));
      return;
    }
    let parsed = null;
    try { parsed = JSON.parse(body); } catch { /* 记原始 body */ }
    const messages = parsed?.messages ?? [];
    const prompt = messages.find((m) => m.role === "user")?.content ?? "";
    // 段数跟着提示词里「保持 N 段」走：模型（这里是我们）只重写标题与要点，不增删段
    const want = Number((prompt.match(/保持\s*(\d+)\s*段/) ?? [])[1] ?? 4);
    const phases = PHASES.slice(0, want);

    console.log(JSON.stringify({
      at: new Date().toISOString(),
      method: req.method,
      url: req.url,
      auth: req.headers.authorization ?? null,
      model: parsed?.model ?? null,
      temperature: parsed?.temperature ?? null,
      stream: parsed?.stream ?? null,
      max_tokens: parsed?.max_tokens ?? null,
      roles: messages.map((m) => m.role),
      promptHead: prompt.slice(0, 120),
      segmentsAsked: want,
    }));

    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({
      id: "chatcmpl-fake-1",
      object: "chat.completion",
      model: parsed?.model ?? "fake-model",
      choices: [{ index: 0, message: { role: "assistant", content: JSON.stringify({ phases }) }, finish_reason: "stop" }],
      usage: { prompt_tokens: 512, completion_tokens: 96, total_tokens: 608 },
    }));
  });
});

server.listen(PORT, "127.0.0.1", () => console.log(`fake-llm listening on http://127.0.0.1:${PORT}/v1/chat/completions`));
