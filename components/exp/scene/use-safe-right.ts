"use client";

/**
 * 右栏安全边：把「任务看板 / 错误演示」那张浮在台面上的 HTML 卡，换算成 viewBox 里的 x。
 *
 * 为什么需要单独量：右栏是 `position: absolute; right: 8px; width: 232px` 的 HTML 卡，
 * 台面是等宽缩放的 SVG；两者之间没有布局关系（`.benchArea` 上的 padding 对 absolute 子元素无效）。
 * 视口一窄，台面右边的托盘右端就钻到卡片底下 —— 1152 宽实测被压 21px、1024 宽锥形瓶也被压。
 *
 * 返回 null 表示「右栏不浮在台面上」（≤900px 时右栏会变成台面下方一整块），此时按原版面画。
 */
import { useLayoutEffect, useState, type RefObject } from "react";

const round1 = (n: number) => Math.round(n * 10) / 10;

export function useSafeRight(svgRef: RefObject<SVGSVGElement | null>): number | null {
  const [limit, setLimit] = useState<number | null>(null);

  useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!svg || typeof ResizeObserver === "undefined") return;
    const rail = document.querySelector<HTMLElement>("[data-rail]");

    const measure = () => {
      const box = svg.getBoundingClientRect();
      const vb = svg.viewBox.baseVal;
      if (box.width < 40 || !vb.width) return;
      if (!rail) {
        setLimit(null);
        return;
      }
      const r = rail.getBoundingClientRect();
      /* 只认「真的浮在台面右上」的那一版：宽度够、左沿进到台面里、竖向与台面相交。
         窄屏右栏变成页面底部一整块时 r.left 会跑到最左边 —— 这时不能用它当安全边。 */
      const floats = r.width > 40 && r.left > box.left + box.width * 0.45 && r.top < box.bottom - 60;
      if (!floats) {
        setLimit(null);
        return;
      }
      const scale = box.width / vb.width;
      setLimit(round1(vb.x + (Math.min(r.left, box.right) - box.left) / scale));
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(svg);
    // 右栏内容随步骤出现/消失（`.rail:empty` 会 display:none），宽高变化就是「有没有卡」的信号
    if (rail) ro.observe(rail);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [svgRef]);

  return limit;
}
