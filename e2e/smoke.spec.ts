import { test, expect } from "@playwright/test";

test("首页渲染并且数据库连通", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("虚拟实验平台");
  await expect(page.getByText("数据库连通检查")).toBeVisible();
  // 不允许把数据库错误漏到页面上
  await expect(page.getByText("读取失败")).toHaveCount(0);
});

test("移动端无横向溢出", async ({ page }) => {
  await page.goto("/");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(overflow).toBe(false);
});
