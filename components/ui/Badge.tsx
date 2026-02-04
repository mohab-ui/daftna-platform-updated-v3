import type { HTMLAttributes, ReactNode } from "react";

type Variant = "pill" | "chip";

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: Variant;
  children: ReactNode;
};

export default function Badge({ variant = "pill", className, children, ...props }: BadgeProps) {
  const base = variant === "chip" ? "chip" : "pill";
  const cls = [base, className ?? ""].filter(Boolean).join(" ");
  return (
    <span {...props} className={cls}>
      {children}
    </span>
  );
}
