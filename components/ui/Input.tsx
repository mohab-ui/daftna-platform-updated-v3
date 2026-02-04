import type { InputHTMLAttributes } from "react";

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export default function Input({ className, ...props }: InputProps) {
  const cls = ["input", className ?? ""].filter(Boolean).join(" ");
  return <input {...props} className={cls} />;
}
