"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { VesselGlyph } from "@/components/portal/vessel-strip";

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
    <div className="login-screen">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="login-bg" src="/brand/campus/campus-02.jpg" alt="" aria-hidden="true" />
      <span className="login-screen__veil" aria-hidden="true" />

      <div className="login-art" aria-hidden="true">
        <span className="login-art__item" data-pos="left">
          <VesselGlyph index={3} />
        </span>
        <span className="login-art__item" data-pos="top">
          <VesselGlyph index={4} />
        </span>
        <span className="login-art__item" data-pos="right">
          <VesselGlyph index={1} />
        </span>
      </div>

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

          <button className="btn btn--primary login__submit" type="submit" disabled={busy} data-demo-id="demo-login-submit">
            {busy ? "登录中…" : role === "student" ? "登录并进入实验" : "登录教师后台"}
          </button>
        </form>

        <p className="login__foot">
          <Link href="/">返回门户</Link>
          <span className="mono">03600004 · 2026 秋</span>
        </p>
      </div>

      <style>{`
        body:has(.login-screen) {
          padding-left: 0;
          background: #f3f6fb;
        }
        .login-screen {
          position: fixed;
          inset: 0;
          display: grid;
          place-items: center;
          overflow-y: auto;
          padding: clamp(18px, 4vh, 34px) 16px;
          box-sizing: border-box;
          background:
            radial-gradient(60% 55% at 15% 18%, rgba(35, 48, 127, .1), transparent 70%),
            radial-gradient(52% 46% at 86% 82%, rgba(15, 123, 108, .08), transparent 74%),
            linear-gradient(90deg, rgba(35, 48, 127, .05) 1px, transparent 1px) 0 0 / 72px 72px,
            linear-gradient(rgba(35, 48, 127, .05) 1px, transparent 1px) 0 0 / 72px 72px,
            #f3f6fb;
        }
        .login-bg {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center;
          opacity: .16;
          filter: saturate(.88) contrast(1.02);
          pointer-events: none;
        }
        .login-screen__veil {
          position: absolute;
          inset: 0;
          z-index: 1;
          pointer-events: none;
          background:
            linear-gradient(180deg, rgba(246, 248, 252, .72) 0%, rgba(255, 255, 255, .86) 58%, rgba(243, 246, 251, .9) 100%),
            radial-gradient(ellipse at 50% 42%, rgba(255, 255, 255, .5), rgba(243, 246, 251, .9) 78%);
        }
        .login-art {
          position: absolute;
          inset: 0;
          z-index: 1;
          overflow: hidden;
          pointer-events: none;
          color: var(--river-700);
        }
        .login-art__item {
          position: absolute;
          display: block;
          opacity: .14;
          animation: login-float 26s ease-in-out infinite alternate;
          will-change: transform;
        }
        .login-art__item svg { width: 100%; height: 100%; }
        .login-art__item[data-pos="left"] {
          left: 7%;
          bottom: 13%;
          width: 110px;
          height: 132px;
        }
        .login-art__item[data-pos="top"] {
          left: 19%;
          top: 16%;
          width: 72px;
          height: 86px;
          animation-duration: 21s;
          animation-delay: -6s;
        }
        .login-art__item[data-pos="right"] {
          right: 8%;
          top: 22%;
          width: 132px;
          height: 158px;
          animation-duration: 30s;
          animation-delay: -12s;
        }

        .login-card {
          position: relative;
          z-index: 2;
          display: flex;
          flex-direction: column;
          width: min(430px, 100%);
          box-sizing: border-box;
          padding: 28px 28px 22px;
          border-radius: 18px;
          border: 1px solid rgba(213, 220, 228, .9);
          background: rgba(255, 255, 255, .96);
          box-shadow: 0 24px 64px rgba(35, 48, 127, .14), 0 2px 8px rgba(22, 32, 44, .05);
          backdrop-filter: blur(10px);
          animation: login-in 280ms cubic-bezier(.23, 1, .32, 1) both;
        }
        .login-card .login__brand {
          font-size: 13px;
          gap: 9px;
          color: var(--ink-2);
        }
        .login-card .login__brand .brand__mark { color: var(--river-700); }
        .login-card .login__tabs {
          position: relative;
          margin-top: 24px;
          border-bottom: 1px solid var(--line);
        }
        .login-card .login__tabs button {
          position: relative;
          z-index: 1;
          min-height: 46px;
          padding: 0;
          border-bottom: 0;
          background: transparent;
          color: var(--ink-2);
        }
        .login-card .login__tabs button[data-active="true"] {
          color: var(--river-700);
          border-bottom-color: transparent;
        }
        .login__tab-ink {
          position: absolute;
          left: 0;
          bottom: -1px;
          width: 50%;
          height: 2px;
          background: var(--river-700);
          transform: translateX(0);
          transition: transform 160ms cubic-bezier(.23, 1, .32, 1);
        }
        .login__tabs[data-role="teacher"] .login__tab-ink { transform: translateX(100%); }

        .login-card .login__form {
          margin-top: 20px;
          gap: 15px;
        }
        .login-card .login__form label span {
          font-size: 12px;
          letter-spacing: .02em;
        }
        .login-card .login__form input {
          height: 48px;
          padding: 0 14px;
          border-radius: 8px;
          font-size: 15px;
          background: #fbfcfd;
          transition:
            border-color 160ms cubic-bezier(.23, 1, .32, 1),
            box-shadow 160ms cubic-bezier(.23, 1, .32, 1);
        }
        .login-card .login__form input:focus {
          outline: 0;
          border-color: var(--river-700);
          box-shadow: 0 0 0 3px rgba(35, 48, 127, .12);
        }
        .login-card .login__submit {
          height: 50px;
          margin-top: 6px;
          border-radius: 8px;
          font-size: 15px;
          background: var(--river-700);
          box-shadow: 0 10px 24px rgba(35, 48, 127, .2);
        }
        .login-card .login__submit:active { transform: scale(.97); }
        .login-card .login__foot {
          margin-top: 24px;
          font-size: 12px;
        }
        @media (hover: hover) and (pointer: fine) {
          .login-card .login__submit:hover {
            background: var(--river-800, #1b266a);
            transform: scale(1.01);
          }
        }
        @keyframes login-in {
          from { opacity: 0; transform: translateY(12px) scale(.96); }
          to { opacity: 1; transform: none; }
        }
        @keyframes login-float {
          from { transform: translateY(0) rotate(-2deg); }
          to { transform: translateY(-16px) rotate(2deg); }
        }
        @media (max-width: 420px) {
          .login-card { padding: 24px 20px 20px; border-radius: 16px; }
          .login-art__item[data-pos="right"] { opacity: .09; }
        }
        @media (prefers-reduced-motion: reduce) {
          .login-card { animation: none; }
          .login-art__item { animation: none; }
          .login__tab-ink,
          .login-card .login__form input,
          .login-card .login__submit { transition: none; }
        }
      `}</style>
    </div>
  );
}
