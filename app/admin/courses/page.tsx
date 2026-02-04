"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { supabase } from "@/lib/supabase";
import { getMyProfile, isModerator, UserRole } from "@/lib/profile";

type Course = {
  id: string;
  code: string;
  name: string;
  semester: number | null;
  description: string | null;
  created_at: string;
};

const DEFAULT_MED_S2: Array<Pick<Course, "code" | "name" | "semester" | "description">> = [
  { code: "PHARMA", name: "Pharmacology", semester: 2, description: "Term 2 - 1st year Medicine" },
  { code: "PARA", name: "Parasitology", semester: 2, description: "Term 2 - 1st year Medicine" },
  { code: "MICRO", name: "Microbiology", semester: 2, description: "Term 2 - 1st year Medicine" },
  { code: "PATHO", name: "Pathology", semester: 2, description: "Term 2 - 1st year Medicine" },
  { code: "ECE1", name: "ECE1", semester: 2, description: "Term 2 - 1st year Medicine" },
];

export default function AdminCoursesPage() {
  const [role, setRole] = useState<UserRole | null>(null);

  const [courses, setCourses] = useState<Course[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [semester, setSemester] = useState<string>("2");
  const [description, setDescription] = useState("");

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const canManage = useMemo(() => isModerator(role as any), [role]);

  async function loadAll() {
    setErr(null);
    setOk(null);
    setLoadingCourses(true);

    const profile = await getMyProfile();
    setRole(profile?.role ?? null);

    const { data, error } = await supabase
      .from("courses")
      .select("id, code, name, semester, description, created_at")
      .order("semester", { ascending: true })
      .order("code", { ascending: true });

    setLoadingCourses(false);

    if (error) {
      setErr("مش قادر أجيب المواد. تأكد من الـ RLS والسياسات.");
      return;
    }

    setCourses((data ?? []) as Course[]);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addCourse(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setOk(null);

    if (!canManage) {
      setErr("مش مسموح. الصفحة دي للمشرفين فقط.");
      return;
    }

    const c = code.trim().toUpperCase();
    const n = name.trim();
    const sem = semester.trim() ? Number(semester) : null;

    if (!c) {
      setErr("اكتب كود المادة (مثال: PHARMA).");
      return;
    }
    if (!n) {
      setErr("اكتب اسم المادة.");
      return;
    }
    if (semester.trim() && (Number.isNaN(sem) || sem! < 1 || sem! > 20)) {
      setErr("الترم لازم يكون رقم منطقي (مثال: 2).");
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase.from("courses").insert({
        code: c,
        name: n,
        semester: sem,
        description: description.trim() ? description.trim() : null,
      });

      if (error) {
        // Unique constraint / duplicates
        if ((error as any).code === "23505" || error.message.toLowerCase().includes("duplicate")) {
          setErr("الكود ده موجود بالفعل. غيّر الكود أو احذف القديم.");
        } else {
          setErr("فشل إضافة المادة. تأكد إن دورك moderator/admin وإن RLS مضبوط.");
        }
        return;
      }

      setCode("");
      setName("");
      setDescription("");
      setOk("تمت إضافة المادة ✅");
      await loadAll();
    } finally {
      setBusy(false);
    }
  }

  async function addDefaultMedS2() {
    setErr(null);
    setOk(null);

    if (!canManage) {
      setErr("مش مسموح. الصفحة دي للمشرفين فقط.");
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase
        .from("courses")
        .upsert(DEFAULT_MED_S2, { onConflict: "code", ignoreDuplicates: true });

      if (error) {
        setErr("فشل إضافة المواد الافتراضية. تأكد من RLS.");
        return;
      }

      setOk("تمت إضافة مواد الترم التاني ✅");
      await loadAll();
    } finally {
      setBusy(false);
    }
  }

  async function deleteCourse(courseId: string) {
    setErr(null);
    setOk(null);

    if (!canManage) {
      setErr("مش مسموح.");
      return;
    }

    const yes = confirm("متأكد؟ حذف المادة هيحذف كل الملفات المرتبطة بيها كمان.");
    if (!yes) return;

    setBusy(true);
    try {
      const { error } = await supabase.from("courses").delete().eq("id", courseId);
      if (error) {
        setErr("فشل الحذف. تأكد من الصلاحيات.");
        return;
      }
      setOk("تم حذف المادة ✅");
      await loadAll();
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <main className="container">
        <div className="card">
          <h1>إدارة المواد</h1>
          <p className="muted">
            من هنا تقدر تضيف/تحذف مواد من داخل الموقع بدل Supabase.
          </p>

          {!canManage ? (
            <p className="error">
              دورك الحالي: {role ?? "غير معروف"} — مش مسموح بالدخول لصفحة الإدارة.
            </p>
          ) : (
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
              <button className="btn" onClick={addDefaultMedS2} disabled={busy}>
                {busy ? "..." : "إضافة مواد الترم التاني (PHARMA, PARA, MICRO, PATHO, ECE1)"}
              </button>
              <button className="btn btn--ghost" onClick={loadAll} disabled={busy}>
                تحديث القائمة
              </button>
            </div>
          )}

          {err ? <p className="error">{err}</p> : null}
          {ok ? <p style={{ marginTop: 10 }}>{ok}</p> : null}
        </div>

        <div className="grid" style={{ marginTop: 12 }}>
          <div className="col-12 col-6">
            <div className="card">
              <h2>إضافة مادة جديدة</h2>

              <form onSubmit={addCourse} style={{ marginTop: 12 }}>
                <label className="label">كود المادة</label>
                <input
                  className="input"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="مثال: PHARMA"
                />

                <div style={{ height: 10 }} />

                <label className="label">اسم المادة</label>
                <input
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: Pharmacology"
                />

                <div style={{ height: 10 }} />

                <label className="label">الترم</label>
                <input
                  className="input"
                  value={semester}
                  onChange={(e) => setSemester(e.target.value)}
                  placeholder="2"
                />

                <div style={{ height: 10 }} />

                <label className="label">وصف (اختياري)</label>
                <textarea
                  className="textarea"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="مثال: Term 2 - 1st year Medicine"
                />

                <div style={{ height: 12 }} />

                <button className="btn" type="submit" disabled={busy || !canManage}>
                  {busy ? "..." : "إضافة"}
                </button>

                {!canManage ? (
                  <p className="muted" style={{ marginTop: 10 }}>
                    لازم تكون moderator/admin علشان تضيف مواد.
                  </p>
                ) : null}
              </form>
            </div>
          </div>

          <div className="col-12 col-6">
            <div className="card">
              <h2>قائمة المواد</h2>
              <p className="muted">
                {loadingCourses ? "جاري التحميل…" : `${courses.length} مادة`}
              </p>

              <div className="tableWrap" style={{ marginTop: 12 }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>الكود</th>
                      <th>اسم المادة</th>
                      <th>الترم</th>
                      <th>الوصف</th>
                      <th>إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {courses.map((c) => (
                      <tr key={c.id}>
                        <td style={{ fontWeight: 950 }}>{c.code}</td>
                        <td>{c.name}</td>
                        <td>{c.semester ? `ترم ${c.semester}` : "-"}</td>
                        <td className="muted">{c.description ?? "-"}</td>
                        <td>
                          {canManage ? (
                            <div className="tableActions">
                              <Link className="btn btn--ghost" href={`/admin/courses/${c.id}/lectures`}>
                                محاضرات
                              </Link>
                              <Link className="btn btn--ghost" href={`/courses/${c.id}`}>
                                فتح
                              </Link>
                              <button className="btn btn--ghost" onClick={() => deleteCourse(c.id)} disabled={busy}>
                                حذف
                              </button>
                            </div>
                          ) : (
                            "-"
                          )}
                        </td>
                      </tr>
                    ))}

                    {!loadingCourses && courses.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="muted">
                          مفيش مواد لسه. استخدم زر الإضافة فوق.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <p className="muted" style={{ marginTop: 12 }}>
          تنبيه: حذف مادة هيحذف كل الموارد المرتبطة بيها (Cascade).
        </p>
      </main>
    </AppShell>
  );
}