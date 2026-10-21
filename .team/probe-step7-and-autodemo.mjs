/**
 * 两件事实测：
 *  A. ?autodemo=1 跑完是否自动交卷并落到报告页（不停在最后一步）
 *  B. exp09 走到第 7 步时，台面上的引导内容到底是什么（用户说对不上）
 * 用法：node .team/probe-step7-and-autodemo.mjs
 */
import { chromium } from "@playwright/test";

const BASE = "http://127.0.0.1:3001";
const browser = await chromium.launch();

async function newPage() {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.request.post(`${BASE}/api/session`, {
    headers: { "content-type": "application/json" },
    data: { studentNo: "20250101", name: "周若曦" },
  });
  return { ctx, page };
}

// A. autodemo 自动交卷
{
  const { ctx, page } = await newPage();
  await page.goto(`${BASE}/exp/exp09?force=1&autodemo=1`, { waitUntil: "domcontentloaded" });
  let landed = false;
  for (let i = 0; i < 60; i++) {
    await page.waitForTimeout(2000);
    if (/\/report/.test(page.url())) {
      landed = true;
      break;
    }
  }
  const txt = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " ").slice(0, 120));
  console.log(`A. autodemo: ${landed ? "✅ 自动到报告页" : "❌ 停在 " + page.url().slice(0, 90)}`);
  console.log(`   页面: ${txt}`);
  await ctx.close();
}

// B. exp09 第 7 步的引导内容
{
  const { ctx, page } = await newPage();
  await page.goto(`${BASE}/exp/exp09?force=1`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2200);
  await page.getByRole("button", { name: /跳过/ }).first().click().catch(() => {});
  await page.waitForTimeout(500);

  const stepNow = () =>
    page.evaluate(() => {
      const m = document.body.innerText.match(/第\s*(\d+)\s*步\s*\/\s*共\s*(\d+)\s*步/);
      return m ? { cur: Number(m[1]), total: Number(m[2]) } : null;
    });

  for (let i = 0; i < 40; i++) {
    const s = await stepNow();
    if (s && s.cur >= 7) break;
    const op = page.locator('[data-demo-id^="demo-op-"]').first();
    if (await op.isVisible().catch(() => false)) {
      await op.click({ timeout: 4000 }).catch(() => undefined);
      await page.waitForTimeout(900);
    } else {
      await page.waitForTimeout(700);
    }
  }
  console.log(`\nB. 到第 ${(await stepNow())?.cur} 步，页面内容：`);
  const text = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
  console.log(text.slice(0, 900));
  const dialogs = await page.evaluate(() =>
    [...document.querySelectorAll('[role="dialog"], dialog, [aria-modal="true"]')].map((el) =>
      (el.textContent ?? "").replace(/\s+/g, " ").slice(0, 200),
    ),
  );
  console.log("\n弹窗/dialog 数量:", dialogs.length, JSON.stringify(dialogs));
  await ctx.close();
}

await browser.close();
