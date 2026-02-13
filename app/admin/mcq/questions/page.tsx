"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { supabase } from "@/lib/supabase";
import { getMyProfile, isModerator, UserRole } from "@/lib/profile";
import { fmtDate } from "@/lib/utils";
import { letterFromIndex } from "@/lib/mcqParse";

type Course = { id: string; code: string; name: string };
type Lecture = { id: string; title: string; order_index: number };

type QRow = {
  id: string;
  question_text: string;
  correct_index: number;
  created_at: string;
  course: { id: string; code: string; name: string } | null;
  lecture: { id: string; title: string } | null;
};

export default function AdminMcqQuestionsPage() {
  const [role, setRole] = useState<UserRole | null>(null);
  const [loadingRole, setLoadingRole] = useState(true);

  const [courses, setCourses] = useState<Course[]>([]);
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [courseId, setCourseId] = useState("");
  const [lectureId, setLectureId] = useState("");

  const [q, setQ] = useState("");
  const [rows, setRows] = useState<QRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const p = await getMyProfile();
        if (!mounted) return;
        setRole((p?.role as UserRole) ?? null);
      } finally {
        if (!mounted) return;
        setLoadingRole(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const canManage = useMemo(() => isModerator(role as any), [role]);

  useEffect(() => {
    async function loadCourses() {
      const { data } = await supabase
        .from("courses")
        .select("id, code, name")
        .order("code", { ascending: true });

      setCourses((data ?? []) as Course[]);
    }

    if (!loadingRole && canManage) loadCourses();
  }, [loadingRole, canManage]);

  useEffect(() => {
    async function loadLectures() {
      setLectures([]);
      if (!courseId) return;

      const { data } = await supabase
        .from("lectures")
        .select("id, title, order_index")
        .eq("course_id", courseId)
        .order("order_index", { ascending: true });

      setLectures((data ?? []) as Lecture[]);
    }

    if (!loadingRole && canManage) loadLectures();
  }, [courseId, loadingRole, canManage]);

  async function loadQuestions() {
    setErr(null);
    setLoading(true);

    try {
      let query = supabase
        .from("mcq_questions")
        .select(
          "id, question_text, correct_index, created_at, course:courses(id,code,name), lecture:lectures(id,title)"
        )
        .order("created_at", { ascending: false })
        .limit(300);

      if (courseId) query = query.eq("course_id", courseId);
      if (lectureId) query = query.eq("lecture_id", lectureId);

      const term = q.trim();
      if (term) query = query.ilike("question_text", `%${term}%`);

      const { data, error } = await query;

      if (error) {
        setErr(`مشكلة في تحميل بنك الأسئلة: ${error.message}`);
        return;
      }

      setRows((data ?? []) as any as QRow[]);
    } finally {
      setLoading(false);
    }
  }

  // ✅ حذف نهائي فقط (Hard delete) — بعد تفعيل CASCADE في DB
  async function remove(id: string) {
    const ok = confirm("تأكيد حذف السؤال نهائيًا؟");
    if (!ok) return;

    const del = await supabase.from("mcq_questions").delete().eq("id", id);

    if (del.error) {
      alert(`الحذف فشل: ${del.error.code ?? ""} ${del.error.message ?? ""}`);
      return;
    }

    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  async function editCorrectAnswer(id: string, current: number) {
    const input = prompt("اكتب رقم الإجابة الصحيحة (0 للأولى، 1 للتانية…)", String(current));
    if (input === null) return;

    const next = Number(input);
    if (!Number.isInteger(next) || next < 0 || next > 10) {
      alert("رقم غير صحيح. لازم يكون رقم صحيح (0..10)");
      return;
    }

    const { error } = await supabase
      .from("mcq_questions")
      .update({ correct_index: next })
      .eq("id", id);

    if (error) {
      alert(`فشل التعديل: ${error.message}`);
      return;
    }

    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, correct_index: next } : r)));
  }

  useEffect(() => {
    if (!canManage) return;
    loadQuestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage]);

  // لو غيرت الفلاتر، يعيد تحميل الأسئلة تلقائيًا
  useEffect(() => {
    if (!canManage) return;
    loadQuestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, lectureId]);

  if (loadingRole) {
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
            <Link className="btn" href="/dashboard">
              رجوع
            </Link>
          </div>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className="container">
        <div className="card">
          <div className="sectionHeader">
            <div className="sectionTitle">
              <h1 style={{ marginBottom: 6 }}>بنك الأسئلة</h1>
              <p className="muted" style={{ marginTop: 0 }}>
                ابحث وفلتر. تقدر تعدّل الإجابة الصح أو تحذف السؤال نهائيًا.
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Link className="btn" href="/admin/mcq/import">
                إضافة (Paste)
              </Link>
              <Link className="btn btn--ghost" href="/admin/mcq">
                رجوع
              </Link>
            </div>
          </div>

          <div className="grid" style={{ marginTop: 12 }}>
            <div className="col-12 col-4">
              <label className="label">المادة</label>
              <select
                className="select"
                value={courseId}
                onChange={(e) => {
                  setCourseId(e.target.value);
                  setLectureId("");
                }}
              >
                <option value="">الكل</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-12 col-4">
              <label className="label">المحاضرة</label>
              <select
                className="select"
                value={lectureId}
                onChange={(e) => setLectureId(e.target.value)}
                disabled={!courseId}
              >
                <option value="">الكل</option>
                {lectures.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-12 col-4">
              <label className="label">بحث في نص السؤال</label>
              <input
                className="input"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="اكتب كلمة…"
              />
            </div>
          </div>

          <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <button className="btn" onClick={loadQuestions} disabled={loading}>
              {loading ? "جاري التحميل…" : "تحديث"}
            </button>

            <span className="pill">{rows.length} سؤال</span>
          </div>

          {err ? (
            <p className="error" style={{ marginTop: 10 }}>
              {err}
            </p>
          ) : null}
        </div>

        <div className="card" style={{ marginTop: 12 }}>
          {rows.length === 0 ? (
            <p className="muted">مفيش أسئلة في الفلتر ده.</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {rows.map((r) => (
                <div key={r.id} className="rowItem">
                  <div style={{ minWidth: 0 }}>
                    <div className="rowTitle" style={{ marginBottom: 4 }}>
                      {r.course ? `${r.course.code}` : "—"}
                      {r.lecture ? ` • ${r.lecture.title}` : ""}
                      {" • "}
                      <span className="muted">Correct: {letterFromIndex(r.correct_index)}</span>
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
                      {r.question_text}
                    </div>

                    <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                      {fmtDate(r.created_at)}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <button className="btn btn--ghost" onClick={() => editCorrectAnswer(r.id, r.correct_index)}>
                      تعديل الإجابة الصح
                    </button>

                    <button className="btn btn--ghost btn--danger" onClick={() => remove(r.id)}>
                      حذف
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </AppShell>
  );
}
