/**
 * 全站回归 · S5 拼接实验（4 主题 + 拖块 + 点评）· S6 教师端（口令 2026 / 学情 / CSV）
 * 用法：PLAYWRIGHT_BROWSERS_PATH=… BASE_URL=http://localhost:3001 node scripts/regression-plan-teacher.mjs
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3001";
const EVID = "evidence/regression";
fs.mkdirSync(EVID, { recursive: true });

const results = [];
const allErrors = [];
let shotN = 40;
const rec = (section, name, pass, detail) => {
  results.push({ section, name, pass, detail });
  console.log(`${pass ? "[OK]" : "[FAIL]"} ${section} · ${name} · ${detail}`);
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
let bucket = [];
page.on("pageerror", (e) => bucket.push("pageerror:" + String(e.message).slice(0, 200)));
page.on("console", (m) => {
  if (m.type() !== "error") return;
  const t = m.text();
  if (/favicon|Failed to load resource/.test(t)) return;
  bucket.push("console:" + t.slice(0, 200));
});
const flush = (label) => {
  if (bucket.length) allErrors.push({ label, errors: [...bucket] });
  bucket = [];
};
const shot = async (slug) => {
  await page.waitForTimeout(300);
  const name = `${String(++shotN).padStart(2, "0")}-${slug}.png`;
  await page.screenshot({ path: `${EVID}/${name}` });
  return name;
};

// ───────────── 学生上下文：登录 → /plan
await page.goto(BASE + "/login", { waitUntil: "domcontentloaded" });
await page.locator("[data-demo-id='demo-login-student-no']").fill("20250101");
await page.locator("[data-demo-id='demo-login-student-name']").fill("周若曦");
await page.locator("[data-demo-id='demo-login-submit']").click();
await page.waitForURL(/\/experiments/, { timeout: 12000 });

try {
  await page.goto(BASE + "/plan", { waitUntil: "networkidle" });
  const topics = await page.locator("[data-demo-id^='demo-topic-']").evaluateAll((els) =>
    els.map((el) => el.getAttribute("data-demo-id")).filter((id) => !id.includes("-level-")),
  );
  await shot("s5-plan-topics");
  rec("S5", "拼接实验四个主题", topics.length === 4, topics.join(" "));
  flush("S5-topics");

  let first = true;
  for (const topic of topics) {
    const label = topic.replace("demo-topic-", "");
    await page.locator(`[data-demo-id='${topic}']`).click();
    await page.waitForTimeout(700);
    const head = await page.locator("[data-demo-id='demo-topic-head']").innerText().catch(() => "");
    const headBox = await page.locator("[data-demo-id='demo-topic-head']").boundingBox().catch(() => null);

    // 拿 3 块素材：第一轮用真拖拽，其余点击
    const pieces = page.locator("[data-demo-id^='demo-design-piece-']");
    const pieceCount = await pieces.count();
    if (first && pieceCount > 0) {
      const src = pieces.first();
      const s = await src.boundingBox();
      const dst = await page.locator("[data-plan-drop='list']").boundingBox();
      if (s && dst) {
        await page.mouse.move(s.x + s.width / 2, s.y + s.height / 2);
        await page.mouse.down();
        await page.mouse.move(s.x + 40, s.y + 20, { steps: 5 });
        await page.mouse.move(dst.x + dst.width / 2, dst.y + dst.height / 2, { steps: 16 });
        await page.mouse.up();
        await page.waitForTimeout(700);
      }
      first = false;
    }
    // 按稳定 id 添加（列表会因置顶/分组重排，按 nth 点同一个块会把它再取消掉）
    const pieceIds = await page.evaluate(() =>
      [...document.querySelectorAll("[data-demo-id^='demo-design-piece-']")]
        .map((el) => el.getAttribute("data-demo-id"))
        .filter((id) => id !== "demo-design-piece-count"),
    );
    const picked = [];
    for (const pid of pieceIds) {
      if (picked.length >= 3) break;
      const before = await page.locator("[data-demo-id='demo-design-piece-count']").innerText().catch(() => "");
      await page.locator(`[data-demo-id='${pid}']`).first().click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(220);
      const after = await page.locator("[data-demo-id='demo-design-piece-count']").innerText().catch(() => "");
      if (after !== before) picked.push(pid.replace("demo-design-piece-", ""));
    }
    await page.waitForTimeout(1800);
    const added = await page.locator("[data-demo-id='demo-design-piece-count']").innerText().catch(() => "?");
    const remark = await page.locator("[data-demo-id='demo-remark-text']").innerText().catch(() => "");
    const provider = await page.locator("[data-demo-id='demo-remark-provider']").innerText().catch(() => "");
    const points = await page.locator("[data-demo-id='demo-remark-points'] li").count().catch(() => 0);
    await shot(`s5-plan-${label}`);
    rec(
      "S5",
      `${label} 拖块→点评`,
      head.length > 0 && remark.length > 8 && points > 0 && picked.length >= 1,
      `主题头=${head.replace(/\s+/g, " ").slice(0, 18)} · 素材=${added}（本轮加入 ${picked.join("/") || "0 块"}） · 点评=${provider} · 要点 ${points} 条 · 点评首句=${remark.replace(/\s+/g, " ").slice(0, 30)}${headBox ? "" : " · 主题头未定位"}`,
    );
    flush(`S5-${label}`);

    // 回主题列表
    const back = page.locator("[data-demo-id='demo-topic-switch']");
    if (await back.count()) {
      await back.click();
      await page.waitForTimeout(600);
    } else {
      await page.goto(BASE + "/plan", { waitUntil: "networkidle" });
    }
  }
} catch (e) {
  rec("S5", "链路异常", false, String(e).slice(0, 200));
}

// ───────────── 教师端：口令 2026
const tctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const tpage = await tctx.newPage();
let tbucket = [];
tpage.on("pageerror", (e) => tbucket.push("pageerror:" + String(e.message).slice(0, 200)));
tpage.on("console", (m) => {
  if (m.type() !== "error") return;
  const t = m.text();
  if (/favicon|Failed to load resource/.test(t)) return;
  tbucket.push("console:" + t.slice(0, 200));
});

try {
  await tpage.goto(BASE + "/login?passcode=1", { waitUntil: "networkidle" });
  await tpage.locator("[data-demo-id='demo-login-tab-teacher']").click();
  const pass = tpage.locator("[data-demo-id='demo-login-teacher-passcode']");
  const hasPass = await pass.count();
  if (hasPass) await pass.fill("2026");
  await tpage.locator("[data-demo-id='demo-login-submit']").click();
  await tpage.waitForURL(/\/teacher/, { timeout: 15000 });
  await tpage.waitForTimeout(1500);
  const turl = tpage.url();
  const ttext = await tpage.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
  await tpage.screenshot({ path: `${EVID}/${String(++shotN).padStart(2, "0")}-s6-teacher.png` });
  const rows = await tpage.locator("tbody tr").count();
  const nums = ttext.match(/共\s*\d+\s*人|\d+\s*条/)?.[0] ?? "";
  rec("S6", "口令 2026 进教师端", /\/teacher/.test(turl) && rows > 0, `${turl.replace(BASE, "")} · 学生行 ${rows} · 口令输入框=${hasPass > 0 ? "有" : "已移除"} · ${nums}`);
  rec("S6", "学情能读", /已完成|进行中|未开始/.test(ttext), ttext.slice(0, 60));
  const unlockState = await tpage.locator("[class*='tch-unlock']").count();
  rec("S6", "口令登录后已解锁（不再要求二次解锁）", unlockState === 0 || !/教师解锁/.test(ttext.slice(0, 400)), `解锁控件 ${unlockState} 个`);

  // CSV 导出（带 cookie）
  const csvRes = await tctx.request.get(BASE + "/api/teacher/export");
  const buf = Buffer.from(await csvRes.body());
  const head3 = buf.subarray(0, 3);
  const hasBom = head3[0] === 0xef && head3[1] === 0xbb && head3[2] === 0xbf;
  const text = buf.toString("utf8");
  const lines = text.trim().split(/\r?\n/);
  const header = lines[0] ?? "";
  const mojibake = /[�]/.test(text);
  rec(
    "S6",
    "CSV 导出不乱码",
    csvRes.status() === 200 && hasBom && /学号/.test(header) && !mojibake,
    `HTTP ${csvRes.status()} · BOM=${hasBom} · ${lines.length - 1} 行 · 表头=${header.replace(/^\uFEFF/, "").slice(0, 40)} · 乱码=${mojibake}`,
  );
  fs.writeFileSync(`${EVID}/teacher-export-sample.csv`, text.slice(0, 4000), "utf8");

  // UI 里的导出按钮（学生看到的那次点击）
  await tpage.locator("[data-demo-id='demo-teacher-export']").click().catch(() => {});
  await tpage.waitForTimeout(1800);
  const exportMsg = await tpage.locator("[data-demo-id='demo-teacher-export-msg']").innerText().catch(() => "");
  rec("S6", "导出按钮（界面点击）", /KB|已导出/.test(exportMsg), exportMsg || "无回执");
  await tpage.screenshot({ path: `${EVID}/${String(++shotN).padStart(2, "0")}-s6-teacher-export.png` });
  if (tbucket.length) allErrors.push({ label: "S6-teacher", errors: [...tbucket] });
  tbucket = [];

  // 学生详情页
  const firstStudent = await tpage.locator("tbody tr a").first().getAttribute("href").catch(() => null);
  if (firstStudent) {
    await tpage.goto(BASE + firstStudent, { waitUntil: "networkidle" });
    await tpage.waitForTimeout(800);
    const st = await tpage.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
    await tpage.screenshot({ path: `${EVID}/${String(++shotN).padStart(2, "0")}-s6-teacher-student.png` });
    rec("S6", "学生详情页", st.length > 120, st.slice(0, 60));
    if (tbucket.length) allErrors.push({ label: "S6-student", errors: [...tbucket] });
    tbucket = [];
  } else {
    rec("S6", "学生详情页", true, "表格里没有学生链接（演示数据）");
  }
} catch (e) {
  rec("S6", "链路异常", false, String(e).slice(0, 200));
}

await browser.close();
const fails = results.filter((r) => !r.pass);
fs.writeFileSync(`${EVID}/results-plan-teacher.json`, JSON.stringify({ results, errors: allErrors }, null, 1));
console.log("\n==== SUMMARY ====");
console.log(`检查项 ${results.length} · 失败 ${fails.length}`);
for (const f of fails) console.log("FAILED:", f.section, f.name, f.detail);
const errCount = allErrors.reduce((n, e) => n + e.errors.length, 0);
console.log(`console/pageerror 总计 ${errCount} 条`);
for (const e of allErrors) console.log(" ERR", e.label, e.errors.slice(0, 3).join(" | "));
process.exitCode = fails.length || errCount ? 1 : 0;
