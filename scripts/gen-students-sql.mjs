/**
 * 生成 40 人演示学生名单 SQL（与 db/seed-demo.mjs 口径一致）。
 * 用法：node scripts/gen-students-sql.mjs > db/seed-students-40.sql
 */
const SURNAMES = "王李张刘陈杨赵黄周吴徐孙马朱胡郭何高林罗郑梁谢宋唐许韩冯邓曹彭".split("");
const GIVEN = ["浩然", "思远", "梓涵", "雨欣", "明轩", "佳怡", "子墨", "欣怡", "宇轩", "诗涵", "俊杰", "静怡", "泽宇", "梦琪", "浩然", "雨桐", "嘉豪", "语汐", "星辰", "若曦"];
const CLASSES = ["化工 25-1 班", "化工 25-2 班"];

const rows = [];
for (let i = 1; i <= 40; i++) {
  const studentNo = `2025${String(101 + i - 1).padStart(4, "0")}`;
  const name = i === 1 ? "周若曦" : SURNAMES[(i * 7) % SURNAMES.length] + GIVEN[(i * 3) % GIVEN.length];
  const className = i <= 20 ? CLASSES[0] : CLASSES[1];
  rows.push(`('${studentNo}', '${name}', '${className}')`);
}

const sql = [
  "-- 40 人演示学生名单（幂等）",
  "INSERT INTO students (student_no, name, class_name) VALUES",
  rows.join(",\n"),
  "ON CONFLICT (student_no) DO UPDATE SET name = EXCLUDED.name, class_name = EXCLUDED.class_name;",
  "",
].join("\n");

const outPath = process.argv[2] ?? "db/seed-students-40.sql";
await (await import("node:fs/promises")).writeFile(outPath, sql, "utf8");
console.log(`已写入 ${outPath}（${rows.length} 人）`);
