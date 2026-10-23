import { test, expect } from "@playwright/test";

/** 线上：助教弹窗不许贴右边缘、不许压到平台徽标区（部署后随 smoke 一起跑） */
test("助教弹窗：右侧与底部留白", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 620 });
  await page.goto("/exp/exp01?force=1");
  await page.waitForFunction(
    () => {
      const b = document.querySelector('[data-demo-id="demo-ai-button"]') as HTMLElement | null;
      return Boolean(b && Object.keys(b).some((k) => k.startsWith("__react")));
    },
    null,
    { timeout: 40000 },
  );
  await page.click('[data-demo-id="demo-ai-button"]');
  await page.waitForTimeout(800);
  const m = await page.evaluate(() => {
    const d = document.querySelector('[data-demo-id="demo-ai-chat"]') as HTMLElement;
    const r = d.getBoundingClientRect();
    const bubble = d.querySelector("p[data-from]")!.getBoundingClientRect();
    return {
      rightGap: Math.round(document.documentElement.clientWidth - r.right),
      bottomGap: Math.round(document.documentElement.clientHeight - r.bottom),
      bubbleRightGap: Math.round(r.right - bubble.right),
      width: Math.round(r.width),
    };
  });
  console.log(JSON.stringify(m));
  expect(m.rightGap).toBeGreaterThanOrEqual(8);
  expect(m.bottomGap).toBeGreaterThanOrEqual(40);
  expect(m.bubbleRightGap).toBeGreaterThanOrEqual(10);
});
