/**
 * 只读校验：确认 .next 里那份 sourcemap 的 sourcesContent 是否含 workbench.tsx 的完整原始 TSX。
 * 用于判断"从 sourcemap 恢复"是否可行（不写任何文件）。
 */
import { readFileSync } from "node:fs";

const MAP = ".next/dev/server/chunks/ssr/app_exp_[id]_157lbxsvvrk7u._.js.map";
const map = JSON.parse(readFileSync(MAP, "utf8"));

console.log("sources:", map.sources);
const contents = map.sourcesContent ?? [];
console.log("sourcesContent 条数:", contents.length);

contents.forEach((src, i) => {
  if (typeof src !== "string") {
    console.log(`  [${i}] ${map.sources[i]} → 非字符串`);
    return;
  }
  const hasFallback = src.includes("REJECT_FALLBACK");
  const hasMission = src.includes("mission-board") || src.includes("MissionBoard");
  const mojibake = /[\uFFFD]|锛|鐨|涓|姝/.test(src);
  console.log(
    `  [${i}] ${map.sources[i]}\n      长度=${src.length} REJECT_FALLBACK=${hasFallback} mission=${hasMission} 乱码=${mojibake}`,
  );
  if (hasFallback) {
    const idx = src.indexOf("REJECT_FALLBACK");
    console.log("      ---- 片段 ----");
    console.log(
      src
        .slice(idx - 60, idx + 220)
        .split("\n")
        .map((l) => "      " + l)
        .join("\n"),
    );
  }
});
