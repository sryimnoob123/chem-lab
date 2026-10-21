import fs from "node:fs";

const total = { L1: 0, L2: 0, L3: 0, L4: 0 };
const rows = [];
for (let i = 1; i <= 10; i++) {
  const id = `exp${String(i).padStart(2, "0")}`;
  const p = `experiments/${id}/definition.ts`;
  if (!fs.existsSync(p)) {
    rows.push(`${id}: 缺失`);
    continue;
  }
  const s = fs.readFileSync(p, "utf8");
  const c = {
    L1: (s.match(/"L1"/g) || []).length,
    L2: (s.match(/"L2"/g) || []).length,
    L3: (s.match(/"L3"/g) || []).length,
    L4: (s.match(/"L4"/g) || []).length,
  };
  for (const k of Object.keys(c)) total[k] += c[k];
  rows.push(`${id}  L1=${c.L1}  L2=${c.L2}  L3=${c.L3}  L4=${c.L4}  合计 ${c.L1 + c.L2 + c.L3 + c.L4}`);
}
console.log(rows.join("\n"));
console.log("总计", JSON.stringify(total), "共", total.L1 + total.L2 + total.L3 + total.L4, "条事故");
