"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import { supabase } from "@/lib/supabase";
import { clamp, pct } from "@/lib/utils";
import { letterFromIndex } from "@/lib/mcqParse";

type QuizRow = {
  id: string;
  mode: "practice" | "exam";
  total_questions: number;
  correct_count: number;
  score: number;
  started_at: string;
  submitted_at: string | null;
  course_id: string;
  lecture_id: string | null;
  course?: { code: string; name: string } | null;
  lecture?: { title: string } | null;
};

type Question = {
  id: string;
  question_text: string;
  choices: string[];
  correct_index: number;
  explanation: string | null;
};

type QQ = {
  order_index: number;
  question_id: string;
  question: Question;
};

type AnswerRow = {
  question_id: string;
  selected_index: number | null;
  is_correct: boolean;
};

export default function McqQuizPage() {
  const params = useParams<{ quizId: string }>();
  const quizId = params.quizId;
  const router = useRouter();

  const [quiz, setQuiz] = useState<QuizRow | null>(null);
  const [items, setItems] = useState<QQ[]>([]);
  const [answers, setAnswers] = useState<Record<string, number | null>>({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);

  const current = useMemo(() => items[idx]?.question ?? null, [items, idx]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setErr(null);

      // Quiz row
      const { data: qData, error: qErr } = await supabase
        .from("mcq_quizzes")
        .select("id, mode, total_questions, correct_count, score, started_at, submitted_at, course_id, lecture_id, course:courses(code,name), lecture:lectures(title)")
        .eq("id", quizId)
        .single();

      if (qErr || !qData) {
        setErr("مش قادر أجيب بيانات الاختبار.");
        setLoading(false);
        return;
      }

      const quizRow = qData as any as QuizRow;
      setQuiz(quizRow);

      if (quizRow.submitted_at) {
        router.replace(`/mcq/results/${quizId}`);
        return;
      }

      const { data: qqData, error: qqErr } = await supabase
        .from("mcq_quiz_questions")
        .select("order_index, question_id, question:mcq_questions(id, question_text, choices, correct_index, explanation)")
        .eq("quiz_id", quizId)
        .order("order_index", { ascending: true });

      if (qqErr) {
        setErr("مش قادر أجيب أسئلة الاختبار.");
        setLoading(false);
        return;
      }

      const list = (qqData ?? []) as any as QQ[];
      // Normalize choices (jsonb -> array)
      list.forEach((x: any) => {
        if (x.question && typeof x.question.choices === "string") {
          try { x.question.choices = JSON.parse(x.question.choices); } catch {}
        }
      });
      setItems(list);

      // Existing answers (resume)
      const { data: aData } = await supabase
        .from("mcq_quiz_answers")
        .select("question_id, selected_index, is_correct")
        .eq("quiz_id", quizId);

      const map: Record<string, number | null> = {};
      (aData ?? []).forEach((a: any) => {
        map[a.question_id] = a.selected_index ?? null;
      });
      setAnswers(map);

      setLoading(false);
    }

    load();
  }, [quizId, router]);

  const total = items.length;

  const answeredCount = useMemo(() => {
    return Object.values(answers).filter((v) => v !== null && v !== undefined).length;
  }, [answers]);

  async function choose(optionIndex: number) {
    if (!quiz || !current) return;

    const qid = current.id;
    const correct = optionIndex === current.correct_index;

    setAnswers((prev) => ({ ...prev, [qid]: optionIndex }));

    // Persist
    await supabase.from("mcq_quiz_answers").upsert(
      {
        quiz_id: quiz.id,
        question_id: qid,
        selected_index: optionIndex,
        is_correct: correct,
      },
      { onConflict: "quiz_id,question_id" }
    );
  }

  async function submit() {
    if (!quiz) return;

    const ok = confirm("تأكيد تسليم الاختبار؟");
    if (!ok) return;

    // Ensure all questions exist in map (so results page shows unanswered)
    const map = { ...answers };
    for (const it of items) {
      if (!(it.question.id in map)) map[it.question.id] = null;
    }

    // Compute correct count
    let correctCount = 0;
    for (const it of items) {
      const sel = map[it.question.id];
      if (sel === null || sel === undefined) continue;
      if (sel === it.question.correct_index) correctCount++;
    }

    const score = pct(correctCount, total);

    // Persist unanswered rows (optional)
    const unanswered = items
      .filter((it) => map[it.question.id] === null || map[it.question.id] === undefined)
      .map((it) => ({
        quiz_id: quiz.id,
        question_id: it.question.id,
        selected_index: null,
        is_correct: false,
      }));

    if (unanswered.length) {
      await supabase.from("mcq_quiz_answers").upsert(unanswered, { onConflict: "quiz_id,question_id" });
    }

    const { error: upErr } = await supabase
      .from("mcq_quizzes")
      .update({
        submitted_at: new Date().toISOString(),
        total_questions: total,
        correct_count: correctCount,
        score,
      })
      .eq("id", quiz.id);

    if (upErr) {
      alert("مشكلة في تسليم الاختبار. جرّب تاني.");
      return;
    }

    router.push(`/mcq/results/${quiz.id}`);
  }

  const currentSelected = current ? answers[current.id] ?? null : null;
  const isPractice = quiz?.mode === "practice";
  const showFeedback = isPractice && currentSelected !== null && currentSelected !== undefined;

  if (loading) {
    return (
      <AppShell>
        <main className="container">
          <div className="card">
            <h2>جاري تجهيز الاختبار…</h2>
            <p className="muted">ثواني.</p>
          </div>
        </main>
      </AppShell>
    );
  }

  if (err) {
    return (
      <AppShell>
        <main className="container">
          <div className="card">
            <h2>حصلت مشكلة</h2>
            <p className="error">{err}</p>
            <div style={{ marginTop: 12 }}>
              <a className="btn" href="/mcq">رجوع</a>
            </div>
          </div>
        </main>
      </AppShell>
    );
  }

  if (!quiz || items.length === 0) {
    return (
      <AppShell>
        <main className="container">
          <div className="card">
            <h2>الاختبار فاضي</h2>
            <p className="muted">ممكن يكون بنك الأسئلة فاضي أو الاختبار اتنشأ غلط.</p>
            <a className="btn" href="/mcq">رجوع</a>
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
            <div className="sectionTitle" style={{ minWidth: 0 }}>
              <h1 style={{ marginBottom: 6 }}>
                اختبار {quiz.course?.code ?? ""} — {quiz.course?.name ?? ""}
              </h1>
              <p className="muted" style={{ marginTop: 0 }}>
                {quiz.lecture?.title ? `المحاضرة: ${quiz.lecture.title} • ` : ""}
                الوضع: {quiz.mode === "practice" ? "تدريب" : "امتحان"} •
                {" "}{answeredCount}/{total} تم الإجابة
              </p>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn btn--ghost" onClick={() => router.push("/mcq/history")}>محاولاتي</button>
              <button className="btn" onClick={submit}>تسليم</button>
            </div>
          </div>

          <div className="mcqProgress" style={{ marginTop: 12 }}>
            <div className="mcqProgress__bar" style={{ width: `${pct(idx + 1, total)}%` }} />
          </div>

          <div className="grid" style={{ marginTop: 12 }}>
            <div className="col-12 col-8">
              <div className="card card--soft">
                <div className="sectionHeader">
                  <div className="sectionTitle">
                    <h2 style={{ marginBottom: 6 }}>
                      سؤال {idx + 1} / {total}
                    </h2>
                    <div className="muted" style={{ fontSize: 13 }}>
                      {currentSelected !== null && currentSelected !== undefined ? "تمت الإجابة" : "لسه ما اتجاوبش"}
                    </div>
                  </div>
                  <span className="pill">{quiz.mode === "practice" ? "Practice" : "Exam"}</span>
                </div>

                <div className="mcqQuestionText">
                  {current?.question_text}
                </div>

                <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                  {current?.choices?.map((c, i) => {
                    const selected = currentSelected === i;
                    const correctIdx = current.correct_index;

                    const isCorrect = selected && i === correctIdx;
                    const isWrong = selected && i !== correctIdx;

                    // In exam mode, don't reveal correct during solving
                    const showCorrectStyle = isPractice && currentSelected !== null && i === correctIdx;

                    const cls = [
                      "mcqOption",
                      selected ? "mcqOption--selected" : "",
                      showCorrectStyle ? "mcqOption--correct" : "",
                      isPractice && isWrong ? "mcqOption--wrong" : "",
                    ].join(" ");

                    return (
                      <button key={i} className={cls} onClick={() => choose(i)}>
                        <span className="mcqOption__letter">{letterFromIndex(i)}</span>
                        <span className="mcqOption__text">{c}</span>
                        {isCorrect ? <span className="mcqTag mcqTag--ok">صح</span> : null}
                        {isWrong ? <span className="mcqTag mcqTag--bad">غلط</span> : null}
                      </button>
                    );
                  })}
                </div>

                {showFeedback ? (
                  <div className={currentSelected === current!.correct_index ? "note note--ok" : "note note--bad"} style={{ marginTop: 12 }}>
                    <div className="note__title">
                      {currentSelected === current!.correct_index ? "إجابة صحيحة ✅" : "إجابة خاطئة ❌"}
                    </div>
                    <div className="note__body">
                      الإجابة الصحيحة: {letterFromIndex(current!.correct_index)}.
                      {current?.explanation ? (
                        <>
                          <div className="divider" />
                          <div className="muted" style={{ whiteSpace: "pre-wrap" }}>
                            {current.explanation}
                          </div>
                        </>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                  <button className="btn btn--ghost" onClick={() => setIdx((v) => clamp(v - 1, 0, total - 1))} disabled={idx === 0}>
                    السابق
                  </button>
                  <button className="btn" onClick={() => setIdx((v) => clamp(v + 1, 0, total - 1))} disabled={idx === total - 1}>
                    التالي
                  </button>
                  <button className="btn btn--ghost" onClick={() => setIdx((v) => clamp(v, 0, total - 1))} disabled>
                    {idx + 1}/{total}
                  </button>
                </div>
              </div>
            </div>

            <div className="col-12 col-4">
              <div className="card card--soft">
                <h2 style={{ marginBottom: 8 }}>الأسئلة</h2>
                <p className="muted" style={{ marginTop: 0 }}>
                  اضغط على رقم السؤال للتنقل بسرعة.
                </p>

                <div className="mcqNavGrid">
                  {items.map((it, i) => {
                    const qid = it.question.id;
                    const answered = answers[qid] !== null && answers[qid] !== undefined;
                    const active = i === idx;
                    return (
                      <button
                        key={qid}
                        className={[
                          "mcqNavBtn",
                          answered ? "mcqNavBtn--answered" : "",
                          active ? "mcqNavBtn--active" : "",
                        ].join(" ")}
                        onClick={() => setIdx(i)}
                        aria-label={`سؤال ${i + 1}`}
                        title={answered ? "تمت الإجابة" : "بدون إجابة"}
                      >
                        {i + 1}
                      </button>
                    );
                  })}
                </div>

                <div className="divider" />
                <div className="kpis">
                  <span className="kpi">تمت الإجابة: {answeredCount}</span>
                  <span className="kpi">المتبقي: {Math.max(0, total - answeredCount)}</span>
                </div>

                <div style={{ marginTop: 12 }}>
                  <button className="btn" onClick={submit} style={{ width: "100%" }}>
                    تسليم
                  </button>
                  <a className="btn btn--ghost" href="/mcq" style={{ width: "100%", marginTop: 8, textAlign: "center", display: "inline-block" }}>
                    اختبار جديد
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </AppShell>
  );
}
