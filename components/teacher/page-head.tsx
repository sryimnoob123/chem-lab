import type { ReactNode } from "react";

/** 页头：H1 + 一行小字 + 右侧动作区（台账式，不用卡片） */
export function PageHead({
  title,
  sub,
  children,
}: {
  title: string;
  sub: string;
  children?: ReactNode;
}) {
  return (
    <header className="tch-page-head">
      <div className="tch-page-head__main">
        <h1 className="tch-page-title">{title}</h1>
        <p className="tch-page-sub">{sub}</p>
      </div>
      {children ? <div className="tch-page-head__side">{children}</div> : null}
    </header>
  );
}
