import { afterEach, describe, expect, it, vi } from "vitest";
import { REFERENCE_PLAN, type PlanInput } from "./pieces";
import { validate } from "./rules";
import { LLM_TIMEOUT_MS, assess, buildPrompt, offlineAssessment } from "./assess";

const PERFECT = REFERENCE_PLAN;
const WITH_WARN: PlanInput = {
  pieces: PERFECT.pieces,
  params: { ...PERFECT.params, indicatorDrops: 6, endpointHoldSec: 10 },
};
const BROKEN: PlanInput = {
  pieces: PERFECT.pieces.filter(
    (id) => id !== "piece-analytical-balance" && id !== "piece-step-rinse",
  ),
  params: PERFECT.params,
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("离线点评（无 key 时的唯一路径，必须有内容）", () => {
  it("全过方案：结论说『可执行』，三段齐全", () => {
    const r = offlineAssessment(PERFECT, validate(PERFECT));
    expect(r.offline).toBe(true);
    expect(r.text.length).toBeGreaterThan(40);
    expect(r.text).toContain("【结论】");
    expect(r.text).toContain("【依据】");
    expect(r.text).toContain("【下一步】");
    expect(r.text).toContain("可执行");
  });

  it("只有 warn：结论说『基本可执行』且指出要改进", () => {
    const report = validate(WITH_WARN);
    expect(report.blockCount).toBe(0);
    const r = offlineAssessment(WITH_WARN, report);
    expect(r.offline).toBe(true);
    expect(r.text).toContain("基本可执行");
    expect(r.text).toContain("需要改进");
    expect(r.text).toContain("【下一步】");
  });

  it("有 block：结论说『不可执行』，并给出第一条修复提示", () => {
    const report = validate(BROKEN);
    expect(report.blockCount).toBeGreaterThan(0);
    const r = offlineAssessment(BROKEN, report);
    expect(r.offline).toBe(true);
    expect(r.text).toContain("不可执行");
    expect(r.text).toContain(report.issues[0].hint);
  });
});

describe("提示词 buildPrompt", () => {
  it("包含实验名、块列表、参数、规则判定与三段式要求", () => {
    const prompt = buildPrompt(PERFECT, validate(PERFECT));
    expect(prompt).toContain("盐酸标准溶液的标定");
    expect(prompt).toContain("piece-analytical-balance");
    expect(prompt).toContain("acidOrder");
    expect(prompt).toContain("100/100");
    expect(prompt).toContain("【结论】");
    expect(prompt).toContain("【依据】");
    expect(prompt).toContain("【下一步】");
    expect(prompt).toContain("c(HCl)=2m/(M·V)");
  });

  it("违规时把 ruleId 与 label 摊进提示词，模型不用猜", () => {
    const report = validate(BROKEN);
    const prompt = buildPrompt(BROKEN, report);
    for (const issue of report.issues) {
      expect(prompt).toContain(issue.ruleId);
      expect(prompt).toContain(issue.text);
    }
  });

  it("空方案也能拼出提示词（不抛错）", () => {
    const empty: PlanInput = { pieces: [], params: {} };
    const prompt = buildPrompt(empty, validate(empty));
    expect(prompt).toContain("共 0 个");
    expect(prompt.length).toBeGreaterThan(100);
  });
});

describe("assess：有 key 走模型、失败一律回退，绝不抛错", () => {
  it("没有 key：offline=true、返回非空文本、耗时 <100ms", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "");
    vi.stubEnv("COZE_LLM_URL", "");
    const started = performance.now();
    const result = await assess(PERFECT);
    const elapsed = performance.now() - started;
    expect(result.offline).toBe(true);
    expect(result.text.length).toBeGreaterThan(40);
    expect(elapsed).toBeLessThan(100);
  });

  it("端点连不上（stub 到关闭端口）：不抛错、回退离线、快速返回", async () => {
    vi.stubEnv("COZE_LLM_URL", "http://127.0.0.1:9/v1/chat/completions");
    vi.stubEnv("DEEPSEEK_API_KEY", "");
    const started = performance.now();
    const result = await assess(PERFECT);
    const elapsed = performance.now() - started;
    expect(result.offline).toBe(true);
    expect(result.text).toContain("【结论】");
    expect(elapsed).toBeLessThan(LLM_TIMEOUT_MS); // 断连立即失败，不必等满 8 s
  });

  it("模型返回 500：回退离线模板（用 mock fetch 模拟，不真发网络）", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "test-key");
    vi.stubEnv("COZE_LLM_URL", "");
    vi.stubEnv("DEEPSEEK_BASE_URL", "https://example.invalid");
    const fetchMock = vi.fn(async () => new Response("upstream boom", { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await assess(BROKEN);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(result.offline).toBe(true);
    expect(result.text).toContain("不可执行");
  });

  it("模型返回正常 JSON：offline=false，用模型文本", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "test-key");
    vi.stubEnv("COZE_LLM_URL", "");
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ choices: [{ message: { content: "【结论】可以执行。\n【依据】计量关系正确。\n【下一步】进操作台。" } }] }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await assess(PERFECT);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(result.offline).toBe(false);
    expect(result.text).toContain("可以执行");
  });

  it("模型返回空 content：回退离线（不把空白当点评）", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "test-key");
    vi.stubEnv("COZE_LLM_URL", "");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: "   " } }] }), { status: 200 })),
    );
    const result = await assess(PERFECT);
    expect(result.offline).toBe(true);
    expect(result.text.length).toBeGreaterThan(40);
  });

  it("超时常量是 8 秒（演示不能卡 30 s 默认值）", () => {
    expect(LLM_TIMEOUT_MS).toBe(8000);
  });

  it("可直接传入已算好的报告，避免重复跑 21 条规则", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "");
    vi.stubEnv("COZE_LLM_URL", "");
    const report = validate(BROKEN);
    const result = await assess(BROKEN, report);
    expect(result.offline).toBe(true);
    expect(result.text).toContain(report.issues[0].hint);
  });
});
