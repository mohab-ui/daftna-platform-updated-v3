"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { getMyProfile, isModerator, UserRole } from "@/lib/profile";

export default function AdminMcqPage() {
  const [role, setRole] = useState<UserRole | null>(null);

  useEffect(() => {
    getMyProfile().then((p) => setRole(p?.role ?? null));
  }, []);

  const canManage = useMemo(() => isModerator(role as any), [role]);

  if (role === null) {
    return (
      <AppShell>
        <main className="container">
          <div className="card">
            <h1>جاري التحميل…</h1>
            <p className="muted">بنحدد صلاحيات الحساب.</p>
          </div>
        </main>
      </AppShell>
    );
  }


  if (!canManage) {
    return (
      <AppShell>
        <main className="container">
          <div className="card">
            <h1>غير مسموح</h1>
            <p className="muted">الصفحة دي للمشرفين فقط.</p>
            <Link className="btn" href="/dashboard">رجوع</Link>
          </div>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className="container">
        <div className="card">
          <h1 style={{ marginBottom: 6 }}>إدارة الأسئلة (MCQ Bank)</h1>
          <p className="muted" style={{ marginTop: 0 }}>
            أضف أسئلة بسرعة عن طريق لصق النص، أو راجع/احذف الأسئلة الموجودة.
          </p>

          <div className="grid" style={{ marginTop: 12 }}>
            <Link className="col-12 col-6 cardLink" href="/admin/mcq/import">
              <div className="card">
                <h2 style={{ marginBottom: 6 }}>➕ استيراد سريع (Paste)</h2>
                <p className="muted">الصق نص الأسئلة (مع الاختيارات) والموقع هيقسّمها تلقائيًا.</p>
              </div>
            </Link>

            <Link className="col-12 col-6 cardLink" href="/admin/mcq/questions">
              <div className="card">
                <h2 style={{ marginBottom: 6 }}>📚 بنك الأسئلة</h2>
                <p className="muted">بحث/فلترة/حذف. (مناسب لو عايز تنظّم أو تراجع).</p>
              </div>
            </Link>
          </div>

          <div style={{ marginTop: 12 }}>
            <Link className="btn btn--ghost" href="/mcq">فتح صفحة الاختبارات</Link>
          </div>
        </div>

        <div className="card card--soft" style={{ marginTop: 12 }}>
          <h2 style={{ marginBottom: 8 }}>نصيحة</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            الأفضل تربط الأسئلة بمحاضرة محددة لما تقدر (Lecture) عشان الطلاب يختبروا نفسهم على جزء معين.
          </p>
        </div>
      </main>
    </AppShell>
  );
}
