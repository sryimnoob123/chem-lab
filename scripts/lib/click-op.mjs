/**
 * 引导式操作台的点击 helper（所有回归脚本共用）
 *
 * 背景：`app/exp/[id]/workbench.tsx` 改成引导式后 ——
 * - 主区只有一个「建议动作」大卡，仍带 `data-demo-id="demo-op-*"`，直接可见；
 * - 其余动作（含所有陷阱）收进 `<details data-demo-id="demo-other-ways">`，默认收起，
 *   收起时子按钮 `isVisible() === false`，直接 click 会一直等可见直到超时。
 *
 * 用法：
 *   import { clickOp, clickOpById, countVisibleOps, waitForFeedback } from "./lib/click-op.mjs";
 *   await clickOp(page, page.locator("[data-demo-id^='demo-op-']").nth(2));
 *   await clickOpById(page, "demo-op-step1-bare-hands");
 *   await waitForFeedback(page, "fail");   // 结果条 200ms 出结果
 *
 * 注意：本文件只依赖 Playwright 的 Page/Locator，不引入其它依赖。
 */

/** 「其他做法」折叠区 */
export const OTHER_WAYS_SELECTOR = '[data-demo-id="demo-other-ways"]';
/** 建议动作 + 折叠区里的动作（含不可见） */
export const OP_SELECTOR = "[data-demo-id^='demo-op-']";
/** 只数「当前能看见」的动作：引导式下正常为 1（建议动作） */
export const VISIBLE_OP_SELECTOR = "[data-demo-id^='demo-op-']:visible";

/** 展开动画按设计契约 ≤160ms（`guide.module.css`） */
export const EXPAND_SETTLE_MS = 160;

function asLocator(page, target) {
  if (typeof target === "string") return page.locator(target).first();
  return target;
}

/**
 * 展开「其他做法」折叠区。
 * @returns {Promise<boolean>} 本次是否真的展开了（已展开则 false）
 */
export async function expandOtherWays(page, { settleMs = EXPAND_SETTLE_MS } = {}) {
  const details = page.locator(OTHER_WAYS_SELECTOR).first();
  if ((await details.count()) === 0) return false;

  const isOpen = await details.evaluate((el) => el.hasAttribute("open")).catch(() => false);
  if (isOpen) return false;

  const summary = details.locator("summary").first();
  if ((await summary.count()) === 0) return false;

  await summary.click({ timeout: 4000 }).catch(() => {});
  // 等 open 属性真正落位（不同浏览器 <details> 展开是同步的，这里兜底）
  await page
    .waitForFunction(
      (sel) => Boolean(document.querySelector(sel)?.hasAttribute("open")),
      OTHER_WAYS_SELECTOR,
      { timeout: 1500 },
    )
    .catch(() => {});
  if (settleMs > 0) await page.waitForTimeout(settleMs);
  return true;
}

/**
 * 目标不可见就先展开折叠区，再等它可见。
 * @returns {Promise<boolean>} 是否为了它展开了折叠区
 */
export async function ensureOpVisible(page, target, { timeout = 3000 } = {}) {
  const locator = asLocator(page, target);
  if (await locator.isVisible().catch(() => false)) return false;

  const expanded = await expandOtherWays(page);
  await locator.waitFor({ state: "visible", timeout }).catch(() => {});
  return expanded;
}

/**
 * 点一个动作按钮：不可见 → 展开「其他做法」→ 再点。
 * 前置未满足 / 已完成（disabled）或点击失败时不抛错，返回 false（保持旧脚本 `.catch(()=>{})` 的语义）。
 * @returns {Promise<boolean>} 是否真的点下去了
 */
export async function clickOp(page, target, { timeout = 5000 } = {}) {
  const locator = asLocator(page, target);
  if ((await locator.count()) === 0) return false;

  await ensureOpVisible(page, locator);

  const disabled = await locator.isDisabled().catch(() => false);
  if (disabled) return false; // 前置动作没做 / 本步已完成，点了也没用

  try {
    await locator.click({ timeout });
    return true;
  } catch {
    return false;
  }
}

/** 按 demo id 点动作（等价于 clickOp(page, `[data-demo-id='…']`)） */
export async function clickOpById(page, demoId, options = {}) {
  return clickOp(page, page.locator(`[data-demo-id='${demoId}']`).first(), options);
}

/** 当前可见的动作数：引导式下正常为 1（建议动作），旧的「全量列出」是 2~5 */
export async function countVisibleOps(page) {
  return page.locator(VISIBLE_OP_SELECTOR).count();
}

/** 展开「其他做法」后可见的动作数（= 本步全部可选动作） */
export async function countAllOps(page) {
  await expandOtherWays(page);
  return page.locator(VISIBLE_OP_SELECTOR).count();
}

/**
 * 等结果条出现（两段式的第一段，200ms 出结果）。
 * @param {"ok"|"fail"|undefined} outcome undefined = 任一结果都算
 * @returns {Promise<boolean>} 是否等到
 */
export async function waitForFeedback(page, outcome, { timeout = 3000 } = {}) {
  const prefix = outcome === "ok" ? "demo-feedback-ok-" : outcome === "fail" ? "demo-feedback-fail-" : "demo-feedback-";
  const selector = `[data-demo-id^='${prefix}']`;
  try {
    await page.waitForSelector(selector, { state: "visible", timeout });
    return true;
  } catch {
    return false;
  }
}

/**
 * 等第二段「下一步」滑出（600ms 后），用来替代「点完硬等 900ms」。
 * @returns {Promise<boolean>} 是否等到
 */
export async function waitForNextLine(page, { timeout = 2000 } = {}) {
  try {
    await page.waitForSelector("[data-demo-id='demo-guide-next-line']", { state: "visible", timeout });
    return true;
  } catch {
    return false;
  }
}

/**
 * 等某个元素被 React 接管（hydration 完成）。
 * 为什么需要：dev server 首帧比生产慢，若在 hydration 前 fill 输入框，
 * React 挂载时会把受控组件的值重置回初始 state，提交就变成空 body → 400 MISSING_CREDENTIALS。
 */
export async function waitForReactReady(page, selector, { timeout = 10000 } = {}) {
  await page
    .waitForFunction(
      (sel) => {
        const el = document.querySelector(sel);
        if (!el) return false;
        return Object.keys(el).some(
          (k) => k.startsWith("__reactProps") || k.startsWith("__reactFiber"),
        );
      },
      selector,
      { timeout },
    )
    .catch(() => {});
}

/**
 * 学生登录（幂等、可重试）：等 hydration → 填学号姓名 → 提交 → 等跳 /experiments。
 * 反复失败时重填重提（顶多是 hydration 还没完成，重试即可），不会让脚本硬超时。
 * @returns {Promise<boolean>} 是否登录成功并跳转
 */
export async function loginStudent(
  page,
  { base = "", studentNo = "20250101", name = "周若曦", attempts = 3, timeout = 8000 } = {},
) {
  await page.goto(base + "/login", { waitUntil: "domcontentloaded" });
  const no = page.locator("[data-demo-id='demo-login-student-no']");
  const nm = page.locator("[data-demo-id='demo-login-student-name']");
  const submit = page.locator("[data-demo-id='demo-login-submit']");

  for (let attempt = 0; attempt < attempts; attempt++) {
    await no.waitFor({ state: "visible", timeout });
    await waitForReactReady(page, "[data-demo-id='demo-login-submit']");
    await no.fill(studentNo);
    await nm.fill(name);
    await submit.click();
    try {
      await page.waitForURL(/\/experiments/, { timeout: 7000 });
      return true;
    } catch {
      // 还没 hydration 完 / 提交时表单还是空的：等一下重填
      await page.waitForTimeout(500);
    }
  }
  return false;
}

/**
 * 点「重做本步」。
 * 已知产品侧问题（已报 Lead）：1440×900 下浮动的「预习 0/3」入口盖住该按钮中心 → 点击会被拦截。
 * 兜底：改用产品自带的键盘入口 R（footer 写明「R 重做」），对学生来说等价可用。
 * @returns {Promise<boolean>} 是否完成重做动作
 */
export async function clickRetry(page, { timeout = 2500 } = {}) {
  const retry = page.locator("[data-demo-id^='demo-retry-']").first();
  if ((await retry.count()) === 0) return false;
  try {
    await retry.click({ timeout });
    return true;
  } catch {
    await page.keyboard.press("r");
    await page.waitForTimeout(300);
    return true;
  }
}

/**
 * 过前测门禁（BOPPPS 的 P 段）：若页面出现前测，按 curriculum 的正确答案全选后提交。
 * 没出现前测（已通过 / 非门禁实验）时返回 appeared=false，不改变脚本流程。
 * @param curriculum `lib/pedagogy/curriculum/<expId>.ts` 的导出对象（有 .pre 数组）
 * @returns {Promise<{appeared: boolean, passed: boolean}>}
 */
export async function passPreTest(page, curriculum, { timeout = 10000 } = {}) {
  const submit = page.locator("[data-demo-id='bopbps-pre-submit']");
  if ((await submit.count()) === 0) return { appeared: false, passed: false };

  const pre = Array.isArray(curriculum?.pre) ? curriculum.pre : [];
  for (const q of pre) {
    await page
      .locator(`[data-demo-id='bopbps-op-${q.id}-${q.answer}']`)
      .click()
      .catch(() => {});
  }
  await submit.click().catch(() => {});
  // 解锁是同一页内切换（不跳转）：等操作台动作出现
  try {
    await page.waitForSelector(VISIBLE_OP_SELECTOR, { state: "visible", timeout });
  } catch {
    /* 由调用方按「动作数=0」判定失败 */
  }
  return { appeared: true, passed: (await page.locator(VISIBLE_OP_SELECTOR).count()) > 0 };
}
