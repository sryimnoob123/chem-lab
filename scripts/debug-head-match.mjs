/** 精确定位：L76 的骨架与 HEAD 中 initialReading 行的骨架到底差在哪。 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const TARGET = "app/exp/[id]/workbench.tsx";
const skeleton = (line) => line.replace(/[^\x20-\x7E]/g, "").replace(/\?/g, "");

const cur = readFileSync(TARGET, "utf8").split("\n");
const head = execSync(`git show ":${TARGET}"`, { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }).split("\n");

const curLine = cur[75];
console.log("当前 L76 :", JSON.stringify(curLine));
console.log("  骨架   :", JSON.stringify(skeleton(curLine)));
console.log("  码点   :", [...curLine].map((c) => c.codePointAt(0).toString(16)).join(" "));

console.log("\nHEAD 中含 initialReading 的行:");
for (const l of head) {
  if (!l.includes("initialReading")) continue;
  console.log("  原文   :", JSON.stringify(l));
  console.log("  骨架   :", JSON.stringify(skeleton(l)));
  console.log("  码点   :", [...l].map((c) => c.codePointAt(0).toString(16)).join(" "));
}

// 用骨架建表，看看 key 到底有没有
const keys = new Set(head.map(skeleton));
console.log("\n骨架 key 命中?", keys.has(skeleton(curLine)));
console.log("含 'initialReading' 的骨架 key:", [...keys].filter((k) => k.includes("initialReading")));
