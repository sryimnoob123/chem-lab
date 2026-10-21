import fs from "node:fs";
import path from "node:path";

const file = path.join(process.cwd(), "app", "exp", "[id]", "workbench.tsx");
const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
const bad = [];
lines.forEach((line, i) => {
  if (!line.includes("\uFFFD")) return;
  const t = line.trim();
  const isComment = t.startsWith("//") || t.startsWith("*") || t.startsWith("/*") || t.startsWith("{/*");
  bad.push({ line: i + 1, isComment, text: t.slice(0, 120) });
});
console.log("FFFD lines:", bad.length, "| code:", bad.filter((b) => !b.isComment).length);
for (const b of bad.filter((b) => !b.isComment)) console.log(`L${b.line}: ${b.text}`);
