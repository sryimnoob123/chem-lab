"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

/**
 * 教师口令解锁：名单导入 / 删除 / CSV 导出这些写操作走 requireTeacher()，
 * 没有 chem_teacher cookie 时后端一律 403。顶栏在未解锁时显示这个入口，
 * 解锁成功后 router.refresh() 让服务端重渲染出「刘建彩」身份。
 */
export function TeacherUnlock() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (passcode.trim() === "") {
      setError("请输入教师口令");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/teacher/unlock", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ passcode }),
      });
      if (!res.ok) {
        throw new Error(res.status === 401 ? "口令不对" : `解锁失败（${res.status}）`);
      }
      setOpen(false);
      setPasscode("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "解锁失败，请重试");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="tch-unlock" onClick={() => setOpen(true)}>
        教师解锁
      </button>
    );
  }

  return (
    <form className="tch-unlock-form" onSubmit={submit}>
      <label className="visually-hidden" htmlFor="tch-passcode">
        教师口令
      </label>
      <input
        id="tch-passcode"
        className="tch-unlock__input"
        type="password"
        inputMode="numeric"
        autoComplete="off"
        spellCheck={false}
        value={passcode}
        onChange={(event) => {
          setPasscode(event.currentTarget.value);
          setError(null);
        }}
        placeholder="教师口令"
      />
      <button type="submit" className="btn btn--on-dark tch-unlock__submit" disabled={busy}>
        {busy ? "解锁中…" : "解锁"}
      </button>
      <button type="button" className="tch-unlock__cancel" onClick={() => setOpen(false)}>
        取消
      </button>
      {error ? (
        <span className="tch-unlock__error" role="alert">
          {error}
        </span>
      ) : null}
    </form>
  );
}
