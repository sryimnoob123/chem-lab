"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** 删除名单条目：DELETE /api/teacher/roster/[no]，成功后刷新服务端表格 */
export function RosterDelete({ studentNo, name }: { studentNo: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function remove() {
    const confirmed = window.confirm(
      `把 ${name}（${studentNo}）移出白名单？\n移出后该学号不能登录，已有实验记录不受影响。`,
    );
    if (!confirmed) return;

    setBusy(true);
    setFailed(false);
    try {
      const res = await fetch(`/api/teacher/roster/${encodeURIComponent(studentNo)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(String(res.status));
      router.refresh();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className="tch-linkbtn"
      onClick={() => void remove()}
      disabled={busy}
      aria-label={`删除 ${name}（${studentNo}）`}
    >
      {busy ? "删除中" : failed ? "重试删除" : "删除"}
    </button>
  );
}
