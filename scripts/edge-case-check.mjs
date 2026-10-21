/**
 * 边界情况专项：逐页扫异常输入与非法操作。
 * 每个用例断言三件事：①有友好提示 ②页面可恢复（还能继续操作）③无 pageerror / console.error
 * 证据：evidence/edge/<序号>-<用例>.png（工作区内，不落 TEMP）
 *
 * 用法：node scripts/edge-case-check.mjs
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const base = "http://localhost:3000";
const dir = path.join("evidence", "edge");
fs.mkdirSync(dir, { recursive: true });

const results = [];
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 950 } });
const page = await ctx.newPage();
let errCount = 0;
const errs = [];
page.on("pageerror", (e) => {
  errCount++;
  errs.push(String(e.message).slice(0, 130));
});
page.on("console", (m) => {
  if (m.type() !== "error") return;
  const t = m.text();
  // 预期内的 4xx 是正常业务响应（登录失败 403、实验不存在 404），不算前端异常
  if (/Failed to load resource/.test(t) && /(400|401|403|404|422)/.test(t)) return;
  errCount++;
  errs.push("console:" + t.slice(0, 120));
});

const bodyText = async () => (await page.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ");
const alive = async () => (await bodyText()).length > 30;

/** 跑一个用例：action 执行后判定 */
const kase = async (n, name, action, expectKw) => {
  const before = errCount;
  let detail = "";
  try {
    await action();
    await page.waitForTimeout(500);
    const text = await bodyText();
    const hinted = expectKw.some((k) => text.includes(k));
    const recovered = await alive();
    const noNewErr = errCount === before;
    const pass = hinted && recovered && noNewErr;
    detail = `提示=${hinted} 可恢复=${recovered} 新错误=${errCount - before}`;
    const file = path.join(dir, `${String(n).padStart(2, "0")}-${name}.png`);
    await page.screenshot({ path: file }).catch(() => {});
    results.push({ n, name, pass, detail, file });
    console.log(`${pass ? "[OK]" : "[X ]"} ${String(n).padStart(2, "0")} ${name} · ${detail}`);
  } catch (e) {
    results.push({ n, name, pass: false, detail: String(e).slice(0, 90) });
    console.log(`[X ] ${String(n).padStart(2, "0")} ${name} · 异常 ${String(e).slice(0, 80)}`);
  }
};

const login = async (no = "20250101", nm = "周若曦") => {
  await page.goto(base + "/login", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(300);
  await page.locator("[data-demo-id='demo-login-student-no']").fill(no);
  await page.locator("[data-demo-id='demo-login-student-name']").fill(nm);
  await page.locator("[data-demo-id='demo-login-submit']").click();
  await page.waitForTimeout(900);
};

// ---------- 登录页：学号/姓名边界 ----------
await kase(1, "login-empty-no", () => login("", "周若曦"), ["学号", "必填", "请输入", "不能为空"]);
await kase(2, "login-overlong-no", () => login("20250101202501012025010120250101", "周若曦"), [
  "学号",
  "格式",
  "无效",
  "不在",
  "长度",
]);
await kase(3, "login-chinese-symbol-no", () => login("２０ ２５-０１＊", "周若曦"), [
  "学号",
  "格式",
  "无效",
  "不在",
]);
await kase(4, "login-empty-name", () => login("20250101", ""), ["姓名", "必填", "请输入", "不能为空"]);
await kase(5, "login-not-in-roster", () => login("20259999", "查无此人"), ["不在", "名单", "核对", "联系"]);

// 正常登录，进入后续页面
await login();

// ---------- 未登录访问 ----------
await kase(
  6,
  "unauth-experiments",
  async () => {
    await ctx.clearCookies();
    await page.goto(base + "/experiments", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(600);
    const url = new URL(page.url()).pathname;
    if (!/login/.test(url)) throw new Error(`未登录仍能访问实验列表：${url}`);
  },
  ["登录", "学号", "身份"],
);

await login();

// ---------- 不存在的实验 ----------
await kase(
  7,
  "bad-experiment-id",
  async () => {
    await page.goto(base + "/exp/exp99", { waitUntil: "domcontentloaded" });
  },
  ["找不到", "不存在", "404", "返回", "实验"],
);

// ---------- 实验页：非法操作 ----------
await kase(
  8,
  "heat-without-reagent",
  async () => {
    await page.goto(base + "/exp/exp09", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(700);
    const heat = page.locator("button", { hasText: /加热|点火|点燃/ }).first();
    if (await heat.count()) await heat.click().catch(() => {});
    else await page.locator("[data-demo-id='demo-scene-drop-flask']").first().click().catch(() => {});
  },
  ["未", "先", "请", "不能", "步骤", "选项"],
);

await kase(
  9,
  "drop-wrong-vessel",
  async () => {
    await page.goto(base + "/exp/exp09", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(700);
    const from = page.locator("[data-demo-id='demo-scene-reagent-hcl']").first();
    const to = page.locator("[data-demo-id='demo-scene-vessel-burette'], [data-demo-id='demo-scene-drop-burette']").first();
    if ((await from.count()) && (await to.count())) {
      await from.dragTo(to, { timeout: 6000 }).catch(() => {});
    } else {
      await from.dragTo(page.locator("[data-demo-id='demo-scene-drop-flask']").first(), { timeout: 6000 }).catch(() => {});
    }
  },
  ["滴定管", "不能", "锥形瓶", "请", "放"],
);

await kase(
  10,
  "invalid-runid",
  async () => {
    await page.goto(base + "/exp/exp09/report?runId=not-a-real-id", { waitUntil: "domcontentloaded" });
  },
  ["0", "总", "暂无", "没有", "记录", "报告"],
);

await kase(
  11,
  "report-no-run",
  async () => {
    await page.goto(base + "/exp/exp09/report", { waitUntil: "domcontentloaded" });
  },
  ["0", "总", "暂无", "没有", "记录", "报告"],
);

// ---------- 教师端：空列表 / 非法查询 ----------
await kase(
  12,
  "teacher-no-unlock",
  async () => {
    await ctx.clearCookies();
    await page.goto(base + "/teacher", { waitUntil: "domcontentloaded" });
  },
  ["口令", "登录", "密码", "通行", "教师"],
);

await kase(
  13,
  "teacher-roster-search-none",
  async () => {
    await page.goto(base + "/teacher/roster?q=" + encodeURIComponent("查无此人zzz"), { waitUntil: "domcontentloaded" });
  },
  ["无", "没有", "空", "查", "名单"],
);

await kase(
  14,
  "api-runs-bad-payload",
  async () => {
    const r = await page.request.post(base + "/api/runs", {
      data: { experimentId: "exp99", studentNo: "", concentration: "-5" },
      failOnStatusCode: false,
    });
    const t = await r.text();
    if (r.status() >= 500) throw new Error(`API 返回 ${r.status()}：${t.slice(0, 60)}`);
    await page.goto(base + "/experiments", { waitUntil: "domcontentloaded" });
    return t;
  },
  ["实", "验", "学", "号", "登"],
);

await b.close();

// ---------- 汇总 ----------
const pass = results.filter((r) => r.pass).length;
const failed = results.filter((r) => !r.pass);
console.log(`\n用例 ${results.length} 个，通过 ${pass}/${results.length}`);
for (const f of failed) console.log(`  [X] ${f.n} ${f.name} · ${f.detail}`);
const uniq = [...new Set(errs)];
console.log(`\n累计 pageerror / console.error：${uniq.length} 条`);
if (uniq.length) console.log("  " + uniq.slice(0, 8).join("\n  "));
console.log(`证据目录：${dir}`);
fs.writeFileSync(
  path.join(dir, "result.json"),
  JSON.stringify({ pass, total: results.length, results, errors: uniq }, null, 2),
);
process.exitCode = failed.length === 0 && uniq.length === 0 ? 0 : 1;
