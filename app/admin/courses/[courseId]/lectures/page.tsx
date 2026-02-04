"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import { supabase } from "@/lib/supabase";
import { getMyProfile, isModerator, UserRole } from "@/lib/profile";

type Course = { id: string; code: string; name: string; semester: number | null; description: string | null };
type Lecture = { id: string; title: string; order_index: number; created_at: string };

function buildTitle(order: number, topic: string, custom: string) {
  const c = custom.trim();
  if (c) return c;
  const t = topic.trim();
  return t ? `محاضرة ${order} (${t})` : `محاضرة ${order}`;
}

export default function AdminLecturesPage() {
  const params = useParams<{ courseId: string }>();
  const courseId = params.courseId;

  const [role, setRole] = useState<UserRole | null>(null);
  const canManage = useMemo(() => isModerator(role as any), [role]);

  const [course, setCourse] = useState<Course | null>(null);
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [loading, setLoading] = useState(true);

  const [orderIndex, setOrderIndex] = useState<string>("1");
  const [topic, setTopic] = useState<string>("");
  const [customTitle, setCustomTitle] = useState<string>("");
  const [seedCount, setSeedCount] = useState<string>("12");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editOrder, setEditOrder] = useState<string>("");
  const [editTitle, setEditTitle] = useState<string>("");
  const [editErr, setEditErr] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function loadAll() {
    setErr(null);
    setOk(null);
    setLoading(true);

    const profile = await getMyProfile();
    setRole(profile?.role ?? null);

    const { data: cData, error: cErr } = await supabase
      .from("courses")
      .select("id, code, name, semester, description")
      .eq("id", courseId)
      .single();

    if (cErr) {
      setLoading(false);
      setErr("مش قادر أجيب بيانات المادة.");
      return;
    }
    setCourse(cData as Course);

    const { data, error } = await supabase
      .from("lectures")
      .select("id, title, order_index, created_at")
      .eq("course_id", courseId)
      .order("order_index", { ascending: true });

    setLoading(false);

    if (error) {
      setErr("مش قادر أجيب المحاضرات. تأكد من RLS.");
      return;
    }

    const list = (data ?? []) as Lecture[];
    setLectures(list);

    // Suggest next number
    const maxOrder = list.reduce((m, l) => Math.max(m, l.order_index), 0);
    setOrderIndex(String(Math.max(1, maxOrder + 1)));
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  async function addLecture(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setOk(null);

    if (!canManage) {
      setErr("مش مسموح. الصفحة دي للمشرفين فقط.");
      return;
    }

    const order = Number(orderIndex);
    if (!orderIndex.trim() || Number.isNaN(order) || order < 0 || order > 9999) {
      setErr("رقم المحاضرة/الترتيب لازم يكون رقم منطقي (1..9999). تقدر تستخدم 0 لـ 'عام'.");
      return;
    }

    const title = buildTitle(order, topic, customTitle);

    setBusy(true);
    try {
      const { error } = await supabase.from("lectures").insert({
        course_id: courseId,
        title,
        order_index: order,
      });

      if (error) {
        if ((error as any).code === "23505" || String(error.message).toLowerCase().includes("duplicate")) {
          setErr("في محاضرة بنفس الرقم/الترتيب موجودة بالفعل. جرّب رقم مختلف.");
        } else {
          setErr("فشل إضافة المحاضرة. تأكد إن دورك moderator/admin وإن RLS مضبوط.");
        }
        return;
      }

      setTopic("");
      setCustomTitle("");
      setOk("تمت إضافة المحاضرة ✅");
      await loadAll();
    } finally {
      setBusy(false);
    }
  }

  async function seedLectures() {
    setErr(null);
    setOk(null);

    if (!canManage) {
      setErr("مش مسموح.");
      return;
    }

    const n = Number(seedCount);
    if (!seedCount.trim() || Number.isNaN(n) || n < 1 || n > 60) {
      setErr("اكتب عدد من 1 إلى 60.");
      return;
    }

    setBusy(true);
    try {
      const rows = Array.from({ length: n }, (_, i) => {
        const num = i + 1;
        return { course_id: courseId, title: `محاضرة ${num}`, order_index: num };
      });

      const { error } = await supabase
        .from("lectures")
        .upsert(rows, { onConflict: "course_id,order_index", ignoreDuplicates: true });

      if (error) {
        setErr("فشل إنشاء المحاضرات.");
        return;
      }

      setOk(`تم إنشاء محاضرات 1 إلى ${n} ✅`);
      await loadAll();
    } finally {
      setBusy(false);
    }
  }

  async function startEdit(l: Lecture) {
    setEditErr(null);
    setEditingId(l.id);
    setEditOrder(String(l.order_index));
    setEditTitle(l.title);
  }

  async function saveEdit(l: Lecture) {
    setEditErr(null);
    const order = Number(editOrder);
    if (!editOrder.trim() || Number.isNaN(order) || order < 0 || order > 9999) {
      setEditErr("رقم غير صحيح.");
      return;
    }
    if (!editTitle.trim()) {
      setEditErr("العنوان مطلوب.");
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase
        .from("lectures")
        .update({ order_index: order, title: editTitle.trim() })
        .eq("id", l.id);

      if (error) {
        if ((error as any).code === "23505" || String(error.message).toLowerCase().includes("duplicate")) {
          setEditErr("في محاضرة بنفس الرقم/الترتيب. غيّر الرقم.");
        } else {
          setEditErr("فشل الحفظ.");
        }
        return;
      }

      setEditingId(null);
      setOk("تم تحديث المحاضرة ✅");
      await loadAll();
    } finally {
      setBusy(false);
    }
  }

  async function swap(a: Lecture, b: Lecture) {
    setErr(null);
    setOk(null);

    if (!canManage) return;

    const tmp = -1 * Math.floor(Date.now() / 1000);

    setBusy(true);
    try {
      // 1) move a to tmp
      await supabase.from("lectures").update({ order_index: tmp }).eq("id", a.id);
      // 2) move b to a's old index
      await supabase.from("lectures").update({ order_index: a.order_index }).eq("id", b.id);
      // 3) move a to b's old index
      await supabase.from("lectures").update({ order_index: b.order_index }).eq("id", a.id);

      await loadAll();
    } finally {
      setBusy(false);
    }
  }

  async function deleteLecture(l: Lecture) {
    setErr(null);
    setOk(null);

    if (!canManage) return;

    const yes = confirm(
      "حذف المحاضرة؟\n\nملاحظة: الموارد داخلها مش هتتمسح، لكنها هتبقى 'محتوى عام' (غير مصنف) بعد الحذف."
    );
    if (!yes) return;

    setBusy(true);
    try {
      const { error } = await supabase.from("lectures").delete().eq("id", l.id);
      if (error) {
        setErr("فشل الحذف.");
        return;
      }
      setOk("تم حذف المحاضرة ✅");
      await loadAll();
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <main className="container">
        <div className="card">
          <div className="sectionHeader">
            <div className="sectionTitle" style={{ minWidth: 0 }}>
              <div>
                <h1 style={{ marginBottom: 6 }}>
                  إدارة المحاضرات — {course ? `${course.code}` : "..."}
                </h1>
                <p className="muted" style={{ marginTop: 0 }}>
                  اعمل تقسيم جوّا المادة: محاضرة 1، 2… وكل محاضرة بقى ليها ملفات/ريكوردات/لينكات/أسئلة.
                </p>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Link className="btn btn--ghost" href="/admin/courses">
                رجوع لإدارة المواد
              </Link>
              <Link className="btn" href={`/courses/${courseId}`}>
                فتح المادة
              </Link>
            </div>
          </div>

          {!canManage ? (
            <p className="error">
              دورك الحالي: {role ?? "غير معروف"} — مش مسموح بالدخول لصفحة الإدارة.
            </p>
          ) : null}

          {err ? <p className="error">{err}</p> : null}
          {ok ? <p className="success">{ok}</p> : null}
        </div>

        <div className="grid" style={{ marginTop: 12 }}>
          <div className="col-12 col-6">
            <div className="card">
              <h2>إضافة محاضرة</h2>
              <p className="muted" style={{ marginTop: 0 }}>
                اكتب رقم المحاضرة + (اختياري) اسمها بين قوسين.
              </p>

              <form onSubmit={addLecture} style={{ marginTop: 12 }}>
                <div className="grid">
                  <div className="col-12 col-6">
                    <label className="label">رقم/ترتيب المحاضرة</label>
                    <input
                      className="input"
                      type="number"
                      value={orderIndex}
                      onChange={(e) => setOrderIndex(e.target.value)}
                      placeholder="1"
                      disabled={busy || !canManage}
                    />
                  </div>

                  <div className="col-12 col-6">
                    <label className="label">اسمها (اختياري)</label>
                    <input
                      className="input"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      placeholder="مثال: Cardiovascular"
                      disabled={busy || !canManage}
                    />
                  </div>

                  <div className="col-12">
                    <label className="label">عنوان مخصص (اختياري)</label>
                    <input
                      className="input"
                      value={customTitle}
                      onChange={(e) => setCustomTitle(e.target.value)}
                      placeholder="لو عايز عنوان مختلف بالكامل (مثال: مراجعة نهائية)"
                      disabled={busy || !canManage}
                    />
                    <p className="muted" style={{ marginTop: 6 }}>
                      لو سيبت العنوان المخصص فاضي، هنكوّن عنوان تلقائيًا: محاضرة X (Topic).
                    </p>
                  </div>
                </div>

                <div style={{ height: 12 }} />
                <button className="btn" type="submit" disabled={busy || !canManage}>
                  {busy ? "..." : "إضافة"}
                </button>
              </form>

              <div className="divider" />

              <h2>إنشاء تلقائي</h2>
              <p className="muted" style={{ marginTop: 0 }}>
                ينشئ محاضرات &quot;محاضرة 1&quot; إلى &quot;محاضرة N&quot; (بدون ما يكرر الموجود).
              </p>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
                <input
                  className="input"
                  style={{ width: 130 }}
                  type="number"
                  value={seedCount}
                  onChange={(e) => setSeedCount(e.target.value)}
                  disabled={busy || !canManage}
                />
                <button className="btn btn--ghost" type="button" onClick={seedLectures} disabled={busy || !canManage}>
                  {busy ? "..." : "إنشاء"}
                </button>
                <button className="btn btn--ghost" type="button" onClick={loadAll} disabled={busy}>
                  تحديث
                </button>
              </div>
            </div>
          </div>

          <div className="col-12 col-6">
            <div className="card">
              <h2>قائمة المحاضرات</h2>
              <p className="muted" style={{ marginTop: 0 }}>
                {loading ? "جاري التحميل…" : `${lectures.length} محاضرة`}
              </p>

              {editingId ? (
                <p className="muted" style={{ marginTop: 6 }}>
                  وضع التعديل نشط — عدّل العنوان/الترتيب ثم احفظ.
                </p>
              ) : null}

              {editErr ? <p className="error">{editErr}</p> : null}

              <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                {lectures.map((l, idx) => {
                  const isEditing = editingId === l.id;
                  return (
                    <div key={l.id} className="card" style={{ padding: 12 }}>
                      <div className="resource__row">
                        <div style={{ minWidth: 0 }}>
                          {isEditing ? (
                            <div className="grid">
                              <div className="col-12 col-4">
                                <label className="label">الترتيب</label>
                                <input
                                  className="input"
                                  type="number"
                                  value={editOrder}
                                  onChange={(e) => setEditOrder(e.target.value)}
                                  disabled={busy}
                                />
                              </div>
                              <div className="col-12 col-8">
                                <label className="label">العنوان</label>
                                <input
                                  className="input"
                                  value={editTitle}
                                  onChange={(e) => setEditTitle(e.target.value)}
                                  disabled={busy}
                                />
                              </div>
                            </div>
                          ) : (
                            <>
                              <h3 className="resource__title" style={{ marginBottom: 6 }}>
                                {l.title}
                              </h3>
                              <span className="pill">ترتيب: {l.order_index}</span>
                            </>
                          )}
                        </div>

                        {canManage ? (
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <button
                              className="iconBtn"
                              type="button"
                              disabled={busy || idx === 0}
                              title="أعلى"
                              onClick={() => swap(l, lectures[idx - 1])}
                            >
                              ▲
                            </button>
                            <button
                              className="iconBtn"
                              type="button"
                              disabled={busy || idx === lectures.length - 1}
                              title="أسفل"
                              onClick={() => swap(l, lectures[idx + 1])}
                            >
                              ▼
                            </button>

                            {isEditing ? (
                              <>
                                <button className="btn" type="button" disabled={busy} onClick={() => saveEdit(l)}>
                                  حفظ
                                </button>
                                <button
                                  className="btn btn--ghost"
                                  type="button"
                                  disabled={busy}
                                  onClick={() => {
                                    setEditingId(null);
                                    setEditErr(null);
                                  }}
                                >
                                  إلغاء
                                </button>
                              </>
                            ) : (
                              <>
                                <button className="btn btn--ghost" type="button" disabled={busy} onClick={() => startEdit(l)}>
                                  تعديل
                                </button>
                                <button className="btn btn--danger" type="button" disabled={busy} onClick={() => deleteLecture(l)}>
                                  حذف
                                </button>
                              </>
                            )}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}

                {!loading && lectures.length === 0 ? (
                  <div className="card">
                    <p className="muted">مفيش محاضرات لسه. ابدأ بإضافة محاضرة 1.</p>
                  </div>
                ) : null}
              </div>

              <p className="muted" style={{ marginTop: 12 }}>
                نصيحة: خلي الترتيب 1..N علشان يسهل على الدفعة. وتقدر تضيف محاضرة &quot;عام&quot; بالترتيب 0 للملفات العامة.
              </p>
            </div>
          </div>
        </div>
      </main>
    </AppShell>
  );
}
