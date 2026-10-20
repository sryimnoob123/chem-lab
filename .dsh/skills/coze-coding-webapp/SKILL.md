---
name: coze-coding-webapp
version: 1.0.0
author: qqbot
license: MIT
description: "Use when 在扣子编程(code.coze.cn)上开发/部署 Web 应用，或判断本地全栈项目能不能原样搬进去。"
metadata:
  hermes:
    tags: [coze, web-app, nextjs, postgres, deploy, quota]
    related_skills: [coze-sandbox-watch, hermes-host-ops]
---

# coze-coding-webapp — 扣子编程上做/迁/部署 Web 应用

## When to Use
- 要在扣子编程写网页应用、或把本地全栈项目（Next.js 一类）迁进去部署
- 要回答「这东西扣子支不支持」「搬过去会踩什么」
- 要给扣子那侧定玩法：环境隔离、数据库、验收方式

**先分清两个产品**：扣子编程 = `code.coze.cn`（云端 AI 编程 + 一键部署，本文讲这个）；扣子低代码/旧版 = `coze.cn` 的编排页和 `api.coze.cn/v1/databases` 那套 API。用户说「扣子」时先确认是哪边，别把低代码的数据库 API 当编程项目的库。

## 硬约束（动手写代码前就按这些设计）
1. **数据库 = 平台托管 PostgreSQL，不是 Supabase**。每项目只有两个库（开发库、生产库），物理隔离。生产库在**首次部署**时按开发库 schema 自动建（可选是否同步数据）；**之后每次部署只同步 schema 变更、不同步数据**。回滚部署版本**不回滚数据库**（schema 和数据都留在当前态）。
   → 迁 Supabase 项目：Auth / Storage / RLS / Realtime / PostgREST 全没有，鉴权和文件上传要自己写；数据层换成普通 PG 客户端（`pg` / `postgres.js` / Prisma）或平台注入的连接环境变量。
   → 因此 schema 必须以**可重复执行的 DDL/migration** 形式存在，因为后续增量全靠它比。
2. **环境变量开发/生产两套、完全隔离**；自定义 key 不能用 `COZE_` 前缀（系统保留）；**生产变量只能在「发布管理」改，改完必须重新部署才生效**。
3. **静态资源路径跨环境会变**：开发 `/workspace/project/assets`，生产 `/opt/bytefaas/assets`。一律用 `/${COZE_WORKSPACE_PATH}/assets` 拼路径，硬编码任一边都会让部署后图片/附件全挂（官方 FAQ 点名）。
4. **长连接 90 秒无数据交互就断**：SSE / 流式对话必须每 <90s 发心跳（官方示例 85s）+ 自动重连，否则 AI 导师这类流式回复会在中途断流。
5. **上传 16MB 上限**：部署后的项目里单文件最大 16MB（开发期对话区 20MB/文件、每项目最多 20 个）。超了要自己做分片（单片 ≤4MB）。
6. **沙箱 3GB / 1 小时空闲回收**：网页应用与导入项目 3GB 磁盘，装依赖+构建很容易顶到；1 小时无任何操作会断沙箱连接（重新连即可，不是部署挂了）。同时最多开 10 个项目预览。
7. **Git 服务只认 main**：不能建/切分支，只同步 main；只能绑「当前授权账号 owner」的仓库，**不支持组织仓库**。想要分支流就得在本地 Git 里做，扣子是单线。
8. **部署网页应用会内容审核**，违规直接封禁；只有「部署成功」的历史能回滚；运行日志留 7 天、Trace 3 天。

## 搬进来 / 交付的路径
- **导入**：GitHub 仓库（公开或私有，≤500MB）或本地压缩包（`.zip/.tar/.tar.gz`，解压后必须是**单个文件夹**，单文件 ≤500MB）。导入后平台自动构建，并自动补一份 `AGENTS.md`。
- **绑仓库**：双向 push/pull + 冲突可视化；终端里也能直接 `git push/pull`。
- **没有 staging**：扣子侧一次部署就是生产。所以「测试 vs 生产」只能在本地做（本地 PG 双库 + 两份 env），扣子上要么旧版本回滚、要么重部署。
- 自定义域名只有网页应用支持，免费证书额度按火山引擎主账号共享。

## 工作纪律（用户偏好）
- 他说「先调研」「先不着急动手」= 别建 profile、别装东西、别改代码，先读官方文档/社区，回来给**结论 + 待确认的关键问题**；他点头才落。
- 结论要能指到出处（官方文档哪一节），别给「应该可以」。不确定的（社区实测 vs 官方口径）要标出来。

## 背景资料在哪
- 他的项目文档在 `C:\Users\14681\Desktop\工作日志\<月 日>\`：`worklog-YYYY-MM-DD.md` 是详细版（任务、修了什么 bug、验证数据），`YYYY-MM-DD 星期X.md` 是当日摘要。问「某天干了什么/这类活长什么样」先读这两个。
- 那个虚拟实验平台的技术栈：Next.js 16 + React 19 + Tailwind，前后端一体，Playwright 写 E2E 巡游/权限矩阵/导出核对/响应式/无障碍。

沙箱探活、在扣子页面里给 agent 催活 → 见 `coze-sandbox-watch`。
