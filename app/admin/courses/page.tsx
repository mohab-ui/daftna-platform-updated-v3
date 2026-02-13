"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { supabase } from "@/lib/supabase";
import { getMyProfile, isModerator, type UserRole } from "@/lib/profile";

type Course = {
  id: string;
  code: string;
  name: string;
  semester: number | null;
  description: string | null;
};

export default function AdminLecturesEntryPage() {
  const [role, setRole] = useState<UserRole | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const canManage = useMemo(() => isModerator(role as any), [role]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      setErr(null);
      setLoading(true);
      try {
        const profile = await getMyProfile();
        if (!mounted) return;
        setRole(profile?.role ?? null);

        const { data, error } = await supabase
          .from("courses")
          .select("id, code, name, semester, description")
          .order("semester", { ascending: true })
          .order("code", { ascending: true });

        if (!mounted) return;

        if (error) {
          setErr("مش قادر أجيب المواد. تأكد من الـ RLS والسياسات.");
          setCourses([]);
          return;
        }

        setCourses((data ?? []) as Course[]);
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <AppShell>
      <main className="container">
        <div className="card">
          <div className="sectionHeader">
            <div className="sectionTitle">
              <h1 style={{ marginBottom: 6 }}>إدارة المحاضرات</h1>
              <p className="muted" style={{ marginTop: 0 }}>
                اختار المادة علشان تفتح شاشة إضافة/تعديل المحاضرات مباشرة.
              </p>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Link className="btn btn--ghost" href="/admin">
                رجوع
              </Link>
            </div>
          </div>

          {!canManage ? (
            <p className="error">
              دورك الحالي: {role ?? "غير معروف"} — مش مسموح بالدخول لصفحات الإدارة.
            </p>
          ) : null}

          {err ? <p className="error">{err}</p> : null}
        </div>

        <div className="card" style={{ marginTop: 12 }}>
          <p className="muted">{loading ? "جاري التحميل…" : `${courses.length} مادة`}</p>

          {!loading && canManage ? (
            <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
              {courses.map((c) => (
                <Link
                  key={c.id}
                  href={`/admin/courses/${c.id}/lectures`}
                  className="rowItem"
                  style={{ textDecoration: "none" }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div className="rowTitle" style={{ marginBottom: 4 }}>
                      {c.code} — {c.name}
                      {c.semester ? <span className="muted"> • ترم {c.semester}</span> : null}
                    </div>
                    <div
                      className="muted"
                      style={{
                        fontSize: 13,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {c.description ?? "—"}
                    </div>
                  </div>

                  <span className="pill">إدارة المحاضرات</span>
                </Link>
              ))}

              {courses.length === 0 ? <p className="muted">مفيش مواد.</p> : null}
            </div>
          ) : null}

          {!loading && !canManage ? (
            <p className="muted" style={{ marginTop: 12 }}>
              لازم تكون moderator/admin علشان تدخل.
            </p>
          ) : null}
        </div>
      </main>
    </AppShell>
  );
}
