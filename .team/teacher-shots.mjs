import { chromium } from "@playwright/test";

const BASE = "http://127.0.0.1:3000";
const OUT = "C:/Users/14681/AppData/Local/Temp/chemlab-shots/teacher-extra";
const targets = [
  { route: "/teacher", tag: "teacher" },
  { route: "/teacher/roster", tag: "roster" },
  { route: "/teacher/student/20250101", tag: "student" },
  { route: "/teacher/student/99999999", tag: "student-404" },
  { route: "/teacher?q=zzzz", tag: "teacher-empty" },
];

const browser = await chromium.launch();
for (const vp of [
  { w: 1440, h: 900, tag: "desktop" },
  { w: 768, h: 1024, tag: "tablet" },
  { w: 390, h: 844, tag: "mobile" },
]) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
  const page = await ctx.newPage();
  // 教师口令解锁（顶栏显示「刘建彩」身份态；不解锁则显示「教师解锁」入口）
  const unlock = await page.request.post(`${BASE}/api/teacher/unlock`, {
    data: { passcode: process.env.TEACHER_PASSCODE ?? "2026" },
  });
  if (!unlock.ok()) console.log("unlock failed", unlock.status());

  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error" && !/WebSocket|_next\/hmr/.test(m.text())) errors.push(m.text().slice(0, 160));
  });
  for (const t of targets) {
    const resp = await page.goto(BASE + t.route, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(200);
    const info = await page.evaluate(() => {
      const table = document.querySelector("table");
      return {
        sw: document.documentElement.scrollWidth,
        cw: document.documentElement.clientWidth,
        tableW: table ? Math.round(table.getBoundingClientRect().width) : 0,
      };
    });
    const chip = await page.locator("text=教师解锁").count();
    console.log(
      `${vp.tag} ${t.route} status=${resp?.status()} sw=${info.sw} cw=${info.cw} tableW=${info.tableW} unlockChip=${chip}`,
    );
    if (info.sw > info.cw + 2) console.log("  !! 横向溢出");
    if (errors.length) console.log("  errors:", errors.slice(0, 2));
    await page.screenshot({ path: `${OUT}/${t.tag}-${vp.tag}.png`, fullPage: true });
  }
  await ctx.close();
}
await browser.close();
