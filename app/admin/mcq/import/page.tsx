"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { supabase } from "@/lib/supabase";
import { getMyProfile, isModerator, UserRole } from "@/lib/profile";
import { DraftQuestion, parseMcqText, letterFromIndex } from "@/lib/mcqParse";

type Course = { id: string; code: string; name: string };

// ✅ أضفنا kind + formative_no علشان نفرّق فورماتيف
type Lecture = {
  id: string;
  title: string;
  order_index: number;
  kind?: string; // 'lecture' | 'formative'
  formative_no?: number | null;
};

type Draft = DraftQuestion & {
  correctIndex: number | null;
  explanation?: string;
};

function isFormative(l: Lecture) {
  return (l.kind ?? "lecture") === "formative";
}

function formativeLabel(l: Lecture) {
  const no = (l.formative_no ?? l.order_index) as number;
  return `فورماتيف ${no}`;
}

export default function AdminMcqImportPage() {
  const [role, setRole] = useState<UserRole | null>(null);
  const [loadingRole, setLoadingRole] = useState(true);

  const [courses, setCourses] = useState<Course[]>([]);
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [courseId, setCourseId] = useState("");
  const [lectureId, setLectureId] = useState<string>("");

  const [raw, setRaw] = useState("");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
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

  // Load dropdown data only after we know permissions
  useEffect(() => {
    async function loadCourses() {
      const { data, error } = await supabase
        .from("courses")
        .select("id, code, name")
        .order("code", { ascending: true });

      if (!error) setCourses((data ?? []) as Course[]);
    }

    if (!loadingRole && canManage) loadCourses();
  }, [loadingRole, canManage]);

  useEffect(() => {
    async function loadLectures() {
      setLectures([]);
      if (!courseId) return;

      // ✅ هنا التعديل الأساسي: kind + formative_no
      const { data, error } = await supabase
        .from("lectures")
        .select("id, title, order_index, kind, formative_no")
        .eq("course_id", courseId)
        .order("order_index", { ascending: true });

      if (error) {
        setErr("مشكلة في تحميل المحاضرات/الفورماتيف. تأكد إنك شغّلت SQL بتاع kind/formative_no.");
        return;
      }

      setLectures((data ?? []) as Lecture[]);
    }

    if (!loadingRole && canManage) loadLectures();
  }, [courseId, loadingRole, canManage]);

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

  function parse() {
    setErr(null);
    setInfo(null);

    if (!courseId) {
      setErr("اختار المادة الأول.");
      return;
    }

    const list = parseMcqText(raw);
    if (list.length === 0) {
      setErr("مش لاقي أسئلة في النص. جرّب تنسيق زي: 1) سؤال ثم A) ... B) ...");
      return;
    }

    const merged: Draft[] = list.map((q) => ({
      ...q,
      correctIndex:
        typeof q.detectedCorrect === "number" && q.detectedCorrect >= 0
          ? q.detectedCorrect
          : null,
      explanation: "",
    }));

    setDrafts(merged);
    const needs = merged.filter((d) => d.needsReview).length;
    setInfo(
      `تم استخراج ${merged.length} سؤال. ${
        needs ? `(${needs} محتاج مراجعة بسيطة)` : ""
      }`
    );
  }

  function setCorrect(qi: number, ci: number) {
    setDrafts((prev) =>
      prev.map((d, i) => (i === qi ? { ...d, correctIndex: ci } : d))
    );
  }

  function setExplanation(qi: number, val: string) {
    setDrafts((prev) =>
      prev.map((d, i) => (i === qi ? { ...d, explanation: val } : d))
    );
  }

  async function saveAll() {
    setErr(null);
    setInfo(null);

    if (!courseId) {
      setErr("اختار المادة الأول.");
      return;
    }
    if (drafts.length === 0) {
      setErr("مفيش أسئلة محفوظة في الـ Preview. اضغط «تحويل» الأول.");
      return;
    }

    // Validate
    const bad = drafts.find(
      (d) => d.correctIndex === null || d.correctIndex === undefined || d.correctIndex < 0
    );
    if (bad) {
      setErr("في أسئلة لسه ما اخترتش الإجابة الصحيحة بتاعتها. اختار A/B/C/D لكل سؤال.");
      return;
    }

    const { data: userData, error: uErr } = await supabase.auth.getUser();
    if (uErr || !userData.user) {
      setErr("لازم تسجل دخول.");
      return;
    }

    setSaving(true);
    try {
      const payload = drafts.map((d) => ({
        course_id: courseId,
        lecture_id: lectureId ? lectureId : null, // ✅ يقدر يكون فورماتيف
        question_text: d.question,
        choices: d.choices,
        correct_index: d.correctIndex!,
        explanation: d.explanation?.trim() ? d.explanation.trim() : null,
        created_by: userData.user!.id,
      }));

      const { error } = await supabase.from("mcq_questions").insert(payload);
      if (error) {
        setErr(`مشكلة في حفظ الأسئلة: ${error.message}`);
        return;
      }

      setInfo(`تم حفظ ${payload.length} سؤال ✅`);
      setRaw("");
      setDrafts([]);
    } finally {
      setSaving(false);
    }
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

  const lecturesOnly = lectures
    .filter((l) => !isFormative(l))
    .sort((a, b) => a.order_index - b.order_index);

  const formativesOnly = lectures
    .filter((l) => isFormative(l))
    .sort(
      (a, b) =>
        ((a.formative_no ?? a.order_index) as number) -
        ((b.formative_no ?? b.order_index) as number)
    );

  return (
    <AppShell>
      <main className="container">
        <div className="card">
          <div className="sectionHeader">
            <div className="sectionTitle">
              <h1 style={{ marginBottom: 6 }}>استيراد سريع لأسئلة MCQ</h1>
              <p className="muted" style={{ marginTop: 0 }}>
                الصق الأسئلة كنص (مع الاختيارات). الموقع هيقسّمها، وإنت تختار الصح وتعمل حفظ دفعة واحدة.
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Link className="btn btn--ghost" href="/admin/mcq">
                رجوع
              </Link>
              <Link className="btn btn--ghost" href="/admin/mcq/questions">
                بنك الأسئلة
              </Link>
            </div>
          </div>

          <div className="grid" style={{ marginTop: 12 }}>
            <div className="col-12 col-6">
              <label className="label">المادة</label>
              <select
                className="select"
                value={courseId}
                onChange={(e) => {
                  setCourseId(e.target.value);
                  setLectureId("");
                  setDrafts([]);
                  setInfo(null);
                  setErr(null);
                }}
              >
                <option value="">اختر مادة…</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-12 col-6">
              <label className="label">المحاضرة / فورماتيف (اختياري)</label>
              <select
                className="select"
                value={lectureId || ""}
                onChange={(e) => setLectureId(e.target.value)}
                disabled={!courseId}
              >
                <option value="">(عام للمادة)</option>

                <optgroup label="المحاضرات">
                  {lecturesOnly.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.title}
                    </option>
                  ))}
                </optgroup>

                <optgroup label="الفورماتيف">
                  {formativesOnly.map((l) => (
                    <option key={l.id} value={l.id}>
                      {formativeLabel(l)}
                    </option>
                  ))}
                </optgroup>
              </select>

              {!courseId ? (
                <p className="muted" style={{ marginTop: 6 }}>
                  اختار مادة الأول علشان تظهر المحاضرات والفورماتيف.
                </p>
              ) : null}
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <label className="label">نص الأسئلة</label>
            <textarea
              className="textarea"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder={`مثال:\n1) What is ...?\nA) ...\nB) ...\nC) ...\nD) ...\n\n2) ...`}
              rows={10}
            />
          </div>

          <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn" onClick={parse}>
              تحويل النص لأسئلة
            </button>
            <button
              className="btn btn--ghost"
              onClick={() => {
                setDrafts([]);
                setInfo(null);
                setErr(null);
              }}
            >
              مسح الـ Preview
            </button>
            <button className="btn" onClick={saveAll} disabled={saving || drafts.length === 0}>
              {saving ? "جاري الحفظ…" : `حفظ (${drafts.length}) سؤال`}
            </button>
          </div>

          {info ? (
            <p className="muted" style={{ marginTop: 10 }}>
              {info}
            </p>
          ) : null}
          {err ? (
            <p className="error" style={{ marginTop: 10 }}>
              {err}
            </p>
          ) : null}
        </div>

        {drafts.length ? (
          <div className="card" style={{ marginTop: 12 }}>
            <div className="sectionHeader">
              <div className="sectionTitle">
                <h2 style={{ marginBottom: 6 }}>Preview</h2>
                <p className="muted" style={{ marginTop: 0 }}>
                  اضغط على الاختيار الصحيح (A/B/C/D). الأسئلة اللي محتاجة مراجعة عليها علامة.
                </p>
              </div>

              <div className="kpis">
                <span className="kpi">الإجمالي: {drafts.length}</span>
                <span className="kpi">
                  بدون إجابة: {drafts.filter((d) => d.correctIndex === null).length}
                </span>
                <span className="kpi">Needs review: {drafts.filter((d) => d.needsReview).length}</span>
              </div>
            </div>

            <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
              {drafts.map((d, qi) => (
                <div key={qi} className="card card--soft">
                  <div className="sectionHeader">
                    <div className="sectionTitle" style={{ minWidth: 0 }}>
                      <h3 style={{ marginBottom: 6 }}>
                        سؤال {qi + 1}{" "}
                        {d.needsReview ? (
                          <span
                            className="pill"
                            style={{
                              borderColor: "rgba(255,106,106,.7)",
                              color: "rgba(255,106,106,.95)",
                            }}
                          >
                            Review
                          </span>
                        ) : null}
                      </h3>
                      <div className="muted" style={{ whiteSpace: "pre-wrap" }}>
                        {d.question}
                      </div>
                    </div>

                    <div className="kpis">
                      <span className="kpi">{d.choices.length} اختيارات</span>
                      <span className="kpi">
                        Correct: {d.correctIndex !== null ? letterFromIndex(d.correctIndex) : "—"}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                    {d.choices.map((c, ci) => {
                      const selected = d.correctIndex === ci;
                      return (
                        <button
                          key={ci}
                          className={[
                            "mcqOption",
                            selected ? "mcqOption--correct mcqOption--selected" : "",
                          ].join(" ")}
                          onClick={() => setCorrect(qi, ci)}
                        >
                          <span className="mcqOption__letter">{letterFromIndex(ci)}</span>
                          <span className="mcqOption__text">{c}</span>
                          {selected ? (
                            <span className="mcqTag mcqTag--ok">Correct</span>
                          ) : (
                            <span className="mcqTag">اختر</span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <div style={{ marginTop: 10 }}>
                    <label className="label">شرح (اختياري)</label>
                    <textarea
                      className="textarea"
                      rows={3}
                      value={d.explanation ?? ""}
                      onChange={(e) => setExplanation(qi, e.target.value)}
                      placeholder="اكتب شرح الإجابة أو نقطة سريعة…"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="divider" />

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn" onClick={saveAll} disabled={saving}>
                {saving ? "جاري الحفظ…" : "حفظ كل الأسئلة"}
              </button>
              <Link className="btn btn--ghost" href="/admin/mcq/questions">
                فتح بنك الأسئلة
              </Link>
            </div>
          </div>
        ) : null}
      </main>
    </AppShell>
  );
}
