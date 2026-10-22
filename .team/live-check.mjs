/** 18:00 现场点验：3001 启动 / Dev Dock 热区 / 登录随便进 / exp09 报告总分。 */
import { chromium } from "@playwright/test";

const BASE = "http://127.0.0.1:3001";
const browser = await chromium.launch({
  executablePath: "C:/Users/14681/AppData/Local/hermes/tools/chromium-1208/chrome-win64/chrome.exe",
});
const rows = [];
const push = (label, pass, detail) => rows.push({ label, pass, detail });

// 1) 学生登录：乱填也进
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(1200);
  await page.fill('[data-demo-id="demo-login-student-no"]', "99999999").catch(() => {});
  await page.fill('[data-demo-id="demo-login-student-name"]', "测试同学").catch(() => {});
  await page.click('[data-demo-id="demo-login-submit"]').catch(() => {});
  const ok = await page.waitForURL(/\/experiments/, { timeout: 20000 }).then(() => true).catch(() => false);
  push("登录页学生乱填能进 /experiments", ok, page.url());
  await ctx.close();
}

// 2) 教师直进后台
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(1200);
  await page.click('[data-demo-id="demo-login-tab-teacher"]').catch(() => {});
  await page.waitForTimeout(400);
  await page.click('[data-demo-id="demo-login-quick-teacher"]').catch(() => {});
  const ok = await page.waitForURL(/\/teacher/, { timeout: 20000 }).then(() => true).catch(() => false);
  const txt = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " ").trim().length);
  push("登录页教师一键进后台", ok && txt > 40, `${page.url()} · ${txt} 字符`);
  await ctx.close();
}

// 3) Dev Dock：十个一键演示热区 ≥32px
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  await page.request.post(`${BASE}/api/session`, {
    headers: { "content-type": "application/json" },
    data: { studentNo: "20250101", name: "周若曦" },
  });
  const resp = await page.goto(`${BASE}/experiments`, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(2000);
  // Dev Dock 默认收起，必须先点 dock-toggle 展开才量得到热区
  await page.click('[data-dev="dock-toggle"]').catch(() => {});
  await page.waitForTimeout(900);
  const boxes = await page.evaluate(() =>
    [...document.querySelectorAll('[data-dev="dock-oneclick-demo"]')].map((el) => {
      const r = el.getBoundingClientRect();
      return { exp: el.getAttribute("data-exp"), w: Math.round(r.width), h: Math.round(r.height) };
    }),
  );
  const small = boxes.filter((b) => b.w < 32 || b.h < 32);
  push(
    `Dev Dock 一键演示热区 ${boxes.length} 个，全部 ≥32px`,
    resp?.status() === 200 && boxes.length === 10 && small.length === 0,
    boxes.length ? `${boxes.length} 个，最小 ${Math.min(...boxes.map((b) => b.h))}×${Math.min(...boxes.map((b) => b.w))}px${small.length ? ` · 过小 ${small.map((s) => s.exp).join(",")}` : ""}` : `HTTP ${resp?.status()}`,
  );
  // 点一个热区的 href 必须可点（不空）：拿到 href 后直接跟随，看是否 200
  const href = await page.getAttribute('[data-dev="dock-oneclick-demo"][data-exp="exp09"]', "href").catch(() => null);
  if (href) {
    const resp2 = await page.goto(`${BASE}${href}`, { waitUntil: "domcontentloaded", timeout: 45000 }).catch(() => null);
    const step = await page.evaluate(() => (document.body.innerText.match(/第\s*\d+\s*步\s*\/\s*共\s*\d+\s*步/) ?? [""])[0]);
    push("点 Dev Dock「exp09 一键演示」→ 进到实验台", resp2?.status() === 200 && step.length > 0, `${href} · HTTP ${resp2?.status()} · ${step}`);
  } else {
    push("点 Dev Dock「exp09 一键演示」→ 进到实验台", false, "没找到热区 href");
  }
  await ctx.close();
}

// 4) exp09 末步 → 报告页出总分
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  await page.request.post(`${BASE}/api/session`, {
    headers: { "content-type": "application/json" },
    data: { studentNo: "20250101", name: "周若曦" },
  });
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e.message).slice(0, 100)));
  await page.goto(`${BASE}/exp/exp09?force=1&autodemo=1`, { waitUntil: "domcontentloaded", timeout: 60000 });
  const ok = await page.waitForURL(/\/report/, { timeout: 200000 }).then(() => true).catch(() => false);
  await page.waitForTimeout(2500);
  const info = await page.evaluate(() => {
    const t = document.body.innerText.replace(/\s+/g, " ");
    const m = t.match(/(?:总分|得分|分数)[^0-9]{0,6}(\d{1,3})/);
    return { score: m ? Number(m[1]) : null, len: t.length, sample: t.slice(0, 80) };
  });
  push(
    "exp09 末步→报告页出总分",
    ok && info.score !== null && info.score > 0 && errs.length === 0,
    `${page.url()} · 总分 ${info.score ?? "未读到"} · ${info.len} 字符${errs.length ? ` · error ${errs[0]}` : ""}`,
  );
  await ctx.close();
}

await browser.close();
let fails = 0;
for (const r of rows) {
  if (!r.pass) fails++;
  console.log(`${r.pass ? "PASS" : "FAIL"}\t${r.label}\n\t${r.detail}`);
}
console.log(`\n${rows.length} 项，FAIL ${fails}`);
process.exit(fails ? 1 : 0);
