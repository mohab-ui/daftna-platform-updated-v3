import { Suspense } from "react";
import McqClient from "./McqClient";

export default function Page() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>جاري التحميل...</div>}>
      <McqClient />
    </Suspense>
  );
}
