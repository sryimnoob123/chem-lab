/**
 * 把"重点实验卡 / 更多实验折叠"的样式追加到 portal.css（一次性）。
 * 幂等：已含标记就跳过。
 */
import fs from "node:fs";
import path from "node:path";

const file = path.join(process.cwd(), "app/styles/portal.css");
const MARK = "/* ===== 实验列表：重点三张卡 + 更多实验折叠（2026-10-21） ===== */";

const CSS = `
${MARK}
.cat-featured {
  margin-top: 28px;
}
.cat-featured__head {
  display: flex;
  align-items: baseline;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.cat-featured__head h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--ink);
}
.cat-featured__head p {
  margin: 0;
  font-size: 12px;
  color: var(--ink-2);
}
.cat-featured__list {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.cat-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 170px;
  padding: 16px 16px 14px;
  border: 1px solid var(--line);
  border-radius: 2px;
  background: #fff;
  color: inherit;
  text-decoration: none;
  transition:
    transform 180ms var(--ease-out),
    border-color 180ms var(--ease-out),
    box-shadow 180ms var(--ease-out);
}
.cat-card:hover {
  transform: translateY(-2px);
  border-color: var(--river-700);
  box-shadow: 0 10px 24px rgba(22, 32, 44, 0.08);
}
.cat-card:active {
  transform: scale(0.99);
}
.cat-card__top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}
.cat-card__no {
  font-size: 26px;
  line-height: 1;
  color: var(--river-700);
  letter-spacing: -0.02em;
}
.cat-card__hours {
  font-size: 11px;
  color: var(--ink-2);
}
.cat-card__title {
  font-size: 15px;
  font-weight: 600;
  line-height: 1.35;
  color: var(--ink);
}
.cat-card__desc {
  flex: 1;
  font-size: 12px;
  line-height: 1.6;
  color: var(--ink-2);
}
.cat-card__foot {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  font-size: 11px;
  color: var(--ink-2);
}
.cat-card__score {
  color: var(--jade-600);
}
.cat-card__score[data-empty="true"] {
  color: var(--ink-2);
  opacity: 0.7;
}

.cat-more {
  margin-top: 22px;
  padding-top: 6px;
  border-top: 1px solid var(--line);
}
.cat-more__summary {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  cursor: pointer;
  list-style: none;
  color: var(--ink);
}
.cat-more__summary::-webkit-details-marker {
  display: none;
}
.cat-more__title {
  font-size: 13px;
  font-weight: 600;
}
.cat-more__count {
  font-size: 11px;
  color: var(--ink-2);
}
.cat-more__chev {
  margin-left: auto;
  display: inline-flex;
  transition: transform 180ms var(--ease-out);
}
.cat-more[open] .cat-more__chev {
  transform: rotate(180deg);
}
.cat-list--more {
  margin-top: 6px;
}
.cat-list--more .cat-row[data-state="locked"] .cat-row__link {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 860px) {
  .cat-featured__list {
    grid-template-columns: 1fr;
  }
  .cat-card {
    min-height: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .cat-card,
  .cat-more__chev {
    transition: none;
  }
  .cat-card:hover {
    transform: none;
  }
}
`;

const text = fs.readFileSync(file, "utf8");
if (text.includes(MARK)) {
  console.log("已存在，跳过");
} else {
  fs.writeFileSync(file, text + CSS, "utf8");
  console.log("已追加实验列表样式");
}
