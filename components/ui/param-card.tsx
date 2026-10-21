import styles from "./param-card.module.css";

export type ParamTone = "normal" | "warn" | "danger";

export type ParamCardProps = {
  label: string;
  value: string;
  unit?: string;
  tone?: ParamTone;
  tag?: string;
  swatch?: string;
  note?: string;
  className?: string;
};

/**
 * live 参数卡：小标题 + 大数字 + 单位。
 * 阈值状态只改描边和小标签，不铺大色块。
 */
export function ParamCard({
  label,
  value,
  unit,
  tone = "normal",
  tag,
  swatch,
  note,
  className,
}: ParamCardProps) {
  const classes = [styles.card, className].filter(Boolean).join(" ");

  return (
    <div className={classes} data-tone={tone}>
      <div className={styles.head}>
        <span className={styles.label}>{label}</span>
        {tag ? <span className={styles.tag}>{tag}</span> : null}
      </div>
      <div className={styles.reading}>
        {swatch ? (
          <span
            className={styles.swatch}
            style={{ background: swatch }}
            aria-hidden="true"
          />
        ) : null}
        <span className={styles.value}>{value}</span>
        {unit ? <span className={styles.unit}>{unit}</span> : null}
      </div>
      {note ? <p className={styles.note}>{note}</p> : null}
    </div>
  );
}
