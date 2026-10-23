import { test, expect } from "@playwright/test";

/**
 * 线上：助教是右侧侧边栏 —— 内容要显示完整（标题/消息/快捷问法/输入框一次看全），
 * 右边缘留白 12、底部避开扣子官方徽标 56。
 */
test("助教侧边栏：内容完整 + 留白", async ({ page }) => {
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
  await page.waitForTimeout(900);
  const m = await page.evaluate(() => {
    const d = document.querySelector('[data-demo-id="demo-ai-chat"]') as HTMLElement;
    const r = d.getBoundingClientRect();
    const stream = d.querySelector('[data-demo-id="demo-ai-messages"]') as HTMLElement;
    const intro = d.querySelector("p[data-from]") as HTMLElement;
    const send = d.querySelector('[data-demo-id="demo-ai-send"]')!.getBoundingClientRect();
    return {
      rightGap: Math.round(document.documentElement.clientWidth - r.right),
      bottomGap: Math.round(document.documentElement.clientHeight - r.bottom),
      streamH: Math.round(stream.getBoundingClientRect().height),
      introVisible: intro.getBoundingClientRect().top >= stream.getBoundingClientRect().top - 2,
      sendInside: send.right <= r.right && send.bottom <= r.bottom,
    };
  });
  console.log(JSON.stringify(m));
  expect(m.rightGap).toBeGreaterThanOrEqual(8);
  expect(m.bottomGap).toBeGreaterThanOrEqual(40);
  expect(m.streamH).toBeGreaterThan(150);
  expect(m.introVisible).toBe(true);
  expect(m.sendInside).toBe(true);
});
