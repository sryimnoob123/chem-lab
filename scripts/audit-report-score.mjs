/**
 * 查报告页真实分数来源：拿最近一次 exp01 的 run，读报告页 DOM。
 * 用法：node scripts/audit-report-score.mjs
 */
import { chromium } from "@playwright/test";
import { loginStudent } from "./lib/click-op.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:3001";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const page = await ctx.newPage();
await loginStudent(page, { base: BASE });

// 1) 最近几条 run
const runs = await page.evaluate(async (base) => {
  const res = await fetch(`${base}/api/runs`, { credentials: "include" });
  if (!res.ok) return { status: res.status };
  return { status: res.status, body: await res.json() };
}, BASE);

// 2) 工作台口径（完整）
await page.goto(`${BASE}/exp/exp01?force=1`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
const board = await page.evaluate(() => {
  const out = {};
  out.topBar = (document.body.innerText.match(/第\s*0?(\d+)\s*步\s*\/\s*共\s*(\d+)\s*步/) ?? []).slice(1);
  // 找所有形如 "第 x / y 步" 或 "第 x/y 步" 的片段
  const all = [...document.body.innerText.matchAll(/第\s*(\d+)\s*\/\s*(\d+)\s*步/g)].map((m) => `${m[1]}/${m[2]}`);
  out.allStepStrings = [...new Set(all)];
  // 看板标题 + 副标题
  const heading = document.querySelector("h1, h2, h3, [class*='missionTitle'], [class*='boardTitle']");
  out.heading = heading ? (heading.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 50) : null;
  return out;
});

console.log("RUNS:", JSON.stringify(runs).slice(0, 900));
console.log("BOARD:", JSON.stringify(board, null, 2));

// 3) 报告页
const list = runs.body;
const arr = Array.isArray(list) ? list : list?.runs ?? list?.data ?? [];
const exp01 = arr.filter((r) => String(r.expId ?? r.experimentId ?? "").includes("exp01"));
const latest = exp01[0] ?? arr[0];
if (latest) {
  const runId = latest.id ?? latest.runId;
  await page.goto(`${BASE}/exp/exp01/report?run=${runId}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1800);
  const rep = await page.evaluate(() => {
    const body = document.body.innerText;
    const total = body.match(/(\d+)\s*\/\s*(\d+)/);
    return {
      url: location.href,
      totalMatch: total ? total[0] : null,
      headline: (body.match(/本次总结[\s\S]{0,60}/) ?? [null])[0],
      firstScreen: body.replace(/\s+/g, " ").slice(0, 260),
    };
  });
  console.log("REPORT:", JSON.stringify(rep, null, 2));
  await page.screenshot({ path: "public/shots-prod/redteam/r6-report-audit.png" });
} else {
  console.log("没有 run 记录（数组长度 0）");
}

await browser.close();
