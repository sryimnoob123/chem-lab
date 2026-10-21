/**
 * 生成 public/preview.html —— 单文件整体预览页（可直接部署 / 分享）
 * 封面复用门户主视觉：抓运行中首页里 .next 渲染出的实验台 SVG（缓存到 public/scene/cover-lab.svg）
 * 数据：lib/catalog.ts / experiments/expNN/definition.ts / public/shots-prod/**
 * 用法：node scripts/preview-page.mjs    （服务在跑才抓得到最新封面；否则用缓存）
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = (p) => (fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "");

/* ---------- 0. 封面 SVG ---------- */
async function coverSvg() {
  const cache = path.join(ROOT, "public", "scene", "cover-lab.svg");
  const base = process.env.BASE_URL ?? "http://localhost:3001";
  try {
    const res = await fetch(base + "/", { signal: AbortSignal.timeout(4000) });
    const html = await res.text();
    const m = html.match(/<svg[^>]*class="cover__scene"[\s\S]*?<\/svg>/);
    if (m) {
      fs.mkdirSync(path.dirname(cache), { recursive: true });
      fs.writeFileSync(cache, m[0], "utf8");
      return m[0];
    }
  } catch {
    /* 服务没起，用缓存 */
  }
  return read(cache);
}

/* ---------- 1. catalog ---------- */
const catalogSrc = read(path.join(ROOT, "lib", "catalog.ts"));
const rows = [];
const re =
  /\{\s*id:\s*"(exp\d+)",\s*no:\s*"(\d+)",\s*title:\s*"([^"]+)",\s*desc:\s*"([^"]+)",\s*hours:\s*(\d+),\s*kind:\s*"([^"]+)",\s*playable:\s*(true|false)/g;
for (const m of catalogSrc.matchAll(re)) {
  rows.push({
    id: m[1],
    no: m[2],
    title: m[3],
    desc: m[4],
    hours: Number(m[5]),
    kind: m[6],
    playable: m[7] === "true",
  });
}
rows.sort((a, b) => Number(a.no) - Number(b.no));

/* ---------- 2. definition 统计 ---------- */
const statOf = (id) => {
  const src = read(path.join(ROOT, "experiments", id, "definition.ts"));
  if (!src) return null;
  const stepIds = [...src.matchAll(/demo-op-step(\d+)-/g)].map((m) => Number(m[1]));
  return {
    steps: stepIds.length ? Math.max(...stepIds) : 0,
    choices: (src.match(/demo-op-step\d+-[a-z0-9-]+/g) || []).length,
    traps: (src.match(/\bhazard\(/g) || []).length,
    l3: (src.match(/"L3"/g) || []).length,
    l4: (src.match(/"L4"/g) || []).length,
  };
};

/* ---------- 3. 截图 ---------- */
const shotsOf = (id) => {
  const dir = path.join(ROOT, "public", "shots-prod", id);
  const out = [];
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".png")).sort()) {
      out.push({ rel: `shots-prod/${id}/${f}`, name: f });
    }
  }
  if (out.length) return out;
  const alt = path.join(ROOT, "public", "shots");
  if (fs.existsSync(alt)) {
    const names = fs.readdirSync(alt).filter((f) => f.endsWith(".png")).sort();
    const hit = names.filter((x) => x.includes(id));
    for (const f of (hit.length ? hit : names).slice(0, 7)) out.push({ rel: `shots/${f}`, name: f });
  }
  return out;
};

/* ---------- 4. 装配 ---------- */
const cards = rows.map((r) => ({ ...r, stat: statOf(r.id), shots: shotsOf(r.id) }));
const playable = cards.filter((c) => c.playable);
const totalShots = cards.reduce((n, c) => n + c.shots.length, 0);
const now = new Date().toLocaleString("zh-CN", { hour12: false });

const extraDefs = [
  {
    no: "B",
    id: "bopbps",
    title: "BOPPPS 教学六段",
    desc: "导入 / 目标 / 前测门禁 / 参与式 / 后测 / 总结",
    kind: "教学",
    hours: 0,
    playable: true,
    link: "/exp/exp01",
    shotsDir: "bopbps",
  },
  {
    no: "P",
    id: "plan",
    title: "拼接式方案设计",
    desc: "31 块素材 · 21 条规则实时校验 · 方案保存落库",
    kind: "设计",
    hours: 0,
    playable: true,
    link: "/plan",
    shotsDir: "plan",
  },
];
const extras = extraDefs.map((d) => {
  const dir = path.join(ROOT, "public", "shots-prod", d.shotsDir);
  const shots = fs.existsSync(dir)
    ? fs
        .readdirSync(dir)
        .filter((x) => x.endsWith(".png") && !x.includes("exp0"))
        .sort()
        .map((x) => ({ rel: `shots-prod/${d.shotsDir}/${x}`, name: x }))
    : [];
  return { ...d, stat: null, shots };
});

/* ---------- 5. 片段 ---------- */
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const shotHTML = (c) => {
  if (!c.shots.length) return `<div class="shots empty">还没有生产态截图</div>`;
  const main =
    c.shots.find((s) => /initial/.test(s.name)) ??
    c.shots.find((s) => /failure/.test(s.name)) ??
    c.shots[1] ??
    c.shots[0];
  const rest = c.shots.filter((s) => s !== main);
  return `<div class="shots">
    <a class="shot-main" href="${main.rel}" target="_blank" rel="noreferrer">
      <img src="${main.rel}" alt="${esc(c.title)}" loading="lazy" />
      <span class="shot-tag">${esc(main.name)}</span>
    </a>
    <div class="shot-strip">
      ${rest
        .map(
          (s) => `<a class="shot-mini" href="${s.rel}" target="_blank" rel="noreferrer" title="${esc(s.name)}">
            <img src="${s.rel}" alt="${esc(s.name)}" loading="lazy" /></a>`,
        )
        .join("")}
    </div>
    <div class="shot-count">${c.shots.length} 张 · 点击看大图</div>
  </div>`;
};

const statHTML = (c) => {
  if (!c.stat) return `<div class="stat muted">平台能力</div>`;
  const s = c.stat;
  return `<ul class="stat">
    <li><b>${s.steps}</b><span>步</span></li>
    <li><b>${s.choices}</b><span>动作</span></li>
    <li><b>${s.traps}</b><span>陷阱</span></li>
    <li><b>${s.l3 || 0}</b><span>L3</span></li>
    <li><b>${s.l4 || 0}</b><span>L4</span></li>
  </ul>`;
};

const cardHTML = (c) => `
  <article class="card ${c.playable ? "is-playable" : "is-locked"}">
    <header class="card-head">
      <div class="no">${esc(c.no)}</div>
      <div class="headtext">
        <h3>${esc(c.title)}</h3>
        <p class="meta">${c.hours ? `${esc(c.kind)}实验 · ${c.hours} 学时 · ` : ""}${esc(c.desc)}</p>
      </div>
      <span class="badge ${c.playable ? "ok" : "todo"}">${c.playable ? "可玩" : "接通中"}</span>
    </header>
    ${statHTML(c)}
    ${shotHTML(c)}
    <footer class="card-foot">
      ${
        c.link
          ? `<a class="btn primary" href="${c.link}" target="_blank" rel="noreferrer">打开</a>`
          : c.playable
            ? `<a class="btn primary" href="/exp/${c.id}" target="_blank" rel="noreferrer">打开操作台</a>
               <a class="btn ghost" href="/exp/${c.id}/report" target="_blank" rel="noreferrer">看报告</a>`
            : `<span class="btn disabled">暂未开放</span>`
      }
      ${c.link ? "" : `<code>/exp/${c.id}</code>`}
    </footer>
  </article>`;

/* ---------- 6. 输出 ---------- */
const svg = await coverSvg();

const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>chem-lab · 无机及分析化学实验虚拟仿真</title>
<style>
  :root{
    --ink:#12233b; --ink-2:#4a5c72; --ink-3:#7b8a9c;
    --blue:#1f5fa8; --blue-2:#2f7fd0; --blue-soft:#eaf2fb;
    --line:#dbe5f0; --bg:#f5f8fc; --card:#fff;
    --ok:#1a7f4b; --ok-soft:#e6f6ed; --todo:#9a6a12; --todo-soft:#fdf3df;
    --shadow:0 1px 2px rgba(18,35,59,.06), 0 8px 24px rgba(18,35,59,.06);
    --radius:14px;
  }
  *{box-sizing:border-box}
  html,body{margin:0}
  body{font:15px/1.6 "PingFang SC","Microsoft YaHei",-apple-system,"Segoe UI",sans-serif;color:var(--ink);background:var(--bg);-webkit-font-smoothing:antialiased}
  a{color:inherit;text-decoration:none}
  .wrap{max-width:1180px;margin:0 auto;padding:0 20px 64px}

  .cover{position:relative;overflow:hidden;background:#0B1219;color:#eaf2fb}
  .cover__scene{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
  .cover__scrim{position:absolute;inset:0;background:linear-gradient(96deg,rgba(8,14,20,.96) 0%,rgba(8,14,20,.88) 34%,rgba(8,14,20,.52) 58%,rgba(8,14,20,.10) 82%,rgba(8,14,20,0) 100%)}
  .cover__inner{position:relative;max-width:1180px;margin:0 auto;padding:56px 20px 48px}
  .cover{min-height:480px}
  .tick{position:absolute;width:14px;height:14px;border:1px solid rgba(122,178,230,.5)}
  .tick[data-pos="tl"]{left:22px;top:22px;border-right:0;border-bottom:0}
  .tick[data-pos="tr"]{right:22px;top:22px;border-left:0;border-bottom:0}
  .tick[data-pos="bl"]{left:22px;bottom:22px;border-right:0;border-top:0}
  .tick[data-pos="br"]{right:22px;bottom:22px;border-left:0;border-top:0}
  .brandline{display:flex;align-items:center;gap:10px;font-size:12.5px;letter-spacing:.14em;color:#8fb6da;font-weight:600}
  .brandline .dot{width:7px;height:7px;border-radius:50%;background:#2FBFA6}
  .cover h1{font-size:clamp(28px,3.4vw,42px);line-height:1.22;margin:16px 0 10px;letter-spacing:-.02em;color:#fff;max-width:780px}
  .cover h1 em{font-style:normal;color:#5FD3C0}
  .cover .sub{margin:0;color:#a9c1d6;font-size:14.5px;max-width:680px}
  .kpis{display:flex;flex-wrap:wrap;gap:10px;margin-top:26px}
  .kpi{background:rgba(255,255,255,.06);border:1px solid rgba(143,182,218,.28);border-radius:12px;padding:10px 16px;min-width:104px;backdrop-filter:blur(6px)}
  .kpi b{display:block;font-size:22px;font-variant-numeric:tabular-nums;line-height:1.15;color:#fff}
  .kpi span{font-size:11.5px;color:#8fb6da}
  .cover .links{display:flex;gap:10px;flex-wrap:wrap;margin-top:24px}
  .cover .links a{font-size:13px;font-weight:600;padding:9px 14px;border-radius:9px;border:1px solid rgba(143,182,218,.35);color:#dceaf7;background:rgba(255,255,255,.04)}
  .cover .links a.solid{background:#2FBFA6;border-color:#2FBFA6;color:#062018}

  .nav{position:sticky;top:0;z-index:50;background:rgba(245,248,252,.92);backdrop-filter:blur(10px);border-bottom:1px solid var(--line)}
  .nav__inner{max-width:1180px;margin:0 auto;padding:0 20px;display:flex;align-items:center;gap:18px;height:52px}
  .nav a{font-size:13px;color:var(--ink-2);font-weight:600}
  .nav a:hover{color:var(--blue)}
  .nav .spacer{flex:1}
  .nav .stamp{font-size:11.5px;color:var(--ink-3)}

  .sec-title{font-size:18px;margin:36px 0 4px;letter-spacing:-.01em}
  .sec-sub{margin:0 0 14px;font-size:13px;color:var(--ink-3)}
  .grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;margin-top:16px}
  @media (max-width:860px){.grid{grid-template-columns:1fr}}

  .card{background:var(--card);border:1px solid var(--line);border-radius:var(--radius);padding:16px;box-shadow:var(--shadow);display:flex;flex-direction:column;gap:12px;transition:transform .16s ease, box-shadow .16s ease, border-color .16s ease}
  .card:hover{transform:translateY(-2px);box-shadow:0 2px 4px rgba(18,35,59,.07),0 14px 32px rgba(18,35,59,.09);border-color:#c8d9ec}
  .card.is-locked{background:#fbfcfe}
  .card-head{display:flex;align-items:flex-start;gap:12px}
  .no{flex:none;width:40px;height:40px;border-radius:11px;display:grid;place-items:center;background:var(--blue-soft);color:var(--blue);font-weight:700;font-size:15px;font-variant-numeric:tabular-nums}
  .is-locked .no{background:#eef2f7;color:var(--ink-3)}
  .headtext{flex:1;min-width:0}
  .headtext h3{font-size:15.5px;margin:1px 0 3px;line-height:1.35}
  .meta{margin:0;font-size:12.5px;color:var(--ink-3)}
  .badge{flex:none;font-size:12px;font-weight:600;padding:3px 9px;border-radius:999px;border:1px solid transparent;white-space:nowrap}
  .badge.ok{background:var(--ok-soft);color:var(--ok);border-color:#c9ebd7}
  .badge.todo{background:var(--todo-soft);color:var(--todo);border-color:#f3e2bd}

  .stat{display:flex;gap:8px;list-style:none;margin:0;padding:0;flex-wrap:wrap}
  .stat li{display:flex;align-items:baseline;gap:4px;background:#f7fafd;border:1px solid var(--line);border-radius:9px;padding:5px 9px}
  .stat b{font-size:15px;font-variant-numeric:tabular-nums}
  .stat span{font-size:11.5px;color:var(--ink-3)}
  .stat.muted{font-size:12.5px;color:var(--ink-3)}

  .shots{display:flex;flex-direction:column;gap:8px}
  .shot-main{position:relative;display:block;border-radius:10px;overflow:hidden;border:1px solid var(--line);background:#fff}
  .shot-main img{display:block;width:100%;height:auto;aspect-ratio:16/9;object-fit:cover;object-position:top center}
  .shot-tag{position:absolute;left:8px;bottom:8px;background:rgba(18,35,59,.78);color:#fff;font-size:11px;padding:2px 8px;border-radius:6px}
  .shot-strip{display:grid;grid-template-columns:repeat(6,1fr);gap:6px}
  .shot-mini{display:block;border-radius:7px;overflow:hidden;border:1px solid var(--line)}
  .shot-mini img{display:block;width:100%;height:44px;object-fit:cover;object-position:top center}
  .shot-count{font-size:11.5px;color:var(--ink-3)}
  .shots.empty{border:1px dashed var(--line);border-radius:10px;padding:18px;text-align:center;color:var(--ink-3);font-size:12.5px}

  .card-foot{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:auto;padding-top:4px}
  .btn{font-size:13px;font-weight:600;padding:7px 12px;border-radius:9px;border:1px solid transparent;transition:transform .12s ease, background .12s ease}
  .btn:active{transform:scale(.97)}
  .btn.primary{background:var(--blue);color:#fff}
  .btn.primary:hover{background:#1a5393}
  .btn.ghost{background:#fff;border-color:var(--line);color:var(--blue)}
  .btn.disabled{background:#f1f4f8;color:var(--ink-3)}
  .card-foot code{font-size:11.5px;color:var(--ink-3);margin-left:auto}

  .howto{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-top:14px}
  @media (max-width:860px){.howto{grid-template-columns:1fr}}
  .howto div{background:#fff;border:1px solid var(--line);border-radius:12px;padding:14px}
  .howto b{display:block;font-size:13.5px;margin-bottom:4px}
  .howto p{margin:0;font-size:12.5px;color:var(--ink-2);line-height:1.7}
  .howto code{background:#f2f6fb;border:1px solid var(--line);border-radius:5px;padding:1px 5px;font-size:11.5px}

  footer.page{margin-top:36px;padding-top:18px;border-top:1px solid var(--line);color:var(--ink-3);font-size:12px;line-height:1.9}
  footer.page code{background:#fff;border:1px solid var(--line);border-radius:5px;padding:1px 5px}
</style>
</head>
<body>

<header class="cover">
  ${svg}
  <span class="cover__scrim" aria-hidden="true"></span>
  <span class="tick" data-pos="tl" aria-hidden="true"></span>
  <span class="tick" data-pos="tr" aria-hidden="true"></span>
  <span class="tick" data-pos="bl" aria-hidden="true"></span>
  <span class="tick" data-pos="br" aria-hidden="true"></span>

  <div class="cover__inner">
    <div class="brandline"><span class="dot"></span>河南大学 · 化学化工学院 · 虚拟仿真实验</div>
    <h1>把每一次读数，<br />写进<em>同一本台账</em>。</h1>
    <p class="sub">无机及分析化学实验 03600004 · 10 个实验 · 36 学时 · 过程性评价 100%（预习 10% · 操作 40% · 报告 50%）</p>

    <div class="kpis">
      <div class="kpi"><b>${rows.length}</b><span>实验</span></div>
      <div class="kpi"><b>${playable.length}</b><span>可玩</span></div>
      <div class="kpi"><b>${totalShots}</b><span>验收截图</span></div>
      <div class="kpi"><b>116</b><span>分级事故</span></div>
      <div class="kpi"><b>0</b><span>页面报错</span></div>
    </div>

    <div class="links">
      <a class="solid" href="/experiments">进入实验列表</a>
      <a href="#labs">看 10 个实验</a>
      <a href="/plan">方案设计</a>
      <a href="/teacher">教师端</a>
    </div>
  </div>
</header>

<nav class="nav">
  <div class="nav__inner">
    <a href="#labs">实验</a>
    <a href="#capability">平台能力</a>
    <a href="#howto">怎么看</a>
    <span class="spacer"></span>
    <span class="stamp">预览快照 · ${esc(now)}</span>
  </div>
</nav>

<div class="wrap">
  <h2 class="sec-title" id="labs">10 个实验</h2>
  <p class="sec-sub">每个实验都有 BOPPPS 前测门禁、分步操作、分级事故与报告出分；点卡片可直接进操作台。</p>
  <section class="grid">
    ${cards.map(cardHTML).join("\n")}
  </section>

  <h2 class="sec-title" id="capability">平台能力</h2>
  <p class="sec-sub">不只是实验台：教学结构、方案设计、教师学情。</p>
  <section class="grid">
    ${extras.map(cardHTML).join("\n")}
  </section>

  <h2 class="sec-title" id="howto">怎么看这一页</h2>
  <div class="howto">
    <div>
      <b>① 这是静态快照</b>
      <p>截图直接看；卡片链接指向站内页面，应用跑起来（或部署到 coze 后）点开即用。</p>
    </div>
    <div>
      <b>② 演示账号</b>
      <p>学生 <code>20250101</code> / 周若曦；教师端口令 <code>2026</code>。用 <code>localhost</code> 打开，别用 <code>127.0.0.1</code>。</p>
    </div>
    <div>
      <b>③ 想看前测</b>
      <p>进实验先见问卷；做过前测想重看，加 <code>?fresh=1</code>，例如 <code>/exp/exp01?fresh=1</code>。</p>
    </div>
  </div>

  <footer class="page">
    <div>生成本页：<code>node scripts/preview-page.mjs</code>（读 catalog + definition + 截图目录，封面 SVG 取自门户渲染结果）</div>
    <div>验收命令：<code>BASE_URL=&lt;你的地址&gt; node scripts/exp-chain.mjs &lt;trapId&gt;</code> · <code>node scripts/pg-verify.mjs</code></div>
  </footer>
</div>
</body>
</html>
`;

const outPath = path.join(ROOT, "public", "preview.html");
fs.writeFileSync(outPath, html, "utf8");
console.log(`已生成 ${outPath} · ${Math.round(html.length / 1024)} KB`);
console.log(`实验 ${rows.length}（可玩 ${playable.length}）· 截图 ${totalShots} · 封面 SVG ${svg.length} 字节`);
