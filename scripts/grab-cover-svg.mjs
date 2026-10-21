import fs from "node:fs";

// 从运行中的首页抓封面主视觉 SVG（真实渲染输出），供 preview.html 内联使用
const base = process.env.BASE_URL ?? "http://localhost:3001";
const res = await fetch(base + "/");
const html = await res.text();
const m = html.match(/<svg[^>]*class="cover__scene"[\s\S]*?<\/svg>/);
if (!m) {
  const any = html.match(/<svg[\s\S]*?<\/svg>/);
  console.log("未匹配 cover__scene · 首个 svg 长度:", any ? any[0].length : 0, "· HTML 长度:", html.length);
  process.exit(1);
}
const svg = m[0];
fs.mkdirSync("public/scene", { recursive: true });
fs.writeFileSync("public/scene/cover-lab.svg", svg, "utf8");
console.log("已抓取封面 SVG:", svg.length, "字节 → public/scene/cover-lab.svg");
console.log("片段:", svg.slice(0, 160).replace(/\s+/g, " "));
