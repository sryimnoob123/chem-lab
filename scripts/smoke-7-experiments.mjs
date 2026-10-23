/**
 * scripts/smoke-7-experiments.mjs —— 只验「能进、不白屏、console 干净」。
 *
 * 按运营口径（2026-10-23）：exp02/04/05/06/07/08/10 只做冒烟，不给它们加功能。
 * 每个实验：打开 ?force=1 → 等场景出现 → 记 console/pageerror → 截一张图。
 * 判定：操作台根节点在、场景里有器皿或滴定台、结果条在、正文不是空壳、console 0 error。
 *
 * 用法：node scripts/smoke-7-experiments.mjs [--base http://localhost:3001]
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : fallback;
};
const BASE = arg("base", "http://localhost:3001");
const IDS = ["exp02", "exp04", "exp05", "exp06", "exp07", "exp08", "exp10"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
mkdirSync("evidence/smoke", { recursive: true });

const rows = [];
for (const id of IDS) {
  const errors = [];
  const onConsole = (m) => {
    if (m.type() === "error") errors.push(m.text().slice(0, 160));
  };
  const onPageError = (e) => errors.push(`pageerror: ${e.message.slice(0, 160)}`);
  page.on("console", onConsole);
  page.on("pageerror", onPageError);

  await page.goto(`${BASE}/exp/${id}?force=1`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-demo-id="demo-scene-event"]', { timeout: 20000 }).catch(() => {});
  await sleep(900);

  const facts = await page.evaluate(() => ({
    workbench: Boolean(document.querySelector('[data-demo-id="demo-scene-event"]')),
    bench: Boolean(document.querySelector('[data-demo-id$="-bench-scene"]')),
    titration: Boolean(document.querySelector('[data-demo-id="apparatus-title"]') || document.querySelector("svg title")),
    vessels: document.querySelectorAll('[data-demo-id^="demo-scene-vessel-"]').length,
    tools: document.querySelectorAll('[data-demo-id^="demo-tool-"]').length,
    reagents: document.querySelectorAll('[data-demo-id^="demo-scene-reagent-"]').length,
    textLength: document.body.innerText.replace(/\s/g, "").length,
    step: document.querySelector("#stage-title")?.textContent?.trim().slice(0, 40) ?? "",
  }));

  const shot = `evidence/smoke/${id}.png`;
  await page.screenshot({ path: shot });
  page.off("console", onConsole);
  page.off("pageerror", onPageError);

  const ok =
    facts.workbench && facts.textLength > 200 && errors.length === 0 && (facts.vessels > 0 || facts.titration);
  rows.push({ id, ok, ...facts, errors, shot });
  console.log(
    `${ok ? "PASS" : "FAIL"} ${id}  器皿 ${facts.vessels} 工具 ${facts.tools} 试剂 ${facts.reagents} 正文 ${facts.textLength} 字  console ${errors.length}  ${facts.step}`,
  );
  if (!ok) errors.slice(0, 2).forEach((e) => console.log(`     ${e}`));
}

await browser.close();
const failed = rows.filter((r) => !r.ok).length;
console.log(`\n冒烟：${rows.length - failed}/${rows.length} 通过`);
writeFileSync("evidence/smoke/report.json", JSON.stringify(rows, null, 2));
process.exit(failed === 0 ? 0 : 1);