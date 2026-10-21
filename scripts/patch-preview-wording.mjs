import fs from "node:fs";

const f = "scripts/preview-page.mjs";
let t = fs.readFileSync(f, "utf8");

const pairs = [
  [
    "截图直接看；“打开操作台 / 看报告”需要本机 <code>localhost:3001</code> 正在运行（<code>start-chem-lab.bat</code>）。",
    "截图直接看；卡片链接指向站内页面，应用跑起来（或部署到 coze 后）点开即用。",
  ],
  [
    "BASE_URL=http://localhost:3001 node scripts/exp-chain.mjs &lt;trapId&gt;",
    "BASE_URL=&lt;你的地址&gt; node scripts/exp-chain.mjs &lt;trapId&gt;",
  ],
];

let n = 0;
for (const [from, to] of pairs) {
  if (t.includes(from)) {
    t = t.replace(from, to);
    n++;
  } else {
    console.log("未匹配:", from.slice(0, 20));
  }
}
fs.writeFileSync(f, t, "utf8");
console.log("替换", n, "处");
