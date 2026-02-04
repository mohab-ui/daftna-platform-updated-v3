"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { supabase } from "@/lib/supabase";
import { fmtDate, pct } from "@/lib/utils";
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

export default function McqResultsPage() {
  const params = useParams<{ quizId: string }>();
  const quizId = params.quizId;

  const [quiz, setQuiz] = useState<QuizRow | null>(null);
  const [items, setItems] = useState<QQ[]>([]);
  const [answers, setAnswers] = useState<Record<string, AnswerRow>>({});
  const [filter, setFilter] = useState<"all" | "wrong" | "unanswered">("all");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setErr(null);

      const { data: qData, error: qErr } = await supabase
        .from("mcq_quizzes")
        .select("id, mode, total_questions, correct_count, score, started_at, submitted_at, course_id, lecture_id, course:courses(code,name), lecture:lectures(title)")
        .eq("id", quizId)
        .single();

      if (qErr || !qData) {
        setErr("مش قادر أجيب بيانات النتيجة.");
        setLoading(false);
        return;
      }

      const quizRow = qData as any as QuizRow;
      setQuiz(quizRow);

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
      list.forEach((x: any) => {
        if (x.question && typeof x.question.choices === "string") {
          try { x.question.choices = JSON.parse(x.question.choices); } catch {}
        }
      });
      setItems(list);

      const { data: aData } = await supabase
        .from("mcq_quiz_answers")
        .select("question_id, selected_index, is_correct")
        .eq("quiz_id", quizId);

      const map: Record<string, AnswerRow> = {};
      (aData ?? []).forEach((a: any) => {
        map[a.question_id] = {
          question_id: a.question_id,
          selected_index: a.selected_index ?? null,
          is_correct: !!a.is_correct,
        };
      });
      setAnswers(map);

      setLoading(false);
    }

    load();
  }, [quizId]);

  const total = items.length;
  const computedCorrect = useMemo(() => {
    let c = 0;
    for (const it of items) {
      const a = answers[it.question.id];
      if (a && a.selected_index !== null && a.selected_index === it.question.correct_index) c++;
    }
    return c;
  }, [items, answers]);

  const correctCount = quiz?.correct_count ?? computedCorrect;
  const percent = pct(correctCount, total);

  const viewItems = useMemo(() => {
    if (filter === "all") return items;
    if (filter === "unanswered") {
      return items.filter((it) => {
        const a = answers[it.question.id];
        return !a || a.selected_index === null || a.selected_index === undefined;
      });
    }
    // wrong
    return items.filter((it) => {
      const a = answers[it.question.id];
      if (!a || a.selected_index === null || a.selected_index === undefined) return false;
      return a.selected_index !== it.question.correct_index;
    });
  }, [items, answers, filter]);

  if (loading) {
    return (
      <AppShell>
        <main className="container">
          <div className="card">
            <h2>جاري تحميل النتيجة…</h2>
          </div>
        </main>
      </AppShell>
    );
  }

  if (err || !quiz) {
    return (
      <AppShell>
        <main className="container">
          <div className="card">
            <h2>حصلت مشكلة</h2>
            <p className="error">{err ?? "غير معروف"}</p>
            <Link className="btn" href="/mcq">اختبار جديد</Link>
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
              <h1 style={{ marginBottom: 6 }}>
                النتيجة — {quiz.course?.code ?? ""} {quiz.course?.name ?? ""}
              </h1>
              <p className="muted" style={{ marginTop: 0 }}>
                {quiz.lecture?.title ? `المحاضرة: ${quiz.lecture.title} • ` : ""}
                {quiz.submitted_at ? `تم التسليم: ${fmtDate(quiz.submitted_at)}` : "لم يتم التسليم"}
              </p>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Link className="btn" href={`/mcq?course=${quiz.course_id}${quiz.lecture_id ? `&lecture=${quiz.lecture_id}` : ""}`}>اختبار جديد لنفس المادة</Link>
              <Link className="btn btn--ghost" href="/mcq/history">محاولاتي</Link>
            </div>
          </div>

          <div className="grid" style={{ marginTop: 12 }}>
            <div className="col-12 col-4">
              <div className="kpiCard">
                <div className="kpiCard__label">الدرجة</div>
                <div className="kpiCard__value">{correctCount}/{total}</div>
              </div>
            </div>
            <div className="col-12 col-4">
              <div className="kpiCard">
                <div className="kpiCard__label">النسبة</div>
                <div className="kpiCard__value">{percent}%</div>
              </div>
            </div>
            <div className="col-12 col-4">
              <div className="kpiCard">
                <div className="kpiCard__label">الوضع</div>
                <div className="kpiCard__value">{quiz.mode === "practice" ? "Practice" : "Exam"}</div>
              </div>
            </div>
          </div>

          <div className="divider" />

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className={`btn btn--ghost ${filter === "all" ? "isActive" : ""}`} onClick={() => setFilter("all")}>
              كل الأسئلة
            </button>
            <button className={`btn btn--ghost ${filter === "wrong" ? "isActive" : ""}`} onClick={() => setFilter("wrong")}>
              أخطاء فقط
            </button>
            <button className={`btn btn--ghost ${filter === "unanswered" ? "isActive" : ""}`} onClick={() => setFilter("unanswered")}>
              بدون إجابة
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
          {viewItems.map((it, i) => {
            const q = it.question;
            const a = answers[q.id];
            const selected = a?.selected_index ?? null;
            const correct = q.correct_index;

            return (
              <div key={q.id} className="card">
                <div className="sectionHeader">
                  <div className="sectionTitle">
                    <h2 style={{ marginBottom: 6 }}>سؤال {i + 1}</h2>
                    <div className="muted" style={{ whiteSpace: "pre-wrap" }}>
                      {q.question_text}
                    </div>
                  </div>

                  {selected === null ? (
                    <span className="pill">بدون إجابة</span>
                  ) : selected === correct ? (
                    <span className="pill" style={{ borderColor: "rgba(65,216,157,.8)", color: "rgba(65,216,157,.95)" }}>
                      صح
                    </span>
                  ) : (
                    <span className="pill" style={{ borderColor: "rgba(255,106,106,.8)", color: "rgba(255,106,106,.95)" }}>
                      غلط
                    </span>
                  )}
                </div>

                <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                  {q.choices.map((c, idx) => {
                    const isSelected = selected === idx;
                    const isCorrect = idx === correct;

                    const cls = [
                      "mcqOption",
                      isSelected ? "mcqOption--selected" : "",
                      isCorrect ? "mcqOption--correct" : "",
                      isSelected && !isCorrect ? "mcqOption--wrong" : "",
                    ].join(" ");

                    return (
                      <div key={idx} className={cls} style={{ cursor: "default" }}>
                        <span className="mcqOption__letter">{letterFromIndex(idx)}</span>
                        <span className="mcqOption__text">{c}</span>
                        {isCorrect ? <span className="mcqTag mcqTag--ok">الصحيح</span> : null}
                        {isSelected && !isCorrect ? <span className="mcqTag mcqTag--bad">اختيارك</span> : null}
                      </div>
                    );
                  })}
                </div>

                {q.explanation ? (
                  <div className="note" style={{ marginTop: 12 }}>
                    <div className="note__title">الشرح</div>
                    <div className="note__body" style={{ whiteSpace: "pre-wrap" }}>
                      {q.explanation}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}

          {viewItems.length === 0 ? (
            <div className="card">
              <p className="muted">مفيش عناصر في الفلتر ده.</p>
            </div>
          ) : null}
        </div>
      </main>
    </AppShell>
  );
}
