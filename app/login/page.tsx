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

export default function LoginPage() {
  const router = useRouter();
  const screenRef = useRef<HTMLDivElement>(null);
  const [role, setRole] = useState<Role>("student");
  const [studentNo, setStudentNo] = useState(DEMO_STUDENT.no);
  const [name, setName] = useState(DEMO_STUDENT.name);
  const [passcode, setPasscode] = useState("");

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

  /** 口令校验失败时留在原页给一句人话（后端仍是唯一判据） */
  const [teacherError, setTeacherError] = useState("");

  /**
   * 演示口径（用户 2026-10-22）：登录只做样子，不校验、不请求后端。
   * 之前学生走 POST /api/session 查库，库里一有问题就 500、现场卡在登录页。
   *
   * 例外是教师：`/teacher` 里的「导出学情 CSV」走 /api/teacher/export，
   * 后端要 chem_teacher cookie（lib/session.ts 的 requireTeacher）。
   * 2026-10-23 回归实测：登录页填了口令却谁也没种 cookie，
   * 于是导出永远 403「请先在右上角教师解锁」。这里把填的口令真的提交上去，
   * 留空则照旧直接进（演示不弹口令），口令错就留在本页给提示。
   */
  async function enter(nextRole: Role) {
    playSound("ok-l1");
    if (nextRole === "teacher" && passcode.trim()) {
      try {
        const res = await fetch("/api/teacher/unlock", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ passcode: passcode.trim() }),
        });
        if (res.status === 401) {
          setTeacherError("口令不对，再试一次");
          return;
        }
      } catch {
        // 网络/后端挂了不挡人：照旧进后台（只是导出会提示先解锁）
      }
    }
    router.push(nextRole === "student" ? "/experiments" : "/teacher");
    router.refresh();
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    void enter(role);
  }

  /** 一键进：不填表，直接进对应端。 */
  function enterAs(nextRole: Role) {
    void enter(nextRole);
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
                  data-demo-id="demo-login-student-no"
                />
              </label>
              <label>
                <span>姓名</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  data-demo-id="demo-login-student-name"
                />
              </label>
            </>
          ) : (
            <>
              {/* 教师端口令已取消：打开就进后台。口令字段只在 ?passcode=1 时保留，
                  给旧链接/兼容用，正常演示看不到（用户 2026-10-22 要求"弹口令那个去掉"）。 */}
              {typeof window !== "undefined" &&
              new URLSearchParams(window.location.search).get("passcode") === "1" ? (
                <label>
                  <span>教师口令（可留空）</span>
                  <input
                    type="password"
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    autoComplete="current-password"
                    data-demo-id="demo-login-teacher-passcode"
                  />
                </label>
              ) : null}
            </>
          )}

          {role === "teacher" ? (
            <button
              type="button"
              className="login__quick"
              onClick={() => enterAs("teacher")}
             
              data-demo-id="demo-login-quick-teacher"
            >
              直接进入教师后台（无需口令）
            </button>
          ) : null}

          <button className="btn btn--primary login__submit" type="submit" data-demo-id="demo-login-submit">
            {role === "student" ? "进入实验" : "登录教师后台"}
          </button>
          {role === "teacher" && teacherError ? (
            <p className="login__foot" role="alert" data-demo-id="demo-login-teacher-error" style={{ color: "#a33" }}>
              {teacherError}
            </p>
          ) : null}
        </form>

        {/* 原来「演示账号」和「返回门户 / 课程号」是上下两行小字（堆叠），
            2026-10-23 收成一行：三件都是辅助信息，同一行分左右即可。 */}
        <div className="login__foot login__foot-row">
          <span className="mono" data-demo-id="demo-login-hint">
            演示账号 20250101/周若曦
          </span>
          <span className="login__foot-end">
            <Link href="/">返回门户</Link>
            <span className="mono">03600004 · 2026 秋</span>
          </span>
        </div>
      </div>

      <LoginScreenStyles />
    </div>
  );
}
