/**
 * 三个重点实验的 pointer 拖拽验证：每个实验拖一次，检查三段状态与结果。
 *   exp01 第4步 蒸馏水→锥形瓶（应当接受）
 *   exp09 第2步 浓盐酸→锥形瓶（应当接受）
 *   exp09 第5步 酚酞→锥形瓶（应当接受）
 *   exp03 第1步 蒸馏水→锥形瓶（应当拒收，三行理由）
 *
 * 用法：node .team/pointer-drag-all.mjs
 */
import { chromium } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3001";

const CASES = [
  { exp: "exp01", step: 4, reagent: "water", expect: "accept" },
  { exp: "exp09", step: 2, reagent: "hcl", expect: "accept" },
  { exp: "exp09", step: 5, reagent: "phenolphthalein", expect: "accept" },
  { exp: "exp03", step: 1, reagent: "water", expect: "reject" },
];

const browser = await chromium.launch();
const results = [];

for (const item of CASES) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 120)));

  await page.request.post(`${BASE}/api/session`, {
    headers: { "content-type": "application/json" },
    data: { studentNo: "20250101", name: "周若曦" },
  });

  await page.goto(`${BASE}/exp/${item.exp}?force=1`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2200);
  await page.getByRole("button", { name: /跳过/ }).first().click().catch(() => {});
  await page.waitForTimeout(500);

  const stepNow = () =>
    page.evaluate(() => {
      const m = document.body.innerText.match(/第\s*(\d+)\s*步\s*\/\s*共\s*(\d+)\s*步/);
      return m ? { cur: Number(m[1]), total: Number(m[2]) } : null;
    });

  // 推进到目标步。注意：同一 stepIndex 内可能还有子阶段（配制→观察→转移），
  // 所以「没前进」不代表失败，要看结果条有没有 ✓ 成功标记。
  for (let i = 0; i < 20; i++) {
    const s = await stepNow();
    if (s && s.cur >= item.step) break;
    const op = page.locator('[data-demo-id^="demo-op-"]').first();
    if (await op.isVisible().catch(() => false)) {
      await op.click({ timeout: 4000 }).catch(() => undefined);
      await page.waitForTimeout(900);
    } else {
      const next = page.getByRole("button", { name: /下一步|观察/ }).first();
      if (await next.isVisible().catch(() => false)) {
        await next.click({ timeout: 3000 }).catch(() => undefined);
      }
      await page.waitForTimeout(600);
    }
  }
  const before = await stepNow();

  // 有些步在一个 stepIndex 里还有子阶段（exp09 第 5 步要先「移取 HCl」再「加指示剂」），
  // 拖拽前先把它推到真正等这一步试剂的状态。
  // 判据用 data-next（页面自己标的"下一步该用哪瓶"），别拿文案匹配——标题里就有「加指示剂」。
  if (item.exp === "exp09" && item.step === 5) {
    for (let i = 0; i < 4; i++) {
      const isNext = await page
        .locator(`[data-demo-id="demo-scene-reagent-${item.reagent}"][data-next="true"]`)
        .count();
      if (isNext > 0) break;
      const op = page.locator('[data-demo-id^="demo-op-"]').first();
      if (await op.isVisible().catch(() => false)) {
        await op.click({ timeout: 4000 }).catch(() => undefined);
      }
      await page.waitForTimeout(1100);
    }
  }

  const bottle = page.locator(`[data-demo-id="demo-scene-reagent-${item.reagent}"]`).first();
  const flask = page.locator('[data-demo-id="demo-scene-drop-flask"]').first();
  const bb = await bottle.boundingBox().catch(() => null);
  const fb = await flask.boundingBox().catch(() => null);

  const row = { 实验: item.exp, 步: item.step, 试剂: item.reagent, 段1: false, 段2: false, 段3: false, 说明: "" };
  if (!bb || !fb) {
    row.说明 = "找不到试剂瓶或落区";
    results.push(row);
    await ctx.close();
    continue;
  }

  const startX = bb.x + bb.width / 2;
  const startY = bb.y + bb.height / 2;
  const endX = fb.x + fb.width / 2;
  const endY = fb.y + fb.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.waitForTimeout(220);
  row.段1 = (await bottle.getAttribute("data-dragging")) === "true";

  // 段 2 采样：拖动过程中只要任意一刻热区点亮过就算过（热区可能随指针进出）。
  let sawOver = false;
  for (let i = 1; i <= 12; i++) {
    const t = i / 12;
    await page.mouse.move(startX + (endX - startX) * t, startY + (endY - startY) * t - Math.sin(t * Math.PI) * 26);
    await page.waitForTimeout(45);
    if ((await flask.getAttribute("data-over")) === "true") sawOver = true;
  }
  row.段2 = sawOver;

  await page.mouse.up();
  await page.waitForTimeout(1600);

  const after = await stepNow();
  const text = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
  // 成功：步骤前进，或同一 step 内出现 ✓ 成功标记 / 「下一步：观察」
  // 拒收：出现「为什么 / 不能 / 不该 / 换一种」等理由
  row.段3 =
    item.expect === "accept"
      ? Boolean(
          after &&
            before &&
            (after.cur > before.cur || /✓\s*(酸|蒸馏水|加入|沿壁)|下一步：观察|已加入|倒入/.test(text)),
        )
      : /拒收|不能|不该|为什么|换一种|先加/.test(text);
  row.说明 = item.expect === "accept" ? `${before?.cur}→${after?.cur} ${/✓/.test(text) ? "有✓" : ""}` : "拒收理由已出现";
  if (errors.length) row.说明 += ` | pageerror ${errors.length}`;

  results.push(row);
  await ctx.close();
}

await browser.close();

console.log("实验\t步\t试剂\t段1\t段2\t段3\t说明");
for (const r of results) {
  console.log(`${r.实验}\t${r.步}\t${r.试剂}\t${r.段1 ? "✓" : "✗"}\t${r.段2 ? "✓" : "✗"}\t${r.段3 ? "✓" : "✗"}\t${r.说明}`);
}
const failed = results.filter((r) => !r.段1 || !r.段2 || !r.段3).length;
console.log(failed === 0 ? "\n全部通过" : `\n${failed} 项未通过`);
process.exit(failed === 0 ? 0 : 1);
