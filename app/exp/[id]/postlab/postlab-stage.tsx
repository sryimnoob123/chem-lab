"use client";

/**
 * 后测一屏（BOPPPS 的 P · Post-assessment）。
 *
 * 用户 2026-10-23 口径：交卷之后先做完后测，再进评分。以前后测和总分挤在同一屏，
 * 学生还没答就被分数盖过去了。这里只放假后测，答完提交 → 一个按钮进报告页看评分。
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BopbpsPostLab } from "@/components/exp/bopbps-postlab";
import { getCurriculum } from "@/lib/pedagogy/curriculum";

export function PostlabStage({
  expId,
  runId,
  auto,
}: {
  expId: string;
  runId: string | null;
  auto: boolean;
}) {
  const router = useRouter();
  const [done, setDone] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const total = getCurriculum(expId)?.post.length ?? 0;

  const params = new URLSearchParams();
  if (runId) params.set("runId", runId);
  if (auto) params.set("auto", "1");
  if (score !== null) params.set("post", String(score));
  const query = params.toString();
  const reportHref = `/exp/${expId}/report${query ? `?${query}` : ""}`;

  return (
    <div>
      <BopbpsPostLab
        expId={expId}
        onSubmit={(value, answers) => {
          setScore(value);
          setDone(true);
          // 后测答案落库（quiz_answers phase="post"）：与预习分同一条写路径。
          // 交卷在进入本页之前已经发生，所以这次写入不重算已冻结的 runs 分数；
          // 报告页的「后测回顾」仍按 URL 里的 ?post= 显示。
          if (runId) {
            void fetch(`/api/runs/${runId}/quiz`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ phase: "post", answers }),
            }).catch(() => null);
          }
        }}
      />
      {done || auto ? (
        <div
          style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 16 }}
          data-demo-id="demo-postlab-actions"
        >
          <button
            type="button"
            className="btn btn--primary"
            data-demo-id="demo-postlab-next"
            style={{ minHeight: 44, padding: "0 18px" }}
            onClick={() => router.push(reportHref)}
          >
            进入报告与评分
          </button>
          <span style={{ fontSize: "var(--type-meta)", color: "var(--ink-2)" }}>
            {score !== null ? `后测 ${score} / 100` : `后测 ${total} 题已完成`}
          </span>
        </div>
      ) : null}
    </div>
  );
}
