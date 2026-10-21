/**
 * 完整验 "auto 跑完 → 交卷 → 报告分数"：
 * 1) 点"自动"，等步骤到 7/7
 * 2) 点交卷
 * 3) 读报告页总分与总结文案
 *
 * 用法：node scripts/audit-autorun-finish.mjs [exp01]
 */
import { chromium } from "@playwright/test";
import { dismissOnboarding, loginStudent } from "./lib/click-op.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:3001";
const expId = process.argv[2] ?? "exp01";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const page = await ctx.newPage();
await loginStudent(page, { base: BASE });
await page.goto(`${BASE}/exp/${expId}?force=1`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
await dismissOnboarding(page, { waitMs: 800 });

await page.locator("[data-demo-id='demo-mode-auto']").click();

const readState = () =>
  page.evaluate(() => {
    const body = document.body.innerText;
    const m = body.match(/第\s*0?(\d+)\s*步\s*\/\s*共\s*0?(\d+)\s*步/);
    return { step: m ? Number(m[1]) : null, total: m ? Number(m[2]) : null, done: /已完成|查看报告/.test(body) };
  });

let st = { step: 0, total: 7 };
for (let i = 0; i < 40; i++) {
  await page.waitForTimeout(1000);
  st = await readState();
  if (st.step === st.total) break;
}

// 点交卷
const finishBtn = page.locator("[data-demo-id='demo-finish']");
if (await finishBtn.count()) {
  await finishBtn.click();
  await page.waitForTimeout(2500);
  // 可能有确认弹层
  const confirm = page.locator("[data-demo-id='demo-finish-confirm'], button:has-text('确认交卷')");
  if (await confirm.count()) {
    await confirm.first().click();
    await page.waitForTimeout(3000);
  }
}

await page.waitForTimeout(2500);
const report = await page.evaluate(() => {
  const body = document.body.innerText.replace(/\s+/g, " ");
  const total = body.match(/(\d+)\s*\/\s*(\d+)/);
  const summary = body.match(/本次总结[\s\S]{0,80}/);
  const badge = body.match(/(优秀|良好|合格|待提高|徽章|A|B|C|D)\b/g);
  return {
    url: location.href,
    isReport: location.pathname.includes("/report"),
    score: total ? total[0] : null,
    summary: summary ? summary[0].slice(0, 90) : null,
    firstScreen: body.slice(0, 220),
  };
});

console.log(JSON.stringify({ finalStep: st, report }, null, 2));
await page.screenshot({ path: "public/shots-prod/redteam/r6-autorun-report.png" });
await browser.close();
