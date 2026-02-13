"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Course = { id: string; code: string; name: string };

type Lecture = {
  id: string;
  title: string;
  order_index: number;
  kind?: string; // 'lecture' | 'formative'
  formative_no?: number | null;
};

type McqQuestion = {
  id: string;
  question_text: string;
  choices: string[];
  correct_index: number;
  explanation: string | null;
  course_id: string;
  lecture_id: string | null;
  created_at?: string;
};

type GroupMode = "all" | "lectures" | "formatives" | "mixed";

function letterFromIndex(i: number) {
  return ["A", "B", "C", "D", "E", "F"][i] ?? String(i + 1);
}

function isFormative(l: Lecture) {
  return (l.kind ?? "lecture") === "formative";
}

function formativeLabel(l: Lecture) {
  const no = (l.formative_no ?? l.order_index) as number;
  return `فورماتيف ${no}`;
}

export default function McqClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const [courses, setCourses] = useState<Course[]>([]);
  const [lectures, setLectures] = useState<Lecture[]>([]);

  const [courseId, setCourseId] = useState<string>(sp.get("course") ?? "");

  const [group, setGroup] = useState<GroupMode>(
    (sp.get("group") as GroupMode) ?? "all"
  );

  const [selectedLectureIds, setSelectedLectureIds] = useState<string[]>(
    () => (sp.get("lectures") ? sp.get("lectures")!.split(",").filter(Boolean) : [])
  );
  const [selectedFormativeIds, setSelectedFormativeIds] = useState<string[]>(
    () => (sp.get("formatives") ? sp.get("formatives")!.split(",").filter(Boolean) : [])
  );

  const [includeGeneral, setIncludeGeneral] = useState<boolean>(sp.get("general") === "1");

  const [count, setCount] = useState<number>(() => {
    const n = Number(sp.get("count") ?? 50);
    return Number.isFinite(n) ? Math.min(Math.max(n, 5), 200) : 50;
  });

  const [shuffle, setShuffle] = useState<boolean>(() => (sp.get("shuffle") === "0" ? false : true));
  const [mode, setMode] = useState<"practice" | "exam">(sp.get("mode") === "exam" ? "exam" : "practice");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [questions, setQuestions] = useState<McqQuestion[]>([]);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);

  // في التدريب: نكشف نتيجة السؤال فورًا بعد الاختيار
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  const current = questions[idx];

  // 1) تحميل المواد
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("courses")
        .select("id, code, name")
        .order("code", { ascending: true });

      setCourses((data ?? []) as Course[]);
    })();
  }, []);

  // 2) تحميل محاضرات + فورماتيف للمادة
  useEffect(() => {
    (async () => {
      setLectures([]);
      if (!courseId) return;

      const { data, error } = await supabase
        .from("lectures")
        .select("id, title, order_index, kind, formative_no")
        .eq("course_id", courseId)
        .order("order_index", { ascending: true });

      if (error) {
        setErr("في مشكلة في تحميل المحاضرات/الفورماتيف. شغّل SQL بتاع kind/formative_no.");
        return;
      }

      setLectures((data ?? []) as Lecture[]);
    })();
  }, [courseId]);

  const lecturesOnly = useMemo(() => {
    return lectures
      .filter((l) => !isFormative(l))
      .sort((a, b) => a.order_index - b.order_index);
  }, [lectures]);

  const formativesOnly = useMemo(() => {
    return lectures
      .filter((l) => isFormative(l))
      .sort((a, b) => ((a.formative_no ?? a.order_index) as number) - ((b.formative_no ?? b.order_index) as number));
  }, [lectures]);

  const selectedIds = useMemo(() => {
    if (group === "lectures") return selectedLectureIds;
    if (group === "formatives") return selectedFormativeIds;
    if (group === "mixed") return [...selectedLectureIds, ...selectedFormativeIds];
    return [];
  }, [group, selectedLectureIds, selectedFormativeIds]);

  const canStart = useMemo(() => {
    if (!courseId) return false;
    if (group === "all") return true;
    return selectedIds.length > 0;
  }, [courseId, group, selectedIds.length]);

  const selectionLabel = useMemo(() => {
    if (group === "all") return "كل المادة";
    const titleOf = (id: string) => {
      const l = lectures.find((x) => x.id === id);
      if (!l) return id;
      return isFormative(l) ? formativeLabel(l) : l.title;
    };
    const join = (ids: string[]) => ids.map(titleOf).join(" + ");

    if (group === "lectures") return `محاضرات: ${join(selectedLectureIds)}`;
    if (group === "formatives") return `فورماتيف: ${join(selectedFormativeIds)}`;
    return `مخصص: ${join(selectedIds)}`;
  }, [group, lectures, selectedLectureIds, selectedFormativeIds, selectedIds]);

  function resetAttempt() {
    setErr(null);
    setQuestions([]);
    setIdx(0);
    setAnswers({});
    setSubmitted(false);
    setRevealed({});
  }

  async function start() {
    setErr(null);
    setLoading(true);
    resetAttempt();

    try {
      if (!courseId) {
        setErr("اختار المادة الأول.");
        return;
      }

      let q = supabase
        .from("mcq_questions")
        .select("id, question_text, choices, correct_index, explanation, course_id, lecture_id, created_at")
        .eq("course_id", courseId);

      if (group !== "all") {
        if (!selectedIds.length) {
          setErr("اختار محاضرة/فورماتيف واحد على الأقل.");
          return;
        }

        if (includeGeneral) {
          const list = selectedIds.join(",");
          // lecture_id in (...) OR lecture_id is null
          q = q.or(`lecture_id.in.(${list}),lecture_id.is.null`);
        } else {
          q = q.in("lecture_id", selectedIds);
        }
      }

      // ترتيب ثابت ثم نعمل shuffle لو مطلوب
      q = q.order("created_at", { ascending: true });

      const { data, error } = await q.limit(count);
      if (error) {
        setErr(`مشكلة في تحميل الأسئلة: ${error.message}`);
        return;
      }

      const list = (data ?? []) as McqQuestion[];
      if (!list.length) {
        setErr("مفيش أسئلة للفلتر ده. (جرّب تختار فورماتيف/محاضرة تانية أو تلغي الفلترة)");
        return;
      }

      if (shuffle) list.sort(() => Math.random() - 0.5);
      setQuestions(list);

      // حفظ الفلاتر في الرابط
      const params = new URLSearchParams();
      params.set("course", courseId);
      params.set("group", group);

      if (group === "lectures" || group === "mixed") {
        if (selectedLectureIds.length) params.set("lectures", selectedLectureIds.join(","));
      }
      if (group === "formatives" || group === "mixed") {
        if (selectedFormativeIds.length) params.set("formatives", selectedFormativeIds.join(","));
      }
      if (group !== "all" && includeGeneral) params.set("general", "1");

      params.set("count", String(count));
      params.set("shuffle", shuffle ? "1" : "0");
      params.set("mode", mode);

      router.replace(`/mcq?${params.toString()}`);
    } finally {
      setLoading(false);
    }
  }

  function choose(choiceIndex: number) {
    if (!current || submitted) return;

    setAnswers((p) => ({ ...p, [current.id]: choiceIndex }));

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

    // حفظ المحاولة (لو ماعندكش الجداول/الأعمدة مش هنبوّظ الامتحان، بس التاريخ ممكن مايتسجلش)
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const idsForQuiz = group === "all" ? [] : selectedIds;
      const lectureIdForQuiz = idsForQuiz.length === 1 ? idsForQuiz[0] : null;

      const baseRow: any = {
        user_id: userData.user.id,
        course_id: courseId,
        lecture_id: lectureIdForQuiz,
        mode,
        total_questions: questions.length,
        correct_count: correct,
        score,
        started_at: new Date().toISOString(),
        submitted_at: new Date().toISOString(),
      };

      // محاولة 1: نحط selection لو موجود
      let quizId: string | null = null;

      const try1 = await supabase
        .from("mcq_quizzes")
        .insert([{ ...baseRow, selection: selectionLabel }])
        .select("id")
        .single();

      if (!try1.error && try1.data?.id) {
        quizId = try1.data.id as string;
      } else {
        // لو العمود selection مش موجود، جرّب بدونها
        const try2 = await supabase
          .from("mcq_quizzes")
          .insert([baseRow])
          .select("id")
          .single();

        if (!try2.error && try2.data?.id) quizId = try2.data.id as string;
      }

      if (!quizId) return;

      // ترتيب الأسئلة
      await supabase.from("mcq_quiz_questions").insert(
        questions.map((q, i) => ({ quiz_id: quizId!, question_id: q.id, order_index: i }))
      );

      // إجابات الطالب
      const now = new Date().toISOString();
      await supabase.from("mcq_quiz_answers").insert(
        questions.map((q) => ({
          quiz_id: quizId!,
          question_id: q.id,
          selected_index: answers[q.id],
          is_correct: answers[q.id] === q.correct_index,
          answered_at: now,
        }))
      );
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
        {/* اختيار الفلاتر */}
        <div className="card">
          <div className="sectionHeader">
            <div className="sectionTitle">
              <h1 style={{ marginBottom: 6 }}>اختبارات MCQ</h1>
              <p className="muted" style={{ marginTop: 0 }}>
                اختار المادة → (محاضرات/فورماتيف/مخصص) → اختار أكتر من واحد → ابدأ.
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <a className="btn btn--ghost" href="/mcq/history">سجل المحاولات</a>
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
                  setGroup("all");
                  setSelectedLectureIds([]);
                  setSelectedFormativeIds([]);
                  setIncludeGeneral(false);
                  resetAttempt();
                }}
              >
                <option value="">اختر مادة…</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                ))}
              </select>
            </div>

            <div className="col-12 col-6">
              <label className="label">النطاق</label>
              <select
                className="select"
                value={group}
                onChange={(e) => {
                  const v = e.target.value as GroupMode;
                  setGroup(v);
                  if (v === "all") {
                    setSelectedLectureIds([]);
                    setSelectedFormativeIds([]);
                  }
                  resetAttempt();
                }}
                disabled={!courseId}
              >
                <option value="all">كل أسئلة المادة</option>
                <option value="lectures">محاضرات (اختيار متعدد)</option>
                <option value="formatives">فورماتيف (اختيار متعدد)</option>
                <option value="mixed">مخصص (محاضرات + فورماتيف)</option>
              </select>
            </div>

            {courseId && group !== "all" ? (
              <div className="col-12">
                <div className="card card--soft" style={{ marginTop: 6 }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <label className="pill" style={{ display: "inline-flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={includeGeneral}
                        onChange={(e) => setIncludeGeneral(e.target.checked)}
                        style={{ accentColor: "currentColor" }}
                      />
                      ضم الأسئلة العامة للمادة
                    </label>
                    <span className="pill">مختار: {selectedIds.length}</span>
                  </div>

                  {(group === "lectures" || group === "mixed") ? (
                    <div style={{ marginTop: 12 }}>
                      <div className="rowTitle" style={{ marginBottom: 8 }}>المحاضرات</div>

                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                        <button className="btn btn--ghost" type="button" onClick={() => setSelectedLectureIds(lecturesOnly.map((x) => x.id))}>
                          اختيار الكل
                        </button>
                        <button className="btn btn--ghost" type="button" onClick={() => setSelectedLectureIds([])}>
                          مسح
                        </button>
                      </div>

                      <div style={{ display: "grid", gap: 6, maxHeight: 220, overflow: "auto", paddingInlineEnd: 4 }}>
                        {lecturesOnly.map((l) => (
                          <label key={l.id} className="pill" style={{ display: "flex", gap: 10, alignItems: "center", cursor: "pointer" }}>
                            <input
                              type="checkbox"
                              checked={selectedLectureIds.includes(l.id)}
                              onChange={(e) => {
                                const on = e.target.checked;
                                setSelectedLectureIds((prev) =>
                                  on ? Array.from(new Set([...prev, l.id])) : prev.filter((x) => x !== l.id)
                                );
                              }}
                              style={{ accentColor: "currentColor" }}
                            />
                            <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {l.title}
                            </span>
                          </label>
                        ))}
                        {lecturesOnly.length === 0 ? <p className="muted">مفيش محاضرات للمادة دي.</p> : null}
                      </div>
                    </div>
                  ) : null}

                  {(group === "formatives" || group === "mixed") ? (
                    <div style={{ marginTop: 12 }}>
                      <div className="rowTitle" style={{ marginBottom: 8 }}>الفورماتيف</div>

                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                        <button className="btn btn--ghost" type="button" onClick={() => setSelectedFormativeIds(formativesOnly.map((x) => x.id))}>
                          اختيار الكل
                        </button>
                        <button className="btn btn--ghost" type="button" onClick={() => setSelectedFormativeIds([])}>
                          مسح
                        </button>
                      </div>

                      <div style={{ display: "grid", gap: 6, maxHeight: 220, overflow: "auto", paddingInlineEnd: 4 }}>
                        {formativesOnly.map((l) => (
                          <label key={l.id} className="pill" style={{ display: "flex", gap: 10, alignItems: "center", cursor: "pointer" }}>
                            <input
                              type="checkbox"
                              checked={selectedFormativeIds.includes(l.id)}
                              onChange={(e) => {
                                const on = e.target.checked;
                                setSelectedFormativeIds((prev) =>
                                  on ? Array.from(new Set([...prev, l.id])) : prev.filter((x) => x !== l.id)
                                );
                              }}
                              style={{ accentColor: "currentColor" }}
                            />
                            <span>{formativeLabel(l)}</span>
                          </label>
                        ))}
                        {formativesOnly.length === 0 ? <p className="muted">مفيش فورماتيف للمادة دي.</p> : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="col-12 col-6">
              <label className="label">الوضع</label>
              <select className="select" value={mode} onChange={(e) => setMode(e.target.value as any)}>
                <option value="practice">تدريب</option>
                <option value="exam">امتحان</option>
              </select>
            </div>

            <div className="col-12 col-3">
              <label className="label">عدد الأسئلة</label>
              <select className="select" value={String(count)} onChange={(e) => setCount(Number(e.target.value))}>
                {[10, 20, 30, 50, 75, 100].map((n) => (
                  <option key={n} value={String(n)}>{n}</option>
                ))}
              </select>
            </div>

            <div className="col-12 col-3">
              <label className="label">الترتيب</label>
              <select className="select" value={shuffle ? "shuffle" : "ordered"} onChange={(e) => setShuffle(e.target.value === "shuffle")}>
                <option value="shuffle">عشوائي</option>
                <option value="ordered">بالترتيب</option>
              </select>
            </div>

            <div className="col-12 col-6" style={{ display: "flex", alignItems: "end" }}>
              <button className="btn" onClick={start} disabled={!canStart || loading}>
                {loading ? "جاري التحميل…" : "ابدأ"}
              </button>
            </div>
          </div>

          {err ? <p className="error" style={{ marginTop: 12 }}>{err}</p> : null}
        </div>

        {/* الامتحان */}
        {questions.length ? (
          <div className="card" style={{ marginTop: 12 }}>
            <div className="sectionHeader">
              <div className="sectionTitle" style={{ minWidth: 0 }}>
                <div className="rowTitle">
                  سؤال {progress}
                  {submitted ? <span className="pill" style={{ marginInlineStart: 10 }}>تم التسليم</span> : null}
                </div>
                <div className="muted" style={{ fontSize: 13 }}>
                  التقدم: {correctCount} / {questions.length} — النطاق: {selectionLabel}
                </div>
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
                const showMarks = current ? isRevealedFor(current.id) : false;

                const cls = [
                  "mcqOption",
                  selected ? "mcqOption--selected" : "",
                  showMarks && isCorrect ? "mcqOption--correct" : "",
                  showMarks && selected && !isCorrect ? "mcqOption--wrong" : "",
                ].filter(Boolean).join(" ");

                return (
                  <button key={ci} className={cls} onClick={() => choose(ci)} disabled={submitted}>
                    <span className="mcqOption__letter">{letterFromIndex(ci)}</span>
                    <span className="mcqOption__text">{c}</span>
                  </button>
                );
              })}
            </div>

            {current && mode === "practice" && isRevealedFor(current.id) ? (
              <div style={{ marginTop: 12 }} className="card card--soft">
                <div className="rowTitle" style={{ fontWeight: 700 }}>
                  {answers[current.id] === current.correct_index ? "✅ إجابة صحيحة" : "❌ إجابة خاطئة"}
                </div>
                {current.explanation ? (
                  <p className="muted" style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>{current.explanation}</p>
                ) : (
                  <p className="muted" style={{ marginTop: 8 }}>(لا يوجد تفسير)</p>
                )}
              </div>
            ) : null}

            <div className="divider" />

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn btn--ghost" onClick={() => setIdx((p) => Math.max(0, p - 1))} disabled={idx === 0}>
                السابق
              </button>

              <button className="btn btn--ghost" onClick={() => setIdx((p) => Math.min(questions.length - 1, p + 1))} disabled={idx >= questions.length - 1}>
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
