# lead · 第 5 轮 · 更新（10:25）

## 已解决的阻塞：静态 chunk 404 → 页面没水合

### 根因
重启 3001 时只复制了 `public/`，**漏掉 `.next/static`**。`next build` 重新生成带新 hash 的 chunk，而 standalone 里的 static 还是旧的 → 页面请求 `_next/static/chunks/*.js|css` 全部 404 → React 没水合 → 登录按钮点了没反应、页面看起来像"老代码"。

### 修复
1. `Copy-Item .next\static .next\standalone\.next\static -Recurse -Force`
2. **必须重启服务**（静态清单在启动时生成，不重启仍 404）

### 验证（修复后）
```
login-debug: URL=/experiments · cookie chem_sid(secure,httpOnly) 已种
samescreen-check exp01: 5/5（同屏占位 / 解锁 / 无跳转 / 抽屉 / 前测回顾）· pageerror 0
bopbps-all: 10/10 · pageerror 0
```

### 已推送
`f29a585`（= 远端 main）

## 标准重启流程（务必按这个来，别再漏）
```
1) Stop-Process 停 3001（pid 在 logs/server.pid）
2) npm run build
3) Copy-Item .next\static .next\standalone\.next\static -Recurse -Force
4) 删除并重建 .next\standalone\public ← Copy-Item public 到该位置
5) 启动：PORT=3001 HOSTNAME=127.0.0.1 PGLITE_DIR=<abs .pgdata-prod2> node .next\standalone\server.js
6) 验证三步：/login 能水合（控制台无 chunk 404）→ 登录跳 /experiments → /exp/exp01 出现前测
```

## 用户可见的自测入口
- 预览页：http://localhost:3001/preview.html
- 实验（前测）：http://localhost:3001/exp/exp01
- 强制重看问卷：http://localhost:3001/exp/exp01?fresh=1
- 方案设计：http://localhost:3001/plan
- 教师端：http://localhost:3001/teacher（口令 2026）

## 剩余可做
- 四绿复跑（lint/tsc/test/e2e）确认 f29a585 干净
- 把"重启必须复制 static"写进 docs/交付说明.md，避免下次再踩
