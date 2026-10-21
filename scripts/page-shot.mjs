import { chromium } from "@playwright/test";
import path from "node:path";
import os from "node:os";

const route = process.argv[2] ?? "/exp/exp09";
const name = process.argv[3] ?? "exp-stage";
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errs = [];
p.on("pageerror", (e) => errs.push(String(e.message).slice(0, 120)));
await p.goto("http://localhost:3000" + route, { waitUntil: "networkidle" });
await p.waitForTimeout(600);
const out = path.join(os.tmpdir(), "chemlab-shots", `${name}.png`);
await p.screenshot({ path: out });
console.log("SHOT:", out);
console.log("TEXT:", (await p.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 420));
console.log("errors:", JSON.stringify(errs));
await b.close();
