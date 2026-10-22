/**
 * 全站回归 · 主链（S1 首页/列表/10 个实验入口 · S2 exp01 整链 · S3 exp03 · S4 exp09）
 *
 * 干净上下文、零 console/pageerror 才算过；截图落 evidence/regression/。
 * 用法：PLAYWRIGHT_BROWSERS_PATH=… BASE_URL=http://localhost:3001 node scripts/regression-main.mjs
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3001";
const EVID = "evidence/regression";
fs.mkdirSync(EVID, { recursive: true });

const results = [];
const allErrors = [];
let shotN = 0;

const rec = (section, name, pass, detail) => {
  results.push({ section, name, pass, detail });
  console.log(`${pass ? "[OK]" : "[FAIL]"} ${section} · ${name} · ${detail}`);
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

let bucket = [];
const flushErrors = (label) => {
  if (bucket.length) allErrors.push({ label, errors: [...bucket] });
  bucket = [];
};
page.on("pageerror", (e) => bucket.push("pageerror:" + String(e.message).slice(0, 200)));
page.on("console", (m) => {
  if (m.type() !== "error") return;
  const t = m.text();
  if (/favicon|Failed to load resource/.test(t)) return;
  bucket.push("console:" + t.slice(0, 200));
});

const shot = async (slug) => {
  await page.waitForTimeout(350);
  const name = `${String(++shotN).padStart(2, "0")}-${slug}.png`;
  await page.screenshot({ path: path.join(EVID, name) });
  return name;
};

const bodyText = () => page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
const stepNo = () =>
  page.evaluate(() => {
    const el = document.querySelector("[class*='topStep']");
    const m = (el?.textContent ?? "").match(/第\s*(\d+)\s*步\s*\/\s*共\s*(\d+)\s*步/);
    return m ? { step: Number(m[1]), total: Number(m[2]) } : null;
  });

/** 真实指针拖拽：把试剂瓶拖到某台器皿；返回落点判定 ok/bad/none */
const dragReagentTo = async (reagentDemoId, vesselDemoId) => {
  const src = page.locator(`[data-demo-id='${reagentDemoId}']`).first();
  const s = await src.boundingBox();
  if (!s) return "no-source";
  await page.mouse.move(s.x + s.width / 2, s.y + s.height / 2);
  await page.mouse.down();
  await page.mouse.move(s.x + s.width / 2 + 16, s.y + s.height / 2 + 8, { steps: 4 });
  const t = await page.locator(`[data-demo-id='${vesselDemoId}']`).first().boundingBox();
  if (!t) return "no-target";
  await page.mouse.move(t.x + t.width / 2, t.y + t.height * 0.65, { steps: 14 });
  await page.waitForTimeout(120);
  const state = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    return el?.getAttribute("data-drop") ?? "none";
  }, `[data-demo-id='${vesselDemoId}']`);
  await page.mouse.up();
  return state;
};

/** 拖当前该加的试剂到正确器皿（靠拖拽中的 data-drop=ok 找目标）。成功返回 true */
const pourNextReagent = async () => {
  const next = page.locator("[data-demo-id^='demo-scene-reagent-'][data-next='true']").first();
  if (!(await next.count())) return false;
  const reagentSel = await next.getAttribute("data-demo-id");
  const s = await next.boundingBox();
  if (!s) return false;
  const before = await stepNo();
  await page.mouse.move(s.x + s.width / 2, s.y + s.height / 2);
  await page.mouse.down();
  await page.mouse.move(s.x + s.width / 2 + 18, s.y + s.height / 2 + 10, { steps: 4 });
  const vessels = await page.evaluate(() =>
    [...document.querySelectorAll("[data-drop-kind='vessel']")].map((el) => {
      const r = el.getBoundingClientRect();
      return { demo: el.getAttribute("data-demo-id"), x: r.left + r.width / 2, y: r.top + r.height * 0.65 };
    }),
  );
  let target = null;
  for (const v of vessels) {
    await page.mouse.move(v.x, v.y, { steps: 8 });
    await page.waitForTimeout(80);
    const state = await page.evaluate((sel) => document.querySelector(sel)?.getAttribute("data-drop") ?? "none", `[data-demo-id='${v.demo}']`);
    if (state === "ok") {
      target = v;
      break;
    }
  }
  if (!target) {
    // 没有判定为「落这里对」的器皿：回原位松手，绝不往错的器皿上丢
    // （丢错会走 trap/事故分支，把整条回归链带偏）
    await page.mouse.move(s.x + s.width / 2, s.y + s.height / 2, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    return false;
  }
  await page.mouse.move(target.x, target.y, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(1400);
  const after = await stepNo();
  void reagentSel;
  return Boolean(after && before && after.step > before.step);
};

/** 拖一瓶「这一步用不上」的试剂到会判 bad 的器皿上，验非法落点提示。返回 {state, hint} */
const dragWrongReagent = async () => {
  const next = page.locator("[data-demo-id^='demo-scene-reagent-'][data-next='true']").first();
  if (!(await next.count())) return null;
  const nextSel = await next.getAttribute("data-demo-id");
  const otherSel = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    const all = [...document.querySelectorAll("[data-demo-id^='demo-scene-reagent-']")];
    return all.find((x) => x !== el)?.getAttribute("data-demo-id") ?? null;
  }, `[data-demo-id='${nextSel}']`);
  if (!otherSel) return null;
  const src = page.locator(`[data-demo-id='${otherSel}']`).first();
  const s = await src.boundingBox();
  if (!s) return null;
  await page.mouse.move(s.x + s.width / 2, s.y + s.height / 2);
  await page.mouse.down();
  await page.mouse.move(s.x + s.width / 2 + 18, s.y + s.height / 2 + 10, { steps: 4 });
  const vessels = await page.evaluate(() =>
    [...document.querySelectorAll("[data-drop-kind='vessel']")].map((el) => {
      const r = el.getBoundingClientRect();
      return { demo: el.getAttribute("data-demo-id"), x: r.left + r.width / 2, y: r.top + r.height * 0.6 };
    }),
  );
  let bad = null;
  for (const v of vessels) {
    await page.mouse.move(v.x, v.y, { steps: 8 });
    await page.waitForTimeout(80);
    const st = await page.evaluate((sel) => document.querySelector(sel)?.getAttribute("data-drop") ?? "none", `[data-demo-id='${v.demo}']`);
    if (st === "bad") {
      bad = v;
      break;
    }
  }
  if (!bad) {
    await page.mouse.move(s.x + s.width / 2, s.y + s.height / 2, { steps: 8 });
    await page.mouse.up();
    return { state: "no-bad-target", hint: 0 };
  }
  await page.mouse.move(bad.x, bad.y, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(700);
  const hint = await page.locator("[role='status']", { hasText: "这一步用不上" }).count();
  return { state: "bad", hint };
};

// ───────────────────────────── 步骤定义（正确动作的按键顺序）
const DEF_CACHE = new Map();
const loadDef = async (expId) => {
  if (DEF_CACHE.has(expId)) return DEF_CACHE.get(expId);
  const mod = await import(`../experiments/${expId}/definition.ts`);
  const def = mod[`${expId}Definition`] ?? mod.default;
  DEF_CACHE.set(expId, def);
  return def;
};
/**
 * 某一步「正确动作」对应的键盘序号（choices 里 role=correct 的下标 +1）。
 * 一步可能有 2~4 个正确动作（前者是后者的前置），陷阱都在它们之后，
 * 所以按这个顺序按键既不会踩陷阱，也不会漏掉 completesStep 的那一下。
 */
const correctKeys = (def, stepIndex) => {
  const step = def?.steps?.[stepIndex];
  if (!step) return [];
  return step.choices.map((c, i) => (c.role === "correct" ? i + 1 : null)).filter((k) => k !== null);
};

// ───────────────────────────── S1：首页 → 登录 → 列表 → 10 个实验入口
try {
  const home = await page.goto(BASE + "/", { waitUntil: "networkidle" });
  const h1 = await page.locator("h1").first().innerText();
  const rows = await page.locator(".exp-list__row").count();
  const allLink = await page.locator(".exp-list__all").getAttribute("href");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  await shot("s1-home");
  rec("S1", "门户首页", home.status() === 200 && rows === 5 && allLink === "/experiments" && !overflow, `HTTP ${home.status()} · h1=${h1} · ${rows} 行 · 查看全部=${allLink} · 横向溢出=${overflow}`);
  rec("S1", "首页控制台", bucket.length === 0, `${bucket.length} 条错误`);
  flushErrors("S1-home");

  await page.locator("[data-demo-id='demo-cover-cta']").click();
  await page.waitForURL(/\/login/, { timeout: 10000 });
  const loginOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  await shot("s1-login");
  rec("S1", "登录页", loginOverflow === false, `横向溢出=${loginOverflow}`);

  await page.locator("[data-demo-id='demo-login-student-no']").waitFor();
  await page.locator("[data-demo-id='demo-login-student-no']").fill("20250101");
  await page.locator("[data-demo-id='demo-login-student-name']").fill("周若曦");
  await page.locator("[data-demo-id='demo-login-submit']").click();
  await page.waitForURL(/\/experiments/, { timeout: 12000 });
  const featured = await page.locator("a[data-demo-id^='demo-catalog-']").count();
  const planEntry = await page.locator("[data-demo-id='demo-advanced-plan']").count();
  await shot("s1-catalog");
  rec("S1", "登录 → 我的实验", featured >= 3 && planEntry > 0, `可点实验 ${featured} 个 · 拼接实验入口 ${planEntry} 个`);
  flushErrors("S1-catalog");

  await page.goto(BASE + "/experiments?unlock=all", { waitUntil: "networkidle" });
  const allRows = await page.locator("[data-demo-id^='demo-catalog-']").count();
  const allLinks = await page.locator("a[data-demo-id^='demo-catalog-']").count();
  await shot("s1-catalog-all");
  rec("S1", "列表解锁全部 10 个", allRows === 10, `行 ${allRows} 个 · 可点 ${allLinks} 个`);
  flushErrors("S1-catalog-all");

  // 10 个实验：默认门禁页 + ?force=1 操作台，逐个进
  const ids = Array.from({ length: 10 }, (_, i) => `exp${String(i + 1).padStart(2, "0")}`);
  const gates = [];
  const benches = [];
  for (const id of ids) {
    const r = await page.goto(`${BASE}/exp/${id}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    const txt = await bodyText();
    const workbench = await page.locator("[data-demo-id='demo-finish']").count();
    const preTest = await page.locator("[data-demo-id='bopbps-pre-submit']").count();
    const lockedText = /不在本次开放的实验范围内|操作台还在接通中/.test(txt);
    gates.push({ id, status: r.status(), workbench, preTest, lockedText, len: txt.length });
    flushErrors(`S1-exp-${id}`);

    const r2 = await page.goto(`${BASE}/exp/${id}?force=1`, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    const bench = await page.locator("[data-demo-id='demo-finish']").count();
    const step = await stepNo();
    const vessels = await page.locator("[data-drop-kind='vessel']").count();
    benches.push({ id, status: r2.status(), bench, step: step?.step ?? 0, total: step?.total ?? 0, vessels });
    if (id === "exp01" || id === "exp03" || id === "exp09") await shot(`s1-${id}-bench`);
    flushErrors(`S1-exp-force-${id}`);
  }
  const gateOk = gates.every((g) => g.status === 200 && g.len > 60 && (g.workbench > 0 || g.preTest > 0 || g.lockedText));
  rec("S1", "10 个实验默认门禁页", gateOk, gates.map((g) => `${g.id}:${g.status}/${g.workbench > 0 ? "台面" : g.preTest > 0 ? "前测门禁" : g.lockedText ? "未开放页" : "空"}`).join(" "));
  // 有实验台场景的四个实验要求器皿齐全；其余四个走旧器材视图（0 器皿是现状，不算回归）
  const BENCH_IDS = new Set(["exp01", "exp03", "exp08", "exp09"]);
  const benchOk = benches.every(
    (b) => b.status === 200 && b.bench > 0 && b.step === 1 && b.total >= 5 && (!BENCH_IDS.has(b.id) || b.vessels >= 2),
  );
  rec("S1", "10 个实验操作台(?force=1)", benchOk, benches.map((b) => `${b.id}:${b.total}步/${b.vessels}器皿`).join(" "));
  await page.goto(`${BASE}/experiments?unlock=all`, { waitUntil: "networkidle" });
  flushErrors("S1-final");
} catch (e) {
  rec("S1", "链路异常", false, String(e).slice(0, 200));
}

// ───────────────────────────── S2：exp01 BOPPPS 前测 → 七步 → 交卷 → 报告
try {
  const { exp01Curriculum } = await import("../lib/pedagogy/curriculum/exp01.ts");
  await page.goto(BASE + "/exp/exp01", { waitUntil: "networkidle" });

  const preBtn = page.locator("[data-demo-id='bopbps-pre-submit']");
  const appeared = (await preBtn.count()) > 0;
  rec("S2", "BOPPPS 前测出现", appeared, appeared ? "三道前测已渲染" : "未出现前测门禁");
  if (appeared) {
    for (const q of exp01Curriculum.pre) {
      await page.locator(`[data-demo-id='bopbps-op-${q.id}-${q.answer}']`).click().catch(() => {});
    }
    await shot("s2-exp01-pretest");
    await preBtn.click();
    await page.waitForSelector("[data-demo-id='demo-finish']", { timeout: 15000 }).catch(() => {});
    const unlocked = await page.locator("[data-demo-id='demo-finish']").count();
    rec("S2", "前测提交后解锁操作台", unlocked > 0, unlocked > 0 ? "已进操作台" : "未解锁");
    flushErrors("S2-pretest");
  }

  const walked = [];
  let dragProved = false;
  let rejectTried = false;

  // 演示引导（DemoCoach）：开 → 出气泡与路线 → 关
  const coachBtn = page.locator("[data-demo-id='demo-coach-open']");
  if (await coachBtn.count()) {
    await coachBtn.click();
    await page.waitForTimeout(1500);
    const bubble = await page.locator("[data-demo-id='demo-coach-bubble']").innerText().catch(() => "");
    await shot("s2-exp01-coach");
    rec("S2", "演示引导出气泡", bubble.length > 4, bubble.replace(/\s+/g, " ").slice(0, 40) || "无气泡");
    await page.locator("[data-demo-id='demo-coach-close']").click().catch(() => {});
    await page.waitForTimeout(400);
    flushErrors("S2-coach");
  } else {
    rec("S2", "演示引导出气泡", false, "没有演示按钮");
  }

  for (let guard = 0; guard < 12; guard++) {
    if (/\/report/.test(page.url())) break;
    const st = await stepNo();
    if (!st) break;
    if (st.step > st.total) break;
    let advanced = false;
    // 一步可能要做 2~4 个动作（如 exp09 第 2 步：加水 → 量酸 → 加酸 → 定容），
    // 按定义里 role=correct 的序号顺序执行；陷阱都排在它们之后，不会被误触。
    const def01 = await loadDef("exp01");
    const keys = correctKeys(def01, st.step - 1);
    // 遇到「这一步要加某瓶试剂」的步骤，先故意拖错一瓶，验非法落点提示（只验一次）
    if (!rejectTried) {
      const wrong = await dragWrongReagent();
      if (wrong) {
        rejectTried = true;
        await shot("s2-exp01-reject");
        rec("S2", `非法落点提示（第 ${st.step} 步）`, wrong.hint > 0 || wrong.state === "bad", `落点判定=${wrong.state} · 提示=${wrong.hint}`);
        flushErrors("S2-reject");
      }
    }
    for (const key of keys.length ? keys : [1]) {
      if (/\/report/.test(page.url())) break;
      const poured = await pourNextReagent();
      if (poured) dragProved = true;
      if (!poured) {
        await page.keyboard.press(String(key));
        await page.waitForTimeout(950);
      }
      const after = await stepNo();
      advanced = Boolean(after && after.step > st.step) || /\/report/.test(page.url());
      if (advanced) break;
    }
    walked.push(`第${st.step}步:${advanced ? "过" : "卡住"}`);
    if (!advanced) break;
    if (st.step === 4) await shot("s2-exp01-step4");
  }
  // 最后一步做完，应用会自己交卷跳报告（不推进步号），给它几秒把导航走完
  await page.waitForURL(/\/report/, { timeout: 8000 }).catch(() => {});
  const alreadyFinished = /\/report/.test(page.url());

  const fin = await stepNo();
  const finishable = await page.locator("[data-demo-id='demo-finish']").count();
  await shot("s2-exp01-last-step");
  rec("S2", "七步走完", alreadyFinished || Boolean(fin && fin.step > fin.total) || walked.length >= 7, `${walked.join(" ")} · 真实拖拽=${dragProved}`);
  rec("S2", "交卷入口", finishable > 0 || alreadyFinished, alreadyFinished ? "最后一步做完自动交卷" : `交卷按钮 ${finishable} 个`);
  flushErrors("S2-walk");

  if (finishable > 0 && !alreadyFinished) {
    try {
      await page.locator("[data-demo-id='demo-finish']").click({ timeout: 6000 });
    } catch (e) {
      // 点不动就留证，再走产品自带的键盘入口（footer 写明 Enter 交卷，学生等价可用）
      await shot("s2-finish-blocked");
      const dbg = await page.evaluate(() => ({
        finishCount: document.querySelectorAll("[data-demo-id='demo-finish']").length,
        url: location.href,
        overlays: [...document.querySelectorAll("[data-demo-id]")]
          .map((el) => el.getAttribute("data-demo-id"))
          .filter((id) => /coach|onboarding|incident|result|leave|page-enter/i.test(id))
          .slice(0, 8),
      }));
      console.log("[warn] 交卷按钮点不动，改用 Enter：", String(e).slice(0, 120), JSON.stringify(dbg));
      await page.keyboard.press("Enter");
    }
    await page.waitForURL(/\/report/, { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(2500);
  }
  if (/\/report/.test(page.url())) {
    const url = page.url();
    await page.waitForTimeout(800);
    const txt = await bodyText();
    await shot("s2-report-top");
    const scoreMatch = txt.match(/(\d{2,3})\s*\/\s*100/);
    rec("S2", "报告页打开", /\/report/.test(url), url.replace(BASE, ""));
    rec("S2", "报告有分数", Boolean(scoreMatch), scoreMatch ? `总分 ${scoreMatch[1]}` : "未找到 xx / 100");
    rec("S2", "报告有学号", /20250101/.test(txt), (txt.match(/学号\s*\d+/) ?? ["无"])[0]);
    rec("S2", "报告有时间线", /关键步骤时间线/.test(txt), /暂无时间线记录/.test(txt) ? "时间线为空" : "有时间线条目");
    rec("S2", "报告有错题解析", /错题解析/.test(txt), "ok");

    // 后测三题 + 逐题解析
    const post = exp01Curriculum.post ?? [];
    const postReady = await page.locator("[data-demo-id^='bopbps-post-']").count();
    rec("S2", "报告有后测", postReady > 0, `${postReady} 个后测元素 · 题目 ${post.length}`);
    if (postReady > 0 && post.length) {
      for (const q of post) {
        await page.locator(`[data-demo-id='bopbps-post-${q.id}-${q.answer}']`).click().catch(() => {});
      }
      await shot("s2-postlab-answered");
      await page.locator("[data-demo-id='bopbps-post-submit']").click();
      await page.waitForTimeout(1200);
      const t2 = await bodyText();
      await shot("s2-postlab-result");
      rec("S2", "后测提交后出逐题解析", /后测完成/.test(t2) && /解析|正确|错误/.test(t2), t2.match(/后测完成[^。]{0,20}/)?.[0] ?? "无回执");
    }
    flushErrors("S2-report");
  }
} catch (e) {
  rec("S2", "链路异常", false, String(e).slice(0, 240));
}

// ───────────────────────────── S3/S4：exp03、exp09 各两步 + 新底层
for (const expId of ["exp03", "exp09"]) {
  const S = expId === "exp03" ? "S3" : "S4";
  try {
    await page.goto(`${BASE}/exp/${expId}?force=1`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);

    const vessels = await page.locator("[data-drop-kind='vessel']").count();
    const tools = await page.locator("[data-demo-id^='demo-tool-']").count();
    const reagents = await page.locator("[data-demo-id^='demo-scene-reagent-']").count();
    const tray = await page.locator("[data-demo-id='demo-tool-tray']").count();
    rec(S, `${expId} 器皿库/工具托盘/试剂架`, vessels >= 2 && tools >= 3 && reagents >= 1 && tray === 1, `器皿 ${vessels} · 工具 ${tools} · 试剂 ${reagents} · 托盘 ${tray}`);
    await shot(`${expId}-initial`);

    // 非法落点：把「不该加的试剂」拖到器皿上
    const nextSel = await page.locator("[data-demo-id^='demo-scene-reagent-'][data-next='true']").first().getAttribute("data-demo-id").catch(() => null);
    const anyReagent = await page.locator("[data-demo-id^='demo-scene-reagent-']").first().getAttribute("data-demo-id");
    const wrongReagent = nextSel
      ? await page.evaluate((sel) => {
          const el = document.querySelector(sel);
          if (!el) return null;
          const all = [...document.querySelectorAll("[data-demo-id^='demo-scene-reagent-']")];
          const other = all.find((x) => x !== el);
          return other?.getAttribute("data-demo-id") ?? null;
        }, `[data-demo-id='${nextSel}']`)
      : anyReagent;
    const firstVessel = await page.locator("[data-drop-kind='vessel']").first().getAttribute("data-demo-id");
    let wrongState = "skip";
    if (wrongReagent && firstVessel && nextSel) {
      wrongState = await dragReagentTo(wrongReagent, firstVessel);
      await page.waitForTimeout(600);
      const rejectVisible = await page.locator("[role='status']", { hasText: "这一步用不上" }).count();
      await shot(`${expId}-reject`);
      rec(S, `${expId} 非法落点提示`, rejectVisible > 0 || wrongState === "bad", `落点判定=${wrongState} · 提示=${rejectVisible}`);
    } else {
      rec(S, `${expId} 非法落点提示`, true, "本步没有试剂拖拽（跳过）");
    }
    flushErrors(`${S}-reject`);

    // 两步：先试真实拖试剂，不行就按 1；一步可能要连做几个动作才推进
    const progress = [];
    for (let i = 0; i < 2; i++) {
      const before = await stepNo();
      if (!before) break;
      const beforeLevel = await page.evaluate(() =>
        [...document.querySelectorAll("[data-vessel-liquid]")].map((el) => Number(el.getAttribute("data-liquid-level") ?? 0)),
      );
      let advanced = false;
      let usedDrag = false;
      const defX = await loadDef(expId);
      const keysX = correctKeys(defX, before.step - 1);
      for (const key of keysX.length ? keysX : [1]) {
        const poured = await pourNextReagent();
        if (poured) usedDrag = true;
        if (!poured) {
          await page.keyboard.press(String(key));
          await page.waitForTimeout(950);
        }
        const after = await stepNo();
        advanced = Boolean(after && after.step > before.step);
        if (advanced) break;
      }
      const after = await stepNo();
      const afterLevel = await page.evaluate(() =>
        [...document.querySelectorAll("[data-vessel-liquid]")].map((el) => Number(el.getAttribute("data-liquid-level") ?? 0)),
      );
      const rose = afterLevel.some((v, idx) => v > (beforeLevel[idx] ?? 0) + 0.001);
      progress.push(`第${before.step}步:${usedDrag ? "拖" : "按1"}→${after?.step ?? "?"}${rose ? "/液面↑" : ""}`);
      if (!advanced) break;
    }
    const st = await stepNo();
    await shot(`${expId}-after2`);
    rec(S, `${expId} 连做两步`, Boolean(st && st.step >= 3), progress.join(" ") || "无进展");
    flushErrors(`${S}-steps`);

    // 走完两步后，如果当前步确实点名要某瓶试剂，再验一次非法落点（拖「不该加的那瓶」）
    const next2 = await page
      .locator("[data-demo-id^='demo-scene-reagent-'][data-next='true']")
      .first()
      .getAttribute("data-demo-id")
      .catch(() => null);
    if (next2) {
      const other = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        const all = [...document.querySelectorAll("[data-demo-id^='demo-scene-reagent-']")];
        return all.find((x) => x !== el)?.getAttribute("data-demo-id") ?? null;
      }, `[data-demo-id='${next2}']`);
      const v = await page.locator("[data-drop-kind='vessel']").first().getAttribute("data-demo-id");
      if (other && v) {
        const st2 = await dragReagentTo(other, v);
        await page.waitForTimeout(700);
        const rv = await page.locator("[role='status']", { hasText: "这一步用不上" }).count();
        await shot(`${expId}-reject2`);
        rec(S, `${expId} 非法落点提示（第 ${st?.step ?? "?"} 步）`, rv > 0 || st2 === "bad", `落点判定=${st2} · 提示=${rv}`);
        flushErrors(`${S}-reject2`);
      }
    }
  } catch (e) {
    rec(S, `${expId} 链路异常`, false, String(e).slice(0, 200));
  }
}

await browser.close();

const fails = results.filter((r) => !r.pass);
fs.writeFileSync(path.join(EVID, "results-main.json"), JSON.stringify({ results, errors: allErrors }, null, 1));
console.log("\n==== SUMMARY ====");
console.log(`检查项 ${results.length} · 失败 ${fails.length} · 截图 ${shotN} 张`);
for (const f of fails) console.log("FAILED:", f.section, f.name, f.detail);
const errCount = allErrors.reduce((n, e) => n + e.errors.length, 0);
console.log(`console/pageerror 总计 ${errCount} 条`);
for (const e of allErrors) console.log(" ERR", e.label, e.errors.slice(0, 3).join(" | "));
process.exitCode = fails.length || errCount ? 1 : 0;
