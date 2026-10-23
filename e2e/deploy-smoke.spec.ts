import { expect, test } from "@playwright/test";

/**
 * 线上全流程冒烟（部署后打一遍）。E2E_BASE_URL 指向线上域名时跑：
 *   E2E_BASE_URL=https://smnh6y8fgh.coze.site npx playwright test e2e/deploy-smoke.spec.ts
 *
 * 覆盖这次改的五处：实验列表编号/标题、器皿洗涤后回位、AI 评分来源标签、
 * 助教接口、教师端返回。任何一条不过就说明这次部署带错了包。
 */

test("实验列表：必做实验 + 1/2/3 顺排", async ({ page }) => {
  await page.goto("/experiments");
  await expect(page.getByRole("heading", { name: "必做实验" })).toBeVisible({ timeout: 30000 });
  const nos = await page.locator(".cat-card__no").allInnerTexts();
  expect(nos.map((s) => s.trim())).toEqual(["1", "2", "3"]);
});

test("操作台：洗涤 → 倒水 → 回原位", async ({ page }) => {
  await page.goto("/exp/exp01?force=1");
  await page.waitForFunction(
    () => {
      const n = document.querySelector('[data-vessel-id="volumetric"]') as HTMLElement | null;
      return Boolean(n && Object.keys(n).some((k) => k.startsWith("__react")));
    },
    null,
    { timeout: 40000 },
  );
  const vessel = page.locator('[data-vessel-id="volumetric"]');
  const sink = page.locator('[data-drop-kind="sink"]').first();
  const vb = (await vessel.boundingBox())!;
  const sb = (await sink.boundingBox())!;
  await page.mouse.move(vb.x + vb.width / 2, vb.y + vb.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 12; i += 1) {
    await page.mouse.move(
      vb.x + vb.width / 2 + ((sb.x + sb.width / 2) - (vb.x + vb.width / 2)) * (i / 12),
      vb.y + vb.height / 2 + ((sb.y + sb.height / 2) - (vb.y + vb.height / 2)) * (i / 12),
    );
    await page.waitForTimeout(20);
  }
  await page.mouse.up();
  await expect
    .poll(async () => vessel.evaluate((el: HTMLElement) => el.style.transform), { timeout: 20000 })
    .toBe("translate(0px, 0px)");
  await expect(page.locator("[data-demo-id='demo-task-board-mini']")).toBeVisible();
});

test("拼接方案：评分卡有来源标签（AI 评测 / 规则校验）", async ({ page }) => {
  await page.goto("/plan");
  await page.waitForTimeout(1500);
  // 主题若还没选：点第一个主题 → 背景 → 开始设计方案
  // 主题卡是 button[data-demo-id="demo-topic-<topicId>"]（里面还有个 -level- 的 span，别选错）
  const topic = page.locator('button[data-demo-id^="demo-topic-"]').first();
  if (await topic.count()) {
    await topic.click();
    await page.waitForTimeout(900);
  }
  const start = page.locator('[data-demo-id="demo-plan-start"]');
  if (await start.count()) {
    await start.click();
    await page.waitForTimeout(900);
  }
  // 载入参考方案（最稳的一条：一步就有完整方案）
  const ref = page.locator('[data-demo-id="demo-design-reference"]');
  await expect(ref).toBeVisible({ timeout: 20000 });
  await ref.click();
  await page.waitForTimeout(1200);

  const submit = page.locator('[data-demo-id="demo-plan-submit"]');
  await expect(submit).toBeEnabled({ timeout: 20000 });
  await submit.click();

  const source = page.locator("[data-demo-id='demo-design-score-source']");
  await expect(source).toBeVisible({ timeout: 40000 });
  const text = (await source.innerText()).trim();
  expect(["AI 评测", "规则校验", "AI 评测中"]).toContain(text);
});

test("后台接口：assess 与 tutor 都返回 ok", async ({ page }) => {
  await page.goto("/plan");
  await page.waitForTimeout(1200);
  const out = await page.evaluate(async () => {
    const assess = await fetch("/api/plan/assess", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pieces: ["piece-analytical-balance"], params: {}, topicId: "topic-hcl-standard" }),
    }).then((r) => r.json()).catch((e) => ({ error: String(e) }));
    const tutor = await fetch("/api/tutor/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question: "为什么要润洗", step: "仪器认领" }),
    }).then((r) => r.json()).catch((e) => ({ error: String(e) }));
    return { assess, tutor };
  });
  expect(out.assess.ok).toBe(true);
  expect(typeof out.assess.score).toBe("number");
  expect(["llm", "rule"]).toContain(out.assess.scoreSource);
  expect(out.tutor.ok).toBe(true);
  expect(String(out.tutor.reply).length).toBeGreaterThan(0);
});

test("教师端：返回停在教师后台", async ({ page }) => {
  await page.goto("/teacher/roster");
  await page.waitForTimeout(1500);
  const back = page.locator("header.tch-top a[aria-label]").first();
  expect(await back.getAttribute("href")).toBe("/teacher");
  await back.click();
  await page.waitForTimeout(1500);
  expect(new URL(page.url()).pathname).toBe("/teacher");
});
