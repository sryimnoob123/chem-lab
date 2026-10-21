import fs from "node:fs";
import path from "node:path";

const f = "scripts/build-preview.mjs";
let t = fs.readFileSync(f, "utf8");

// 1) 在 </main> 之后插入「平台能力」区块
const anchor = `  </main>\n`;
const extrasBlock = [
  "  </main>",
  "",
  '  <h2 class="sec-title">平台能力（不止实验台）</h2>',
  '  <section class="grid">',
  "    ${extras.map(cardHTML).join(\"\\n\")}",
  "  </section>",
  "",
].join("\n");
if (!t.includes("平台能力（不止实验台）")) {
  t = t.replace(anchor, extrasBlock);
}

// 2) 生成 extras 数据（在 cards 定义后）
const extrasAnchor = `const playable = cards.filter((c) => c.playable);`;
const extrasData = `const playable = cards.filter((c) => c.playable);

// ── 平台能力卡（BOPPPS / 方案设计 / 教师端）──
const extraDefs = [
  {
    id: "bopbps",
    no: "B",
    title: "BOPPPS 教学六段",
    desc: "导入 / 目标 / 前测门禁 / 参与式 / 后测 / 总结",
    kind: "教学",
    hours: 0,
    playable: true,
    link: "http://localhost:3001/exp/exp01",
    shotsDir: "bopbps",
  },
  {
    id: "plan",
    no: "P",
    title: "拼接式方案设计",
    desc: "31 块素材 · 21 条规则实时校验 · 方案保存",
    kind: "设计",
    hours: 0,
    playable: true,
    link: "http://localhost:3001/plan",
    shotsDir: "plan",
  },
];
const extras = extraDefs.map((d) => {
  const dir = path.join(ROOT, "public", "shots-prod", d.shotsDir);
  const shots = fs.existsSync(dir)
    ? fs
        .readdirSync(dir)
        .filter((x) => x.endsWith(".png"))
        .sort()
        .map((x) => ({ rel: \`shots-prod/\${d.shotsDir}/\${x}\`, name: x }))
    : [];
  return { ...d, stat: null, shots };
});`;

if (!t.includes("extraDefs")) {
  t = t.replace(extrasAnchor, extrasData);
}

// 3) 卡片底部链接：能力卡用各自 link
t = t.replace(
  `        c.playable
          ? \`<a class="btn primary" href="http://localhost:3001/exp/\${c.id}" target="_blank" rel="noreferrer">打开操作台</a>
             <a class="btn ghost" href="http://localhost:3001/exp/\${c.id}/report" target="_blank" rel="noreferrer">看报告页</a>\`
          : \`<span class="btn disabled">暂未开放（友好页）</span>\``,
  `        c.link
          ? \`<a class="btn primary" href="\${c.link}" target="_blank" rel="noreferrer">打开</a>\`
          : c.playable
            ? \`<a class="btn primary" href="http://localhost:3001/exp/\${c.id}" target="_blank" rel="noreferrer">打开操作台</a>
               <a class="btn ghost" href="http://localhost:3001/exp/\${c.id}/report" target="_blank" rel="noreferrer">看报告页</a>\`
            : \`<span class="btn disabled">暂未开放（友好页）</span>\``,
);

// 4) 路径小节标题样式 + 能力卡不要 /exp/xxx 的 code
t = t.replace(`  footer.page{margin-top:28px`, `  .sec-title{font-size:17px;margin:34px 0 0;letter-spacing:-.01em}
  footer.page{margin-top:28px`);
t = t.replace(`      <code>/exp/\${c.id}</code>`, `      \${c.link ? "" : \`<code>/exp/\${c.id}</code>\`}`);

fs.writeFileSync(f, t, "utf8");
console.log("已改 build-preview.mjs ·", t.length, "字节；extras:", t.includes("extraDefs"), "| 平台能力:", t.includes("平台能力（不止实验台）"));
