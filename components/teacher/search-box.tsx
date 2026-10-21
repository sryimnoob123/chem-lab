"use client";

import { useEffect, useRef, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";

/**
 * 学号/姓名搜索：300ms 防抖后写 URL query（服务端筛）。
 * 输入框是非受控的：只有"外部 q 变了且用户没在输入"时才回写 DOM，
 * 避免每次 commit 重挂载导致失焦（受控 + effect 同步会触发级联渲染）。
 */
export function SearchBox({
  initialQ,
  status,
  action,
}: {
  initialQ: string;
  /** 当前状态筛选（all | done | doing | not_started） */
  status: string;
  action: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const applied = useRef(initialQ);

  // 后退/前进等外部变化：用户不在输入时把 URL 的 q 回写到输入框
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    if (document.activeElement === input) return;
    if (input.value === initialQ) return;
    input.value = initialQ;
    applied.current = initialQ;
  }, [initialQ]);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function commit(next: string) {
    const trimmed = next.trim();
    if (trimmed === applied.current) return;
    applied.current = trimmed;

    const params = new URLSearchParams();
    if (trimmed) params.set("q", trimmed);
    if (status && status !== "all") params.set("status", status);
    const qs = params.toString();
    router.replace(qs ? `${action}?${qs}` : action);
  }

  function onChange(event: ChangeEvent<HTMLInputElement>) {
    const next = event.currentTarget.value;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => commit(next), 300);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (timer.current) clearTimeout(timer.current);
    commit(inputRef.current?.value ?? "");
  }

  return (
    <form className="tch-search" role="search" onSubmit={onSubmit}>
      <label className="visually-hidden" htmlFor="tch-q">
        按学号或姓名搜索学生
      </label>
      <svg className="tch-search__icon" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <path d="M10.4 10.4 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" />
      </svg>
      <input
        ref={inputRef}
        id="tch-q"
        className="tch-search__input"
        type="search"
        defaultValue={initialQ}
        onChange={onChange}
        placeholder="学号 / 姓名"
        autoComplete="off"
        spellCheck={false}
      />
    </form>
  );
}
