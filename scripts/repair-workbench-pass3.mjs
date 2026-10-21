/**
 * Pass 3：把 pass2 还原后仍残留替换字符（U+FFFD）的行，用参照源补齐。
 *
 * 参照源（按优先级）：
 *   1) git 暂存区/HEAD 的同一文件
 *   2) .next 索引式 sourcemap 的 sections[].map.sourcesContent（10-21 18:01 的完整 TSX）
 *
 * 匹配方式：把行归一化成「只留 ASCII 结构」的骨架（去掉非 ASCII、问号、引号、空白），
 * 因为损坏会吞掉行尾引号，且丢字会造成空格差异。骨架在参照源里唯一命中才替换。
 *
 * 全程 node + 显式 utf8，不经过 PowerShell。
 */
import { execSync } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";

const TARGET = "app/exp/[id]/workbench.tsx";
const REPAIRED = `${TARGET}.repaired`;

const skeleton = (line) =>
  line.replace(/[^\x20-\x7E]/g, "").replace(/[?"\s]/g, "");

const cur = readFileSync(REPAIRED, "utf8").split("\n");

/** 收集所有可用参照源 */
const baselines = [];

try {
  baselines.push({
    name: "git HEAD",
    lines: execSync(`git show ":${TARGET}"`, { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }).split("\n"),
  });
} catch (e) {
  console.log("git HEAD 不可用: " + String(e.message).slice(0, 80));
}

const SSR_DIR = ".next/dev/server/chunks/ssr";
try {
  for (const f of readdirSync(SSR_DIR).filter((x) => x.endsWith(".map"))) {
    let map;
    try {
      map = JSON.parse(readFileSync(`${SSR_DIR}/${f}`, "utf8"));
    } catch {
      continue;
    }
    for (const sec of map.sections ?? []) {
      const srcs = sec.map?.sources ?? [];
      const conts = sec.map?.sourcesContent ?? [];
      conts.forEach((src, i) => {
        if (typeof src !== "string") return;
        if (!(srcs[i] ?? "").includes("workbench.tsx")) return;
        if (src.length < 30000) return;
        baselines.push({ name: `sourcemap ${f.slice(0, 30)} (${src.length} 字符)`, lines: src.split("\n") });
      });
    }
  }
} catch {
  /* 没有 sourcemap 也能跑 */
}

console.log(`参照源 ${baselines.length} 个:`);
for (const b of baselines) console.log(`  - ${b.name}: ${b.lines.length} 行`);

/** 每个参照源建 骨架 -> 行数组 的索引 */
const indexes = baselines.map((b) => {
  const m = new Map();
  for (const line of b.lines) {
    const key = skeleton(line);
    if (!key) continue;
    if (!m.has(key)) m.set(key, []);
    m.get(key).push(line);
  }
  return { name: b.name, map: m };
});

let fixed = 0;
const fixedBy = {};
const ambiguous = [];
const missing = [];

const out = cur.map((line, i) => {
  if (!line.includes("\uFFFD")) return line;
  const key = skeleton(line);
  for (const idx of indexes) {
    const hit = idx.map.get(key);
    if (hit?.length === 1) {
      fixed += 1;
      fixedBy[idx.name] = (fixedBy[idx.name] ?? 0) + 1;
      return hit[0];
    }
  }
  // 记录最接近的歧义情况，便于人工判断
  const anyHit = indexes.map((idx) => idx.map.get(key)?.length ?? 0).find((n) => n > 1);
  if (anyHit) ambiguous.push({ line: i + 1, n: anyHit, text: line.trim().slice(0, 88) });
  else missing.push({ line: i + 1, text: line.trim().slice(0, 88) });
  return line;
});

writeFileSync(TARGET, out.join("\n"), "utf8");

console.log(`\n补齐: ${fixed} 行`);
for (const [k, v] of Object.entries(fixedBy)) console.log(`  来自 ${k}: ${v}`);
console.log(`仍残留替换字符: ${out.filter((l) => l.includes("\uFFFD")).length}`);
if (ambiguous.length) {
  console.log(`\n骨架歧义（未改）: ${ambiguous.length}`);
  for (const a of ambiguous.slice(0, 12)) console.log(`  L${a.line} (${a.n}) ${a.text}`);
}
if (missing.length) {
  console.log(`\n参照源都没有（需人工）: ${missing.length}`);
  for (const m of missing.slice(0, 30)) console.log(`  L${m.line} ${m.text}`);
}
