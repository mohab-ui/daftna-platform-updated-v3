import type { ReactNode, TableHTMLAttributes } from "react";

export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="tableWrap">{children}</div>;
}

export default function Table({ className, children, ...props }: TableHTMLAttributes<HTMLTableElement>) {
  const cls = ["table", className ?? ""].filter(Boolean).join(" ");
  return (
    <table {...props} className={cls}>
      {children}
    </table>
  );
}
