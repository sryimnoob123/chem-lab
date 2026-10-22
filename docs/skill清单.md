# Skill 与插件清单（2026-10-22）

> 分三处：**项目级** `chem-lab/.dsh/skills/`（只在这个项目生效）、**全局** `~/.dsh/skills/`（桌面端任何工作区可用）、**profile 插件** `~/.dsh/profiles/chemlab/`。

---

## 一、本轮新装（9 个，均为社区 skill）

| # | skill | 装它解决什么 | 安装量 | 来源 |
|---|---|---|---|---|
| 1 | `nextjs-app-router-patterns` | Next 16 App Router：Server Components、streaming、parallel routes、数据获取 | 32.4K | wshobson/agents |
| 2 | `tailwind-design-system` | Tailwind **v4** 设计系统：token、组件库、响应式 | 69.7K | wshobson/agents |
| 3 | `vercel-react-view-transitions` | 原生 View Transition API（`<ViewTransition>` / `addTransitionType` / 伪元素），**零依赖**做页面与共享元素转场 | 162K | vercel-labs/agent-skills |
| 4 | `database-migration` | 跨 ORM 迁移、数据变换、零停机、回滚 | 17.5K | wshobson/agents |
| 5 | `better-colors` | 色阶生成、语义 token 命名、格式转换、对比度实测 | 31.1K | jakubkrehel/skills |
| 6 | `animate` | 从零做动画，按决策顺序走（该不该动→目的→工具→属性→曲线时长→打断→退出），**直接写实现** | — | emilkowalski/skills |
| 7 | `find-animation-opportunities` | 只读扫描：哪里该动、**哪里不该动**，给精确数值建议 | 198.7K | emilkowalski/skills |
| 8 | `review-animations` | 评审现有动画（曲线、时长、属性、打断、退出） | 244.6K | emilkowalski/skills |
| 9 | `improve-animations` | 全代码库动效审计 → 优先级计划 + 可交给其他 agent 执行的实现方案 | 213.5K | emilkowalski/skills |

> 6–9 是闭环：**find（找机会）→ animate（做）→ review / improve（评 / 全库审）**。

**此前按你的要求装的 2 个**（也在清单里，不是本轮）：
- `design-taste-frontend` ← `github.com/Leonxlnx/taste-skill`，529 行 + 5 个资源目录
- `impeccable` ← `github.com/pbakaus/impeccable`，85 行 + 3 个资源目录

---

## 二、项目级 24 个（`chem-lab/.dsh/skills/`）

按技栈归类：

**① 前端框架 / 构建**
| skill | 用途 |
|---|---|
| `nextjs-app-router-patterns` | App Router 结构、RSC、数据获取 |
| `vercel-react-best-practices` | React / Next 性能模式（Vercel 官方） |
| `tailwind-design-system` | Tailwind v4 token 与组件规范 |

**② 动画 / 动效**
| skill | 用途 |
|---|---|
| `animate` | 从零做动画并写实现 |
| `find-animation-opportunities` | 找该动 / 不该动 |
| `review-animations` | 评审单个动画 |
| `improve-animations` | 全库动效审计 |
| `vercel-react-view-transitions` | 原生页面 / 共享元素转场 |
| `emil-design-eng` | Emil 的 UI 手感哲学（克制、时长、缓动） |

**③ 设计 / 审美**
| skill | 用途 |
|---|---|
| `design-taste-frontend` | 美术方向 + `inspect.mjs` 93 条规则真实浏览器验收 |
| `impeccable` | 20 分制 audit / critique / polish / animate 方法论 |
| `frontend-design` | 视觉方向、字体、避免模板感 |
| `better-colors` | 色阶与语义 token、对比度实测 |

**④ 后端 / 数据**
| skill | 用途 |
|---|---|
| `api-design-principles` | REST 语义、分页、错误码、幂等、N+1 |
| `supabase-postgres-best-practices` | Postgres 最佳实践（表设计、索引、迁移、RLS） |
| `database-migration` | 迁移与数据变换、零停机 |

**⑤ 测试 / 无障碍 / 调试**
| skill | 用途 |
|---|---|
| `webapp-testing` | Playwright 跑本地应用、截图、看控制台 |
| `tdd` | 测试先行、红绿重构 |
| `accessibility` | WCAG 2.2 审计与修复 |
| `systematic-debugging` | 四阶段根因调试 |

**⑥ 平台 / 项目自管**
| skill | 用途 |
|---|---|
| `coze-coding-webapp` | 扣子编程部署判断与流程 |
| `prototype` | 一次性可交互原型验证状态机 / UI |
| `chemlab-work-scope` | 本项目工作边界（自己写的） |
| `dsh-profile-and-skill-policy` | profile / skill 的选装纪律（自己写的） |

---

## 三、全局 29 个（`~/.dsh/skills/`，桌面端通用）

项目级 24 个里有 22 个同名共享，另有 7 个**只在全局**：

| skill | 用途 |
|---|---|
| `caveman` | 极简回复模式 |
| `ego-browser` | 默认 agent 浏览器（唯一） |
| `find-skills` | 按需求搜社区 skill |
| `grill-me` | 追问式澄清 |
| `i-have-adhd` | 输出分块、短句 |
| `magpie-quota` | 查 AI 订阅 / API 余额用量 |
| `sakuracat` | 网络失败走本机代理 `127.0.0.1:7897` |

> 差异口径：`ls .dsh/skills` = 24，`ls ~/.dsh/skills` = 29；项目独有 2 个（`chemlab-work-scope`、`dsh-profile-and-skill-policy`）。

---

## 四、chemlab profile 的插件（11 个）

| 插件 | 作用 |
|---|---|
| `@deepseek-ai/dsh-base` | 底座 |
| `@deepseek-ai/dsh-web-app` | Web 应用能力 |
| `@deepseek-ai/dsh-experimental-agent-team-profile` | Agent Team |
| `dsh-builtin-browser` | 内置浏览器（34 个 `dsh_browser_*`，含截图落盘） |
| `billion-context` | 上下文压缩（社区第一，178 万下载） |
| `@michengai/dsh-code-review` | 独立子 agent 做 `/review` |
| `dsh-diff-approval` | 改动收集成面板，逐行批注 |
| `dsh-checkpoint-rewind` | 工作区/会话/配置三态检查点与回滚 |
| `dshmarket` | 插件市场 |
| `@aiwayds/dsh-feishu` | 飞书桥（凭据待 `/feishu-onboard` 扫码） |
| `@aiwayds/dsh-ask-router` | 提问同时弹飞书卡 + 桌面，先答先得 |

**MCP**：`context7`（远端 HTTP）、`playwright`（stdio，移动端视口 390×844）。

---

## 五、常用命令

```powershell
# 看项目能见到哪些 skill（会话里会实时刷新目录）
ls .dsh/skills

# 装一个社区 skill（会落到 .agents/skills，再手动搬到 .dsh/skills 和 ~/.dsh/skills）
npx --yes skills add <owner/repo> --skill <name> --yes

# profile 插件
dsh plugin --profile chemlab add <pkg>

# 校验 profile 挂载（desktop 档被 Electron 独占，需造镜像 profile 验证）
dsh --profile chemlab --dump-config
```

**两条硬规矩**（来历见 `docs/dsh-profile-chemlab.md`）：
1. 手动改 profile 的 `package.json` 必须存**无 BOM**，否则 dsh 报 `SyntaxError: Unexpected token '﻿'`。
2. 中文文件只用 `write` / `edit` 工具写，别用 PowerShell 重定向（会变 GBK 乱码）。
