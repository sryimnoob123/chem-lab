import type { ButtonHTMLAttributes } from "react";
import styles from "./button.module.css";

export type ButtonVariant = "primary" | "secondary" | "on-dark" | "action";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

/**
 * 纯展示按钮。只负责样式，不绑定任何业务动作。
 */
export function Button({
  variant = "secondary",
  type = "button",
  className,
  ...rest
}: ButtonProps) {
  const classes = [styles.button, styles[variant], className]
    .filter(Boolean)
    .join(" ");

  return <button type={type} className={classes} {...rest} />;
}
