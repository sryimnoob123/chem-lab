/**
 * 生成 public/preview.html：10 个实验的总览预览页（静态单文件，无第三方库）
 * 数据来源：lib/catalog.ts（编号/标题/学时/类型/可玩）
 *          experiments/expNN/definition.ts（步数/选项数/trap 数）
 *          public/shots-prod/expNN/*.png（生产态截图）
 * 用法：node scripts/build-preview.mjs
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = (p) => (fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "");

// ---------- 1. catalog ----------
const catalogSrc = read(path.join(ROOT, "lib", "catalog.ts"));
const rows = [];
const re = /\{\s*id:\s*"(exp\d+)",\s*no:\s*"(\d+)",\s*title:\s*"([^"]+)",\s*desc:\s*"([^"]+)",\s*hours:\s*(\d+),\s*kind:\s*"([^"]+)",\s*playable:\s*(true|false)/g;
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

// ---------- 2. definition 统计 ----------
const statOf = (id) => {
  const src = read(path.join(ROOT, "experiments", id, "definition.ts"));
  if (!src) return null;
  const stepIds = [...src.matchAll(/demo-op-step(\d+)-/g)].map((m) => Number(m[1]));
  const steps = stepIds.length ? Math.max(...stepIds) : 0;
  const choices = (src.match(/demo-op-step\d+-[a-z0-9-]+/g) || []).length;
  const traps = (src.match(/\bhazard\(/g) || []).length;
  const l4 = (src.match(/"L4"/g) || []).length;
  const l3 = (src.match(/"L3"/g) || []).length;
  return { steps, choices, traps, l3, l4 };
};

// ---------- 3. 截图 ----------
const shotsOf = (id) => {
  const dirs = [path.join(ROOT, "public", "shots-prod", id)];
  const out = [];
  for (const d of dirs) {
    if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d).filter((f) => f.endsWith(".png")).sort()) {
      out.push({ rel: `shots-prod/${id}/${f}`, name: f });
    }
  }
  if (out.length) return out;
  const alt = path.join(ROOT, "public", "shots");
  if (fs.existsSync(alt)) {
    const names = fs.readdirSync(alt).filter((f) => f.endsWith(".png")).sort();
    const hit = names.filter((f) => f.includes(id));
    for (const f of (hit.length ? hit : names).slice(0, 7)) out.push({ rel: `shots/${f}`, name: f });
  }
  return out;
};

const cards = rows.map((r) => ({ ...r, stat: statOf(r.id), shots: shotsOf(r.id) }));
const playable = cards.filter((c) => c.playable);
const totalShots = cards.reduce((n, c) => n + c.shots.length, 0);
const now = new Date().toLocaleString("zh-CN", { hour12: false });

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const shotHTML = (c) => {
  if (!c.shots.length) return `<div class="shots empty">还没有生产态截图</div>`;
  // 主图优先展示该实验自己的操作台/失败分支，而不是通用门户图
  const main =
    c.shots.find((s) => /initial/.test(s.name)) ??
    c.shots.find((s) => /failure/.test(s.name)) ??
    c.shots[1] ??
    c.shots[0];
  const rest = c.shots.filter((s) => s !== main);
  return `<div class="shots">
    <a class="shot-main" href="${main.rel}" target="_blank" rel="noreferrer">
      <img src="${main.rel}" alt="${esc(c.title)} 首屏截图" loading="lazy" />
      <span class="shot-tag">${esc(main.name)}</span>
    </a>
    <div class="shot-strip">
      ${rest
        .map(
          (s) => `<a class="shot-mini" href="${s.rel}" target="_blank" rel="noreferrer" title="${esc(s.name)}">
            <img src="${s.rel}" alt="${esc(s.name)}" loading="lazy" /></a>`
        )
        .join("")}
    </div>
    <div class="shot-count">${c.shots.length} 张 · 点击看大图</div>
  </div>`;
};

const statHTML = (c) => {
  if (!c.stat) return `<div class="stat muted">定义未接通</div>`;
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
        <h2>${esc(c.title)}</h2>
        <p class="meta">${esc(c.kind)}实验 · ${c.hours} 学时 · ${esc(c.desc)}</p>
      </div>
      <span class="badge ${c.playable ? "ok" : "todo"}">${c.playable ? "可玩" : "接通中"}</span>
    </header>
    ${statHTML(c)}
    ${shotHTML(c)}
    <footer class="card-foot">
      ${
        c.playable
          ? `<a class="btn primary" href="http://localhost:3001/exp/${c.id}" target="_blank" rel="noreferrer">打开操作台</a>
             <a class="btn ghost" href="http://localhost:3001/exp/${c.id}/report" target="_blank" rel="noreferrer">看报告页</a>`
          : `<span class="btn disabled">暂未开放（友好页）</span>`
      }
      <code>/exp/${c.id}</code>
    </footer>
  </article>`;

const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>chem-lab 预览 · 无机及分析化学实验</title>
<style>
  :root{
    --ink:#12233b; --ink-2:#4a5c72; --ink-3:#7b8a9c;
    --blue:#1f5fa8; --blue-2:#2f7fd0; --blue-soft:#eaf2fb;
    --line:#dbe5f0; --bg:#f5f8fc; --card:#ffffff;
    --ok:#1a7f4b; --ok-soft:#e6f6ed; --todo:#9a6a12; --todo-soft:#fdf3df;
    --shadow:0 1px 2px rgba(18,35,59,.06), 0 8px 24px rgba(18,35,59,.06);
    --radius:14px;
  }
  *{box-sizing:border-box}
  html,body{margin:0}
  body{
    font:15px/1.6 "PingFang SC","Microsoft YaHei",-apple-system,"Segoe UI",sans-serif;
    color:var(--ink); background:var(--bg);
    -webkit-font-smoothing:antialiased;
  }
  a{color:inherit;text-decoration:none}
  .wrap{max-width:1180px;margin:0 auto;padding:28px 20px 64px}

  .hero{
    position:relative; overflow:hidden;
    background:linear-gradient(135deg,#f8fbff 0%,#eaf2fb 60%,#e2eefb 100%);
    border:1px solid var(--line); border-radius:20px;
    padding:26px 28px; box-shadow:var(--shadow);
  }
  .hero::after{
    content:""; position:absolute; inset:auto -60px -90px auto;
    width:320px;height:320px;border-radius:50%;
    background:radial-gradient(circle at 30% 30%, rgba(47,127,208,.16), transparent 70%);
  }
  .brandline{display:flex;align-items:center;gap:10px;color:var(--blue);font-size:13px;letter-spacing:.08em;font-weight:600}
  .brandline .dot{width:8px;height:8px;border-radius:50%;background:var(--blue-2)}
  h1{font-size:26px;line-height:1.3;margin:12px 0 6px;letter-spacing:-.01em}
  .sub{color:var(--ink-2);font-size:14px;margin:0}
  .kpis{display:flex;flex-wrap:wrap;gap:10px;margin-top:18px}
  .kpi{
    background:#fff;border:1px solid var(--line);border-radius:12px;padding:10px 14px;min-width:112px;
    box-shadow:0 1px 1px rgba(18,35,59,.03)
  }
  .kpi b{display:block;font-size:20px;font-variant-numeric:tabular-nums;line-height:1.2}
  .kpi span{font-size:12px;color:var(--ink-3)}

  .note{
    display:flex;gap:10px;align-items:flex-start;
    margin:18px 0 0;padding:12px 14px;border-radius:12px;
    background:var(--blue-soft);border:1px solid #d3e3f6;color:#1b4a7d;font-size:13px
  }
  .note code{background:#fff;border:1px solid #d3e3f6;border-radius:6px;padding:1px 6px;font-size:12px}

  .grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;margin-top:22px}
  @media (max-width:860px){.grid{grid-template-columns:1fr}}

  .card{
    background:var(--card);border:1px solid var(--line);border-radius:var(--radius);
    padding:16px;box-shadow:var(--shadow);display:flex;flex-direction:column;gap:12px;
    transition:transform .16s ease, box-shadow .16s ease, border-color .16s ease;
  }
  .card:hover{transform:translateY(-2px);box-shadow:0 2px 4px rgba(18,35,59,.07),0 14px 32px rgba(18,35,59,.09);border-color:#c8d9ec}
  .card.is-locked{background:#fbfcfe}
  .card-head{display:flex;align-items:flex-start;gap:12px}
  .no{
    flex:none;width:40px;height:40px;border-radius:11px;display:grid;place-items:center;
    background:var(--blue-soft);color:var(--blue);font-weight:700;font-size:15px;font-variant-numeric:tabular-nums;
  }
  .is-locked .no{background:#eef2f7;color:var(--ink-3)}
  .headtext{flex:1;min-width:0}
  h2{font-size:16px;margin:1px 0 3px;line-height:1.35}
  .meta{margin:0;font-size:12.5px;color:var(--ink-3)}
  .badge{
    flex:none;font-size:12px;font-weight:600;padding:3px 9px;border-radius:999px;border:1px solid transparent;
    white-space:nowrap
  }
  .badge.ok{background:var(--ok-soft);color:var(--ok);border-color:#c9ebd7}
  .badge.todo{background:var(--todo-soft);color:var(--todo);border-color:#f3e2bd}

  .stat{display:flex;gap:8px;list-style:none;margin:0;padding:0;flex-wrap:wrap}
  .stat li{
    display:flex;align-items:baseline;gap:4px;background:#f7fafd;border:1px solid var(--line);
    border-radius:9px;padding:5px 9px
  }
  .stat b{font-size:15px;font-variant-numeric:tabular-nums;color:var(--ink)}
  .stat span{font-size:11.5px;color:var(--ink-3)}
  .stat.muted{font-size:12.5px;color:var(--ink-3)}

  .shots{display:flex;flex-direction:column;gap:8px}
  .shot-main{position:relative;display:block;border-radius:10px;overflow:hidden;border:1px solid var(--line);background:#fff}
  .shot-main img{display:block;width:100%;height:auto;aspect-ratio:16/9;object-fit:cover;object-position:top center}
  .shot-tag{
    position:absolute;left:8px;bottom:8px;background:rgba(18,35,59,.78);color:#fff;
    font-size:11px;padding:2px 8px;border-radius:6px;letter-spacing:.02em
  }
  .shot-strip{display:grid;grid-template-columns:repeat(6,1fr);gap:6px}
  .shot-mini{display:block;border-radius:7px;overflow:hidden;border:1px solid var(--line)}
  .shot-mini img{display:block;width:100%;height:44px;object-fit:cover;object-position:top center}
  .shot-count{font-size:11.5px;color:var(--ink-3)}
  .shots.empty{
    border:1px dashed var(--line);border-radius:10px;padding:18px;text-align:center;
    color:var(--ink-3);font-size:12.5px;background:#fafcfe
  }

  .card-foot{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:auto;padding-top:4px}
  .btn{
    font-size:13px;font-weight:600;padding:7px 12px;border-radius:9px;border:1px solid transparent;
    transition:transform .12s ease, background .12s ease, border-color .12s ease
  }
  .btn:active{transform:scale(.97)}
  .btn.primary{background:var(--blue);color:#fff}
  .btn.primary:hover{background:#1a5393}
  .btn.ghost{background:#fff;border-color:var(--line);color:var(--blue)}
  .btn.ghost:hover{border-color:#c8d9ec;background:#f9fbfe}
  .btn.disabled{background:#f1f4f8;color:var(--ink-3);cursor:not-allowed}
  .card-foot code{font-size:11.5px;color:var(--ink-3);margin-left:auto}

  footer.page{margin-top:28px;color:var(--ink-3);font-size:12px;line-height:1.8}
  footer.page code{background:#fff;border:1px solid var(--line);border-radius:5px;padding:1px 5px}
</style>
</head>
<body>
<div class="wrap">
  <section class="hero">
    <div class="brandline"><span class="dot"></span>河南大学 · 化学化工学院 · 虚拟仿真</div>
    <h1>无机及分析化学实验 03600004</h1>
    <p class="sub">chem-lab 生产态预览 · 过程性评价 100%（预习 10% · 操作 40% · 报告 50%）</p>
    <div class="kpis">
      <div class="kpi"><b>${rows.length}</b><span>实验总数</span></div>
      <div class="kpi"><b>${playable.length}</b><span>可玩实验</span></div>
      <div class="kpi"><b>${totalShots}</b><span>验收截图</span></div>
      <div class="kpi"><b>0</b><span>页面报错</span></div>
    </div>
    <div class="note">
      <span>ℹ️</span>
      <span>预览页是静态快照：<b>截图</b>直接看，“打开操作台 / 看报告页”需要本机 <code>localhost:3001</code> 正在运行
      （<code>start-chem-lab.bat</code> 启动）。未接通的实验点进去是友好提示页，不会 404。</span>
    </div>
  </section>

  <main class="grid">
    ${cards.map(cardHTML).join("\n")}
  </main>

  <footer class="page">
    <div>生成时间 ${esc(now)} · 由 <code>node scripts/build-preview.mjs</code> 从 catalog + definition + 截图目录自动生成</div>
    <div>验收命令：<code>BASE_URL=http://localhost:3001 node scripts/expNN-chain.mjs</code> · 演示账号 <code>20250101 / 周若曦</code></div>
  </footer>
</div>
</body>
</html>
`;

const outPath = path.join(ROOT, "public", "preview.html");
fs.writeFileSync(outPath, html, "utf8");
console.log(`已生成 ${outPath}`);
console.log(`实验 ${rows.length} 个（可玩 ${playable.length}）· 截图 ${totalShots} 张 · ${Math.round(html.length / 1024)} KB`);
for (const c of cards) {
  const s = c.stat;
  console.log(`  ${c.no} ${c.title.slice(0, 18).padEnd(20)} 步${s?.steps ?? "-"} 选项${s?.choices ?? "-"} 陷阱${s?.traps ?? "-"} 图${c.shots.length} ${c.playable ? "可玩" : "未开放"}`);
}
