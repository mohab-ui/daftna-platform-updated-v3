import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ghost" | "danger";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  loading?: boolean;
};

export default function Button({ variant = "primary", loading, className, children, ...props }: ButtonProps) {
  const cls = [
    "btn",
    variant === "ghost" ? "btn--ghost" : "",
    variant === "danger" ? "btn--danger" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button {...props} className={cls} disabled={props.disabled || loading}>
      {loading ? "…" : children}
    </button>
  );
}
