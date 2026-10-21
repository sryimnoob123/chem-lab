import { PGlite } from "@electric-sql/pglite";

const dir = process.env.PGLITE_DIR ?? ".pgdata";
const db = new PGlite(dir);
const rows = await db.query("select student_no, name, class_name from students order by student_no limit 5");
for (const r of rows.rows) console.log(`${r.student_no} | ${r.name} | ${r.class_name}`);
const n = await db.query("select count(*)::int as c from students");
console.log("学生总数:", n.rows[0].c);
await db.close();
