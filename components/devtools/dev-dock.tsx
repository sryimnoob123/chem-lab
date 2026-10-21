"use client";

/**
 * Dev Dock —— 悬浮在左下角的开发调试抽屉（只在开发环境挂载，见 app/layout.tsx）。
 *
 * 四组：身份 / 实验直达 / 进度锁 / 快捷跳转。
 * 数据：登录态走 GET /api/session，实验清单走 GET /api/experiments，run 走 localStorage + GET /api/runs/:id；
 * 前测解锁不碰后端，直接读写 localStorage 的 `bopbps:v1:<expId>:pre`（与 components/exp/bopbps-gate 同键）。
 */

import { useCallback, useEffect, useState } from "react";
import type { DockExperiment, DockRun, DockStudent } from "./dev-dock-types";
import { DevDockExperiments } from "./dev-dock-experiments";
import { DevDockShortcuts } from "./dev-dock-shortcuts";
import styles from "./dev-dock.module.css";

const PRE_PREFIX = "bopbps:v1:";
const RUN_STORE = "chem-lab:dev:runId";
const DEV_STUDENT = { studentNo: "20250101", name: "周若曦" };
const TEACHER_PASSCODE = "2026";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readPrePassed(ids: string[]): Record<string, boolean> {
  const map: Record<string, boolean> = {};
  try {
    for (const id of ids) map[id] = window.localStorage.getItem(`${PRE_PREFIX}${id}:pre`) === "pass";
  } catch {
    /* 隐私模式：保持空 */
  }
  return map;
}

function isDockExperiment(value: unknown): value is DockExperiment {
  if (!isRecord(value)) return false;
  return typeof value.id === "string" && typeof value.title === "string";
}

type Busy = "student" | "teacher" | "logout" | "pre" | null;

export function DevDock() {
  const [open, setOpen] = useState(false);
  const [student, setStudent] = useState<DockStudent | null>(null);
  const [teacher, setTeacher] = useState(false);
  const [experiments, setExperiments] = useState<DockExperiment[]>([]);
  const [prePassed, setPrePassed] = useState<Record<string, boolean>>({});
  const [run, setRun] = useState<DockRun | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/session");
      if (res.ok) {
        const body: unknown = await res.json().catch(() => null);
        const info = isRecord(body) && isRecord(body.student) ? body.student : null;
        setStudent(
          info && typeof info.studentNo === "string" && typeof info.name === "string"
            ? {
                studentNo: info.studentNo,
                name: info.name,
                className: typeof info.className === "string" ? info.className : "",
              }
            : null,
        );
      } else {
        setStudent(null);
      }
    } catch {
      setStudent(null);
    }

    try {
      const res = await fetch("/api/experiments");
      const body: unknown = await res.json().catch(() => null);
      if (Array.isArray(body)) {
        const list = body.filter(isDockExperiment).map((item) => ({
          id: item.id,
          title: item.title,
          steps: typeof item.steps === "number" ? item.steps : 0,
        }));
        setExperiments(list);
        setPrePassed(readPrePassed(list.map((item) => item.id)));
      }
    } catch {
      /* 保持空列表 */
    }

    let runId = "";
    try {
      runId =
        new URLSearchParams(window.location.search).get("runId") ??
        window.localStorage.getItem(RUN_STORE) ??
        "";
    } catch {
      runId = "";
    }
    if (runId) {
      try {
        const res = await fetch(`/api/runs/${encodeURIComponent(runId)}`);
        const body: unknown = await res.json().catch(() => null);
        if (res.ok && isRecord(body) && isRecord(body.run)) {
          setRun({
            runId,
            experimentId: typeof body.run.experimentId === "string" ? body.run.experimentId : "",
            status: typeof body.run.status === "string" ? body.run.status : "",
          });
        }
      } catch {
        /* 忽略 */
      }
    }

    try {
      const res = await fetch("/api/teacher/roster?limit=1");
      setTeacher(res.ok);
    } catch {
      setTeacher(false);
    }
  }, []);

  useEffect(() => {
    // 让首次拉取异步一点，避免 effect 内同步 setState 触发级联渲染（react-hooks 规则）
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function loginStudent() {
    setBusy("student");
    setMessage("");
    try {
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(DEV_STUDENT),
      });
      if (res.ok) {
        setStudent({ ...DEV_STUDENT, className: "" });
        setMessage("已登录 20250101");
      } else {
        setMessage(`登录失败：${res.status}`);
      }
    } catch {
      setMessage("登录请求失败");
    } finally {
      setBusy(null);
    }
  }

  async function logout() {
    setBusy("logout");
    try {
      await fetch("/api/session", { method: "DELETE" });
      setStudent(null);
      setMessage("已登出");
    } catch {
      setMessage("登出请求失败");
    } finally {
      setBusy(null);
    }
  }

  async function unlockTeacher() {
    setBusy("teacher");
    setMessage("");
    try {
      const res = await fetch("/api/teacher/unlock", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ passcode: TEACHER_PASSCODE }),
      });
      setTeacher(res.ok);
      setMessage(res.ok ? "教师已解锁" : `解锁失败：${res.status}`);
    } catch {
      setMessage("解锁请求失败");
    } finally {
      setBusy(null);
    }
  }

  function togglePre(expId: string, next: boolean) {
    try {
      const key = `${PRE_PREFIX}${expId}:pre`;
      if (next) window.localStorage.setItem(key, "pass");
      else window.localStorage.removeItem(key);
      setPrePassed((prev) => ({ ...prev, [expId]: next }));
      setMessage(`${expId} 前测${next ? "已解锁" : "已重置"}`);
    } catch {
      setMessage("localStorage 不可用");
    }
  }

  function clearAllPre() {
    try {
      const keys: string[] = [];
      for (let index = 0; index < window.localStorage.length; index += 1) {
        const key = window.localStorage.key(index);
        if (key && key.startsWith(PRE_PREFIX)) keys.push(key);
      }
      keys.forEach((key) => window.localStorage.removeItem(key));
      setPrePassed(readPrePassed(experiments.map((item) => item.id)));
      setMessage(`已清 ${keys.length} 个前测缓存`);
    } catch {
      setMessage("localStorage 不可用");
    }
  }

  return (
    <div className={styles.root} data-dev="dock">
      <button
        type="button"
        className={styles.launcher}
        aria-expanded={open}
        aria-label="开发者调试"
        onClick={() => setOpen((value) => !value)}
        data-dev="dock-toggle"
      >
        <span className={styles.dot} aria-hidden="true" />
        DEV
      </button>

      {open ? (
        <aside className={styles.drawer} role="dialog" aria-label="开发者调试面板" data-dev="dock-drawer">
          <header className={styles.head}>
            <strong>DEV DOCK</strong>
            <span className={styles.hint}>仅本地调试</span>
            <button
              type="button"
              className={styles.close}
              aria-label="关闭"
              onClick={() => setOpen(false)}
              data-dev="dock-close"
            >
              ×
            </button>
          </header>

          <section className={styles.section} data-dev="dock-identity">
            <div className={styles.sectionHead}>
              <h3>身份</h3>
              <span className={styles.hint}>
                {student ? "chem_sid ✓" : "未登录"} · {teacher ? "教师 ✓" : "教师未解锁"}
              </span>
            </div>
            {student ? (
              <div className={styles.identityRow}>
                <span className={styles.studentLine} data-dev="dock-student">
                  {student.studentNo} · {student.name}
                </span>
                <button
                  type="button"
                  className={styles.miniButton}
                  onClick={() => void logout()}
                  disabled={busy !== null}
                  data-dev="dock-logout"
                >
                  登出
                </button>
              </div>
            ) : (
              <button
                type="button"
                className={styles.primary}
                onClick={() => void loginStudent()}
                disabled={busy !== null}
                data-dev="dock-login-student"
              >
                {busy === "student" ? "登录中…" : "学生登录 20250101"}
              </button>
            )}
            <button
              type="button"
              className={styles.secondary}
              onClick={() => void unlockTeacher()}
              disabled={busy !== null}
              data-dev="dock-login-teacher"
            >
              {busy === "teacher" ? "解锁中…" : teacher ? "教师已解锁" : "教师解锁 2026"}
            </button>
          </section>

          <DevDockExperiments
            experiments={experiments}
            prePassed={prePassed}
            run={run}
            busy={busy !== null}
            onTogglePre={togglePre}
            onClearAllPre={clearAllPre}
            onNavigate={() => setOpen(false)}
          />

          <DevDockShortcuts onNavigate={() => setOpen(false)} />

          {message ? (
            <p className={styles.message} role="status" data-dev="dock-message">
              {message}
            </p>
          ) : null}
        </aside>
      ) : null}
    </div>
  );
}
