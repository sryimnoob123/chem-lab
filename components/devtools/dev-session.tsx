"use client";

/**
 * 调试面板顶部的登录态条：一键登录 / 教师解锁 / 登出。
 * 只调现有 /api/session 与 /api/teacher/unlock，不新增服务端逻辑。
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { DevSessionInfo } from "./types";
import styles from "./devtools.module.css";

const DEV_STUDENT = { studentNo: "20250101", name: "周若曦" };
const DEV_TEACHER_PASSCODE = "2026";

type Busy = "student" | "teacher" | "logout" | null;

export function DevSession({ session }: { session: DevSessionInfo }) {
  const router = useRouter();
  const [busy, setBusy] = useState<Busy>(null);
  const [message, setMessage] = useState("");

  async function loginStudent() {
    setBusy("student");
    setMessage("");
    try {
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(DEV_STUDENT),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setMessage(res.ok ? `已登录 ${DEV_STUDENT.studentNo}` : `登录失败：${body.error ?? res.status}`);
      if (res.ok) router.refresh();
    } catch {
      setMessage("登录请求失败");
    } finally {
      setBusy(null);
    }
  }

  async function loginTeacher() {
    setBusy("teacher");
    setMessage("");
    try {
      const res = await fetch("/api/teacher/unlock", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ passcode: DEV_TEACHER_PASSCODE }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setMessage(res.ok ? "教师已解锁" : `解锁失败：${body.error ?? res.status}`);
      if (res.ok) router.refresh();
    } catch {
      setMessage("解锁请求失败");
    } finally {
      setBusy(null);
    }
  }

  async function logout() {
    setBusy("logout");
    setMessage("");
    try {
      await fetch("/api/session", { method: "DELETE" });
      setMessage("已登出");
      router.refresh();
    } catch {
      setMessage("登出请求失败");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className={styles.card} data-dev="session">
      <div className={styles.cardHead}>
        <h2 className={styles.cardTitle}>登录态</h2>
        <span className={styles.hint}>
          {session.student ? "chem_sid 有效" : "未登录"} · {session.teacher ? "教师已解锁" : "教师未解锁"}
        </span>
      </div>

      <dl className={styles.kv}>
        <dt>学生</dt>
        <dd data-dev="session-student">
          {session.student
            ? `${session.student.studentNo} · ${session.student.name} · ${session.student.className}`
            : "未登录"}
        </dd>
        <dt>教师</dt>
        <dd>{session.teacher ? "已解锁（chem_teacher）" : "未解锁"}</dd>
      </dl>

      <div className={styles.row}>
        <button
          type="button"
          className="btn btn--primary"
          onClick={loginStudent}
          disabled={busy !== null}
          data-dev="login-student"
        >
          {busy === "student" ? "登录中…" : `登录 ${DEV_STUDENT.studentNo}`}
        </button>
        <button
          type="button"
          className="btn btn--secondary"
          onClick={loginTeacher}
          disabled={busy !== null}
          data-dev="login-teacher"
        >
          {busy === "teacher" ? "解锁中…" : `教师解锁 ${DEV_TEACHER_PASSCODE}`}
        </button>
        <button
          type="button"
          className="btn btn--secondary"
          onClick={logout}
          disabled={busy !== null || !session.student}
          data-dev="logout"
        >
          登出
        </button>
        {message ? (
          <span className={styles.message} role="status" data-dev="session-message">
            {message}
          </span>
        ) : null}
      </div>
    </section>
  );
}
