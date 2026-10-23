import { test } from "@playwright/test";

test("perf: 关键页面的加载与体积", async ({ page }) => {
  for (const route of ["/experiments", "/exp/exp01", "/teacher", "/plan"]) {
    const t0 = Date.now();
    await page.goto(route, { waitUntil: "load" });
    const loadMs = Date.now() - t0;
    const m = await page.evaluate(() => {
      const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
      const res = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
      const js = res.filter((r) => r.name.endsWith(".js"));
      const css = res.filter((r) => r.name.endsWith(".css"));
      const sum = (arr: PerformanceResourceTiming[]) => arr.reduce((a, r) => a + (r.transferSize || 0), 0);
      const slow = res
        .filter((r) => r.duration > 150)
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 4)
        .map((r) => `${r.name.split("/").pop()?.slice(0, 28)}=${Math.round(r.duration)}ms/${Math.round((r.transferSize || 0) / 1024)}KB`);
      return {
        ttfb: Math.round(nav.responseStart),
        dcl: Math.round(nav.domContentLoadedEventEnd),
        load: Math.round(nav.loadEventEnd),
        jsKB: Math.round(sum(js) / 1024),
        jsCount: js.length,
        cssKB: Math.round(sum(css) / 1024),
        reqs: res.length,
        slow,
      };
    });
    console.log(route, `wall=${loadMs}ms`, JSON.stringify(m));
  }
});
