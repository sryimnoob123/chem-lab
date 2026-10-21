"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";

type ImportResult = { imported: number; skipped: number; errors: string[] };

function parseResult(json: unknown): ImportResult {
  if (typeof json !== "object" || json === null) return { imported: 0, skipped: 0, errors: [] };
  const record = json as Record<string, unknown>;
  const count = (value: unknown) =>
    typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
  const errors = Array.isArray(record.errors)
    ? record.errors.filter((item): item is string => typeof item === "string")
    : [];
  return { imported: count(record.imported), skipped: count(record.skipped), errors };
}

/** 名单导入：上传 CSV 或粘贴文本两种方式，POST 后原地给出「已导入 / 跳过」回执 */
export function RosterImport() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const file = fileRef.current?.files?.[0] ?? null;
    if (!file && text.trim() === "") {
      setError("选择 CSV 文件，或把名单粘贴到右侧文本框。");
      setResult(null);
      return;
    }

    const body = new FormData();
    if (file) body.append("file", file);
    else body.append("csv", text);

    setBusy(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/teacher/roster/import", { method: "POST", body });
      if (!res.ok) {
        const hint = res.status === 403 ? "没有教师权限，请先以教师身份登录。" : `导入失败（HTTP ${res.status}）`;
        throw new Error(hint);
      }
      const json: unknown = await res.json();
      const parsed = parseResult(json);
      setResult(parsed);
      formRef.current?.reset();
      setFileName("");
      setText("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "导入失败，请重试。");
    } finally {
      setBusy(false);
    }
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    setFileName(event.currentTarget.files?.[0]?.name ?? "");
    setError(null);
  }

  return (
    <form
      ref={formRef}
      className="tch-import"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div className="tch-import__grid">
        <div className="tch-field">
          <span className="tch-field__label">方式一 · 上传 CSV</span>
          <div className="tch-file-row">
            <label className="btn btn--secondary tch-file">
              <input
                ref={fileRef}
                className="visually-hidden"
                type="file"
                accept=".csv,text/csv,text/plain"
                onChange={onFileChange}
              />
              选择文件
            </label>
            <span className="tch-field__hint">{fileName || "未选择文件 · 列顺序：学号, 姓名, 班级"}</span>
          </div>
        </div>

        <div className="tch-field">
          <label className="tch-field__label" htmlFor="tch-roster-text">
            方式二 · 粘贴名单
          </label>
          <textarea
            id="tch-roster-text"
            className="tch-textarea"
            rows={4}
            value={text}
            onChange={(event) => {
              setText(event.currentTarget.value);
              setError(null);
            }}
            placeholder={"2024010101,张三,25级能源1班\n2024010102,李四,25级能源1班"}
            spellCheck={false}
          />
          <span className="tch-field__hint">每行一条，逗号分隔；与文件二选一。</span>
        </div>
      </div>

      <div className="tch-import__foot">
        <button type="submit" className="btn btn--primary" disabled={busy}>
          {busy ? "导入中…" : "开始导入"}
        </button>

        {result ? (
          <p className="tch-import__result" role="status">
            已导入 <span className="mono">{result.imported}</span> 条 / 跳过{" "}
            <span className="mono">{result.skipped}</span> 条
            {result.errors.length > 0 ? (
              <span className="tch-import__errors">
                　首条问题：<span className="mono">{result.errors[0]}</span>
              </span>
            ) : null}
          </p>
        ) : null}

        {error ? (
          <p className="tch-import__error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </form>
  );
}
