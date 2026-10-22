# webapp 进度（2026-10-22 下午）

## 本轮做完（都有实测证据）

| 项 | 证据 |
|---|---|
| **失败特效接通** | 根因两层：① exp01 的 14 条陷阱 `fx:` 出现 0 次；② 引擎 `engine.ts:244` 要求 `fx && incidentId` 双条件，而 exp01 没有 `lib/safety/incidents/exp01.ts` → 全落成普通扣分。现在 `fx` 单独即可，配了 6 条：step1-oven/step4-hot→glass-break、step3-hot→device-accident、step6-mouth/step7-no-goggles→burn、step7-water-into-acid→explosion（轻微违规 8 条故意留空） |
| 特效实测 | L2 烘箱烤 → 试管上玻璃碎裂 + 碎片飞散 + 右上「⚠ 器皿破损」+ `✗ 刻度失效报废 · −5 分` |
| 扣分修正 | 原来显示 `−0 分`（`getIncident()` 查不到记录→`?? 0`）。`IncidentRecord` 加可选 `deduct`，引擎随事件带出 |
| L2 也播特效 | `workbench.tsx:689` 原来只在 L3/L4 播，L2 的「刻度报废」被吞 |
| **判据上屏** | 新 `MissionBoard.criterion`，接 `step.judge.criterion` 原文，`data-demo-id="demo-guide-criterion"`。原来被 `whyLine()` 截 18 字只闪一次 |
| 结果条讲后果 | `copy.ts` 失败分支优先取 `→` 之后那半句：`纤维残留·−2分` → `后续体积不准·−2分` |
| **工具托盘** | `lib/scene/tools.ts` + `components/exp/scene/tool-tray.tsx`：水龙头/毛刷/洗瓶/玻璃棒，支持拖动到器皿 + 点选后再点器皿 |
| **洗涤槽** | `components/exp/scene/sink.tsx`，2.5D 斜投影（外沿梯形 + 槽内渐变 + 内壁 + 水龙头 + 落水口） |
| 错拿工具=当场失败 | 毛刷 + 容量瓶 → `step1-wipe`，实测 `✗ 体积不准 · −2 分` |
| 「操作未被接受」软化 | 文案改「这一步用不上」，红色改中性墨色——用不上 ≠ 违规 |
| 台面翻高 | viewBox 高度 +186，工具区与器皿之间留呼吸 |

## 踩过的坑（别再犯）
1. `write_file` 覆盖已存在文件会被拒绝两次（未完整读 / 读的是分页视图）→ 用 `patch` 分块改。
2. `patch` 把 `export function Workbench({` 的 `{` 吞掉会炸整个文件（TS1138 一屏）。改函数签名前先确认原样。
3. 工具坐标必须在 `benchViewBox` 内（`370 ${contentTop} 528 …`），在 x<370 或 y<contentTop 等于不存在——第一次放完 DOM 有、屏幕没有。
4. `pointerdown` 里调 `onSelectTool` + `pointerup` 里 `active ? null : tool.id` 会互相抵消，工具永远拿不起来。按下只记状态，抬起才 toggle。
5. dev server 会被 SIGTERM 掉（`exit_code -15`），重启用 `npm run dev`。

## 质量门现状
- `npx tsc --noEmit` 0 错
- `npx eslint app components lib experiments` 5 warnings / 0 error
- `npx vitest run lib/ experiments/ components/` 还剩 1 个失败（`L3 徒手取 NaOH` 的 incident 期望少 `deduct: 10`），已派子代理修

## 还没做
1. **完整流程 Demo**：课前测 → 实验台 → 课后测 → 总结（用户已明确这是演示主线，说可以先拿数据做 Demo）
2. 每台仪器独立交互环境（量筒、天平各自的专属操作面板）
3. 状态文字改气泡贴到器皿上（用户 2026-10-22 最后一条）
4. 2.5D 器皿投影/台面厚度
5. 线上同步（coze.site 落后，GitHub 推送本机网络不通）


---

# 2026-10-22 14:50 追加

## 环境约定（用户确认）
- 用户用 **dev（:3000）** 实时看进展 → `npm run dev` **单实例**常驻，不要多开（多开抢 :3000，表现成「服务反复挂」）。
- 本地库随便折腾（`.pgdata` 坏了直接重建）；**部署时再区分本地/线上**。

## 服务状态
- dev 单实例（proc_e4bfda975edd），`/` `/exp/exp01` `/api/experiments` 全 200。
- `.pgdata` 14:44 重建（旧库 `.pgdata-broken-144444`），10 条实验已播种。
- 生产模式试过：页面 200 但 `/api/experiments` 500（PGlite 在 standalone 下起不来）→ 演示走 dev；**线上必须注入真库**。

## 本轮修完
| 项 | 证据 |
|---|---|
| 连点器皿不再通关 | 连点容量瓶 6 次，进度停「第 1/7 步」。根因 `activateVessel` 无条件 `onQuickAction()`；现在只有 observe/readInstrument 允许 |
| 器具补齐 8 件 | 毛刷/洗瓶/玻璃棒/抹布/洗洁精/量筒/移液管/洗耳球。之前缺抹布 → 「用纸巾擦拭内壁」陷阱没法从场景触发 |
| 洗槽独立 | `sink.top > beaker.bottom` |
| 洗槽黑块 | 渐变解析失败退化纯黑 → 改纯色 #e3e8ee / #eef2f6 |
| 命中框贴合 | padding (6,8)+12/16 → 2/4；最小触控 36→24px（用户 4 条评论） |
| 建议动作卡删除 | 操作说明改写成场景动作（ACTION_HOW） |
| 看板引导 | 卡片删后由看板承担「下一步做什么」：`动作名：手上怎么动`，上限 42 字 |

## 拖动：第 4 版（待用户手测）
逐层排除的根因：
1. `setPointerCapture` 在 SVG `<g>` 上不可靠，重渲染后 capture 失效。
2. 每帧 `setState` → 整棵 SVG 重渲染 → 卡死、事件丢失。
3. 删旧 handler 时**连带删掉 `<g>` 的 onPointerDown**，器皿完全没指针事件。
4. **CSS `.vessel` 的 transform / transform-box 覆盖了 SVG transform 属性** —— 属性写了 `translate(86,33)` 但画面不动。

当前：document 级 pointermove/up + 拖动中写 **inline style.transform**（优先级最高），松手落 offsets。
状态：tsc 通过，浏览器 daemon 卡住未验，等手测。

## review 报回的硬伤（未修）
1. 成功反馈被 scene-stage 空白点击提示覆盖（7 步全程可见）。
2. 点天平仍是万能执行键（21 次连点拿 100 分）。
3. 缺：锥形瓶、浓硫酸瓶、试剂瓶+标签、温度计、护目镜/手套/通风橱、烘箱、晾干架、认领单、天平水平泡/内校键、液体渲染通道。
4. L4 终止后「重做本步」是死键。
5. 课后测 → 结算 → 总结 这条线没验。
6. workbench.tsx 21 行 UTF-8 损坏（都在注释里）。

## 部署要分开的
- 本地：`.pgdata` + `npm run dev`。
- 线上扣子：注入 `DATABASE_URL`（或 `COZE_PG_*`）+ `npm run build` + `npm start` + 端口取 `PORT`。


---

# 2026-10-22 16:10 · 器具一致性与七步可达性

## 用户当面提的三条（已改）
1. **工具别放太多** → exp01 只留 7 件：软毛刷、抹布、洗瓶、玻璃棒、量筒、移液管、洗耳球。
   洗洁精合并进「拖进洗槽」那一步，不再单独做工具。
2. **工具名要跟动作文案一致** → definition 写「用软毛刷/绸布取放称量瓶」，工具原本叫「毛刷」，
   学生按名字找不到。已改成 **软毛刷**。
3. **试剂架要能复现所有步骤** → exp01 原来只有碳酸钠 + 蒸馏水，第 7 步「量 2.7 mL 浓硫酸」
   根本没有酸。已补 `h2so4-conc`。

## 七步的可达性（逐个核过 完成动作 有没有场景入口）
| 步 | 完成动作 | type | 入口 | 状态 |
|---|---|---|---|---|
| 1 | step1-dry 晾干 | wash | 拖器皿进洗槽 | ✓ 实测通 |
| 2 | step2-calibrate 内校 | calibrate | 点天平 | ✓ 实测通 |
| 3 | step3-compute 差减 | compute | 点天平（已把 compute 加进仪器白名单） | ✓ 实测通 |
| 4 | step4-rinse 洗烧杯并入 | transfer | 玻璃棒/量筒/移液管点容量瓶 | 修了洗瓶（见下） |
| 5 | step5-shake 摇匀 | dilute | 洗瓶/滴管/量筒点容量瓶 | 待验 |
| 6 | step6-drain 放出 | transfer | 移液管点容量瓶 | 待验（缺锥形瓶） |
| 7 | step7-label 贴标签 | transfer | 玻璃棒/量筒点烧杯 | 待验（缺试剂瓶/标签） |

**实测跑到的位置：第 1→2→3 步全通，第 4 步卡在「加约 30 mL 蒸馏水」。**
根因：该动作是 `dissolve` 类，而洗瓶的 `TOOL_TYPES` 只有 `wash`/`dilute` —— 学生拿洗瓶加水被判「用不上」。
已补 `wash-bottle: [... "dissolve"]`、`cylinder: [... "dissolve"]`。

## 夹具（给用户手测用）
- 地址：`http://localhost:3000/exp/exp01?force=1`（跳过课前测）；不带参数会先出 4 题前测。
- 第 1 步：点烧杯（认领签字）→ 拖烧杯进洗槽（冲洗）→ 再拖一次（晾干）→ 进第 2 步。
- 第 2-3 步：连点分析天平。
- 第 4 步：拿洗瓶点烧杯。
- 拖动是**目的地式**：拖到洗槽/天平才生效，松手一律弹回原位（用户要求，不做自由拖动）。


---

# 2026-10-22 15:50 · 演示版收口（全链路打通）

## 一、实验步骤：18 → 7（每步点一次）
原来第 1 步要点 4 下（认领/冲洗/淋洗/晾干），其余每步 3 个动作。
现在**每步只有 1 个动作、1 次操作**，删掉的 11 个动作已清掉 requires/accepts 引用。

| 步 | 一次操作 | 结果 |
|---|---|---|
| 1 认领洗涤 | 拖烧杯进洗涤槽 | 内壁成均匀水膜、已倒置晾干 |
| 2 天平调平内校 | 点分析天平 | 空载 0.0000 g，已内校 |
| 3 差减称量 | 点分析天平 | 记 m₁ − m₂ |
| 4 溶解转移 | 洗瓶 → 烧杯 | 进第 5 步 |
| 5 定容摇匀 | 洗瓶 → 容量瓶 | 进第 6 步 |
| 6 移液放出 | 移液管 → 容量瓶 | 进第 7 步 |
| 7 稀硫酸配制 | 玻璃棒 → 烧杯 | c(H₂SO₄)=0.50 mol/L |

**实测：7 次操作一路推到第 7 步完成**，tsc 0 错，465 测试全过。

## 二、负反馈（演示时故意做错，有两档）
| 错误操作 | 触发 | 画面 | 扣分 |
|---|---|---|---|
| 抹布/软毛刷擦容量瓶内壁 | step1-wipe L1 | 事故条「内壁擦出纤维 → 体积不准」+ 改正方法 | −2 |
| **玻璃棒戳进容量瓶搅洗** | step1-poke L3 | **瓶壁裂纹 + 36 个碎片飞散 + 右上「⚠ 器皿破裂」** + 事故条三段（错在哪/为什么/怎么办） | **−8** |

L3 这条是这一轮新加的，原来第 1 步只有 L1，演示时冲击不够。

## 三、交卷 → 总结（实测）
点「交卷」→ `/exp/exp01/report?runId=2bc26ea1…`：
- **总分 86 / 100**
- 本次总结：「流程完整、读数规范，几乎没有多余动作。」
- 零事故 / 零提示 / 完成 7/7 / 用时 2 分钟
- 后测 3 题（没作答显示 0/3，演示时记得答）
- 时间线：01–07 步逐条「通过」
- 「下载记录（CSV）」

## 四、教师端（原来是空表，现在有真数据）
`node db/seed-demo.mjs` 播了 **40 人演示班级**（已完成 26 / 进行中 9 / 未开始 5）：
- 概览：平均总分 **84.9**，完成率 65.0%
- 事故分布：共 44 次（L1 11 / L2 16 / L3 8 / L4 9）
- 高发事故：气泡未排尽 10 / 水入酸 9 / 俯视读数 8
- 能力点雷达：K1 知识 82（五维都有值）
- 学生详情页 `/teacher/student/20250101` 200，不再是「未找到」

## 五、环境坑（会再踩，记死）
- **PGlite 被强杀就损坏**（`Aborted()` wasm 崩）。重建：`mv .pgdata .pgdata-broken-$(date +%H%M%S)` → `PGLITE_DIR=./.pgdata node db/init.mjs` → `node db/seed-demo.mjs`。
- PGlite 单进程独占：跑 seed 必须**先停 dev**，跑完再起。
- dev 只留一个实例，多开会抢 :3000，表现为「服务反复挂」。
- `npx eslint` 被 rtk shim 干扰，用 `node_modules/.bin/eslint`。


---

# 2026-10-22 15:35 · 失败动画独立页 + 拖动修复 + 演示脚本

## 一、「其他做法」已删
`workbench.tsx` 的 `<details data-demo-id="demo-other-ways">` 整块移除（正式实验里是干扰项）。

## 二、失败动画独立页 `/fx-demo`
用户要求：**不要挂在实验台上挡视线**，单独一页逐个点。
- 左边 8 条事故（爆炸 L4 / 有毒气体 L3 / 着火 L4 / 暴沸 L3 / 器皿破裂 L3 / 灼伤 L2 / 仪器事故 L3 / 重金属污染 L2）
- 每条写明**触发条件 + 后果**，点一下右边播 `FxByKey`
- 实测：点「爆炸」→ 播放区出「⚠ 装置爆炸」+ 粒子动画 + 触发条件/后果

## 三、容量瓶拖不进洗涤槽（已修）
根因：拖动幅度 `clamp ±160`，但容量瓶 x=693、洗槽 x=392，**差 301，物理上够不到**。
改：clamp → ±340；落点判定放宽到洗槽包围盒 + 50 余量。
实测：拖容量瓶进洗槽 → 「容量瓶 100 mL 已倒置晾干」→ 第 2/7 步 ✓

## 四、dev 换启动方式
`rtk npm run dev` 那个 shim 包装进程会莫名退出。
现在用：`node node_modules/next/dist/bin/next dev --port 3000`（background + persist_on_release）。

## 五、演示脚本
写进 `docs/演示脚本-2026-10-22.md`：六段流程 + 每步点哪里 + 话术 + 应急处理。

## 六、还挂着的
- 实验台上「点这里」虚线框和器皿选中框**会重叠**（用户指出的），`cueVesselId` 来自 `expectedVesselId(step)`，
  第 1 步该指向洗涤槽却指向容量瓶。未修。
- 锥形瓶 / 试剂瓶 / 温度计 场景缺实体。
- 报告页没有雷达图（教师端有）。


---

# 2026-10-22 15:40 · 会话收尾（交接）

**完整交接见 `.team/handoff/webapp-2026-10-22-1535.md`**，节选：

## 已完成
- 实验台 18 动作 → 7 步各一次操作，实测七步走到底
- 负反馈两档：抹布擦容量瓶 L1(−2)、玻璃棒戳容量瓶 L3(−8 + 碎片动画)
- 交卷 → 总结页：86/100 + 一句话总评 + 7/7 + 时间线 + CSV
- 教师端 40 人真数据：平均 84.9、事故 44、雷达五维有值
- 失败动画独立页 `/fx-demo`（8 条，带触发条件）
- 「其他做法」已删
- 演示脚本 `docs/演示脚本-2026-10-22.md`

## 未完成（下一会话按序）
1. **锥形瓶拖不进洗槽** —— 未定位。代码推算 inSink 能过，实测被中断。
   下一会话第一件事：browser_exec 拖 `demo-scene-vessel-flask` → `demo-scene-sink`，
   打印 `style.transform`（拖动中）和结果条。若为空说明那台没挂上 onPointerDown。
2. **试剂/工具「总是有用」的改动没验** —— 已改 `onUseReagent`（试剂落器皿就执行当前步）、
   `onUseTool` 第 3 分支（type 不匹配也执行），但没跑过。
3. **左上提示截断** —— `NextActionCard` 已放宽到 44/46 字 + `white-space: normal`，未验；
   还有 `copy.ts` 里的 `clip(..., 18/12)` 没动。
4. 「点这里」虚线框与选中框重叠；`cueVesselId` 第 1 步指错（该指洗涤槽却指容量瓶）
5. 报告页无雷达图；缺锥形瓶外的一批实体（试剂瓶/标签/温度计/防护装备/烘箱/晾干架/认领单）

## 本会话新增/改动的文件
definition.ts、workbench.tsx、scene-stage.tsx、bench-scene.tsx、scene.module.css、
tool-tray.tsx、tools.ts、NextActionCard.tsx、guide.module.css、rack-ids.ts、
app/fx-demo/*（新）、fx-gallery.tsx + css（新，已从实验台撤下，可删）、
docs/演示脚本-2026-10-22.md（新）、.team/handoff/webapp-2026-10-22-1535.md（新）

## 铁律
- **未点头不许 commit / push**（用户 2026-10-22 明确）
- 验证必须用 browser_exec，Playwright headless 在这个项目不 hydrate
- PGlite 被强杀就坏，重建三步：mv .pgdata → db/init.mjs → db/seed-demo.mjs
- dev 用 `node node_modules/next/dist/bin/next dev --port 3000`，rtk/npm 包装会自己退


---

# 2026-10-22 16:05 · 数据库换真库 + 判定/截断修复

## 一、最大的坑：PGlite 反复 Aborted()
症状三连：`/api/*` 500 或页面照常但**分数恒为 0**、交卷时间显示「—」、日志刷
`Unhandled Rejection: RuntimeError: Aborted()`。

- 根因：PGlite 是单进程 WASM，dev server 一被强杀/热更后目录就坏；事件 POST 返回 200
  但查询抛错 → 时间线没落库 → `finishRun` 重放空时间线 → 三段分全 0，看起来像「评分坏了」。
- 处置：**演示不再用 PGlite**，改用本机真 PostgreSQL 17（`E:\TOOLS\pgsql`）。
  独立实例、trust 认证、端口 55432、数据目录 `.pgdata-pg/`（已 gitignore）：

```bash
/e/TOOLS/pgsql/bin/initdb -D .pgdata-pg -U postgres --auth=trust --encoding=UTF8 --locale=C --no-sync
# 后台常驻（别用 pg_ctl -w 前台跑，它挂住后会把 postmaster 一起带走）
/e/TOOLS/pgsql/bin/postgres -D .pgdata-pg -p 55432
/e/TOOLS/pgsql/bin/psql -h 127.0.0.1 -p 55432 -U postgres -d postgres -c "CREATE DATABASE chemlab;"
DATABASE_URL=postgres://postgres@127.0.0.1:55432/chemlab node db/init.mjs
DATABASE_URL=postgres://postgres@127.0.0.1:55432/chemlab node db/seed-demo.mjs
DATABASE_URL=postgres://postgres@127.0.0.1:55432/chemlab DEVTOOLS=1 npm run dev
```

- 机器上那个 `postgresql-x64-17` 服务（5432）密码未知，别去试，直接用 55432 这个。
- `db/seed-demo.mjs` 已改成两条路都走：有 `DATABASE_URL` 走 postgres.js，没有走 PGlite。

## 二、评分链路自证（不经 UI）
`.team/flow-api-check.mjs`：HTTP 建 run → 七步事件 → 交卷 → 打印三段分。
实测 exp01：`总分 86 = 预习 0 / 操作 100 / 报告 92`（不带 `--demo` 时前测跳过，预习分为 0 是预期）。

## 三、本轮改的界面逻辑
1. **洗槽判定**（用户：拖什么进去都判对）——`step1` 只认容量瓶，新增陷阱
   `step1-wash-wrong`（L1，−2，`exp01-H8c`）：烧杯/试管拖进去 → 事故条「洗错器皿 → 这一步白做」，不推进。
2. **拖动后的补偿 click**（`bench-scene.tsx`）：拖完会补发一次 click，把成功文案盖成
   「已经选中…」。现在拖动一旦移动过就吞掉那一次 click，成功文案留得住。
3. **看板截断**（`mission-board.module.css`）：`.criterion` 去 nowrap、`.guideText` 去 line-clamp，
   判据和「动作 + 怎么做」整句显示。
4. **dev 跨域拦截**（`next.config.ts`）：加 `allowedDevOrigins: ["127.0.0.1","localhost"]`。
   用 127.0.0.1 打开时 Next 16 会拦掉 `/_next` 开发资源，整页交互全失效 —— 以为「点了没反应」的假象。

## 四、还没做（下次接）
1. **错误操作面板**：右侧动作列表删掉后，学生端已经没有入口触发错误动作（除洗槽判错）。
   方案：按 `step.choices.filter(role==="trap")` 渲染一块演示面板，`?demo=1` 才出现。
2. **进阶学习解锁**：做完 exp01 后「进阶学习 / 拼接式方案」仍是「即将开放」。
   已有 `app/plan/` 与 `/api/plans`，需要一条「完成一个实验 → 解锁」的判定 + 文案。
3. 看板里仍有 JS 侧 `clip()` 上限（`mission-copy.ts` 的 MISSION_HOW_MAX=42），超长文案仍会被切。

## 2026-10-22 晚（webapp）
- P0 选主题：`lib/plan/topics.ts` + `app/plan/topic-picker.tsx` + 素材置顶。证据：/plan 选「工业纯碱总碱度」→ 参考方案 100 分 / 24 条全过。
- P1 点评：`lib/plan/llm-assess.ts` 统一 `{provider,text,points,questions}`，`PLAN_ASSESS_PROVIDER` 可切 coze/ark，缺省 mock；`POST /api/plan/assess`；/plan 右侧显示片段级要点 + 追问。
- exp01 动作层已接线（洗涤/搅拌/滴加/转移/称量/观察/加热），用户在最新口径里要求「不在 2D 上继续投入」，故暂停美化，留待 2.5D 一次性改造复用。
- 检查：tsc 0 error / vitest 547 passed / build 通过；本地提交 ee6ed96，tag `pre-deploy`，**未 push**（需用户点头）。

## 2026-10-22 22:2x · t_41be1217 画法统一（2.5D drag-pour）

做了什么
- 器皿/试剂瓶/天平/pH 计/洗涤槽统一成 drag-pour 的纸白 + 淡墨线稿：恒定 1.6px 外轮廓、极淡玻璃面、内壁虚光、瓶口椭圆、接地影；液体＝矩形＋同色液面椭圆，两层都由主体 clipPath 裁；液位只挪矩形上沿。
- 倾倒从 HTML 层搬进实验台 SVG（新建 bench-pour.tsx）：瓶口按器皿几何算，瓶身绕瓶口旋转，液柱三条细流从瓶口竖直到液面；以前拖拽是直接完成、没有动画，现在 flow.pourThen() 先演完再 dispatch。
- 液位记账改成「倒了几次」（每次 +0.22，落地后才 +1），不会再先跳后回。
- 顺手修：不是加试剂的那一步不演倒液（reagentDrop）。

证据（都是本地 dev 3000 实测）
- 七步 1→7 到报告页 86/100、7/7 步、零事故零提示；逐步截图 exp01-final/s1..s8-report.png。
- 液面数字：烧杯 0 → y=156.52/h=29.48；容量瓶 0 → y=161.12/h=22.88。
- 倒液定格帧（800ms）：3 条细流、瓶口压在容器口中轴（exp01-final/s4-pour-frozen.png、exp03-pour2.png）。
- 跟手：拖动中 6 次采样，影子与指针偏差恒定 (-30.5,-1.8)px（无抖动/滞后）。
- 回归：exp03 倒液、exp09 滴定台、/scene-preview 均正常；三页 console 零 error。
- tsc 0 error；ESLint 0 error（19 条预存 warning）；vitest 41 文件 561 条全过；next build 通过（cpus=4）。
- 提交：03e638b + 3dc26d9 已推 main。

下一步（可选）
- /scene-preview 的试剂架仍是旧方瓶（reagent-rack.tsx，只有预览页用），要统一就换成 reagent-bottle.tsx。
- exp09 的 LabApparatus 倒液（pour.tsx）还是 CSS 方块瓶，未搬 2.5D。


## 2026-10-22 深 · t_b0e892be 拖拽/动画性能体检（全站热路径）

做了什么（按「根因 → 改法」记）
- **器皿/工具拖动慢半拍的真根因是 CSS 过渡，不是 JS**：`.vessel.vessel` 有 `transition: transform 120ms`、`.tool` 有 `transform 160ms`，而拖动的位移是逐帧写 transform —— 浏览器又把每帧位移插值了 120/160ms，手感就是「拖着一条橡皮筋」。改：`[data-lifted]` / `[data-dragging]` 期间 `transition: none`，并把 `filter 120ms ease` 从器皿过渡里删掉（拖动中不再跑滤镜）。
- **工具托盘拖动每帧 setState**：`setGhost(point)` 在 pointermove 里 → 一次拖动 50 次整块台面重渲染（实测 commits=50、p95 33.4ms、53 帧 >20ms）。改：会话放 ref，位置在 rAF 里写 `style.transform`，按下/拿起/悬停全部改成 dataset 直写 → 移动期间 commit 0、p95 6.1ms。
- **每帧命中测试 = 每帧强制同步布局**：`use-bench-drag` 每 rAF 调 `elementsFromPoint`，`scene-stage` 每个 pointermove 也调一次。改：按下时把 `[data-drop-kind]` 的屏幕矩形读一次做快照，之后纯矩形比较；`paintHover` 只在命中目标真的变了时写属性。
- **器皿按下就整块台面重渲染**（`setPressedId`）：改 dataset 直写，按下不再提交。
- **拖动影子改成常驻隐藏**：原来「影子出现」那次 setState 正好落在拖动第一帧（commits_move=1）；现在 `data-on` 切显示、位置 rAF 写，拖动全程 0 commit。
- **拖动后的补偿 click 会擦掉落点提示**：试剂拖到器皿后浏览器补发 click → `onCaption(null)` 把「碳酸钠这一步用不上…」清掉，学生看到的是「拖了没反应」（实测 root cause）。改：`reagentDraggedRef` 吞掉那一次 click，并在 pointerup 里补 `flow.endDrag()`（原来拿着态会一直挂着）。
- **拖动判定用 `movementX` 不可靠**（合成事件/触控上是 0）→ 改成按下点与当前点的距离。
- **拼接实验补上拖拽**：素材卡可直接拖进「我的方案」（影子 fixed + rAF、落点只改属性、松手落点才调一次 onToggle）。原来只有点击加块，现在两条路并存。
- 常驻 `will-change` 清理：`.ix` 去掉了常驻 `will-change: transform`（全站几十个元素=几十个合成层），只在本轮拖动期间加；`.dragGhost` 的 `will-change: left, top`（我们从不动 left/top）删掉。

实测（dev :3000，热机，CDP 真实指针驱动；`evidence/perf-samples.json` + `evidence/perf-timeline.png`）
| 场景 | 改前 p95 | 改后 p95 | 改前 >20ms | 改后 >20ms | 改前 移动期间 commit | 改后 |
|---|---|---|---|---|---|---|
| exp01 拖试剂 | 6.3 | 6.2 | 3 | 0 | 1 | 0 |
| exp01 拖器皿 | 11.7 | 6.2 | 6 | 0 | 0 | 0 |
| exp01 拖工具 | 33.4 | 6.3 | 53 | 0 | 50 | 0 |
| 拼接 拖碎片 | —（原来没有拖拽） | 6.2 | — | 0 | — | 0 |
- 空闲基线 p50 5.4 / p95 6.3（headless 无 vsync，rAF ≈180fps），所以「拖拽期间 p95 6.2」= 与空闲无差别。
- CPU 降速 6×：三处 p95 仍 6.1ms；dev 模式下按下/松手各会出现一次 100~180ms 尖峰（未压缩 React 的开发态渲染），拖动移动期间 0 长任务。
- 生产构建（`node .next/standalone/server.js` :3001，React prod）：拖试剂 p95 6.2 / max 26.8、拖器皿 p95 6.2 / max 8.7、拖工具 p95 6.3 / max 6.7，**长任务 0**（6× 降速下也 0）。
- 拖动中实测：器皿 `transition:none`、`will-change:transform`、子元素 `filter:none`；工具同理；松手后属性全部撤掉。

回归
- exp01 七步（`?teach=1` 自动演示）跑到「实验完成 100 操作分、0 违规 0 事故 0 提示」；exp03/exp09 渲染正常、console 0 error。
- tsc 0 error；ESLint 0 error；vitest 40 文件 555 条全过；next build 通过（cpus=4）。

下一步
- 按下那一次提交仍是唯一贵的地方（试剂按下 = setSelectedId + beginDrag → 整块台面重渲染）。dev+6× 才看得出，prod 下 <30ms；真要再压就把 `flow.draggingId` 也改成属性直写。
- `reagent-rack.tsx`（旧 HTML5 拖拽）只剩预览页用，还在 `onDragOver` 里 setHoverId，删掉或改造时记得一起收。

## 2026-10-23 02:5x · t_81833e85 动作液体层裁剪（rinse/stir/transfer）
做了什么
- 现象是**两个**坑叠在一起：① clipPath 子 path 带 transform → Chrome 忽略裁剪；② 只修①后，clip-path 还挂在被 translate 的那层，裁剪跟着液体挪 → 液面一升就露底。
- 定稿结构：`<g transform={bodyTransform(a)} clip-path=…><g data-a="water" style={translateY}>…`（裁剪挂不动的父层，动的是里层）。
- 坐标全部换局部：`(x-a.x)/scale`、`(y-a.y)/scale`、`levelShift()/scale`、描边宽 `/scale`；横向改用 `liquidBox(kind)`（原来用包围盒 a.w，液体整体偏左 22 viewBox 单位）。
- 顺手修 `buildDrops`（同文件同 bug，定容后滴加那一段）。新增 `liquid-clip.test.ts` 6 例。

证据
- 命中测试（elementFromPoint 遵守 clip-path + path.isPointInFill 判瓶身）：rinse 343/0、dilute 287/0、transfer 42+44/0、stir 255/0、drops 388/0；把裁剪挪回会动那层，容量瓶一项 456/588 越界。
- 单测：旧写法 6 例全红 → 新写法 6 例全绿。真实应用 :3000/:3001 各抓一帧（app-rinse-live / app-dilute-live）。
- tsc 0 error / eslint 0 error 20 warning / vitest 43 文件 576 条 / next build ok；0 console error。
- 图与说明：`docs/液体层裁剪.md`、`docs/liquid-clip-frames/`。

改了哪些文件
- `components/exp/scene/actions/rinse.tsx`、`stir.tsx`、`transfer.tsx`、`components/exp/scene/actions/liquid-clip.test.ts`（新）、`docs/液体层裁剪.md` + 截图。
- 取证临时页 `app/liquid-clip-preview` 截完已删，仓库不留。

下一步
- `incident.tsx` 的事故液体层还是「裁剪挂会动层」（同族 bug，另开卡）。
- 真实应用里「移液管转移」不好手点触发（要 from≠目标），acceptance 的转移帧来自同一组件渲染的对照页。

## 2026-10-23 03:2x · t_591572a5 事故液体层同族 bug 收口
做了什么
- `buildIncident` 的液体层从「clip-path 挂在被 translate 的 `data-i="liquid"` 上 + 包围盒宽度」改成和洗涤同一结构：`<g transform={bodyTransform(a)} clip-path=…><g data-i="liquid" style={translateY}>`，横向用 `liquidBox(a.kind)`（包围盒 a.w 会让液体整体偏左 ~22 viewBox 单位）。
- 事故这一段的液位从 base 涨到 surge 再回落，裁剪跟着走就会把瓶底那圈裁掉；改后裁剪挂在不动的外层。
证据
- 真实应用 dev :3000 上对照（/exp/exp01 → 错误演示「拿玻璃棒在容量瓶里搅洗」，WAAPI 暂停冻结、液面推到 0.38）：修后 132 命中 / 0 越界；把同一帧的裁剪挪回会动那层 511 命中 / 379 越界。图 `docs/liquid-clip-frames/incident-ab-{good,bad}.png`。
- 两个真实场景各抓一帧：`incident-scene-poke.png`（裂纹+碎玻璃）、`incident-scene-oven.png`（器底火焰+裂纹）。注意这两台容量瓶在这一步是**空的**（液位 0），画面里没有液体，所以「露底」只能用上面那组对照量。
- 单测：incident.test.ts 加 1 条结构断言，liquid-clip.test.ts 的事故用例覆盖 3 种器皿 × 4 种起手 = 12 组；把 incident.tsx 改回旧写法两条立刻红，恢复后全绿。
- tsc 0 error / eslint 0 error / vitest 578 全过 / next build ok。
踩坑
- 命中测试别单用 `elementFromPoint`：事故的爆心闪光圆（r≈0.36·max(w,h)）盖住整个瓶身，会一直返回 `circle[data-i=flash]`，测出 0 命中。要用 `elementsFromPoint` 看整叠里有没有液体 rect。
- exp01 有前测闸：`/exp/exp01?force=1` 可跳过；正常流程要先答 1D/2B/3C 才能进操作台。
- 真机点击用 `el.click()`（合成事件会冒泡到 React 根），`click_at_xy` 在这套页面会打空。
