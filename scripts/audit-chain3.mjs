/**
 * ④ 三条完整链路：首页 → 登录 → 列表 → 实验 →（自动）交卷 → 报告
 * 每页记 pageerror，报告校验四要素（总分 / 总结 / 能力点 / 错题解析）。
 *
 * 用法：node scripts/audit-chain3.mjs
 */
import { chromium } from "@playwright/test";
import { dismissOnboarding, loginStudent } from "./lib/click-op.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:3001";
const EXPS = ["exp01", "exp03", "exp09"];
const results = [];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });

for (const expId of EXPS) {
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 100)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 100)}`);
  });

  const entry = { expId, steps: {}, errors };
  try {
    // 首页
    const home = await page.goto(BASE, { waitUntil: "domcontentloaded" });
    entry.steps.home = home?.status() ?? 0;

    // 登录 → 列表
    await loginStudent(page, { base: BASE });
    entry.steps.catalog = page.url().includes("/experiments") ? 200 : 0;

    // 实验页
    await page.goto(`${BASE}/exp/${expId}?force=1`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1800);
    await dismissOnboarding(page, { waitMs: 900 });
    entry.steps.workbench = 200;

    // 点自动，等它自己跑完并跳到报告
    const autoBtn = page.locator("[data-demo-id='demo-mode-auto']");
    entry.debug = { autoBtnCount: await autoBtn.count() };
    if (entry.debug.autoBtnCount) {
      await autoBtn.click({ timeout: 5000 }).catch((e) => {
        entry.debug.clickError = String(e).slice(0, 120);
      });
      entry.debug.afterClick = await page.evaluate(() => {
        const body = document.body.innerText;
        const m = body.match(/第\s*0?(\d+)\s*步\s*\/\s*共\s*0?(\d+)\s*步/);
        const app = document.querySelector("[data-input-mode]");
        return {
          step: m ? Number(m[1]) : null,
          inputMode: app?.getAttribute("data-input-mode") ?? null,
          lsMode: localStorage.getItem("chem-lab:input-mode"),
          onboarding: Boolean(document.querySelector("[data-demo-id='demo-onboarding']")),
        };
      });
    }
    let onReport = false;
    for (let i = 0; i < 40; i++) {
      await page.waitForTimeout(1000);
      if (page.url().includes("/report")) {
        onReport = true;
        break;
      }
    }
    entry.debug.finalUrl = page.url();
    entry.debug.finalStep = await page.evaluate(() => {
      const m = document.body.innerText.match(/第\s*0?(\d+)\s*步/);
      return m ? Number(m[1]) : null;
    });
    entry.steps.autoToReport = onReport;
    await page.waitForTimeout(2500);

    const rep = await page.evaluate(() => {
      const body = document.body.innerText.replace(/\s+/g, " ");
      return {
        hasTotal: /总分\s*\d+\s*\/\s*100/.test(body),
        total: (body.match(/总分\s*(\d+)\s*\/\s*100/) ?? [])[1] ?? null,
        hasSummary: body.includes("本次总结"),
        hasCompetency: /能力|competency/i.test(body),
        hasWrongAnswer: /错题|解析/.test(body),
        hasBadge: body.includes("零事故"),
        postScore: (body.match(/后测（\d+ 题）\s*(\d+)\s*\/\s*100/) ?? [])[1] ?? null,
      };
    });
    entry.report = rep;
  } catch (err) {
    entry.fatal = String(err).slice(0, 160);
  }
  results.push(entry);
  await page.close();
}

console.log(JSON.stringify(results, null, 2));
await browser.close();
