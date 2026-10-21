/** 教师端加载态：静态骨架 + 一行说明（不做循环动画，reduced-motion 下也稳定） */
export default function TeacherLoading() {
  return (
    <div className="tch-loading" role="status" aria-live="polite">
      <span className="visually-hidden">正在读取学情数据</span>

      <span className="tch-loading__title" aria-hidden="true" />
      <span className="tch-loading__sub" aria-hidden="true" />

      <div className="tch-loading__stats" aria-hidden="true">
        {Array.from({ length: 5 }, (_, index) => (
          <span key={index} />
        ))}
      </div>

      <span className="tch-loading__label" aria-hidden="true">
        正在读取台账…
      </span>

      <div className="tch-loading__rows" aria-hidden="true">
        {Array.from({ length: 8 }, (_, index) => (
          <span key={index} />
        ))}
      </div>
    </div>
  );
}
