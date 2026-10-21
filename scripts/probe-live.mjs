/**
 * 线上探活：验证扣子部署的站点关键接口是否可用（含登录后的页面）。
 * 用法：node scripts/probe-live.mjs [baseUrl]
 */
const BASE = process.argv[2] ?? "https://smnh6y8fgh.coze.site";

async function probe(path, init) {
  try {
    const res = await fetch(BASE + path, { ...init, redirect: "manual", signal: AbortSignal.timeout(30000) });
    const text = await res.text();
    return { status: res.status, text, headers: res.headers };
  } catch (err) {
    return { status: 0, text: String(err), headers: new Headers() };
  }
}

const home = await probe("/");
console.log(`GET /                -> ${home.status}`);

const login = await probe("/login");
console.log(`GET /login           -> ${login.status}  「进入实验」:${login.text.includes("进入实验")}  「登录并进入实验」:${login.text.includes("登录并进入实验")}`);

const session = await probe("/api/session", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ studentNo: "20250101", name: "周若曦" }),
});
console.log(`POST /api/session    -> ${session.status}  ${session.text.slice(0, 120)}`);

// 从 set-cookie 里取会话（多个 cookie 的话全带上）
const setCookie = session.headers.getSetCookie?.() ?? [];
const cookie = setCookie.map((c) => c.split(";")[0]).join("; ");
console.log(`cookie               -> ${cookie ? cookie.replace(/=.*/, "=***") : "(无)"}`);

const withCookie = { headers: { cookie } };
const list = await probe("/experiments", withCookie);
console.log(`GET /experiments     -> ${list.status}  「重点实验」:${list.text.includes("重点实验")}  「即将开放」:${list.text.includes("即将开放")}`);

const exp = await probe("/exp/exp01", withCookie);
console.log(`GET /exp/exp01       -> ${exp.status}  「前测」:${exp.text.includes("前测")}  「跳过实验」:${exp.text.includes("跳过实验")}`);

const teacher = await probe("/teacher", withCookie);
console.log(`GET /teacher         -> ${teacher.status}（未解锁时被挡属正常）`);
