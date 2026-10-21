"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LoginScene } from "@/components/portal/login-scene";
import { LoginScreenStyles } from "@/components/portal/login-screen-styles";
import { playSound } from "@/lib/audio/engine";

type Role = "student" | "teacher";

/**
 * 演示凭证：登录页直接预填，点一下就能进。
 *
 * 用户 2026-10-21 要求「学生点登录直接进、教师也直接进」，
 * 但后端的白名单/口令校验保持不动（报告与成绩要靠 studentNo 归属）。
 * 所以做法是**前端预填 + 一键提交**，而不是削弱鉴权。
 */
const DEMO_STUDENT = { no: "20250101", name: "周若曦" };
const DEMO_TEACHER_PASSCODE = "2026";

export default function LoginPage() {
  const router = useRouter();
  const screenRef = useRef<HTMLDivElement>(null);
  const [role, setRole] = useState<Role>("student");
  const [studentNo, setStudentNo] = useState(DEMO_STUDENT.no);
  const [name, setName] = useState(DEMO_STUDENT.name);
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // 双层视差：pointermove 只写 CSS 变量（--px / --py），不 setState。
  // 仅 (hover:hover) and (pointer:fine) 且非 reduced-motion 才挂监听。
  useEffect(() => {
    const el = screenRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const onMove = (e: PointerEvent) => {
      el.style.setProperty("--px", String((e.clientX / window.innerWidth - 0.5) * 2));
      el.style.setProperty("--py", String((e.clientY / window.innerHeight - 0.5) * 2));
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  /** 统一的登录请求：学生走 /api/session，教师走 /api/teacher/unlock。 */
  async function login(nextRole: Role, body: Record<string, string>) {
    setError(null);
    setBusy(true);
    try {
      const res =
        nextRole === "student"
          ? await fetch("/api/session", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(body),
            })
          : await fetch("/api/teacher/unlock", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(body),
            });

      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        playSound("error-system");
        setError(
          payload.error === "NOT_IN_ROSTER"
            ? "该学号不在课程名单里，请核对后重试，或联系老师导入名单。"
            : nextRole === "teacher"
              ? "口令不正确。"
              : "登录失败，请稍后重试。",
        );
        return;
      }
      playSound("ok-l1");
      router.push(nextRole === "student" ? "/experiments" : "/teacher");
      router.refresh();
    } catch {
      playSound("error-system");
      setError("网络异常，请重试。");
    } finally {
      setBusy(false);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    void login(
      role,
      role === "student"
        ? { studentNo: studentNo.trim(), name: name.trim() }
        : { passcode: passcode.trim() },
    );
  }

  /** 一键进：不填表，直接用演示凭证登录（学生/教师各自的入口）。 */
  function enterAs(nextRole: Role) {
    if (busy) return;
    playSound("tick");
    if (nextRole === "student") {
      setStudentNo(DEMO_STUDENT.no);
      setName(DEMO_STUDENT.name);
      void login("student", { studentNo: DEMO_STUDENT.no, name: DEMO_STUDENT.name });
      return;
    }
    setPasscode(DEMO_TEACHER_PASSCODE);
    void login("teacher", { passcode: DEMO_TEACHER_PASSCODE });
  }

  return (
    <div className="login-screen" ref={screenRef}>
      <span className="login-screen__veil" aria-hidden="true" />
      <LoginScene />

      <div className="login-card">
        <Link className="login__brand" href="/">
          <span className="brand__mark">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/henan-university-emblem.png" alt="河南大学校徽" width={32} height={32} />
          </span>
          <span>河南大学 · 无机及分析化学实验</span>
        </Link>

        <div className="login__tabs" role="tablist" aria-label="登录身份" data-role={role}>
          <span className="login__tab-ink" aria-hidden="true" />
          <button
            type="button"
            role="tab"
            aria-selected={role === "student"}
            data-active={role === "student"}
            onClick={() => {
              playSound("tick");
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
              playSound("tick");
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
                  required
                  data-demo-id="demo-login-student-name"
                />
              </label>
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
                  required
                  data-demo-id="demo-login-teacher-passcode"
                />
              </label>
            </>
          )}

          {error ? (
            <p className="login__error" role="alert">
              {error}
            </p>
          ) : null}

          {role === "teacher" ? (
            <button
              type="button"
              className="login__quick"
              onClick={() => enterAs("teacher")}
              disabled={busy}
              data-demo-id="demo-login-quick-teacher"
            >
              用演示口令直接进入教师后台
            </button>
          ) : null}

          <button className="btn btn--primary login__submit" type="submit" disabled={busy} data-demo-id="demo-login-submit">
            {busy ? "登录中…" : role === "student" ? "进入实验" : "登录教师后台"}
          </button>
        </form>

        <p className="login__foot">
          <Link href="/">返回门户</Link>
          <span className="mono">03600004 · 2026 秋</span>
        </p>
      </div>

      <LoginScreenStyles />
    </div>
  );
}
