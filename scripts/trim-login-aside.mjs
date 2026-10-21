import fs from "node:fs";

const f = "app/login/page.tsx";
let t = fs.readFileSync(f, "utf8");

// 截掉文件末尾未使用的 LoginAside / LabArt / SLIDES（登录框改为居中卡片 + 背景轮播后不再需要）
const marker = "const SLIDES = [";
const idx = t.indexOf(marker);
if (idx > 0) {
  t = t.slice(0, idx).trimEnd() + "\n";
  // useEffect 现在未使用，去掉
  t = t.replace('import { useEffect, useState } from "react";', 'import { useState } from "react";');
  fs.writeFileSync(f, t, "utf8");
  console.log("已移除 LoginAside/LabArt，文件剩余", t.split("\n").length, "行");
} else {
  console.log("未找到 SLIDES 标记，跳过");
}
