"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { LabScene } from "@/components/portal/lab-scene";

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
      <LabScene className="login-scene" />
      <span className="login-screen__scrim" aria-hidden="true" />

      <div className="login-card">
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
          background: #081018;
        }
        .login-screen {
          position: fixed;
          inset: 0;
          display: grid;
          place-items: center;
          overflow-y: auto;
          padding: clamp(18px, 4vh, 34px) 16px;
          background: #081018;
          box-sizing: border-box;
        }
        .login-scene {
          position: absolute;
          left: 0;
          top: -8%;
          width: 116%;
          height: 116%;
          z-index: 0;
          filter: brightness(1.32) saturate(1.08) contrast(1.04);
        }
        .login-screen__scrim {
          position: absolute;
          inset: 0;
          z-index: 1;
          pointer-events: none;
          background:
            radial-gradient(ellipse at 50% 45%, rgba(3, 8, 13, .02) 0%, rgba(3, 8, 13, .14) 68%, rgba(3, 8, 13, .32) 100%),
            linear-gradient(180deg, rgba(3, 8, 13, .18) 0%, rgba(3, 8, 13, .02) 46%, rgba(3, 8, 13, .24) 100%);
        }
        .login-card {
          position: relative;
          z-index: 2;
          display: flex;
          flex-direction: column;
          width: min(430px, 100%);
          box-sizing: border-box;
          padding: 28px 28px 22px;
          border-radius: 20px;
          border: 1px solid rgba(255, 255, 255, .55);
          background: rgba(255, 255, 255, .97);
          box-shadow: 0 28px 90px rgba(2, 7, 12, .52);
          backdrop-filter: blur(16px);
          animation: login-in 280ms cubic-bezier(.22, .61, .36, 1) both;
        }
        .login-card .login__brand {
          font-size: 13px;
          gap: 9px;
        }
        .login-card .login__tabs {
          margin-top: 28px;
        }
        .login-card .login__tabs button {
          min-height: 46px;
          padding: 0;
        }
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
        }
        .login-card .login__form input:focus {
          outline: 2px solid var(--river-500);
          outline-offset: 1px;
          border-color: transparent;
        }
        .login-card .login__submit {
          height: 50px;
          margin-top: 6px;
          border-radius: 8px;
          font-size: 15px;
        }
        .login-card .login__submit:active {
          transform: scale(.97);
        }
        @media (hover: hover) and (pointer: fine) {
          .login-card .login__submit:hover {
            background: #2d3d9e;
            transform: scale(1.01);
          }
        }
        .login-card .login__foot {
          margin-top: 24px;
          font-size: 12px;
        }
        @keyframes login-in {
          from { opacity: 0; transform: translateY(14px) scale(.96); }
          to { opacity: 1; transform: none; }
        }
        @media (max-width: 420px) {
          .login-card { padding: 24px 20px 20px; border-radius: 16px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .login-card { animation: none; }
        }
      `}</style>
    </div>
  );
}
