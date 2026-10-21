import { test, expect } from "@playwright/test";

test("首页渲染并且数据库连通", async ({ page, request }) => {
  await page.goto("/");
  // 门户首屏必须有 h1（内容随设计迭代变化，只断言存在与不报错）
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  // 不允许把数据库错误漏到页面上
  await expect(page.getByText("读取失败")).toHaveCount(0);

  // 数据库连通检查：实验清单接口能读出 10 个实验
  const res = await request.get("/api/experiments");
  expect(res.ok(), `GET /api/experiments → ${res.status()}`).toBeTruthy();
  const rows = (await res.json()) as unknown[];
  expect(Array.isArray(rows)).toBe(true);
  expect(rows.length).toBe(10);
});

test("移动端无横向溢出", async ({ page }) => {
  await page.goto("/");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(overflow).toBe(false);
});
