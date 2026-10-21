/**
 * 登录页样式层（从 app/login/page.tsx 拆出，守单文件 300 行预算）。
 * 页面骨架样式 + 卡片三层错峰入场：
 * 蒙版 0ms → 卡片 60ms → 内部三行 120/180/240ms（+页脚 300ms），总时长 ≤420ms。
 * 只动 transform / opacity；reduced-motion 下全部取消。
 */
export function LoginScreenStyles() {
  return (
    <style>{`
      body:has(.login-screen) {
        padding-left: 0;
        background: #f3f6fb;
      }
      .login-screen {
        position: fixed;
        inset: 0;
        display: grid;
        place-items: center;
        overflow-y: auto;
        padding: clamp(18px, 4vh, 34px) 16px;
        box-sizing: border-box;
        background:
          radial-gradient(60% 55% at 15% 18%, rgba(35, 48, 127, .1), transparent 70%),
          radial-gradient(52% 46% at 86% 82%, rgba(15, 123, 108, .08), transparent 74%),
          linear-gradient(90deg, rgba(35, 48, 127, .05) 1px, transparent 1px) 0 0 / 72px 72px,
          linear-gradient(rgba(35, 48, 127, .05) 1px, transparent 1px) 0 0 / 72px 72px,
          #f3f6fb;
      }
      .login-screen__veil {
        position: absolute;
        inset: 0;
        z-index: 2;
        pointer-events: none;
        background: radial-gradient(ellipse 46% 44% at 50% 48%, rgba(255, 255, 255, .62) 0%, rgba(255, 255, 255, .16) 62%, transparent 100%);
        animation: veil-in 200ms ease-out both;
      }

      .login-card {
        position: relative;
        z-index: 2;
        display: flex;
        flex-direction: column;
        width: min(430px, 100%);
        box-sizing: border-box;
        padding: 28px 28px 22px;
        border-radius: 18px;
        border: 1px solid rgba(213, 220, 228, .9);
        background: rgba(255, 255, 255, .96);
        box-shadow: 0 24px 64px rgba(35, 48, 127, .14), 0 2px 8px rgba(22, 32, 44, .05);
        backdrop-filter: blur(10px);
        animation: login-in 280ms cubic-bezier(.23, 1, .32, 1) 60ms both;
      }
      .login-card .login__brand {
        font-size: 13px;
        gap: 9px;
        color: var(--ink-2);
        /* a11y：可点目标 ≥44px（桌面视觉不变，只多上下留白） */
        min-height: 44px;
        padding: 6px 0;
        animation: row-in 180ms cubic-bezier(.23, 1, .32, 1) 120ms both;
      }
      .login-card .login__brand .brand__mark { color: var(--river-700); }
      .login-card .login__tabs {
        position: relative;
        margin-top: 24px;
        border-bottom: 1px solid var(--line);
        animation: row-in 180ms cubic-bezier(.23, 1, .32, 1) 180ms both;
      }
      .login-card .login__tabs button {
        position: relative;
        z-index: 1;
        min-height: 46px;
        padding: 0;
        border-bottom: 0;
        background: transparent;
        color: var(--ink-2);
      }
      .login-card .login__tabs button[data-active="true"] {
        color: var(--river-700);
        border-bottom-color: transparent;
      }
      .login__tab-ink {
        position: absolute;
        left: 0;
        bottom: -1px;
        width: 50%;
        height: 2px;
        background: var(--river-700);
        transform: translateX(0);
        transition: transform 160ms cubic-bezier(.23, 1, .32, 1);
      }
      .login__tabs[data-role="teacher"] .login__tab-ink { transform: translateX(100%); }

      .login-card .login__form {
        margin-top: 20px;
        gap: 15px;
        animation: row-in 180ms cubic-bezier(.23, 1, .32, 1) 240ms both;
      }
      .login-card .login__form label span {
        font-size: 12px;
        letter-spacing: .02em;
      }
      .login-card .login__form input {
        height: 48px;
        padding: 0 14px;
        border-radius: 8px;
        font-size: 15px;
        background: #fbfcfd;
        transition:
          border-color 160ms cubic-bezier(.23, 1, .32, 1),
          box-shadow 160ms cubic-bezier(.23, 1, .32, 1);
      }
      .login-card .login__form input:focus {
        outline: 0;
        border-color: var(--river-700);
        box-shadow: 0 0 0 3px rgba(35, 48, 127, .12);
      }
      .login-card .login__submit {
        height: 50px;
        margin-top: 6px;
        border-radius: 8px;
        font-size: 15px;
        background: var(--river-700);
        box-shadow: 0 10px 24px rgba(35, 48, 127, .2);
      }
      .login-card .login__submit:active { transform: scale(.97); }
      .login-card .login__foot {
        margin-top: 24px;
        font-size: 12px;
        animation: row-in 120ms cubic-bezier(.23, 1, .32, 1) 300ms both;
      }
      /* a11y：可点目标 ≥44px（视觉仍是同一行，只把行高撑到 44） */
      .login-card .login__foot a {
        display: inline-flex;
        align-items: center;
        min-height: 44px;
        padding: 0 2px;
      }
      @media (hover: hover) and (pointer: fine) {
        .login-card .login__submit:hover {
          background: var(--river-800, #1b266a);
          transform: scale(1.01);
        }
      }
      @keyframes veil-in {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes login-in {
        from { opacity: 0; transform: translateY(12px) scale(.96); }
        to { opacity: 1; transform: none; }
      }
      @keyframes row-in {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: none; }
      }
      @media (max-width: 420px) {
        .login-card { padding: 24px 20px 20px; border-radius: 16px; }
      }
      @media (prefers-reduced-motion: reduce) {
        .login-screen__veil,
        .login-card,
        .login-card .login__brand,
        .login-card .login__tabs,
        .login-card .login__form,
        .login-card .login__foot { animation: none; }
        .login__tab-ink,
        .login-card .login__form input,
        .login-card .login__submit { transition: none; }
      }
    `}</style>
  );
}
