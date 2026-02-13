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
  course_id: string;
  lecture_id: string | null;
  question_text: string;
  choices: string[];
  correct_index: number;
  explanation: string | null;
  created_at: string;
  // migration adds this column (we keep it optional for backwards compatibility)
  is_archived?: boolean;
  course: { id: string; code: string; name: string } | null;
  lecture: { id: string; title: string } | null;
};

function isFkRestriction(err: any) {
  const code = String(err?.code ?? "");
  const msg = String(err?.message ?? "").toLowerCase();
  return (
    code === "23503" ||
    msg.includes("foreign key") ||
    msg.includes("violates foreign key") ||
    msg.includes("constraint")
  );
}

function isMissingArchiveColumn(err: any) {
  const msg = String(err?.message ?? "");
  return msg.includes("is_archived");
}

export default function AdminMcqQuestionsPage() {
  const [role, setRole] = useState<UserRole | null>(null);
  const [loadingRole, setLoadingRole] = useState(true);

  const [courses, setCourses] = useState<Course[]>([]);
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [courseId, setCourseId] = useState("");
  const [lectureId, setLectureId] = useState("");

  const [q, setQ] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const [rows, setRows] = useState<QRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // edit modal state
  const [editing, setEditing] = useState<QRow | null>(null);
  const [editText, setEditText] = useState("");
  const [editChoices, setEditChoices] = useState<string[]>([]);
  const [editCorrect, setEditCorrect] = useState(0);
  const [editExplanation, setEditExplanation] = useState("");
  const [saving, setSaving] = useState(false);

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
      const term = q.trim();

      // try with is_archived column first
      let query = supabase
        .from("mcq_questions")
        .select(
          "id, course_id, lecture_id, question_text, choices, correct_index, explanation, is_archived, created_at, course:courses(id,code,name), lecture:lectures(id,title)"
        )
        .order("created_at", { ascending: false })
        .limit(300);

      if (courseId) query = query.eq("course_id", courseId);
      if (lectureId) query = query.eq("lecture_id", lectureId);
      if (term) query = query.ilike("question_text", `%${term}%`);

      if (!showArchived) query = query.eq("is_archived", false);

      let { data, error } = await query;

      // fallback if column doesn't exist yet
      if (error && isMissingArchiveColumn(error)) {
        let q2 = supabase
          .from("mcq_questions")
          .select(
            "id, course_id, lecture_id, question_text, choices, correct_index, explanation, created_at, course:courses(id,code,name), lecture:lectures(id,title)"
          )
          .order("created_at", { ascending: false })
          .limit(300);

        if (courseId) q2 = q2.eq("course_id", courseId);
        if (lectureId) q2 = q2.eq("lecture_id", lectureId);
        if (term) q2 = q2.ilike("question_text", `%${term}%`);

        const res2 = await q2;
        data = res2.data as any;
        error = res2.error as any;

        if (!error) {
          setErr("تنبيه: علشان تقدر «إخفاء بدل حذف» لازم تشغّل ملف migrate_mcq_archive.sql في Supabase.");
        }
      }

      if (error) {
        setErr("مشكلة في تحميل بنك الأسئلة. تأكد إن MCQ migration متنفّذ.");
        return;
      }

      setRows((data ?? []) as any as QRow[]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!canManage) return;
    loadQuestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage]);

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

  function openEdit(r: QRow) {
    setEditing(r);
    setEditText(r.question_text ?? "");
    setEditChoices(Array.isArray(r.choices) ? [...r.choices] : []);
    setEditCorrect(Number.isFinite(r.correct_index) ? r.correct_index : 0);
    setEditExplanation(r.explanation ?? "");
    setErr(null);
  }

  function closeEdit() {
    setEditing(null);
    setEditText("");
    setEditChoices([]);
    setEditCorrect(0);
    setEditExplanation("");
  }

  async function saveEdit() {
    if (!editing) return;

    const qt = editText.trim();
    const choices = editChoices.map((c) => c.trim()).filter(Boolean);

    if (!qt) {
      alert("اكتب نص السؤال.");
      return;
    }
    if (choices.length < 2) {
      alert("اكتب اختيارات كفاية (على الأقل اختيارين).");
      return;
    }

    const ci = Math.min(Math.max(0, editCorrect), choices.length - 1);

    setSaving(true);
    try {
      const { error } = await supabase
        .from("mcq_questions")
        .update({
          question_text: qt,
          choices,
          correct_index: ci,
          explanation: editExplanation.trim() ? editExplanation.trim() : null,
        })
        .eq("id", editing.id);

      if (error) {
        alert("فشل تعديل السؤال. تأكد إنك مشرف وإن الـ RLS مضبوط.");
        return;
      }

      setRows((prev) =>
        prev.map((r) =>
          r.id === editing.id
            ? {
                ...r,
                question_text: qt,
                choices,
                correct_index: ci,
                explanation: editExplanation.trim() ? editExplanation.trim() : null,
              }
            : r
        )
      );

      closeEdit();
    } finally {
      setSaving(false);
    }
  }

  async function toggleArchive(r: QRow, next: boolean) {
    const { error } = await supabase
      .from("mcq_questions")
      .update({ is_archived: next })
      .eq("id", r.id);

    if (error) {
      if (isMissingArchiveColumn(error)) {
        alert("لازم تشغّل migrate_mcq_archive.sql في Supabase الأول.");
      } else {
        alert("فشل تغيير حالة السؤال. تأكد من الصلاحيات.");
      }
      return;
    }

    setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, is_archived: next } : x)));
  }

  async function remove(r: QRow) {
    const ok = confirm("تأكيد حذف السؤال؟ (لو السؤال داخل محاولات قديمة، هنخفيه عن الطلاب بدل الحذف النهائي)");
    if (!ok) return;

    const { error } = await supabase.from("mcq_questions").delete().eq("id", r.id);

    if (!error) {
      setRows((prev) => prev.filter((x) => x.id !== r.id));
      return;
    }

    // FK restriction -> archive instead
    if (isFkRestriction(error)) {
      const { error: archErr } = await supabase
        .from("mcq_questions")
        .update({ is_archived: true })
        .eq("id", r.id);

      if (archErr) {
        if (isMissingArchiveColumn(archErr)) {
          alert(
            "السؤال مرتبط بمحاولات قديمة، ومش هينفع يتحذف. علشان تعمل «إخفاء» شغّل migrate_mcq_archive.sql في Supabase."
          );
        } else {
          alert("السؤال مرتبط بمحاولات قديمة، وفشلنا نخفيه. راجع RLS وسياسات MCQ.");
        }
        return;
      }

      setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, is_archived: true } : x)));
      alert("السؤال مرتبط بمحاولات قديمة، فتم إخفاؤه عن الطلاب بدل الحذف النهائي ✅");
      return;
    }

    // permission / other
    const msg = String(error?.message ?? "");
    alert(msg ? `فشل حذف السؤال: ${msg}` : "فشل حذف السؤال. تأكد من الصلاحيات.");
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
                ابحث وفلتر. تقدر تعدّل الإجابة/الاختيارات أو تحذف/تخفي الأسئلة.
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

            <label className="pill" style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
                style={{ transform: "translateY(1px)" }}
              />
              <span>إظهار المؤرشف</span>
            </label>

            <span className="pill">{rows.length} سؤال</span>
          </div>

          {err ? (
            <p className={err.startsWith("تنبيه:") ? "muted" : "error"} style={{ marginTop: 10 }}>
              {err}
            </p>
          ) : null}
        </div>

        <div className="card" style={{ marginTop: 12 }}>
          {rows.length === 0 ? (
            <p className="muted">مفيش أسئلة في الفلتر ده.</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {rows.map((r) => {
                const archived = !!r.is_archived;
                return (
                  <div key={r.id} className="rowItem" style={archived ? { opacity: 0.72 } : undefined}>
                    <div style={{ minWidth: 0 }}>
                      <div className="rowTitle" style={{ marginBottom: 4, display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <span>
                          {r.course ? `${r.course.code}` : "—"}
                          {r.lecture ? ` • ${r.lecture.title}` : ""}
                          {" • "}
                          <span className="muted">Correct: {letterFromIndex(r.correct_index)}</span>
                        </span>

                        {archived ? <span className="pill">مؤرشف</span> : null}
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
                      <button className="btn btn--ghost" onClick={() => openEdit(r)}>
                        تعديل
                      </button>

                      {archived ? (
                        <button className="btn btn--ghost" onClick={() => toggleArchive(r, false)}>
                          إلغاء الإخفاء
                        </button>
                      ) : (
                        <button className="btn btn--ghost" onClick={() => toggleArchive(r, true)}>
                          إخفاء
                        </button>
                      )}

                      <button className="btn btn--ghost" onClick={() => remove(r)}>
                        حذف
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Edit modal */}
        {editing ? (
          <div
            className="modalOverlay"
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,.55)",
              zIndex: 60,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 16,
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) closeEdit();
            }}
          >
            <div className="card" style={{ width: "min(860px, 100%)" }}>
              <div className="sectionHeader">
                <div className="sectionTitle">
                  <h2 style={{ margin: 0 }}>تعديل سؤال</h2>
                  <p className="muted" style={{ marginTop: 6 }}>
                    عدّل نص السؤال/الاختيارات/الإجابة الصحيحة.
                  </p>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn--ghost" onClick={closeEdit} disabled={saving}>
                    إغلاق
                  </button>
                </div>
              </div>

              <label className="label">نص السؤال</label>
              <textarea
                className="textarea"
                rows={3}
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                placeholder="اكتب السؤال…"
              />

              <div style={{ height: 10 }} />

              <label className="label">الاختيارات</label>
              <div style={{ display: "grid", gap: 8 }}>
                {editChoices.map((c, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span className="pill" style={{ minWidth: 42, textAlign: "center" }}>
                      {letterFromIndex(i)}
                    </span>
                    <input
                      className="input"
                      value={c}
                      onChange={(e) => {
                        const v = e.target.value;
                        setEditChoices((p) => p.map((x, idx) => (idx === i ? v : x)));
                      }}
                      placeholder={`الاختيار ${letterFromIndex(i)}`}
                    />
                    <button
                      className="btn btn--ghost"
                      onClick={() => {
                        setEditChoices((p) => p.filter((_, idx) => idx !== i));
                        setEditCorrect((prev) => (prev === i ? 0 : prev > i ? prev - 1 : prev));
                      }}
                      disabled={saving || editChoices.length <= 2}
                      title={editChoices.length <= 2 ? "لازم على الأقل اختيارين" : "حذف اختيار"}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  className="btn btn--ghost"
                  onClick={() => setEditChoices((p) => [...p, ""])}
                  disabled={saving || editChoices.length >= 6}
                >
                  + إضافة اختيار
                </button>

                <div style={{ flex: 1 }} />

                <div style={{ minWidth: 220 }}>
                  <label className="label">الإجابة الصحيحة</label>
                  <select
                    className="select"
                    value={String(editCorrect)}
                    onChange={(e) => setEditCorrect(Number(e.target.value))}
                    disabled={saving}
                  >
                    {editChoices.map((_, i) => (
                      <option key={i} value={String(i)}>
                        {letterFromIndex(i)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ height: 10 }} />

              <label className="label">شرح/تعليل (اختياري)</label>
              <textarea
                className="textarea"
                rows={3}
                value={editExplanation}
                onChange={(e) => setEditExplanation(e.target.value)}
                placeholder="لو حابب تكتب شرح…"
              />

              <div style={{ height: 14 }} />

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button className="btn btn--ghost" onClick={closeEdit} disabled={saving}>
                  إلغاء
                </button>
                <button className="btn" onClick={saveEdit} disabled={saving}>
                  {saving ? "جاري الحفظ…" : "حفظ التعديل"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </AppShell>
  );
}
