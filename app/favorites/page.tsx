"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import ResourceRow from "@/components/ResourceRow";
import { FAVORITES_CHANGED_EVENT, type FavoriteResource, readFavorites, clearFavorites } from "@/lib/favorites";

function courseLabel(f: FavoriteResource) {
  if (f.course_code && f.course_name) return `${f.course_code} — ${f.course_name}`;
  if (f.course_code) return f.course_code;
  return "محتوى";
}

export default function FavoritesPage() {
  const [items, setItems] = useState<FavoriteResource[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    const load = () => setItems(readFavorites());
    load();

    if (typeof window !== "undefined") {
      window.addEventListener(FAVORITES_CHANGED_EVENT, load);
      return () => window.removeEventListener(FAVORITES_CHANGED_EVENT, load);
    }
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((f) => {
      const hay = `${f.title} ${f.description ?? ""} ${f.type} ${f.course_code ?? ""} ${f.course_name ?? ""} ${f.lecture_title ?? ""}`.toLowerCase();
      return hay.includes(s);
    });
  }, [items, q]);

  const groups = useMemo(() => {
    const m = new Map<string, FavoriteResource[]>();
    for (const f of filtered) {
      const key = f.course_id ?? "__unknown__";
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(f);
    }
    // keep each group ordered newest → oldest
    for (const [k, list] of m.entries()) {
      m.set(
        k,
        list.slice().sort((a, b) => (b.saved_at || "").localeCompare(a.saved_at || ""))
      );
    }
    return Array.from(m.entries());
  }, [filtered]);

  return (
    <AppShell>
      <main className="container">
        <div className="card">
          <div className="sectionHeader">
            <div className="sectionTitle">
              <div>
                <h1 style={{ marginBottom: 6 }}>المفضلة</h1>
                <p className="muted" style={{ marginTop: 0 }}>
                  اضغط ⭐ جنب أي ملف/لينك علشان يظهر هنا بسرعة.
                </p>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link className="btn" href="/dashboard">
                الرئيسية
              </Link>
              {items.length ? (
                <button
                  className="btn btn--ghost"
                  onClick={() => {
                    if (confirm("مسح كل المفضلة؟")) clearFavorites();
                  }}
                >
                  مسح الكل
                </button>
              ) : null}
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <label className="label">بحث في المفضلة</label>
            <input
              className="input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="اكتب اسم ملف، نوع، أو اسم مادة…"
            />
          </div>

          {!items.length ? (
            <div className="card card--soft" style={{ marginTop: 12 }}>
              <p className="muted" style={{ marginTop: 0 }}>
                لسه مفيش عناصر في المفضلة. روح لأي مادة واضغط ⭐ جنب الملف اللي عايز تحفظه.
              </p>
            </div>
          ) : null}

          {items.length && filtered.length === 0 ? (
            <div className="card card--soft" style={{ marginTop: 12 }}>
              <p className="muted" style={{ marginTop: 0 }}>
                مفيش نتائج مطابقة للبحث.
              </p>
            </div>
          ) : null}
        </div>

        {filtered.length ? (
          <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
            {groups.map(([courseId, list]) => (
              <div key={courseId} className="card">
                <div className="favGroupHeader">
                  <div className="favGroupTitle">{courseLabel(list[0])}</div>

                  {courseId !== "__unknown__" ? (
                    <Link className="btn btn--ghost" href={`/courses/${courseId}`}>
                      فتح المادة
                    </Link>
                  ) : null}
                </div>

                <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                  {list.map((f) => (
                    <div key={f.id}>
                      {f.course_id ? (
                        <div className="favMetaRow">
                          <Link
                            href={`/courses/${f.course_id}?lecture=${encodeURIComponent(
                              f.lecture_key ?? "__general__"
                            )}`}
                            className="favMetaLink"
                          >
                            {f.lecture_title ? `📁 ${f.lecture_title}` : "📁 محاضرة"}
                          </Link>
                          <span className="muted" style={{ fontSize: 12 }}>
                            {new Date(f.saved_at).toLocaleDateString("ar-EG")}
                          </span>
                        </div>
                      ) : null}

                      <ResourceRow
                        r={{
                          id: f.id,
                          title: f.title,
                          type: f.type,
                          description: f.description,
                          storage_path: f.storage_path,
                          external_url: f.external_url,
                        }}
                        ctx={{
                          course_id: f.course_id,
                          course_code: f.course_code,
                          course_name: f.course_name,
                          lecture_key: f.lecture_key,
                          lecture_title: f.lecture_title,
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </main>
    </AppShell>
  );
}
