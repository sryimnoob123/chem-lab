"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";

type Role = "student" | "teacher";

export default function LoginPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role>("student");
  const [studentNo, setStudentNo] = useState("");
  const [name, setName] = useState("");
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res =
        role === "student"
          ? await fetch("/api/session", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ studentNo: studentNo.trim(), name: name.trim() }),
            })
          : await fetch("/api/teacher/unlock", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ passcode: passcode.trim() }),
            });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(
          body.error === "NOT_IN_ROSTER"
            ? "该学号不在课程名单里，请核对后重试，或联系老师导入名单。"
            : role === "teacher"
              ? "口令不正确。"
              : "登录失败，请稍后重试。",
        );
        return;
      }
      router.push(role === "student" ? "/experiments" : "/teacher");
      router.refresh();
    } catch {
      setError("网络异常，请重试。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <div className="login__panel">
        <Link className="login__brand" href="/">
          <span className="brand__mark">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/henan-university-emblem.png" alt="河南大学校徽" width={32} height={32} />
          </span>
          <span>河南大学 · 无机及分析化学实验</span>
        </Link>

        <div className="login__tabs" role="tablist" aria-label="登录身份">
          <button
            type="button"
            role="tab"
            aria-selected={role === "student"}
            data-active={role === "student"}
            onClick={() => {
              setRole("student");
              setError(null);
            }}
            data-demo-id="demo-login-tab-student"
          >
            学生登录
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={role === "teacher"}
            data-active={role === "teacher"}
            onClick={() => {
              setRole("teacher");
              setError(null);
            }}
            data-demo-id="demo-login-tab-teacher"
          >
            教师登录
          </button>
        </div>

        <form className="login__form" onSubmit={submit}>
          {role === "student" ? (
            <>
              <label>
                <span>学号</span>
                <input
                  value={studentNo}
                  onChange={(e) => setStudentNo(e.target.value)}
                  inputMode="numeric"
                  autoComplete="username"
                  placeholder="如 20250101"
                  required
                  data-demo-id="demo-login-student-no"
                />
              </label>
              <label>
                <span>姓名</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  placeholder="与教务名单一致"
                  required
                  data-demo-id="demo-login-student-name"
                />
              </label>
              <p className="login__hint">学号即账号，无需密码。仅名单内学生可登录。</p>
            </>
          ) : (
            <>
              <label>
                <span>教师口令</span>
                <input
                  type="password"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  autoComplete="current-password"
                  placeholder="课程负责人发放"
                  required
                  data-demo-id="demo-login-teacher-passcode"
                />
              </label>
              <p className="login__hint">教师登录后进入班级学情后台。</p>
            </>
          )}

          {error ? (
            <p className="login__error" role="alert">
              {error}
            </p>
          ) : null}

          <button className="btn btn--primary login__submit" type="submit" disabled={busy} data-demo-id="demo-login-submit">
            {busy ? "登录中…" : role === "student" ? "登录并进入实验" : "登录教师后台"}
          </button>
        </form>

        <p className="login__foot">
          <Link href="/">返回门户</Link>
          <span className="mono">03600004 · 2026 秋</span>
        </p>
      </div>

      <div className="login__aside" aria-hidden="true">
        <p className="login__aside-kicker mono">LABORATORY NOTEBOOK</p>
        <p className="login__aside-title">
          先登录，
          <br />
          再动手。
        </p>
        <ul className="login__aside-list">
          <li>10 个实验 · 36 学时</li>
          <li>过程性评价：预习 10% · 操作 40% · 报告 50%</li>
          <li>操作留痕，事故复盘可查</li>
        </ul>
      </div>
    </div>
  );
}
