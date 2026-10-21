# handoff · portal-bg（门户首页背景，task-8）

- 口径：背景要"大一点、只放学校强相关" → 只动 `/` 门户背景（不是登录页）。
- 改的文件（3 个，均在 write_scopes）：
  - `components/portal/campus-slides.tsx`：7 张（**删 campus-08**），**campus-06 校门第一**；桌面/移动两套 object-position；26s Ken Burns `scale(1→1.04)`；paper 遮罩 `.34→.03`。
  - `app/page.tsx`：`cover__wash` 26%→11%；`cover-hero::before` 压条右扩 150px、85% 处 0.8；移动端竖向 `.4→.68` + secondary 文字 `#2e3a48`；slogan 改 `--ink-2`。
  - `app/styles/cover-light.css`：去掉 scene 换色滤镜/浮动动画；移动端 scene opacity `.26→1`。
- 对比度实测（7 张轮播取最差）：1440 最低 **4.94**（实验说明）、390 最低 **5.16**（副标题）；标题 10.95/6.66，CTA 11.66。
- 证据：`%TEMP%\chemlab-shots\portal-bg\`：`compare-1440x900.png`、`compare-390x844.png`、`after-1440x900-slide1..7.png`、`after-390x844-*.png`、`after-reduced-motion-1440x900.png`、`final-measure.json`。
- 约束满足：7 个 `data-demo-id` 未动；CTA 仍在 (101,277,154,50) 且跳 `/login`；390 无横向溢出；reduced-motion 停第 1 张 + transform none；未加依赖、未起 dev/build；未做衍生图。
- 已知：`npx tsc --noEmit` 唯一错在 `app/exp/[id]/scene-stage.tsx(83,62)`（他轨未提交改动 line/lines），非本轨；`npm run lint` 0 error。
- 风险：`cover-light.css` 334 行（既有 346，>300 属存量，本次只减不增）；campus-08 图片文件仍在 public 下（仅不进轮播，未删资产）。
- 接手建议：用户若嫌移动端不够"大"，调 `.cover-hero::before` 移动端竖向压条或 `mobilePosition`；桌面右侧清晰区从 ~x=920 起。
