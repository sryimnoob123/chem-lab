// 下载字体 woff2 到 public/fonts/（不改 package.json）。
// 运行：node docs/design/tools/fetch-fonts.mjs
import { mkdir, writeFile, stat } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const FONTS = resolve(ROOT, "public/fonts");

const NOTO = ["chinese-simplified-400", "chinese-simplified-500", "chinese-simplified-700", "latin-400", "latin-500", "latin-700"];
const MONO = ["400", "500", "600"];

const jobs = [
  ...NOTO.map((s) => ({
    url: `https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-sc@5.3.1/files/noto-sans-sc-${s}-normal.woff2`,
    out: `noto-sans-sc/noto-sans-sc-${s}-normal.woff2`,
  })),
  ...MONO.map((s) => ({
    url: `https://cdn.jsdelivr.net/npm/@fontsource/ibm-plex-mono@5.3.0/files/ibm-plex-mono-latin-${s}-normal.woff2`,
    out: `ibm-plex-mono/ibm-plex-mono-latin-${s}-normal.woff2`,
  })),
];

const licenses = [
  ["https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-sc@5.3.1/LICENSE", "noto-sans-sc/LICENSE.txt"],
  ["https://cdn.jsdelivr.net/npm/@fontsource/ibm-plex-mono@5.3.0/LICENSE", "ibm-plex-mono/LICENSE.txt"],
  ["https://cdn.jsdelivr.net/npm/lxgw-wenkai-webfont@1.7.0/OFL.txt", "lxgw-wenkai/OFL.txt"],
];

async function get(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return Buffer.from(await r.arrayBuffer());
}

async function save(url, out) {
  const dest = resolve(FONTS, out);
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, await get(url));
  const { size } = await stat(dest);
  return { out, size };
}

// LXGW WenKai 400：先取官方 CSS（含 unicode-range 与 97 个子集），再逐个子集下载。
const LXGW = "https://cdn.jsdelivr.net/npm/lxgw-wenkai-webfont@1.7.0";
const css = (await get(`${LXGW}/lxgwwenkai-regular.css`)).toString("utf8");
const subsets = [...new Set(css.match(/lxgwwenkai-regular-subset-\d+\.woff2/g) ?? [])];
await mkdir(resolve(FONTS, "lxgw-wenkai/files"), { recursive: true });
await writeFile(resolve(FONTS, "lxgw-wenkai/lxgwwenkai-regular.css"), css, "utf8");
jobs.push(...subsets.map((f) => ({ url: `${LXGW}/files/${f}`, out: `lxgw-wenkai/files/${f}` })));
jobs.push(...licenses.map(([url, out]) => ({ url, out })));

let ok = 0;
const failed = [];
for (let i = 0; i < jobs.length; i += 8) {
  const batch = jobs.slice(i, i + 8);
  const res = await Promise.allSettled(batch.map((j) => save(j.url, j.out)));
  res.forEach((r, k) => {
    if (r.status === "fulfilled") ok++;
    else failed.push(`${batch[k].out}: ${r.reason.message}`);
  });
}
console.log(`downloaded ${ok}/${jobs.length} files -> ${FONTS}`);
if (failed.length) console.log("FAILED:\n" + failed.join("\n"));
