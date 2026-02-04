"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import ResourceRow, { type ResourceRowItem } from "@/components/ResourceRow";
import { supabase } from "@/lib/supabase";
import { ChevronRightIcon, FolderIcon } from "@/components/icons/FileIcons";

type Course = {
  id: string;
  code: string;
  name: string;
  semester: number | null;
  description: string | null;
};

type Lecture = {
  id: string;
  title: string;
  order_index: number;
};

type Resource = ResourceRowItem & {
  lecture_id: string | null;
  created_at: string;
};

function yearLabelFromSemester(semester?: number | null) {
  if (!semester || semester <= 0) return null;
  const year = Math.max(1, Math.ceil(semester / 2));
  const ord: Record<number, string> = {
    1: "الأولى",
    2: "الثانية",
    3: "الثالثة",
    4: "الرابعة",
    5: "الخامسة",
    6: "السادسة",
  };
  const suffix = ord[year] ?? String(year);
  return `الفرقة ${suffix}`;
}

export default function CoursePage() {
  const params = useParams<{ courseId: string }>();
  const courseId = params.courseId;
  const router = useRouter();
  const sp = useSearchParams();

  const [course, setCourse] = useState<Course | null>(null);
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [type, setType] = useState<string>("الكل");
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setErr(null);

      const [cRes, lRes, rRes] = await Promise.all([
        supabase
          .from("courses")
          .select("id, code, name, semester, description")
          .eq("id", courseId)
          .single(),
        supabase
          .from("lectures")
          .select("id, title, order_index")
          .eq("course_id", courseId)
          .order("order_index", { ascending: true }),
        supabase
          .from("resources")
          .select(
            "id, title, type, description, storage_path, external_url, created_at, lecture_id"
          )
          .eq("course_id", courseId)
          .order("created_at", { ascending: false }),
      ]);

      setLoading(false);

      if (cRes.error) {
        setErr("مش قادر أجيب بيانات المادة.");
        return;
      }
      setCourse(cRes.data as Course);

      if (lRes.error) {
        setErr("مش قادر أجيب المحاضرات.");
        return;
      }
      setLectures((lRes.data ?? []) as Lecture[]);

      if (rRes.error) {
        setErr("مش قادر أجيب ملفات المادة.");
        return;
      }
      setResources((rRes.data ?? []) as Resource[]);
    }

    load();
  }, [courseId]);

  // Apply initial open lecture from query param (or first lecture).
  useEffect(() => {
    const fromQuery = sp.get("lecture");
    if (!fromQuery) return;
    setOpenId(fromQuery);
  }, [sp]);

  useEffect(() => {
    if (openId) return;

    // Prefer lecture from URL, else first lecture that has resources, else first lecture, else general if exists.
    const hasGeneral = resources.some((r) => !r.lecture_id);
    const firstWithResources = lectures.find((l) => resources.some((r) => r.lecture_id === l.id));
    const fallback = firstWithResources?.id || lectures[0]?.id || (hasGeneral ? "__general__" : null);
    if (fallback) setOpenId(fallback);
  }, [openId, lectures, resources]);

  const typeOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of resources) set.add(r.type);
    return ["الكل", ...Array.from(set).sort((a, b) => a.localeCompare(b, "ar"))];
  }, [resources]);

  const filteredResources = useMemo(() => {
    const s = q.trim().toLowerCase();
    return resources.filter((r) => {
      if (type !== "الكل" && r.type !== type) return false;
      if (!s) return true;
      const hay = `${r.title} ${r.description ?? ""}`.toLowerCase();
      return hay.includes(s);
    });
  }, [resources, q, type]);

  const generalResources = useMemo(
    () => filteredResources.filter((r) => !r.lecture_id),
    [filteredResources]
  );

  const resourcesByLecture = useMemo(() => {
    const m = new Map<string, Resource[]>();
    for (const r of filteredResources) {
      const k = r.lecture_id ?? "__general__";
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(r);
    }
    return m;
  }, [filteredResources]);

  const lectureNodes: Array<{ id: string; title: string; order_index: number }> = useMemo(() => {
    const out = [...lectures];
    if (generalResources.length) {
      out.unshift({ id: "__general__", title: "محتوى عام", order_index: -1 });
    }
    return out;
  }, [lectures, generalResources.length]);

  function toggle(id: string) {
    const next = openId === id ? null : id;
    setOpenId(next);

    // Keep URL shareable.
    const nextParams = new URLSearchParams(sp.toString());
    if (next) nextParams.set("lecture", next);
    else nextParams.delete("lecture");
    const qs = nextParams.toString();
    router.replace(qs ? `/courses/${courseId}?${qs}` : `/courses/${courseId}`, { scroll: false });
  }

  return (
    <AppShell>
      <main className="container">
        <div className="card">
          <div className="sectionHeader">
            <div className="sectionTitle" style={{ minWidth: 0 }}>
              <div style={{ minWidth: 0 }}>
                <p className="muted" style={{ marginTop: 0, marginBottom: 6 }}>
                  <Link href="/dashboard" style={{ textDecoration: "underline" }}>
                    الرئيسية
                  </Link>
                  {" "}‹{" "}
                  <span>
                    {course?.semester
                      ? yearLabelFromSemester(course.semester) ?? `ترم ${course.semester}`
                      : "..."}
                  </span>
                  {" "}‹{" "}
                  <span>{course?.code ?? "..."}</span>
                </p>
                <h1 style={{ marginBottom: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {course ? `${course.code} — ${course.name}` : "..."}
                </h1>
                {course?.description ? (
                  <p className="muted" style={{ marginTop: 0 }}>
                    {course.description}
                  </p>
                ) : (
                  <p className="muted" style={{ marginTop: 0 }}>
                    افتح المحاضرة → هتلاقي السلايدات، الريكوردات، واللينكات.
                  </p>
                )}
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link className="btn" href={`/mcq?course=${courseId}`}>
                MCQ للمادة
              </Link>
              <Link className="btn btn--ghost" href="/mcq/history">
                سجل المحاولات
              </Link>
            </div>
          </div>

          <div className="grid" style={{ marginTop: 12 }}>
            <div className="col-12 col-6">
              <label className="label">بحث</label>
              <input
                className="input"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="اكتب اسم ملف أو كلمة من الوصف…"
              />
            </div>

            <div className="col-12 col-6">
              <label className="label">نوع المحتوى</label>
              <select className="select" value={type} onChange={(e) => setType(e.target.value)}>
                {typeOptions.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {err ? <p className="error">{err}</p> : null}
          {loading ? <p className="muted">جاري التحميل…</p> : null}
        </div>

        {!loading ? (
          <div className="lectureTree">
            {lectureNodes.map((l) => {
              const list = resourcesByLecture.get(l.id) ?? [];
              const open = openId === l.id;
              return (
                <div key={l.id} className={open ? "lectureNode isOpen" : "lectureNode"}>
                  <button className="lectureNode__btn" onClick={() => toggle(l.id)}>
                    <div className="lectureNode__left">
                      <div className="lectureNode__folder" aria-hidden>
                        <FolderIcon />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div className="lectureNode__title">{l.title}</div>
                        <div className="lectureNode__count">{list.length} ملف</div>
                      </div>
                    </div>

                    <div className="lectureNode__meta">
                      <div className="lectureNode__chev" aria-hidden>
                        <ChevronRightIcon />
                      </div>
                    </div>
                  </button>

                  {open ? (
                    <div className="lectureNode__content">
                      {list.length ? (
                        list.map((r) => (
                          <ResourceRow
                            key={r.id}
                            r={r}
                            ctx={{
                              course_id: courseId,
                              course_code: course?.code ?? null,
                              course_name: course?.name ?? null,
                              lecture_key: l.id,
                              lecture_title: l.title,
                            }}
                          />
                        ))
                      ) : (
                        <div className="card card--soft">
                          <p className="muted" style={{ marginTop: 0 }}>
                            لا يوجد محتوى مطابق (جرّب تمسح البحث أو تغيّر نوع المحتوى).
                          </p>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}

            {lectureNodes.length === 0 ? (
              <div className="card">
                <h2>لا توجد محاضرات بعد</h2>
                <p className="muted">اتأكد إن المشرف أضاف محاضرات للمادة.</p>
              </div>
            ) : null}
          </div>
        ) : null}
      </main>
    </AppShell>
  );
}
