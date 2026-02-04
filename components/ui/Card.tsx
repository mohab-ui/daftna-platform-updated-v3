import type { HTMLAttributes, ReactNode } from "react";

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  soft?: boolean;
  children: ReactNode;
};

export default function Card({ soft, className, children, ...props }: CardProps) {
  const cls = ["card", soft ? "card--soft" : "", className ?? ""].filter(Boolean).join(" ");
  return (
    <div {...props} className={cls}>
      {children}
    </div>
  );
}
