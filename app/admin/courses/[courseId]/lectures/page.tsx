"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import { supabase } from "@/lib/supabase";
import { getMyProfile, isModerator, UserRole } from "@/lib/profile";

type Course = { id: string; code: string; name: string; semester: number | null; description: string | null };

type LectureKind = "lecture" | "formative";

type Lecture = {
  id: string;
  title: string;
  order_index: number;
  created_at: string;
  kind?: string | LectureKind;
  formative_no?: number | null;
};

function buildLectureTitle(order: number, topic: string, custom: string) {
  const c = custom.trim();
  if (c) return c;
  const t = topic.trim();
  return t ? `محاضرة ${order} (${t})` : `محاضرة ${order}`;
}

function buildFormativeTitle(no: number) {
  return `فورماتيف ${no}`;
}

export default function AdminLecturesPage() {
  const params = useParams<{ courseId: string }>();
  const courseId = params.courseId;

  const [role, setRole] = useState<UserRole | null>(null);
  const canManage = useMemo(() => isModerator(role as any), [role]);

  const [course, setCourse] = useState<Course | null>(null);

  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [formatives, setFormatives] = useState<Lecture[]>([]);
  const [loading, setLoading] = useState(true);

  const [kind, setKind] = useState<LectureKind>("lecture");

  // lecture form
  const [orderIndex, setOrderIndex] = useState<string>("1");
  const [topic, setTopic] = useState<string>("");
  const [customTitle, setCustomTitle] = useState<string>("");
  const [seedCount, setSeedCount] = useState<string>("12");

  // formative form
  const [formativeNo, setFormativeNo] = useState<string>("1");

  // edit
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
      .select("id, title, order_index, created_at, kind, formative_no")
      .eq("course_id", courseId)
      .order("kind", { ascending: true })
      .order("order_index", { ascending: true });

    setLoading(false);

    if (error) {
      setErr("مش قادر أجيب المحاضرات. تأكد إنك شغّلت SQL بتاع kind/formative_no.");
      return;
    }

    const all = (data ?? []) as Lecture[];

    const lec = all.filter((x) => (x.kind ?? "lecture") !== "formative");
    const form = all
      .filter((x) => (x.kind ?? "lecture") === "formative")
      .sort((a, b) => ((a.formative_no ?? a.order_index) as number) - ((b.formative_no ?? b.order_index) as number));

    setLectures(lec);
    setFormatives(form);

    const maxLecture = lec.reduce((m, l) => Math.max(m, l.order_index), 0);
    setOrderIndex(String(Math.max(1, maxLecture + 1)));

    const maxForm = form.reduce((m, l) => Math.max(m, (l.formative_no ?? l.order_index) as number), 0);
    setFormativeNo(String(Math.max(1, maxForm + 1)));
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setOk(null);

    if (!canManage) {
      setErr("مش مسموح. الصفحة دي للمشرفين فقط.");
      return;
    }

    setBusy(true);
    try {
      if (kind === "formative") {
        const no = Number(formativeNo);
        if (!formativeNo.trim() || Number.isNaN(no) || no < 1 || no > 9999) {
          setErr("رقم الفورماتيف لازم يكون (1..9999).");
          return;
        }

        const title = buildFormativeTitle(no);

        const { error } = await supabase.from("lectures").insert({
          course_id: courseId,
          kind: "formative",
          formative_no: no,
          order_index: no,
          title,
        });

        if (error) {
          if ((error as any).code === "23505" || String(error.message).toLowerCase().includes("duplicate")) {
            setErr("في فورماتيف بنفس الرقم موجود. غيّر الرقم.");
          } else {
            setErr(`فشل إضافة الفورماتيف: ${error.message}`);
          }
          return;
        }

        setOk("تمت إضافة الفورماتيف ✅");
        await loadAll();
        return;
      }

      // lecture
      const order = Number(orderIndex);
      if (!orderIndex.trim() || Number.isNaN(order) || order < 0 || order > 9999) {
        setErr("رقم المحاضرة لازم يكون (1..9999). تقدر تستخدم 0 لـ 'عام'.");
        return;
      }

      const title = buildLectureTitle(order, topic, customTitle);

      const { error } = await supabase.from("lectures").insert({
        course_id: courseId,
        kind: "lecture",
        formative_no: null,
        title,
        order_index: order,
      });

      if (error) {
        if ((error as any).code === "23505" || String(error.message).toLowerCase().includes("duplicate")) {
          setErr("في محاضرة بنفس الرقم موجودة. جرّب رقم مختلف.");
        } else {
          setErr(`فشل إضافة المحاضرة: ${error.message}`);
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
        return { course_id: courseId, kind: "lecture", formative_no: null, title: `محاضرة ${num}`, order_index: num };
      });

      const { error } = await supabase
        .from("lectures")
        .upsert(rows, { onConflict: "course_id,kind,order_index", ignoreDuplicates: true });

      if (error) {
        setErr(`فشل إنشاء المحاضرات: ${error.message}`);
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

    const isForm = (l.kind ?? "lecture") === "formative";
    const v = isForm ? (l.formative_no ?? l.order_index) : l.order_index;

    setEditOrder(String(v));
    setEditTitle(l.title);
  }

  async function saveEdit(l: Lecture) {
    setEditErr(null);
    const order = Number(editOrder);
    if (!editOrder.trim() || Number.isNaN(order) || order < 0 || order > 9999) {
      setEditErr("رقم غير صحيح.");
      return;
    }

    const isForm = (l.kind ?? "lecture") === "formative";

    setBusy(true);
    try {
      if (isForm) {
        const title = buildFormativeTitle(order);
        const { error } = await supabase
          .from("lectures")
          .update({ order_index: order, formative_no: order, title })
          .eq("id", l.id);

        if (error) {
          if ((error as any).code === "23505" || String(error.message).toLowerCase().includes("duplicate")) {
            setEditErr("في فورماتيف بنفس الرقم موجود. غيّر الرقم.");
          } else {
            setEditErr(`فشل الحفظ: ${error.message}`);
          }
          return;
        }

        setEditingId(null);
        setOk("تم تحديث الفورماتيف ✅");
        await loadAll();
        return;
      }

      // lecture
      if (!editTitle.trim()) {
        setEditErr("العنوان مطلوب.");
        return;
      }

      const { error } = await supabase
        .from("lectures")
        .update({ order_index: order, title: editTitle.trim() })
        .eq("id", l.id);

      if (error) {
        if ((error as any).code === "23505" || String(error.message).toLowerCase().includes("duplicate")) {
          setEditErr("في محاضرة بنفس الرقم. غيّر الرقم.");
        } else {
          setEditErr(`فشل الحفظ: ${error.message}`);
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

  async function swapWithinKind(list: Lecture[], idx: number, isForm: boolean) {
    setErr(null);
    setOk(null);
    if (!canManage) return;

    const a = list[idx];
    const b = list[idx - 1];
    if (!a || !b) return;

    const tmp = -1 * Math.floor(Date.now() / 1000);

    setBusy(true);
    try {
      if (isForm) {
        // swap formative_no + order_index together
        await supabase.from("lectures").update({ order_index: tmp, formative_no: tmp, title: buildFormativeTitle(tmp) }).eq("id", a.id);
        await supabase.from("lectures").update({ order_index: a.order_index, formative_no: a.formative_no, title: buildFormativeTitle(a.formative_no ?? a.order_index) }).eq("id", b.id);
        await supabase.from("lectures").update({ order_index: b.order_index, formative_no: b.formative_no, title: buildFormativeTitle(b.formative_no ?? b.order_index) }).eq("id", a.id);
      } else {
        await supabase.from("lectures").update({ order_index: tmp }).eq("id", a.id);
        await supabase.from("lectures").update({ order_index: a.order_index }).eq("id", b.id);
        await supabase.from("lectures").update({ order_index: b.order_index }).eq("id", a.id);
      }

      await loadAll();
    } finally {
      setBusy(false);
    }
  }

  async function deleteItem(l: Lecture) {
    setErr(null);
    setOk(null);

    if (!canManage) return;

    const yes = confirm(
      "حذف العنصر؟\n\nملاحظة: الموارد داخلها مش هتتمسح، لكنها هتبقى 'محتوى عام' بعد الحذف."
    );
    if (!yes) return;

    setBusy(true);
    try {
      const { error } = await supabase.from("lectures").delete().eq("id", l.id);
      if (error) {
        setErr(`فشل الحذف: ${error.message}`);
        return;
      }
      setOk("تم الحذف ✅");
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
                  تقدر تضيف محاضرات + فورماتيف (عنوان تلقائي: فورماتيف 1/2/3…).
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
            <p className="error">دورك الحالي: {role ?? "غير معروف"} — مش مسموح بالدخول لصفحة الإدارة.</p>
          ) : null}

          {err ? <p className="error">{err}</p> : null}
          {ok ? <p className="success">{ok}</p> : null}
        </div>

        <div className="grid" style={{ marginTop: 12 }}>
          <div className="col-12 col-6">
            <div className="card">
              <h2>إضافة</h2>

              <div style={{ marginTop: 10 }}>
                <label className="label">النوع</label>
                <select className="select" value={kind} onChange={(e) => setKind(e.target.value as any)} disabled={busy || !canManage}>
                  <option value="lecture">محاضرة</option>
                  <option value="formative">فورماتيف</option>
                </select>
              </div>

              <form onSubmit={addItem} style={{ marginTop: 12 }}>
                {kind === "formative" ? (
                  <>
                    <label className="label">رقم الفورماتيف</label>
                    <input
                      className="input"
                      type="number"
                      value={formativeNo}
                      onChange={(e) => setFormativeNo(e.target.value)}
                      disabled={busy || !canManage}
                    />

                    <div style={{ height: 8 }} />
                    <label className="label">العنوان (تلقائي)</label>
                    <input className="input" value={buildFormativeTitle(Number(formativeNo || "1"))} disabled />
                  </>
                ) : (
                  <>
                    <p className="muted" style={{ marginTop: 0 }}>اكتب رقم المحاضرة + (اختياري) اسمها بين قوسين.</p>

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
                          placeholder="لو عايز عنوان مختلف بالكامل"
                          disabled={busy || !canManage}
                        />
                        <p className="muted" style={{ marginTop: 6 }}>
                          لو سيبت العنوان المخصص فاضي، هنكوّن عنوان تلقائيًا: محاضرة X (Topic).
                        </p>
                      </div>
                    </div>
                  </>
                )}

                <div style={{ height: 12 }} />
                <button className="btn" type="submit" disabled={busy || !canManage}>
                  {busy ? "..." : "إضافة"}
                </button>
              </form>

              <div className="divider" />

              <h2>إنشاء تلقائي (محاضرات فقط)</h2>
              <p className="muted" style={{ marginTop: 0 }}>
                ينشئ محاضرات "محاضرة 1" إلى "محاضرة N" (بدون ما يكرر الموجود).
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

              {editingId ? <p className="muted" style={{ marginTop: 6 }}>وضع التعديل نشط — عدّل ثم احفظ.</p> : null}
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
                                <input className="input" type="number" value={editOrder} onChange={(e) => setEditOrder(e.target.value)} disabled={busy} />
                              </div>
                              <div className="col-12 col-8">
                                <label className="label">العنوان</label>
                                <input className="input" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} disabled={busy} />
                              </div>
                            </div>
                          ) : (
                            <>
                              <h3 className="resource__title" style={{ marginBottom: 6 }}>{l.title}</h3>
                              <span className="pill">ترتيب: {l.order_index}</span>
                            </>
                          )}
                        </div>

                        {canManage ? (
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <button className="iconBtn" type="button" disabled={busy || idx === 0} title="أعلى" onClick={() => swapWithinKind(lectures, idx, false)}>▲</button>
                            <button className="iconBtn" type="button" disabled={busy || idx === lectures.length - 1} title="أسفل" onClick={() => swapWithinKind(lectures, idx + 1, false)}>▼</button>

                            {isEditing ? (
                              <>
                                <button className="btn" type="button" disabled={busy} onClick={() => saveEdit(l)}>حفظ</button>
                                <button className="btn btn--ghost" type="button" disabled={busy} onClick={() => { setEditingId(null); setEditErr(null); }}>إلغاء</button>
                              </>
                            ) : (
                              <>
                                <button className="btn btn--ghost" type="button" disabled={busy} onClick={() => startEdit(l)}>تعديل</button>
                                <button className="btn btn--danger" type="button" disabled={busy} onClick={() => deleteItem(l)}>حذف</button>
                              </>
                            )}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}

                {!loading && lectures.length === 0 ? (
                  <div className="card"><p className="muted">مفيش محاضرات لسه.</p></div>
                ) : null}
              </div>

              <div className="divider" />

              <h2>قائمة الفورماتيف</h2>
              <p className="muted" style={{ marginTop: 0 }}>
                {loading ? "جاري التحميل…" : `${formatives.length} فورماتيف`}
              </p>

              <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                {formatives.map((f, idx) => {
                  const isEditing = editingId === f.id;
                  const no = (f.formative_no ?? f.order_index) as number;

                  return (
                    <div key={f.id} className="card" style={{ padding: 12 }}>
                      <div className="resource__row">
                        <div style={{ minWidth: 0 }}>
                          {isEditing ? (
                            <div className="grid">
                              <div className="col-12 col-6">
                                <label className="label">رقم الفورماتيف</label>
                                <input className="input" type="number" value={editOrder} onChange={(e) => setEditOrder(e.target.value)} disabled={busy} />
                              </div>
                              <div className="col-12 col-6">
                                <label className="label">العنوان (تلقائي)</label>
                                <input className="input" value={buildFormativeTitle(Number(editOrder || "1"))} disabled />
                              </div>
                            </div>
                          ) : (
                            <>
                              <h3 className="resource__title" style={{ marginBottom: 6 }}>{buildFormativeTitle(no)}</h3>
                              <span className="pill">رقم: {no}</span>
                            </>
                          )}
                        </div>

                        {canManage ? (
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {isEditing ? (
                              <>
                                <button className="btn" type="button" disabled={busy} onClick={() => saveEdit(f)}>حفظ</button>
                                <button className="btn btn--ghost" type="button" disabled={busy} onClick={() => { setEditingId(null); setEditErr(null); }}>إلغاء</button>
                              </>
                            ) : (
                              <>
                                <button className="btn btn--ghost" type="button" disabled={busy} onClick={() => startEdit(f)}>تعديل</button>
                                <button className="btn btn--danger" type="button" disabled={busy} onClick={() => deleteItem(f)}>حذف</button>
                              </>
                            )}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}

                {!loading && formatives.length === 0 ? (
                  <div className="card"><p className="muted">مفيش فورماتيفات. ابدأ بـ فورماتيف 1.</p></div>
                ) : null}
              </div>

              <p className="muted" style={{ marginTop: 12 }}>
                نصيحة: المحاضرات 1..N، وتقدر تضيف "عام" بالترتيب 0. والفورماتيف رقمه بيحدد عنوانه تلقائيًا.
              </p>
            </div>
          </div>
        </div>
      </main>
    </AppShell>
  );
}
