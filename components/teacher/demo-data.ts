/**
 * 教师端演示数据（2026-10-22 用户口径：教师后台不做登录、不依赖数据库，
 * 直接放一组数据把整个布局和界面演示出来）。
 *
 * 用途：`/teacher` 查库失败时兜底，保证演示现场永远有内容可看；
 * 查库成功则仍用真实数据，不影响以后的真实班级。
 * 数据是确定性的（手写常量，每次一样），便于截图对比。
 */

import type { IncidentStat, OverviewStat, StudentListResult, StudentRow } from "./types";
import { RADAR_DIMENSIONS, type RadarSeries } from "./radar-data";

const MINUTE = 60_000;

/** 演示时刻：固定基准时间，避免每次刷新"最近活跃"飘 */
const BASE = new Date("2026-10-22T10:00:00+08:00");

function row(
  studentNo: string,
  name: string,
  className: string,
  status: StudentRow["status"],
  progress: number,
  totalScore: number | null,
  incidentCount: number,
  minutesAgo: number,
  experimentId: string | null,
): StudentRow {
  return {
    studentNo,
    name,
    className,
    status,
    progress,
    lastActiveAt: new Date(BASE.getTime() - minutesAgo * MINUTE),
    totalScore,
    incidentCount,
    runId: status === "not_started" ? null : `demo-run-${studentNo}`,
    experimentId: status === "not_started" ? null : experimentId,
  };
}

const ROWS: readonly StudentRow[] = [
  row("20250101", "周若曦", "化学 2501", "done", 100, 92, 1, 38, "exp01"),
  row("20250102", "李嘉禾", "化学 2501", "done", 100, 88, 2, 52, "exp01"),
  row("20250103", "王雨桐", "化学 2501", "done", 100, 86, 3, 61, "exp09"),
  row("20250104", "张一诺", "化学 2501", "doing", 71, null, 4, 4, "exp01"),
  row("20250105", "陈知远", "化学 2501", "doing", 43, null, 1, 9, "exp09"),
  row("20250106", "刘思齐", "化学 2501", "doing", 86, null, 0, 15, "exp03"),
  row("20250107", "赵沐辰", "化学 2501", "doing", 29, null, 5, 23, "exp01"),
  row("20250108", "孙语彤", "化学 2501", "done", 100, 95, 0, 76, "exp03"),
  row("20250109", "吴泊宁", "化学 2501", "doing", 57, null, 2, 31, "exp01"),
  row("20250110", "郑星野", "化学 2501", "not_started", 0, null, 0, 180, null),
  row("20250111", "何清越", "化学 2501", "done", 100, 79, 6, 96, "exp01"),
  row("20250112", "徐望舒", "化学 2501", "not_started", 0, null, 0, 210, null),
  row("20250113", "马嘉言", "化学 2502", "doing", 64, null, 3, 47, "exp09"),
  row("20250114", "高云舒", "化学 2502", "done", 100, 84, 2, 118, "exp09"),
  row("20250115", "林知微", "化学 2502", "doing", 50, null, 1, 58, "exp01"),
  row("20250116", "曹雨辰", "化学 2502", "not_started", 0, null, 0, 240, null),
];

export function demoStudents(): StudentListResult {
  return { rows: [...ROWS], total: ROWS.length };
}

export function demoOverview(): OverviewStat {
  const done = ROWS.filter((r) => r.status === "done").length;
  const doing = ROWS.filter((r) => r.status === "doing").length;
  const notStarted = ROWS.filter((r) => r.status === "not_started").length;
  const scores = ROWS.map((r) => r.totalScore).filter((s): s is number => typeof s === "number");
  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  return {
    total: ROWS.length,
    done,
    doing,
    notStarted,
    avgTotal: avg,
    incidents: ROWS.reduce((sum, r) => sum + r.incidentCount, 0),
  };
}

export function demoIncidents(): readonly IncidentStat[] {
  return [
    {
      level: "L4",
      count: 1,
      top: [{ incidentId: "exp01-boil-over", label: "水入酸爆沸溅出", count: 1 }],
    },
    {
      level: "L3",
      count: 3,
      top: [
        { incidentId: "exp01-burn", label: "酸液溅到皮肤", count: 2 },
        { incidentId: "exp09-endpoint-miss", label: "终点错过", count: 1 },
      ],
    },
    {
      level: "L2",
      count: 9,
      top: [
        { incidentId: "exp01-read-by-eye", label: "未平视读数", count: 4 },
        { incidentId: "exp09-no-rinse", label: "滴定管未润洗", count: 3 },
        { incidentId: "exp03-ph-calib", label: "pH 计未校准", count: 2 },
      ],
    },
    {
      level: "L1",
      count: 14,
      top: [
        { incidentId: "exp01-wipe-wall", label: "擦拭容量瓶内壁", count: 6 },
        { incidentId: "exp01-finger-touch", label: "手接触称量物", count: 5 },
        { incidentId: "exp09-bubble", label: "滴定管尖嘴有气泡", count: 3 },
      ],
    },
  ];
}

export function demoRadar(): RadarSeries {
  const values: Record<string, number> = { K1: 82, K2: 76, A1: 88, S1: 71, S2: 65 };
  return {
    dims: RADAR_DIMENSIONS.map((d) => ({
      code: d.code,
      category: d.category,
      value: values[d.code] ?? 0,
      hasData: true,
    })),
    sampleCount: 43,
    hasData: true,
  };
}
