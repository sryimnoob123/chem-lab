/**
 * E1 学生全链路真点巡检（登录 → 前测 → 七步 → 交卷 → 后测 → 分数 → 拼接实验 → 教师端 → 导出 CSV）
 *
 * 做法：全部走 DOM（点按钮 / 拖器皿 / 拖试剂 / 填表单），不直接请求业务 API。
 * 只在前测、后测「故意先按第一个选项提交」拿不到答案时，才从页面已揭示的「答案 X」里取正确答案 ——
 * 那是学生自己提交后页面给的解析，仍然是人能看到的路径。
 *
 * 用法：
 *   node .team/e1-chain.mjs                                  # 默认打 3000，证据落 evidence/2026-10-24-e1/
 *   node .team/e1-chain.mjs --base http://127.0.0.1:3001 --out evidence/2026-10-24-e1/prod-3001
 *
 * 输出：每步一行 `[01 登录] OK ... 耗时=...ms`，结束时打印 JSON 汇总（含全部非 2xx 请求）。
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

/* ------------------------------------------------------------------ 参数 / 路径 */

const argv = process.argv.slice(2);
const argOf = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

const BASE = (argOf("--base", process.env.E1_BASE ?? "http://127.0.0.1:3000")).replace(/\/$/, "");
const OUT = path.resolve(argOf("--out", "evidence/2026-10-24-e1"));
const STUDENT = { no: "20250101", name: "周若曦" };
const TEACHER_PASSCODE = "2026";
const HEADLESS = argOf("--headed", "") !== "1";
/** 诊断开关：先用应用自己的 POST /api/session 种上 chem_sid，再跑后续环节。
 *  用途是把「登录页不种 cookie」和「登录之后还断在哪」分开定位 —— 结果里会标 sessionSeeded。 */
const SEED_SESSION = argOf("--seed-session", "") === "1";
fs.mkdirSync(OUT, { recursive: true });

/* ------------------------------------------------------------------ 收集器 */

const steps = [];
const net = []; // 非 2xx 响应
const consoleErrors = [];
const pageErrors = [];
const notes = [];
let tag = "setup";

function watch(page) {
  page.on("response", (res) => {
    const status = res.status();
    if (status < 400) return;
    const u = new URL(res.url());
    net.push({
      step: tag,
      status,
      method: res.request().method(),
      url: u.pathname + u.search,
      resource: res.request().resourceType(),
    });
  });
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text().slice(0, 300);
    if (/favicon/i.test(text)) return;
    consoleErrors.push({ step: tag, text });
  });
  page.on("pageerror", (err) => {
    pageErrors.push({ step: tag, text: String(err?.message ?? err).slice(0, 300) });
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------------------ 小工具 */

function shot(page, stepObj, name) {
  const file = path.join(OUT, `${name}.png`);
  stepObj.shot = path.relative(process.cwd(), file).replace(/\\/g, "/");
  return page.screenshot({ path: file, fullPage: false }).catch(() => undefined);
}

/** 读当前工作台步号：页面顶部「第 01 步 / 共 07 步」 */
async function stepNoOf(page) {
  const text = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
  const m = /第\s*0*(\d+)\s*步\s*\/\s*共\s*0*(\d+)\s*步/.exec(text);
  return m ? { cur: Number(m[1]), total: Number(m[2]) } : null;
}

/** 真拖拽：按下 → 插值移动（触发 pointermove 的 >4px 判定）→ 松手 */
async function drag(page, fromSel, toSel) {
  const from = page.locator(fromSel).first();
  const to = page.locator(toSel).first();
  if (!(await from.count())) throw new Error(`拖拽起点不存在：${fromSel}`);
  if (!(await to.count())) throw new Error(`拖拽终点不存在：${toSel}`);
  const a = await from.boundingBox();
  const b = await to.boundingBox();
  if (!a || !b) throw new Error(`拖拽元素不可见：${!a ? fromSel : toSel}`);
  const sx = a.x + a.width / 2;
  const sy = a.y + a.height / 2;
  const ex = b.x + b.width / 2;
  const ey = b.y + b.height / 2;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) {
    await page.mouse.move(sx + ((ex - sx) * i) / 10, sy + ((ey - sy) * i) / 10, { steps: 2 });
    await sleep(25);
  }
  await sleep(90);
  await page.mouse.up();
}

async function clickIfPresent(page, selector, timeout = 4000) {
  const loc = page.locator(selector).first();
  if (!(await loc.count())) return false;
  if (!(await loc.isVisible().catch(() => false))) return false;
  await loc.click({ timeout }).catch(() => undefined);
  return true;
}

/** 等条件成立（默认 8s），返回是否成立 */
async function waitUntil(check, timeout = 8000, interval = 200) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await check().catch(() => false)) return true;
    await sleep(interval);
  }
  return false;
}

/** 等到 React 真的把这个元素接管了（dev 模式水合慢，没水合的按钮点了等于没点） */
async function waitHydrated(page, selector, timeout = 25000) {
  return waitUntil(
    async () =>
      page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) return false;
        return Object.keys(el).some((k) => k.startsWith("__reactProps"));
      }, selector),
    timeout,
    250,
  );
}

/** 反复点直到目标元素出现（dev 模式水合慢，第一次点可能落在未挂载的按钮上） */
async function clickUntil(page, doClick, ready, attempts = 3, waitMs = 5000) {
  for (let i = 0; i < attempts; i++) {
    await doClick().catch(() => undefined);
    if (await waitUntil(ready, waitMs)) return true;
  }
  return false;
}

/** 把整页折成一行，便于在报错里带「现象」 */
async function pageSummary(page) {
  return page.evaluate(() => {
    const t = (document.body?.innerText ?? "").replace(/\s+/g, " ").trim();
    return `${location.pathname}${location.search} :: ${t.slice(0, 220)}`;
  });
}

/** 每步统一封装：计时、截图、打印、异常转 FAIL */
async function runStep(no, name, fileBase, fn, page) {
  const current = { no, name, ok: false, ms: 0, detail: "", shot: null };
  tag = `${no} ${name}`;
  const started = Date.now();
  try {
    current.detail = (await fn(current)) ?? "";
    current.ok = true;
  } catch (err) {
    current.detail = String(err?.message ?? err).slice(0, 400);
  }
  current.ms = Date.now() - started;
  if (page && !page.isClosed()) await shot(page, current, fileBase).catch(() => undefined);
  console.log(
    `[${no} ${name}] ${current.ok ? "OK" : "FAIL"} ${current.detail} 耗时=${current.ms}ms` +
      (current.shot ? ` shot=${current.shot}` : ""),
  );
  steps.push(current);
  return current;
}

const fail = (msg) => {
  throw new Error(msg);
};

/* ------------------------------------------------------------------ 链路各段 */

/** 01 登录：学生入口，学号 + 姓名 → cookie chem_sid → /experiments */
async function doLogin(page) {
  const res = await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  if (!res || res.status() >= 400) fail(`/login HTTP ${res?.status()}`);
  await page.waitForSelector("input", { timeout: 15000 });

  // 「学生登录」页签（默认就是学生，点一下确保不在教师页签）
  await page.getByRole("button", { name: /^学生登录$/ }).first().click({ timeout: 4000 }).catch(() => undefined);
  await sleep(300);

  const inputs = page.locator("input");
  const n = await inputs.count();
  if (n < 2) fail(`登录页输入框只有 ${n} 个`);
  await inputs.nth(0).fill(STUDENT.no); // placeholder「如 20250101」= 学号
  await inputs.nth(1).fill(STUDENT.name);

  // 点「进入实验」时记录会话类接口有没有被调用（登录是否真的走后端）
  const sessionCalls = [];
  const onResponse = (r) => {
    if (/\/api\/session/.test(r.url())) sessionCalls.push(r.status());
  };
  page.on("response", onResponse);

  await waitHydrated(page, "input");
  await page.getByRole("button", { name: /进入实验|登录|开始/ }).first().click({ timeout: 8000 });

  let left = await waitUntil(async () => !/\/login/.test(new URL(page.url()).pathname), 12000);
  if (!left) {
    // dev 模式水合慢：第一次点可能落在还没挂上 onClick 的按钮上，再点一次
    notes.push("第一次点「进入实验」没跳转（登录页水合慢），重试一次");
    await page.getByRole("button", { name: /进入实验|登录|开始/ }).first().click({ timeout: 8000 }).catch(() => undefined);
    left = await waitUntil(async () => !/\/login/.test(new URL(page.url()).pathname), 15000);
  }
  page.off("response", onResponse);
  if (!left) fail(`点「进入实验」后仍停在 ${page.url()}（${await pageSummary(page)}）`);

  const cookies = await page.context().cookies();
  const sid = cookies.find((c) => c.name === "chem_sid");

  if (!/\/experiments/.test(new URL(page.url()).pathname)) {
    // 允许落到首页，但必须能再进实验列表
    await page.goto(`${BASE}/experiments`, { waitUntil: "domcontentloaded" });
  }
  await page.waitForSelector("[data-demo-id^='demo-catalog-']", { timeout: 15000 }).catch(() => undefined);
  const body = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
  const where = new URL(page.url()).pathname;
  if (body.length < 40) fail(`/experiments 空白（${body.length} 字符）`);

  if (!sid) {
    notes.push(
      `登录页点「进入实验」只做了前端 router.push，没有请求 /api/session（本次记录到 ${sessionCalls.length} 次调用），` +
        `因此浏览器里没有 chem_sid —— 所有按学号归属的页面/接口（/plan、报告、教师台账、动作落库）都拿不到身份`,
    );
    fail(
      `跳转到 ${where} 但没种 chem_sid（登录页未调用 /api/session；调用次数=${sessionCalls.length}）；` +
        `后端未参与鉴权，后续按学号归属的功能会退化为匿名`,
    );
  }
  return `学号=${STUDENT.no} 姓名=${STUDENT.name} chem_sid=${sid.value.slice(0, 12)}… url=${where} api/session=${sessionCalls.join(",")}`;
}

/** 诊断用：用应用自己的 POST /api/session 把 chem_sid 种进 context（不打业务接口、只补身份） */
async function seedSession(page) {
  const res = await page.request.post(`${BASE}/api/session`, {
    headers: { "content-type": "application/json" },
    data: { studentNo: STUDENT.no, name: STUDENT.name },
  });
  const jar = await page.context().cookies();
  const sid = jar.find((c) => c.name === "chem_sid");
  if (!res.ok() || !sid) fail(`种 session 失败：HTTP ${res.status()} cookie=${Boolean(sid)}`);
  notes.push(`诊断模式：已用 POST /api/session 补种 chem_sid（模拟「登录页本该做的事」），后续环节照常真点`);
  return `已补种 chem_sid（HTTP ${res.status()}）`;
}

/** 从页面上已揭示的解析按题取正确答案：优先「答案 X」，答对的题页面显示「✓ 正确 ·」，
 *  则回落到本轮实际点的那个选项（调用方传入 pickedByDefault）。 */
async function revealedAnswers(page, prefix, pickedByDefault = "A") {
  return page.evaluate(
    ({ p, fallback }) => {
      const out = {};
      const re = new RegExp(`^${p}-(.+)-([A-Z])$`);
      for (const btn of document.querySelectorAll(`[data-demo-id^="${p}-"]`)) {
        const m = re.exec(btn.getAttribute("data-demo-id") ?? "");
        if (!m) continue;
        const qid = m[1];
        if (qid in out) continue;
        const block = btn.parentElement?.parentElement ?? btn.parentElement;
        const text = block?.innerText ?? "";
        const ans = /答案\s*([A-Z])/.exec(text);
        if (ans) out[qid] = ans[1];
        else if (/✓\s*正确/.test(text)) out[qid] = fallback;
      }
      return out;
    },
    { p: prefix, fallback: pickedByDefault },
  );
}

/** 02 前测：进实验 → 前测存在就做完 → 断言操作台解锁 */
async function doPreTest(page, stepObj) {
  // 从实验列表的卡片进（真点，不直接敲 URL）
  const card = page.locator('[data-demo-id="demo-catalog-exp01"]').first();
  let entered = false;
  if (await card.count()) {
    await card.click({ timeout: 8000 }).catch(() => undefined);
    entered = await waitUntil(async () => /\/exp\/exp01/.test(page.url()), 15000);
  }
  if (!entered) {
    notes.push("实验列表卡片没点进 exp01，退回直接导航 /exp/exp01");
    const r = await page.goto(`${BASE}/exp/exp01`, { waitUntil: "domcontentloaded" });
    if (!r || r.status() >= 400) fail(`/exp/exp01 HTTP ${r?.status()}`);
  }
  await sleep(1200);

  const gate = page.locator('[data-demo-id="bopbps-pre-submit"]').first();
  const hasPre = (await gate.count()) > 0;
  if (!hasPre) {
    // 没前测（或已被 localStorage 记住）：只要求操作台在
    const bench = await page.locator('[data-demo-id="exp01-bench-scene"]').count();
    if (!bench) {
      const probe = await page.request.get(`${BASE}/exp/exp01`);
      const title = await page.title().catch(() => "");
      fail(
        `进实验后既没有前测也没有操作台（HTTP ${probe.status()}，document.title="${title}"）：${await pageSummary(page)}`,
      );
    }
    notes.push("前测门禁未出现（可能已通过 localStorage 记住），直接进操作台");
    return "无前测门禁，操作台已在";
  }
  await shot(page, stepObj, "02-前测-门禁").catch(() => undefined);
  await waitHydrated(page, '[data-demo-id="bopbps-pre-submit"]');
  const benchVisible = async () =>
    (await page.locator('[data-demo-id="exp01-bench-scene"]').count()) > 0 &&
    (await page.locator('[data-demo-id="bopbps-pre-submit"]').count()) === 0;

  const pick = async (keys) => {
    const qids = await page.evaluate(() =>
      [...new Set([...document.querySelectorAll('[data-demo-id^="bopbps-op-"]')].map((el) => {
        const m = /^bopbps-op-(.+)-([A-Z])$/.exec(el.getAttribute("data-demo-id") ?? "");
        return m ? m[1] : "";
      }).filter(Boolean))],
    );
    for (const qid of qids) {
      const key = keys[qid] ?? "A";
      await page.locator(`[data-demo-id="bopbps-op-${qid}-${key}"]`).first().click({ timeout: 5000 });
      await sleep(120);
    }
    await page.locator('[data-demo-id="bopbps-pre-submit"]').first().click({ timeout: 5000 });
    await sleep(700);
  };

  // ① 任务书口径：每题选第一个选项 → 提交
  await pick({});
  const firstTryUnlocked = await waitUntil(benchVisible, 2500);
  if (firstTryUnlocked) return "前测：首选项即通过（一次解锁）";

  const revealed = await revealedAnswers(page, "bopbps-op");
  const hintLine = await page.evaluate(() => {
    const m = document.body.innerText.match(/还有错题[^\n]*|全部正确[^\n]*/);
    return m ? m[0].trim() : "";
  });
  const detail = `首选项未解锁（页面提示「${hintLine}」）`;
  notes.push(`前测不是「选第一个就能交」：${detail}`);

  // ② 用页面刚揭示的答案重做（学生看完解析再改选，是页面明示的路径）
  const qids = await page.evaluate(() =>
    [...new Set([...document.querySelectorAll('[data-demo-id^="bopbps-op-"]')].map((el) => {
      const m = /^bopbps-op-(.+)-([A-Z])$/.exec(el.getAttribute("data-demo-id") ?? "");
      return m ? m[1] : "";
    }).filter(Boolean))],
  );
  const missingQ = qids.filter((qid) => !revealed[qid]);
  if (missingQ.length) fail(`解析里取不到 ${missingQ.join("/")} 的答案：${detail}`);
  const correct = {};
  qids.forEach((qid) => (correct[qid] = revealed[qid]));

  await clickIfPresent(page, '[data-demo-id="bopbps-pre-reset"]');
  await sleep(400);
  await pick(correct);

  if (!(await waitUntil(benchVisible, 6000))) fail(`按解析答案重做后仍未解锁：${await pageSummary(page)}`);
  return `${detail} → 按页面解析答案（${Object.values(correct).join("/")}）重做后解锁`;
}

/** 03 七步：按每步正确的 DOM 操作真点/真拖，步号必须恰好 +1 */
async function doSevenSteps(page) {
  const seq = {
    1: { how: "容量瓶拖进洗涤槽", run: () => drag(page, '[data-demo-id="demo-scene-vessel-volumetric"]', '[data-demo-id="demo-scene-sink"]') },
    2: { how: "点天平（调平+内校）", run: () => page.locator('[data-demo-id="demo-scene-instrument-balance"]').first().click({ timeout: 6000 }) },
    3: { how: "点天平（差减称量）", run: () => page.locator('[data-demo-id="demo-scene-instrument-balance"]').first().click({ timeout: 6000 }) },
    4: { how: "蒸馏水拖到烧杯（溶解）", run: () => drag(page, '[data-demo-id="demo-scene-reagent-water"]', '[data-demo-id="demo-scene-vessel-beaker"]') },
    5: { how: "蒸馏水拖到容量瓶（定容）", run: () => drag(page, '[data-demo-id="demo-scene-reagent-water"]', '[data-demo-id="demo-scene-vessel-volumetric"]') },
    6: { how: "移液管拖到锥形瓶（移取）", run: () => drag(page, '[data-demo-id="demo-tool-pipette"]', '[data-demo-id="demo-scene-vessel-flask"]') },
    7: { how: "浓硫酸拖到烧杯（稀释+贴签）", run: () => drag(page, '[data-demo-id="demo-scene-reagent-h2so4-conc"]', '[data-demo-id="demo-scene-vessel-beaker"]') },
  };
  const done = [];
  const seen = [];
  const started = await stepNoOf(page);
  if (!started) fail(`工作台没渲染出步号：${await pageSummary(page)}`);
  seen.push(started.cur);
  let autoFinished = false;

  for (let guard = 0; guard < 20; guard++) {
    if (/\/(postlab|report)/.test(new URL(page.url()).pathname)) {
      // 最后一步做完页面会 1.4s 后自动交卷跳走（设计如此），这也算七步走通
      autoFinished = true;
      break;
    }
    const at = await stepNoOf(page);
    if (!at) {
      if (/\/(postlab|report)/.test(new URL(page.url()).pathname)) {
        autoFinished = true;
        break;
      }
      fail(`第 ${done.length + 1} 步时读不到步号：${await pageSummary(page)}`);
    }
    if (at.cur > at.total) break;
    const plan = seq[at.cur];
    if (!plan) fail(`第 ${at.cur} 步没有登记操作`);

    const before = at.cur;
    await plan.run();
    let advanced = await waitUntil(async () => {
      if (/\/(postlab|report)/.test(new URL(page.url()).pathname)) return true;
      const now = await stepNoOf(page);
      return !now || now.cur !== before;
    }, 9000);
    if (!advanced) {
      // 兜底：场景里的器皿/线索点一下也能完成当前建议动作（页面对「点选」模式的既有路径）
      notes.push(`第 ${before} 步「${plan.how}」一次没推进，用点 cue 器皿兜底`);
      await clickIfPresent(page, '[data-cue="true"]', 3000);
      advanced = await waitUntil(async () => {
        if (/\/(postlab|report)/.test(new URL(page.url()).pathname)) return true;
        const now = await stepNoOf(page);
        return !now || now.cur !== before;
      }, 6000);
    }
    if (!advanced) fail(`第 ${before} 步卡住（${plan.how}）：${await pageSummary(page)}`);

    const after = await stepNoOf(page);
    if (after) seen.push(after.cur);
    done.push(`${before}:${plan.how}`);
  }

  // 每一步都必须恰好 +1（第 7 步后自动跳转，不再有步号）
  const expect = [1, 2, 3, 4, 5, 6, 7];
  const bad = expect.filter((n, i) => seen[i] !== n);
  if (bad.length) fail(`步号没有严格 +1：实际=${seen.join("→")}（${done.join(" | ")}）`);

  if (autoFinished) {
    const url = new URL(page.url());
    if (!/\/postlab/.test(url.pathname)) fail(`最后一步后跳到了 ${url.pathname}（不是后测页）`);
    return `7 步全过且自动交卷进后测 [${done.join(" | ")}] 步号=${seen.join("→")}`;
  }

  const finish = page.locator('[data-demo-id="demo-finish"]').first();
  if (!(await finish.count())) fail("七步走完但既没有自动跳转也没有「交卷」按钮");
  return `7 步全过（停在台面，需手动交卷）[${done.join(" | ")}] 步号=${seen.join("→")}`;
}

/** 04 交卷 + 后测 */
async function doFinishAndPostlab(page, stepObj) {
  // 正常路径：最后一步后页面已自动交卷跳到 /postlab；只有停在台面时才点「交卷」
  if (!/\/postlab/.test(new URL(page.url()).pathname)) {
    const finishBtn = page.locator('[data-demo-id="demo-finish"]').first();
    if (!(await finishBtn.count())) fail(`既不在后测页也没有「交卷」按钮：${await pageSummary(page)}`);
    await finishBtn.click({ timeout: 8000 });
  }
  const nav = await waitUntil(async () => /\/(postlab|report)/.test(new URL(page.url()).pathname), 30000);
  if (!nav) fail(`点交卷后没有跳转：${await pageSummary(page)}`);
  const url = new URL(page.url());
  if (/\/report/.test(url.pathname)) {
    const t = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " ").slice(0, 160));
    fail(`交卷直接落到报告页（跳过了后测）：${url.pathname}${url.search} :: ${t}`);
  }
  await page.waitForSelector('[data-demo-id="bopbps-post-submit"]', { timeout: 20000 });

  const qids = async () =>
    page.evaluate(() =>
      [...new Set([...document.querySelectorAll('[data-demo-id^="bopbps-post-"]')].map((el) => {
        const m = /^bopbps-post-(.+)-([A-Z])$/.exec(el.getAttribute("data-demo-id") ?? "");
        return m ? m[1] : "";
      }).filter(Boolean))],
    );
  const ids = await qids();
  if (ids.length === 0) fail("后测页没有题目");

  // 先按第一个选项交一遍（看解析），再按答案重做一次
  for (const qid of ids) {
    await page.locator(`[data-demo-id="bopbps-post-${qid}-A"]`).first().click({ timeout: 5000 });
    await sleep(100);
  }
  await page.locator('[data-demo-id="bopbps-post-submit"]').first().click({ timeout: 5000 });
  await sleep(800);

  const revealed = await revealedAnswers(page, "bopbps-post", "A");
  const known = ids.filter((qid) => revealed[qid]);
  if (known.length === ids.length) {
    await clickIfPresent(page, '[data-demo-id="bopbps-post-reset"]');
    await sleep(400);
    for (const qid of ids) {
      await page.locator(`[data-demo-id="bopbps-post-${qid}-${revealed[qid]}"]`).first().click({ timeout: 5000 });
      await sleep(100);
    }
    await page.locator('[data-demo-id="bopbps-post-submit"]').first().click({ timeout: 5000 });
    await sleep(900);
  } else {
    notes.push(`后测解析缺 ${ids.length - known.length} 题答案，保留首选项提交的结果`);
  }

  const postScore = await page.evaluate(() => {
    const t = document.body.innerText.replace(/\s+/g, " ");
    const m = /后测完成 · 得分 (\d+)\s*\/\s*100/.exec(t) ?? /后测 (\d+) \/ 100/.exec(t);
    return m ? Number(m[1]) : null;
  });
  await shot(page, stepObj, "04-后测");

  const next = page.locator('[data-demo-id="demo-postlab-next"]').first();
  if (!(await next.count())) fail("做完后测没有「进入报告与评分」按钮");
  await next.click({ timeout: 8000 });
  if (!(await waitUntil(async () => /\/report/.test(new URL(page.url()).pathname), 20000))) {
    fail(`点「进入报告与评分」没到报告页：${page.url()}`);
  }
  return `后测 ${postScore ?? "?"}/100，已进报告页 ${new URL(page.url()).pathname}`;
}

/** 05 分数：报告页必须有数字总分 + 页面自报的统计，不能是 — / NaN / undefined */
async function doScore(page) {
  await page.waitForSelector('[data-demo-id="demo-report"]', { timeout: 25000 });
  await sleep(900);
  const data = await page.evaluate(() => {
    const text = document.body.innerText.replace(/\s+/g, " ");
    const total = /总分\s*(\d+(?:\.\d+)?)\s*\/\s*100/.exec(text);
    const facts = [...document.querySelectorAll('[data-demo-id="demo-report-summary"] li')].map((li) =>
      li.textContent.replace(/\s+/g, " ").trim(),
    );
    // 三段分（aria-label="三段分"）：每块是「预习 10% / 100 / 前测正确率」
    const partsText = (document.querySelector('[aria-label="三段分"]')?.innerText ?? "").replace(/\s+/g, " ");
    const parts = {};
    for (const key of ["预习", "操作", "报告"]) {
      const m = new RegExp(`${key}\\s*\\d+%\\s*(\\d+)`).exec(partsText);
      if (m) parts[key] = Number(m[1]);
    }
    const postLine = /后测回顾[\s\S]{0,40}?(\d+)\s*\/\s*100/.exec(text);
    const badge = document.querySelector('[data-demo-id="demo-report-notice"]')?.textContent ?? "";
    return {
      total: total ? Number(total[1]) : null,
      raw: total ? total[0] : "",
      facts,
      parts,
      post: postLine ? Number(postLine[1]) : null,
      headline: (document.querySelector('[data-demo-id="demo-report-summary"]')?.textContent ?? "")
        .replace(/\s+/g, " ")
        .slice(0, 70),
      notice: badge.replace(/\s+/g, " ").slice(0, 120),
      excerpt: text.slice(0, 240),
      badWords: /NaN|undefined/.test(text),
    };
  });
  if (data.total === null) fail(`报告页找不到「总分 N / 100」：${data.excerpt}`);
  if (!Number.isFinite(data.total)) fail(`总分不是数字：${data.raw}`);
  if (data.badWords) fail("报告页出现 NaN/undefined 字样");
  if (data.total === 0) fail(`报告页总分是 0（${data.raw}）—— 动作没有落库或没有身份，分数算不出来`);
  // 前测分数必须真的进分数（2026-10-24：quiz_answers 只有读路径，预习分恒 0 的系统性缺口）
  const pre = data.parts["预习"];
  const op = data.parts["操作"];
  const rep = data.parts["报告"];
  if (pre === undefined || op === undefined || rep === undefined) {
    fail(`三段分读不全：${JSON.stringify(data.parts)}`);
  }
  if (!(pre > 0)) {
    fail(`预习分是 ${pre}（三段分 ${JSON.stringify(data.parts)}）—— 前测答案没落库，quiz_answers 里没有 phase="pre" 的行`);
  }
  const expectTotal = Math.round(0.1 * pre + 0.4 * op + 0.5 * rep);
  if (data.total !== expectTotal) {
    fail(`总分与三段分不自洽：页面 ${data.total}，按 10/40/50 重算 ${expectTotal}（${JSON.stringify(data.parts)}）`);
  }
  const partsStr = Object.entries(data.parts).map(([k, v]) => `${k}${v}`).join(" ");
  return `总分=${data.total}/100 三段分[${partsStr}] 后测=${data.post ?? "?"} 事实=[${data.facts.join(" / ")}]`;
}

/** 06 拼接实验：主题 → 拼方案 → 评分数字 → 场景按钮能播 */
async function doPlan(page, stepObj) {
  const res = await page.goto(`${BASE}/plan`, { waitUntil: "domcontentloaded" });
  if (!res || res.status() >= 400) fail(`/plan HTTP ${res?.status()}`);
  await page.waitForSelector('[data-demo-id^="demo-topic-"]', { timeout: 20000 });

  const topics = await page.evaluate(() =>
    [...document.querySelectorAll('[data-demo-id^="demo-topic-"]')]
      .map((el) => el.getAttribute("data-demo-id"))
      .filter((id) => /^demo-topic-[a-z]/.test(id ?? "")),
  );
  const topic = topics.find((t) => t === "demo-topic-topic-hcl-standard") ?? topics[0];
  if (!topic) fail("主题卡一个都没有");
  await waitHydrated(page, `[data-demo-id="${topic}"]`);
  const picked = await clickUntil(
    page,
    () => page.locator(`[data-demo-id="${topic}"]`).first().click({ timeout: 8000 }),
    async () => (await page.locator('[data-demo-id="demo-plan-start"]').count()) > 0,
    3,
    6000,
  );
  if (!picked) fail(`点了主题 ${topic} 之后没出现背景页（可能水合未完成）：${await pageSummary(page)}`);
  await sleep(400);

  // 背景页 → 开始设计方案
  const started = await clickUntil(
    page,
    () => page.locator('[data-demo-id="demo-plan-start"]').first().click({ timeout: 8000 }),
    async () => (await page.locator('[data-demo-id="demo-design-reference"]').count()) > 0,
    3,
    6000,
  );
  if (!started) fail(`背景页「开始设计方案」点了没进设计段：${await pageSummary(page)}`);

  // 载入参考方案（等价于把方案拼齐；点选/拖拽 PieceLibrary 用的同一份 pieces）
  await page.locator('[data-demo-id="demo-design-reference"]').first().click({ timeout: 8000 });
  await sleep(600);
  const count = (await page.locator('[data-demo-id="demo-design-piece-count"]').first().innerText().catch(() => "")).trim();
  if (!/^[1-9]/.test(count)) fail(`载入参考方案后方案条目仍是「${count}」`);

  await page.locator('[data-demo-id="demo-plan-submit"]').first().click({ timeout: 8000 });
  // 回放 → 直接看结果
  const replay = await page.waitForSelector('[data-demo-id="demo-replay"]', { timeout: 20000 }).catch(() => null);
  if (!replay) fail(`提交方案后没有回放：${await pageSummary(page)}`);
  await clickIfPresent(page, '[data-demo-id="demo-replay-skip"]', 5000);

  await page.waitForSelector('[data-demo-id="demo-design-score"]', { timeout: 20000 });
  const score = await page.evaluate(() => {
    const el = document.querySelector('[data-demo-id="demo-design-score"]');
    const src = document.querySelector('[data-demo-id="demo-design-score-source"]');
    return {
      text: (el?.textContent ?? "").replace(/\s+/g, " ").trim(),
      num: Number((el?.textContent ?? "").match(/(\d+(?:\.\d+)?)/)?.[1] ?? NaN),
      source: (src?.textContent ?? "").replace(/\s+/g, " ").trim(),
    };
  });
  if (!Number.isFinite(score.num) || score.num <= 0) fail(`拼接评分不是有效数字：${JSON.stringify(score)}`);

  // 场景按钮只在「设计方案」这一段出现（评分卡在提交后才有）→ 看完分数点「返回修改方案」回到设计段
  const back = page.locator('[data-demo-id="demo-plan-back"]').first();
  if (await back.count()) {
    await back.click({ timeout: 6000 });
    await sleep(600);
  }
  const scenes = await page.evaluate(() =>
    [...document.querySelectorAll('[data-demo-id^="demo-scenario-"]')]
      .map((el) => el.getAttribute("data-demo-id"))
      .filter((id) => id && id !== "demo-scenario-verdict"),
  );
  if (!scenes.length) fail("结果对照没有场景按钮（demo-scenario-*）");
  const pickedScene = scenes.includes("demo-scenario-good") ? "demo-scenario-good" : scenes[0];
  await page.locator(`[data-demo-id="${pickedScene}"]`).first().click({ timeout: 6000 });
  const verdict = await page.waitForSelector('[data-demo-id="demo-scenario-verdict"]', { timeout: 8000 }).catch(() => null);
  if (!verdict) fail(`点场景按钮 ${pickedScene} 后没有出现 verdict 区`);
  const played = await waitUntil(async () =>
    page.evaluate(() => {
      const el = document.querySelector('[data-demo-id="demo-scenario-verdict"]');
      const t = (el?.textContent ?? "").replace(/\s+/g, " ");
      return /正在演|strong|做到|不能|可行/.test(t) && t.length > 4;
    }),
  15000);
  const verdictText = await page.evaluate(() =>
    (document.querySelector('[data-demo-id="demo-scenario-verdict"]')?.textContent ?? "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120),
  );
  if (!played) fail(`场景 ${pickedScene} 点了没有进入播放/结论：${verdictText}`);
  await shot(page, stepObj, "06-拼接实验");

  return `主题=${topic} 条目=${count.trim()} 评分=${score.num}（${score.source || "来源未知"}） 场景=${pickedScene} → "${verdictText.slice(0, 60)}"`;
}

/** 07 教师端：口令 2026 解锁 → 学情看板有数据 → 出现本学生行 */
async function doTeacher(page) {
  const res = await page.goto(`${BASE}/teacher`, { waitUntil: "domcontentloaded" });
  if (!res || res.status() >= 400) fail(`/teacher HTTP ${res?.status()}`);
  await page.waitForSelector("table.ledger tbody tr", { timeout: 25000 }).catch(() => undefined);
  // 口令解锁（写操作 / 导出需要 chem_teacher）
  if (await page.locator("text=教师解锁").count()) {
    await waitHydrated(page, "button.tch-unlock");
    const opened = await clickUntil(
      page,
      () => page.getByRole("button", { name: "教师解锁" }).first().click({ timeout: 5000 }),
      async () => (await page.locator("#tch-passcode").count()) > 0,
      3,
      4000,
    );
    if (!opened) fail(`点了「教师解锁」没弹出口令输入框：${await pageSummary(page)}`);
    await page.locator("#tch-passcode").first().fill(TEACHER_PASSCODE, { timeout: 5000 });
    await page.getByRole("button", { name: /^解锁$/ }).first().click({ timeout: 5000 });
    await sleep(1500);
    await page.waitForLoadState("networkidle").catch(() => undefined);
  }
  const cookies = await page.context().cookies();
  const teacherCookie = cookies.find((c) => c.name === "chem_teacher");
  if (!teacherCookie) fail("口令 2026 没有种下 chem_teacher cookie");

  await page.waitForSelector("table.ledger tbody tr", { timeout: 20000 }).catch(() => undefined);
  const board = await page.evaluate(() => {
    const cards = [...document.querySelectorAll(".tch-stat")].map((el) => ({
      label: el.querySelector(".tch-stat__label")?.textContent?.trim() ?? "",
      value: el.querySelector(".tch-stat__value, strong, .mono")?.textContent?.trim() ?? el.textContent.trim(),
    }));
    const rows = [...document.querySelectorAll("table.ledger tbody tr")].map((tr) =>
      [...tr.querySelectorAll("td")].map((td) => td.textContent.replace(/\s+/g, " ").trim()),
    );
    return {
      cards,
      rowCount: rows.length,
      headers: [...document.querySelectorAll("table.ledger thead th")].map((th) => th.textContent.trim()),
      mine: rows.find((r) => r[0] === "20250101") ?? null,
      emptyText: (document.querySelector(".tch-empty")?.textContent ?? "").replace(/\s+/g, " ").trim(),
    };
  });
  if (board.emptyText) fail(`学情看板是空态：${board.emptyText}`);
  if (board.rowCount === 0) fail("学情看板没有学生行");
  const num = (label) => {
    const c = board.cards.find((x) => x.label.includes(label));
    const m = c ? /(\d+)/.exec(c.value) : null;
    return m ? Number(m[1]) : null;
  };
  const students = num("班级学生");
  const finished = num("已完成");
  if (!students) fail(`「班级学生」不是有效数字：${JSON.stringify(board.cards)}`);
  if (!board.mine) fail(`学生台账里没有 20250101 这一行（共 ${board.rowCount} 行）`);

  await page.screenshot({ path: path.join(OUT, "07-教师端.png") });
  return `学生数=${students} 已完成=${finished} 行数=${board.rowCount} 本生行=[${board.mine.join(" | ")}]`;
}

/** 08 导出 CSV：点按钮 → 真下载 → 文件 >0 → 表头含学号/分数 */
async function doExport(page) {
  const before = await page.locator('[data-demo-id="demo-teacher-export"]').count();
  if (!before) fail("教师端没有导出按钮");

  const exportStatus = [];
  const onRes = (r) => {
    if (/\/api\/teacher\/export/.test(r.url())) exportStatus.push(r.status());
  };
  page.on("response", onRes);

  const outcome = await Promise.all([
    Promise.race([
      page.waitForEvent("download", { timeout: 20000 }).then((d) => ({ kind: "download", download: d })).catch(() => null),
      page
        .waitForSelector('[data-demo-id="demo-teacher-export-msg"]', { timeout: 20000 })
        .then(() => ({ kind: "msg" }))
        .catch(() => null),
    ]),
    page.locator('[data-demo-id="demo-teacher-export"]').first().click({ timeout: 8000 }).catch(() => undefined),
  ]).then(([first]) => first);
  page.off("response", onRes);

  if (!outcome) fail(`点导出后 20s 内既没有下载也没有提示（导出接口状态=${exportStatus.join(",") || "未请求"}）`);

  if (outcome.kind === "msg") {
    const msg = (await page.locator('[data-demo-id="demo-teacher-export-msg"]').first().innerText().catch(() => "")).trim();
    fail(`导出没产生下载，页面提示「${msg}」（/api/teacher/export 状态=${exportStatus.join(",") || "未请求"}）`);
  }

  const download = outcome.download;
  const name = download.suggestedFilename();
  const file = path.join(OUT, "teacher-export.csv");
  await download.saveAs(file);
  const stat = fs.statSync(file);
  if (!stat.size) fail(`下载文件 0 字节：${name}`);

  const raw = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
  const lines = raw.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (!lines.length) fail("CSV 没有内容行");
  const header = lines[0];
  const want = ["学号", "姓名", "总分"];
  const missing = want.filter((w) => !header.includes(w));
  if (missing.length) fail(`CSV 表头缺列 ${missing.join("/")}：${header}`);
  const mine = lines.find((l) => l.startsWith("20250101,")) ?? null;
  const msg = await page.locator('[data-demo-id="demo-teacher-export-msg"]').first().innerText().catch(() => "");
  return `文件=${name} 字节=${stat.size} 行数=${lines.length} 表头="${header.slice(0, 80)}" 本生行=${mine ? mine.slice(0, 80) : "（未含 20250101）"} 页面提示="${msg.trim()}"`;
}

/* ------------------------------------------------------------------ 主流程 */

const browser = await chromium.launch({ headless: HEADLESS });
const startedAt = new Date();
const result = { base: BASE, out: path.relative(process.cwd(), OUT), startedAt: startedAt.toISOString() };

/** 被上游断点挡住的下游步骤也要在矩阵里留痕 */
function markBlocked(no, name, reason) {
  if (steps.some((s) => s.no === no)) return;
  const row = { no, name, ok: false, ms: 0, detail: `BLOCKED：${reason}`, shot: null };
  steps.push(row);
  console.log(`[${no} ${name}] FAIL BLOCKED：${reason} 耗时=0ms`);
}

try {
  // —— 学生链路：同一个 context 走到底
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true });
  const page = await ctx.newPage();
  watch(page);

  const s1 = await runStep("01", "登录", "01-登录", () => doLogin(page), page);
  if (!s1.ok && SEED_SESSION) {
    tag = "01b 补种会话";
    const seeded = await runStep("01b", "补种会话(诊断)", "01b-补种会话", () => seedSession(page), page);
    if (!seeded.ok) notes.push("补种 chem_sid 失败，后续按匿名身份继续");
  } else if (!s1.ok) {
    notes.push("登录没种 cookie，继续按匿名身份走后续环节，记录真实用户会遇到的断点");
  }

  let reason = "";
  const s2 = await runStep("02", "前测", "02-前测", (s) => doPreTest(page, s), page);
  if (!s2.ok) reason = "进实验/前测失败";

  let s3 = null;
  if (!reason) {
    s3 = await runStep("03", "七步", "03-七步", () => doSevenSteps(page), page);
    if (!s3.ok) reason = "七步未走通";
  }

  let s4 = null;
  if (!reason) {
    s4 = await runStep("04", "交卷+后测", "04-后测", (s) => doFinishAndPostlab(page, s), page);
    if (!s4.ok) reason = "交卷/后测失败";
  }

  if (!reason) {
    const s5 = await runStep("05", "分数", "05-分数", () => doScore(page), page);
    if (!s5.ok) notes.push("分数页没给出有效数字，拼接实验仍继续跑");
  }
  await runStep("06", "拼接实验", "06-拼接实验", (s) => doPlan(page, s), page);

  for (const [no, name] of [
    ["03", "七步"],
    ["04", "交卷+后测"],
    ["05", "分数"],
  ]) {
    if (reason) markBlocked(no, name, reason);
  }

  await ctx.close();

  // —— 教师链路：新 context（不共享学生 cookie），口令解锁
  const tctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true });
  const tpage = await tctx.newPage();
  watch(tpage);
  tag = "07 教师端";
  const s7 = await runStep("07", "教师端", "07-教师端", () => doTeacher(tpage), tpage);
  if (s7.ok) {
    await runStep("08", "导出CSV", "08-导出CSV", () => doExport(tpage), tpage);
  } else {
    const blocked = { no: "08", name: "导出CSV", ok: false, ms: 0, detail: "SKIP：教师端未过", shot: null };
    steps.push(blocked);
    console.log(`[08 导出CSV] FAIL SKIP：教师端未过 耗时=0ms`);
  }
  await tctx.close();
} catch (err) {
  // 被阻断的下游步骤也要在矩阵里留痕
  const blockedNote = String(err?.message ?? err).slice(0, 200);
  for (const [no, name] of [
    ["02", "前测"],
    ["03", "七步"],
    ["04", "交卷+后测"],
    ["05", "分数"],
    ["06", "拼接实验"],
    ["07", "教师端"],
    ["08", "导出CSV"],
  ]) {
    markBlocked(no, name, blockedNote);
  }
  result.fatal = blockedNote;
} finally {
  await browser.close().catch(() => undefined);
}

result.ms = Date.now() - startedAt.getTime();
result.sessionSeeded = SEED_SESSION;
result.steps = steps.sort((a, b) => String(a.no).localeCompare(String(b.no)));
result.networkErrors = net;
result.consoleErrors = consoleErrors;
result.pageErrors = pageErrors;
result.notes = notes;

fs.writeFileSync(path.join(OUT, "summary.json"), JSON.stringify(result, null, 2));
console.log("\n===== RESULT JSON =====");
console.log(JSON.stringify(result, null, 2));

const okCount = result.steps.filter((s) => s.ok).length;
console.log(`\n合计：${okCount}/${result.steps.length} 步通过 · 非 2xx ${net.length} 条 · console error ${consoleErrors.length} 条 · pageerror ${pageErrors.length} 条 · 总耗时 ${result.ms}ms`);
process.exit(okCount === result.steps.length ? 0 : 1);
