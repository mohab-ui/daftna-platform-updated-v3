"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import CourseTile, { type CourseTileCourse } from "@/components/CourseTile";
import { supabase } from "@/lib/supabase";

type Course = {
  id: string;
  code: string;
  name: string;
  semester: number | null;
  description: string | null;
};

export default function DashboardPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setErr(null);

      const { data, error } = await supabase
        .from("courses")
        .select("id, code, name, semester, description")
        .order("semester", { ascending: true })
        .order("code", { ascending: true });

      setLoading(false);
      if (error) {
        setErr("مش قادر أجيب المواد.");
        return;
      }
      setCourses((data ?? []) as Course[]);
    }

    load();
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return courses;
    return courses.filter(
      (c) =>
        c.code.toLowerCase().includes(s) ||
        c.name.toLowerCase().includes(s) ||
        String(c.semester ?? "").includes(s)
    );
  }, [courses, q]);

  return (
    <AppShell>
      <main className="container">
        <div className="card">
          <div className="sectionHeader">
            <div className="sectionTitle">
              <div>
                <h1 style={{ marginBottom: 6 }}>الرئيسية</h1>
                <p className="muted" style={{ marginTop: 0 }}>
                  اختار المادة → افتح المحاضرات والملفات. أو ادخل بنك الأسئلة علشان تذاكر بسرعة.
                </p>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link className="btn" href="/mcq">
                بنك الأسئلة
              </Link>
</div>
          </div>

          <div style={{ marginTop: 12 }}>
            <label className="label">بحث سريع</label>
            <input
              className="input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="اكتب كود المادة أو اسمها…"
            />
          </div>

          {err ? <p className="error">{err}</p> : null}
          {loading ? <p className="muted">جاري التحميل…</p> : null}
        </div>

        {!loading ? (
          <div className="courseGrid">
            {filtered.map((c, idx) => (
              <CourseTile
                key={c.id}
                course={c as CourseTileCourse}
                index={idx}
              />
            ))}

            {filtered.length === 0 ? (
              <div className="card" style={{ gridColumn: "1 / -1" }}>
                <p className="muted">مفيش مواد مطابقة للبحث.</p>
              </div>
            ) : null}
          </div>
        ) : null}
      </main>
    </AppShell>
  );
}
