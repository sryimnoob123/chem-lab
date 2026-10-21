#!/usr/bin/env node
/**
 * 检查源码文件编码问题（Windows 下多 agent 并行最容易踩的坑）：
 *  - UTF-16 BOM / NUL 字节
 *  - 非法 UTF-8 序列（表现为 \uFFFD）
 *  - 中文引号当代码引号用（“ ” ‘ ’）
 *
 * 用法：node scripts/check-encoding.mjs [glob根，默认仓库根]
 * 退出码：0 干净；1 有问题（打印文件与首个问题位置）
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(import.meta.dirname, "..");
const EXTS = new Set([".ts", ".tsx", ".css", ".md", ".mjs", ".json", ".sql"]);
const SKIP = new Set(["node_modules", ".next", ".git", ".pgdata", "public", "e2e-review", ".ref"]);

const problems = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP.has(entry.name)) continue;
      walk(full);
      continue;
    }
    if (!EXTS.has(path.extname(entry.name))) continue;
    if (entry.name.endsWith(".woff2")) continue;

    const buf = fs.readFileSync(full);
    const rel = path.relative(ROOT, full);

    // BOM / UTF-16
    if (buf[0] === 0xff && buf[1] === 0xfe) problems.push(`${rel}: UTF-16LE BOM`);
    if (buf[0] === 0xfe && buf[1] === 0xff) problems.push(`${rel}: UTF-16BE BOM`);
    if (buf.includes(0x00)) {
      const idx = buf.indexOf(0x00);
      problems.push(`${rel}: 含 NUL 字节 @${idx}（极可能是 UTF-16 被当成 UTF-8）`);
      continue;
    }

    const text = buf.toString("utf8");
    const bad = text.indexOf("\uFFFD");
    if (bad >= 0) {
      const line = text.slice(0, bad).split("\n").length;
      problems.push(`${rel}: 非法 UTF-8 序列 @第 ${line} 行`);
      continue;
    }

    // 中文引号出现在疑似代码位置（行内含 = " 或 import 等）
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (/[“”‘’]/.test(l) && /(=\s*[“”‘’]|import\s|export\s|\(\s*[“”]|,\s*[“”]|\breturn\s+[“”])/.test(l)) {
        problems.push(`${rel}:${i + 1}: 疑似中文引号当代码引号`);
        break;
      }
    }
  }
}

walk(ROOT);

if (problems.length) {
  console.log(`发现 ${problems.length} 处疑似编码问题：`);
  for (const p of problems) console.log(" - " + p);
  process.exit(1);
}
console.log("编码检查通过：无 BOM / 无 NUL / 无非法 UTF-8");
