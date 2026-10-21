import type { DemoScript } from "../types";

/** 学生登录：填学号姓名 → 进实验列表 */
export const loginScript: DemoScript = {
  id: "login",
  title: "学生登录 · 学号即账号",
  page: "/login",
  steps: [
    { kind: "caption", text: "学生登录：学号即账号，不需要密码；教师走右侧口令通道。", ms: 2200 },
    { kind: "highlight", target: "demo-login-tab-student", text: "学生身份。", ms: 900 },
    { kind: "click", target: "demo-login-student-no", text: "输入学号 20250101。", ms: 400 },
    { kind: "type", target: "demo-login-student-no", value: "20250101", ms: 500 },
    { kind: "click", target: "demo-login-student-name", text: "输入姓名（与教务名单一致）。", ms: 400 },
    { kind: "type", target: "demo-login-student-name", value: "周若曦", ms: 600 },
    { kind: "caption", text: "提交后会校验课程名单，不在名单里的人进不来。", ms: 1600 },
    { kind: "click", target: "demo-login-submit", text: "登录。", ms: 1400 },
  ],
};

/** 教师端巡览：学情总览 → 名单 → 学生明细 */
export const teacherScript: DemoScript = {
  id: "teacher",
  title: "教师端 · 学情总览与复盘",
  page: "/teacher",
  steps: [
    { kind: "caption", text: "教师端：整个班的实验情况一屏看完。", ms: 2400 },
    { kind: "highlight", target: "demo-teacher-stats", text: "班级 40 人：已完成、进行中、未开始、平均总分。", ms: 2000 },
    { kind: "highlight", target: "demo-teacher-incidents", text: "事故分布按 L1~L4 分级，高发事故排前 3。", ms: 2000 },
    { kind: "scroll", target: "demo-teacher-table", text: "学生台账：完成度、最近活跃、总分、事故数，点详情可复盘每一步。", ms: 2000 },
    { kind: "caption", text: "所有数据来自学生真实操作时间线，不是填出来的。", ms: 2400 },
  ],
};

/** 事故大秀：8 种事故依次播放，收尾总结 */
export const fxScript: DemoScript = {
  id: "fx",
  title: "事故大秀 · 做错的真实后果",
  page: "/scene-preview?show=fx",
  steps: [
    { kind: "caption", text: "做错会怎样？这是课堂外不可能让学生亲历的部分。", ms: 2400 },
    { kind: "wait", target: undefined, text: "装置爆炸：玻璃碎片向四周飞散。", ms: 3000 },
    { kind: "wait", target: undefined, text: "有毒气体：黄绿色雾团从器口涌出，必须开通风橱撤离。", ms: 3000 },
    { kind: "wait", target: undefined, text: "起火：有机溶剂不能用水冲，湿布或沙土盖灭。", ms: 3000 },
    { kind: "wait", target: undefined, text: "暴沸溢出：水入浓酸，热液带酸雾冲出。", ms: 3000 },
    { kind: "wait", target: undefined, text: "化学灼伤：大量流水冲洗 15 分钟以上。", ms: 3000 },
    { kind: "wait", target: undefined, text: "器皿破裂：先清碎片，再处理试液。", ms: 3000 },
    { kind: "wait", target: undefined, text: "重金属污染：废液必须倒进回收桶。", ms: 3000 },
    { kind: "wait", target: undefined, text: "仪器损坏：断电、登记、报修，不许自行拆修。", ms: 3000 },
    { kind: "caption", text: "每一次错误都被记录、被解释、被计分——这才是安全教育的闭环。", ms: 3200 },
  ],
};
