"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import { supabase } from "@/lib/supabase";
import { getMyProfile, isModerator } from "@/lib/profile";

type Course = { id: string; code: string; name: string };
type Lecture = { id: string; title: string; order_index: number };

const TYPES = ["كتاب", "ملخص", "سلايدات", "امتحان سابق", "أسئلة", "ريكورد", "لينك"];

function mb(bytes: number) {
  return Math.round((bytes / (1024 * 1024)) * 10) / 10;
}

export default function UploadPage() {
  const router = useRouter();

  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState<string>("");
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [lectureId, setLectureId] = useState<string>("");

  const [title, setTitle] = useState("");
  const [type, setType] = useState(TYPES[0]);
  const [description, setDescription] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);

  const canUpload = useMemo(() => isModerator(role as any), [role]);

  async function loadLecturesForCourse(cId: string, allowAutoCreate: boolean) {
    const { data, error } = await supabase
      .from("lectures")
      .select("id, title, order_index")
      .eq("course_id", cId)
      .order("order_index", { ascending: true });

    if (!error && (data ?? []).length > 0) {
      const list = (data ?? []) as Lecture[];
      setLectures(list);
      if (!lectureId || !list.some((l) => l.id === lectureId)) {
        setLectureId(list[0].id);
      }
      return;
    }

    // If no lectures yet — auto create a default one (only for moderators)
    if (allowAutoCreate) {
      const { error: insErr } = await supabase
        .from("lectures")
        .insert({ course_id: cId, title: "عام", order_index: 0 });

      // If conflict happens (already exists), ignore and just refetch
      if (insErr && !String(insErr.message).toLowerCase().includes("duplicate")) {
        // keep empty; admin can create from manage page
      }

      const { data: data2 } = await supabase
        .from("lectures")
        .select("id, title, order_index")
        .eq("course_id", cId)
        .order("order_index", { ascending: true });

      const list2 = (data2 ?? []) as Lecture[];
      setLectures(list2);
      if (list2.length) setLectureId(list2[0].id);
      return;
    }

    setLectures([]);
    setLectureId("");
  }

  useEffect(() => {
    async function init() {
      setErr(null);

      const profile = await getMyProfile();
      setRole(profile?.role ?? null);

      const { data, error } = await supabase
        .from("courses")
        .select("id, code, name")
        .order("code", { ascending: true });

      if (error) {
        setErr("مش قادر أجيب المواد.");
        return;
      }

      const list = (data ?? []) as Course[];
      setCourses(list);

      const first = list[0]?.id ?? "";
      setCourseId((prev) => prev || first);

      if (first) {
        await loadLecturesForCourse(first, isModerator(profile?.role as any));
      }
    }

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When course changes, reload lectures
  useEffect(() => {
    if (!courseId) return;
    loadLecturesForCourse(courseId, canUpload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, canUpload]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setStatus(null);

    if (!canUpload) {
      setErr("مش مسموح بالرفع غير للمشرفين.");
      return;
    }

    if (!courseId) {
      setErr("اختار مادة.");
      return;
    }

    if (!lectureId) {
      setErr("اختار محاضرة (أو أنشئ محاضرة من صفحة الإدارة).");
      return;
    }

    if (!title.trim()) {
      setErr("اكتب عنوان.");
      return;
    }

    if (!file && !externalUrl.trim()) {
      setErr("لازم ترفع ملف أو تحط لينك خارجي.");
      return;
    }

    setBusy(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) {
        setErr("لازم تكون مسجل دخول.");
        return;
      }

      let storage_path: string | null = null;
      let external_url: string | null = externalUrl.trim() ? externalUrl.trim() : null;

      if (file) {
        setStatus("جاري رفع الملف…");
        const safeName = file.name.replace(/[^\w.\-() ]+/g, "_");
        const path = `${courseId}/${lectureId}/${Date.now()}_${safeName}`;

        const { error: upErr } = await supabase.storage
          .from("resources")
          .upload(path, file, { upsert: false });

        if (upErr) {
          setErr("فشل رفع الملف. تأكد من سياسات الـ Storage.");
          return;
        }

        storage_path = path;
      }

      setStatus("جاري حفظ البيانات…");

      const { error: insErr } = await supabase.from("resources").insert({
        course_id: courseId,
        lecture_id: lectureId,
        title: title.trim(),
        type,
        description: description.trim() ? description.trim() : null,
        storage_path,
        external_url,
        uploader_id: userId,
      });

      if (insErr) {
        setErr("فشل حفظ البيانات في قاعدة البيانات. تأكد من RLS.");
        return;
      }

      setStatus("تم ✅");
      router.replace(`/courses/${courseId}?lecture=${lectureId}`);
    } finally {
      setBusy(false);
      setTimeout(() => setStatus(null), 1500);
    }
  }

  return (
    <AppShell>
      <main className="container">
        <div className="card">
          <h1>رفع محتوى</h1>
          <p className="muted">
            الرفع متاح للمشرفين فقط. الأفضل للكتب الكبيرة: ارفعها على Google Drive وحطها كـ لينك.
          </p>

          {!canUpload ? (
            <p className="error">
              دورك الحالي: {role ?? "غير معروف"} — مش مسموح بالرفع.
            </p>
          ) : null}
        </div>

        <div className="card" style={{ marginTop: 12 }}>
          <form onSubmit={onSubmit}>
            <div className="grid">
              <div className="col-12 col-6">
                <label className="label">المادة</label>
                <select
                  className="select"
                  value={courseId}
                  onChange={(e) => setCourseId(e.target.value)}
                  disabled={busy}
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-12 col-6">
                <label className="label">المحاضرة</label>
                <select
                  className="select"
                  value={lectureId}
                  onChange={(e) => setLectureId(e.target.value)}
                  disabled={busy || lectures.length === 0}
                >
                  {lectures.length === 0 ? (
                    <option value="">لا يوجد محاضرات بعد</option>
                  ) : null}
                  {lectures.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.title}
                    </option>
                  ))}
                </select>

                {lectures.length === 0 ? (
                  <p className="muted" style={{ marginTop: 8 }}>
                    لازم تضيف محاضرات من{" "}
                    <Link href={`/admin/courses/${courseId}/lectures`} style={{ textDecoration: "underline" }}>
                      إدارة المحاضرات
                    </Link>
                    .
                  </p>
                ) : null}
              </div>

              <div className="col-12 col-6">
                <label className="label">نوع المحتوى</label>
                <select
                  className="select"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  disabled={busy}
                >
                  {TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-12 col-6">
                <label className="label">عنوان</label>
                <input
                  className="input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثال: سلايدات محاضرة 3"
                  disabled={busy}
                />
              </div>

              <div className="col-12">
                <label className="label">وصف (اختياري)</label>
                <textarea
                  className="textarea"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="محتوى الملف، للدوران/البحث…"
                  rows={4}
                  disabled={busy}
                />
              </div>

              <div className="col-12 col-6">
                <label className="label">رفع ملف (PDF/…)</label>
                <input
                  className="input"
                  type="file"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  disabled={busy}
                />
                {file ? (
                  <p className="muted" style={{ marginTop: 6 }}>
                    حجم الملف: {mb(file.size)} MB
                  </p>
                ) : (
                  <p className="muted" style={{ marginTop: 6 }}>
                    لو رفعت ملف، ممكن تسيب اللينك فاضي.
                  </p>
                )}
              </div>

              <div className="col-12 col-6">
                <label className="label">لينك خارجي (اختياري)</label>
                <input
                  className="input"
                  value={externalUrl}
                  onChange={(e) => setExternalUrl(e.target.value)}
                  placeholder="https://..."
                  disabled={busy}
                />
                <p className="muted" style={{ marginTop: 6 }}>
                  لو حطيت لينك، ممكن تسيب الملف فاضي.
                </p>
              </div>
            </div>

            <div style={{ height: 12 }} />
            <button className="btn" type="submit" disabled={busy || !canUpload}>
              {busy ? "جاري التنفيذ…" : "رفع وحفظ"}
            </button>

            {status ? <p className="success">{status}</p> : null}
            {err ? <p className="error">{err}</p> : null}
          </form>
        </div>

        <p className="muted" style={{ marginTop: 12 }}>
          تنبيه: ما ترفعش كتب محمية بحقوق نشر من غير إذن. الأفضل تستخدم OER أو ملفات مسموح مشاركتها.
        </p>
      </main>
    </AppShell>
  );
}
