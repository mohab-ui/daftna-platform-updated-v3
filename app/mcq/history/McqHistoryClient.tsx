"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import PerformanceChart from "@/components/PerformanceChart";
import { supabase } from "@/lib/supabase";

type Course = { id: string; code: string; name: string };
type Lecture = { id: string; title: string };

type Row = {
  id: string;
  mode: "practice" | "exam";
  total_questions: number;
  correct_count: number;
  score: number;
  started_at: string;
  submitted_at: string | null;
  course: Course | null;
  lecture: Lecture | null;
};

function fmtDate(s?: string | null) {
  if (!s) return "-";
  const d = new Date(s);
  return d.toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" });
}

// لو رجع relation كـ array بالغلط ناخد أول عنصر
function pickOne<T>(v: any): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export default function McqHistoryClient() {
  const sp = useSearchParams();
  const courseFilter = sp.get("course") ?? "";

  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const filtered = useMemo(() => {
    if (!courseFilter) return rows;
    return rows.filter((r) => r.course?.id === courseFilter);
  }, [rows, courseFilter]);

  const chartScores = useMemo(() => {
    const sorted = [...filtered].sort(
      (a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime()
    );
    return sorted.map((r) => Number(r.score) || 0);
  }, [filtered]);

  const stats = useMemo(() => {
    if (!filtered.length) {
      return { count: 0, avg: 0, best: 0, last: 0 };
    }
    const scores = filtered.map((r) => Number(r.score) || 0);
    const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
    const best = Math.max(...scores);
    const last = scores[0]; // newest (query ordered desc)
    return {
      count: filtered.length,
      avg: Math.round(avg),
      best: Math.round(best),
      last: Math.round(last),
    };
  }, [filtered]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setErr(null);

      const { data: userData, error: uErr } = await supabase.auth.getUser();
      if (uErr || !userData.user) {
        if (mounted) {
          setErr("لازم تسجل دخول.");
          setLoading(false);
        }
        return;
      }

      // ✅ هنا التعديل المهم: mcq_quizzes بدل mcq_quiz_attempts
      const { data, error } = await supabase
        .from("mcq_quizzes_with_stats")
        .select(
          `
          id,
          mode,
          total_questions,
          correct_count,
          score,
          started_at,
          submitted_at,
          course:course_id ( id, code, name ),
          lecture:lecture_id ( id, title )
        `
        )
        .eq("user_id", userData.user.id)
        .order("started_at", { ascending: false });

      if (!mounted) return;

      if (error) {
        setErr("حصل خطأ في تحميل المحاولات. (ممكن RLS مانع القراءة للطالب)");
        setRows([]);
        setLoading(false);
        return;
      }

      const raw = (data ?? []) as any[];

      const normalized: Row[] = raw.map((r) => ({
        id: r.id,
        mode: r.mode,
        total_questions: r.total_questions,
        correct_count: r.correct_count,
        score: r.score,
        started_at: r.started_at,
        submitted_at: r.submitted_at,
        course: pickOne<Course>(r.course),
        lecture: pickOne<Lecture>(r.lecture),
      }));

      setRows(normalized);
      setLoading(false);
    }

    load();
    return () => {
      mounted = false;
    };
  }, [courseFilter]);

  return (
    <AppShell>
      <main className="container">
        <div className="card">
          <h1 style={{ marginBottom: 6 }}>سجل الاختبارات</h1>
          <p className="muted" style={{ marginTop: 0 }}>
            هنا تقدر تشوف محاولاتك السابقة ونتايجك.
          </p>

          {loading ? <p className="muted">جاري التحميل…</p> : null}
          {err ? <p className="error">{err}</p> : null}

          {!loading && !err && filtered.length === 0 ? (
            <p className="muted">مفيش محاولات لحد دلوقتي.</p>
          ) : null}

          {!loading && !err && filtered.length > 0 ? (
            <div className="grid" style={{ marginTop: 14 }}>
              <div className="col-12 col-7">
                <div className="card card--soft" style={{ height: 220 }}>
                  <div className="rowTitle" style={{ marginBottom: 10 }}>
                    الأداء عبر الوقت (Performance)
                  </div>
                  <PerformanceChart scores={chartScores} height={170} />
                </div>
              </div>

              <div className="col-12 col-5">
                <div className="card card--soft">
                  <div className="rowTitle" style={{ marginBottom: 10 }}>
                    ملخص سريع
                  </div>
                  <div className="kpis">
                    <span className="kpi">📌 آخر نتيجة: {stats!.last}%</span>
                    <span className="kpi">🏆 أفضل نتيجة: {stats!.best}%</span>
                    <span className="kpi">📈 متوسط: {stats!.avg}%</span>
                    <span className="kpi">🧾 عدد المحاولات: {stats!.count}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
            {filtered.map((r) => (
              <div key={r.id} className="card card--soft">
                <div className="rowTitle" style={{ fontWeight: 700 }}>
                  {r.course ? `${r.course.code} — ${r.course.name}` : "مادة"}
                  {r.lecture ? ` • ${r.lecture.title}` : ""}
                </div>

                <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
                  بدأ: {fmtDate(r.started_at)} • {r.mode === "practice" ? "تدريب" : "امتحان"} • {r.total_questions} سؤال
                </div>

                <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <span className="kpi">
                    ✅ صح: {r.correct_count} / {r.total_questions}
                  </span>
                  <span className="kpi">⭐ Score: {r.score}%</span>
                  <span className="kpi">🕒 تسليم: {fmtDate(r.submitted_at)}</span>

                  <div style={{ flex: 1 }} />

                  <a className="btn btn--ghost" href={`/mcq/results/${r.id}`}>
                    عرض النتيجة
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </AppShell>
  );
}
