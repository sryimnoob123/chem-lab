import { test, expect } from "@playwright/test";

test("助教对话框：不与页面滚动条/平台徽标重叠", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 620 });
  await page.goto("/exp/exp01?force=1");
  await page.waitForTimeout(4000);
  await page.click('[data-demo-id="demo-ai-button"]');
  await page.waitForTimeout(600);
  const m = await page.evaluate(() => {
    const d = document.querySelector('[data-demo-id="demo-ai-chat"]') as HTMLElement;
    const r = d.getBoundingClientRect();
    const cw = document.documentElement.clientWidth;
    const ch = document.documentElement.clientHeight;
    const send = d.querySelector('[data-demo-id="demo-ai-send"]')!.getBoundingClientRect();
    const bubble = d.querySelector("p[data-from]")!.getBoundingClientRect();
    return {
      box: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
      rightGap: Math.round(cw - r.right),
      bottomGap: Math.round(ch - r.bottom),
      sendBottomGap: Math.round(ch - send.bottom),
      bubbleRightGap: Math.round(r.right - bubble.right),
    };
  });
  console.log(JSON.stringify(m));
  expect(m.rightGap).toBeGreaterThanOrEqual(10);
  expect(m.bottomGap).toBeGreaterThanOrEqual(50);
  await page.screenshot({ path: "e2e-review/ai-dialog-scrollbar.png" });
});
