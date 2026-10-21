import fs from "node:fs";

const f = "scripts/exp02-chain.mjs";
let t = fs.readFileSync(f, "utf8");
const from = "  await clickOp(page, opts.nth(cnt - 1));";
const to = [
  "  const trapId = process.env.TRAP_ID ?? \"demo-op-step1-water\";",
  "  const trap = page.locator(`[data-demo-id='${trapId}']`).first();",
  "  if (await trap.count()) await clickOp(page, trap);",
  "  else await clickOp(page, opts.nth(cnt - 1));",
].join("\n");
if (t.includes(from)) {
  fs.writeFileSync(f, t.replace(from, to), "utf8");
  console.log("已改为点可恢复 trap:", /step1-water/.test(fs.readFileSync(f, "utf8")));
} else {
  console.log("未匹配到原点击行");
}
