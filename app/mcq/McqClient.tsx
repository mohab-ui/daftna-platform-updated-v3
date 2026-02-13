"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Course = { id: string; code: string; name: string };
type Lecture = { id: string; title: string; order_index: number };

type McqQuestion = {
  id: string;
  question_text: string;
  choices: string[];
  correct_index: number;
  explanation: string | null;
  course_id: string;
  lecture_id: string | null;
  created_at: string;
  lecture: { order_index: number } | null;
};

function letterFromIndex(i: number) {
  return ["A", "B", "C", "D", "E"][i] ?? String(i + 1);
}

export default function McqPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const [courses, setCourses] = useState<Course[]>([]);
  const [lectures, setLectures] = useState<Lecture[]>([]);

  const [courseId, setCourseId] = useState<string>(sp.get("course") ?? "");
  const [lectureId, setLectureId] = useState<string>(sp.get("lecture") ?? "");
  const [mode, setMode] = useState<"practice" | "exam">(
    sp.get("mode") === "exam" ? "exam" : "practice"
  );

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [questions, setQuestions] = useState<McqQuestion[]>([]);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);

  // ✅ جديد: في التدريب نكشف نتيجة كل سؤال بمجرد اختيار الإجابة
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  // ✅ وقت بداية المحاولة
  const [startedAt, setStartedAt] = useState<string | null>(null);

  const current = questions[idx];

  useEffect(() => {
    async function loadCourses() {
      const { data } = await supabase
        .from("courses")
        .select("id, code, name")
        .order("code", { ascending: true });
      setCourses((data ?? []) as Course[]);
    }
    loadCourses();
  }, []);

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
    loadLectures();
  }, [courseId]);

  const canStart = useMemo(() => !!courseId, [courseId]);

  async function start() {
    setErr(null);
    setLoading(true);

    // reset attempt state
    setSubmitted(false);
    setIdx(0);
    setAnswers({});
    setQuestions([]);
    setRevealed({});

    const startIso = new Date().toISOString();
    setStartedAt(startIso);

    try {
      if (!courseId) {
        setErr("اختار المادة الأول.");
        return;
      }

      let q = supabase
        .from("mcq_questions")
        .select(
          "id, question_text, choices, correct_index, explanation, course_id, lecture_id, created_at, lecture:lectures(order_index), is_archived"
        )
        .eq("course_id", courseId);

      // hide archived questions for students (requires migration)
      q = q.eq("is_archived", false);

      if (lectureId) q = q.eq("lecture_id", lectureId);

      let data: any[] | null = null;
      let error: any = null;

      {
        const res = await q.limit(50);
        data = res.data as any;
        error = res.error as any;
      }

      // Backward-compatible fallback if is_archived column doesn't exist yet
      if (error && String(error.message ?? "").includes("is_archived")) {
        let q2 = supabase
          .from("mcq_questions")
          .select(
            "id, question_text, choices, correct_index, explanation, course_id, lecture_id, created_at, lecture:lectures(order_index)"
          )
          .eq("course_id", courseId);

        if (lectureId) q2 = q2.eq("lecture_id", lectureId);

        const res2 = await q2.limit(50);
        data = res2.data as any;
        error = res2.error as any;
      }

      if (error) {
        setErr("في مشكلة في تحميل الأسئلة.");
        return;
      }

      const list = (data ?? []) as McqQuestion[];
      if (!list.length) {
        setErr("مفيش أسئلة متاحة للفلتر ده.");
        return;
      }

            // ✅ عرض الأسئلة بالترتيب (مش عشوائي)
      // - لو مختار محاضرة: بالـ created_at
      // - لو على مستوى المادة: حسب ترتيب المحاضرات ثم created_at
      list.sort((a, b) => {
        const at = new Date(a.created_at).getTime();
        const bt = new Date(b.created_at).getTime();
        if (lectureId) return at - bt;

        const ao = a.lecture?.order_index ?? 9999;
        const bo = b.lecture?.order_index ?? 9999;
        if (ao !== bo) return ao - bo;
        return at - bt;
      });

      setQuestions(list);

      const params = new URLSearchParams();
      params.set("course", courseId);
      if (lectureId) params.set("lecture", lectureId);
      params.set("mode", mode);
      router.replace(`/mcq?${params.toString()}`);
    } finally {
      setLoading(false);
    }
  }

  function choose(choiceIndex: number) {
    if (!current) return;
    if (submitted) return;

    setAnswers((p) => ({ ...p, [current.id]: choiceIndex }));

    // ✅ في التدريب: اول ما يختار، نكشف الصح/الغلط فوراً
    if (mode === "practice") {
      setRevealed((p) => ({ ...p, [current.id]: true }));
    }
  }

  function isRevealedFor(qid: string) {
    return submitted || (mode === "practice" && !!revealed[qid]);
  }

  async function submit() {
    setErr(null);
    if (!questions.length) return;

    const unanswered = questions.filter((q) => answers[q.id] === undefined).length;
    if (unanswered > 0) {
      setErr(`لسه في ${unanswered} سؤال بدون إجابة.`);
      return;
    }

    const correct = questions.filter((q) => answers[q.id] === q.correct_index).length;
    const score = Math.round((correct / questions.length) * 100);

    setSubmitted(true);

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      // ✅ 1) حفظ المحاولة في جدول mcq_quizzes (ده اللي عندك في Supabase)
      const { data: quizRow, error: quizErr } = await supabase
        .from("mcq_quizzes")
        .insert([
          {
            user_id: userData.user.id,
            course_id: courseId,
            lecture_id: lectureId ? lectureId : null,
            mode,
            total_questions: questions.length,
            correct_count: correct,
            score,
            started_at: startedAt ?? new Date().toISOString(),
            submitted_at: new Date().toISOString(),
          },
        ])
        .select("id")
        .single();

      if (quizErr || !quizRow?.id) return;

      const quizId = quizRow.id as string;

      // ✅ 2) حفظ ترتيب الأسئلة
      const quizQuestionsPayload = questions.map((q, i) => ({
        quiz_id: quizId,
        question_id: q.id,
        order_index: i,
      }));

      await supabase.from("mcq_quiz_questions").insert(quizQuestionsPayload);

      // ✅ 3) حفظ إجابات الطالب
      const now = new Date().toISOString();
      const quizAnswersPayload = questions.map((q) => {
        const selected = answers[q.id];
        return {
          quiz_id: quizId,
          question_id: q.id,
          selected_index: selected,
          is_correct: selected === q.correct_index,
          answered_at: now,
        };
      });

      await supabase.from("mcq_quiz_answers").insert(quizAnswersPayload);
    } catch {
      // ignore
    }
  }

  const correctCount = useMemo(
    () => questions.filter((q) => answers[q.id] === q.correct_index).length,
    [questions, answers]
  );

  const progress = useMemo(
    () => (questions.length ? `${idx + 1}/${questions.length}` : "0/0"),
    [idx, questions.length]
  );

  return (
    <AppShell>
      <main className="container">
        <div className="card">
          <div className="sectionHeader">
            <div className="sectionTitle">
              <h1 style={{ marginBottom: 6 }}>اختبارات MCQ</h1>
              <p className="muted" style={{ marginTop: 0 }}>
                اختار المادة/المحاضرة واضغط «ابدأ». تقدر تعمل تدريب أو امتحان.
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <a className="btn btn--ghost" href="/mcq/history">
                سجل المحاولات
              </a>
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
              <label className="label">المحاضرة (اختياري)</label>
              <select
                className="select"
                value={lectureId || ""}
                onChange={(e) => setLectureId(e.target.value)}
                disabled={!courseId}
              >
                <option value="">(كل أسئلة المادة)</option>
                {lectures.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-12 col-6">
              <label className="label">الوضع</label>
              <select className="select" value={mode} onChange={(e) => setMode(e.target.value as any)}>
                <option value="practice">تدريب</option>
                <option value="exam">امتحان</option>
              </select>
            </div>

            <div className="col-12 col-6" style={{ display: "flex", alignItems: "end" }}>
              <button className="btn" onClick={start} disabled={!canStart || loading}>
                {loading ? "جاري التحميل…" : "ابدأ"}
              </button>
            </div>
          </div>

          {err ? (
            <p className="error" style={{ marginTop: 12 }}>
              {err}
            </p>
          ) : null}
        </div>

        {questions.length ? (
          <div className="card" style={{ marginTop: 12 }}>
            <div className="sectionHeader">
              <div className="sectionTitle" style={{ minWidth: 0 }}>
                <div className="rowTitle">
                  سؤال {progress}
                  {submitted ? (
                    <span className="pill" style={{ marginInlineStart: 10 }}>
                      تم التسليم
                    </span>
                  ) : null}
                </div>
                <div className="muted" style={{ fontSize: 13 }}>
                  التقدم: {correctCount} / {questions.length}
                </div>
              </div>

              <div className="kpis">
                <span className="kpi">Mode: {mode === "exam" ? "امتحان" : "تدريب"}</span>
                <span className="kpi">محاضرة: {lectureId ? "محددة" : "كل المادة"}</span>
              </div>
            </div>

            <div className="divider" />

            <div className="muted" style={{ whiteSpace: "pre-wrap", fontSize: 16, lineHeight: 1.8 }}>
              {current?.question_text}
            </div>

            <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
              {current?.choices?.map((c, ci) => {
                const selected = answers[current.id] === ci;
                const isCorrect = ci === current.correct_index;
                const revealedNow = current ? isRevealedFor(current.id) : false;

                const showMarks = revealedNow; // ✅ التدريب: بعد الاختيار، الامتحان: بعد submit
                const cls = [
                  "mcqOption",
                  selected ? "mcqOption--selected" : "",
                  showMarks && isCorrect ? "mcqOption--correct" : "",
                  showMarks && selected && !isCorrect ? "mcqOption--wrong" : "",
                ]
                  .filter(Boolean)
                  .join(" ");

                return (
                  <button key={ci} className={cls} onClick={() => choose(ci)} disabled={submitted}>
                    <span className="mcqOption__letter">{letterFromIndex(ci)}</span>
                    <span className="mcqOption__text">{c}</span>
                  </button>
                );
              })}
            </div>

            {/* ✅ في التدريب: بعد ما يختار يظهر التفسير فوراً */}
            {current && mode === "practice" && isRevealedFor(current.id) ? (
              <div style={{ marginTop: 12 }} className="card card--soft">
                <div className="rowTitle" style={{ fontWeight: 700 }}>
                  {answers[current.id] === current.correct_index ? "✅ إجابة صحيحة" : "❌ إجابة خاطئة"}
                </div>
                {current.explanation ? (
                  <p className="muted" style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>
                    {current.explanation}
                  </p>
                ) : (
                  <p className="muted" style={{ marginTop: 8 }}>
                    (لا يوجد تفسير)
                  </p>
                )}
              </div>
            ) : null}

            <div className="divider" />

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn btn--ghost" onClick={() => setIdx((p) => Math.max(0, p - 1))} disabled={idx === 0}>
                السابق
              </button>
              <button
                className="btn btn--ghost"
                onClick={() => setIdx((p) => Math.min(questions.length - 1, p + 1))}
                disabled={idx >= questions.length - 1}
              >
                التالي
              </button>

              <div style={{ flex: 1 }} />

              <button className="btn" onClick={submit} disabled={submitted}>
                {submitted ? "تم التسليم" : "تسليم"}
              </button>
            </div>
          </div>
        ) : null}
      </main>
    </AppShell>
  );
}
