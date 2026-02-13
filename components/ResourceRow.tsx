"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { AttachmentIcon, AudioIcon, LinkIcon, PdfIcon } from "@/components/icons/FileIcons";
import { IconStar, IconStarFilled } from "@/components/icons";
import {
  FAVORITES_CHANGED_EVENT,
  isFavorite,
  removeFavorite,
  toggleFavorite,
  updateFavoriteMeta,
} from "@/lib/favorites";

export type ResourceRowItem = {
  id: string;
  title: string;
  type: string;
  description: string | null;
  storage_path: string | null;
  external_url: string | null;
};

export type ResourceRowContext = {
  course_id: string | null;
  course_code?: string | null;
  course_name?: string | null;
  lecture_key?: string | null; // lecture_id or "__general__"
  lecture_title?: string | null;
};

const DEFAULT_TYPES = ["كتاب", "ملخص", "سلايدات", "امتحان سابق", "أسئلة", "ريكورد", "لينك"];

function safeFileName(name: string) {
  return name.replace(/[^\w.\-() ]+/g, "_");
}

function iconClassFor(t: string) {
  const v = (t || "").toLowerCase();
  if (
    v.includes("pdf") ||
    v.includes("slides") ||
    v.includes("سلايد") ||
    v.includes("كتاب") ||
    v.includes("ملخص") ||
    v.includes("امتحان")
  )
    return "fileIcon fileIcon--pdf";
  if (v.includes("record") || v.includes("audio") || v.includes("mp3") || v.includes("ريكورد"))
    return "fileIcon fileIcon--audio";
  if (v.includes("link") || v.includes("لينك")) return "fileIcon fileIcon--link";
  return "fileIcon";
}

function iconFor(t: string) {
  const v = (t || "").toLowerCase();
  if (
    v.includes("pdf") ||
    v.includes("slides") ||
    v.includes("سلايد") ||
    v.includes("كتاب") ||
    v.includes("ملخص") ||
    v.includes("امتحان")
  )
    return <PdfIcon />;
  if (v.includes("record") || v.includes("audio") || v.includes("mp3") || v.includes("ريكورد"))
    return <AudioIcon />;
  if (v.includes("link") || v.includes("لينك")) return <LinkIcon />;
  return <AttachmentIcon />;
}

export default function ResourceRow({
  r,
  ctx,
  canManage = false,
  onChanged,
}: {
  r: ResourceRowItem;
  ctx?: ResourceRowContext;
  canManage?: boolean;
  onChanged?: () => void | Promise<void>;
}) {
  const [opening, setOpening] = useState(false);
  const [mutating, setMutating] = useState(false);
  const busy = opening || mutating;

  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [fav, setFav] = useState(false);

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editType, setEditType] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editExternalUrl, setEditExternalUrl] = useState("");
  const [editFile, setEditFile] = useState<File | null>(null);
  const [deleteOldFile, setDeleteOldFile] = useState(true);

  const iconClass = useMemo(() => iconClassFor(r.type), [r.type]);
  const iconSvg = useMemo(() => iconFor(r.type), [r.type]);

  useEffect(() => {
    const sync = () => setFav(isFavorite(r.id));
    sync();

    if (typeof window !== "undefined") {
      window.addEventListener(FAVORITES_CHANGED_EVENT, sync);
      return () => window.removeEventListener(FAVORITES_CHANGED_EVENT, sync);
    }
  }, [r.id]);

  async function openResource() {
    setErr(null);
    setOk(null);
    if (busy) return;

    if (r.external_url) {
      window.open(r.external_url, "_blank", "noopener,noreferrer");
      return;
    }

    if (!r.storage_path) {
      setErr("لا يوجد ملف مرتبط.");
      return;
    }

    setOpening(true);
    try {
      const { data, error } = await supabase.storage.from("resources").createSignedUrl(r.storage_path, 60);

      if (error || !data?.signedUrl) {
        setErr("مش قادر أفتح الملف. تأكد من سياسات Storage.");
        return;
      }

      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } finally {
      setOpening(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openResource();
    }
  }

  function toggleFav(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    setErr(null);
    setOk(null);

    const next = toggleFavorite({
      id: r.id,
      title: r.title,
      type: r.type,
      description: r.description,
      storage_path: r.storage_path,
      external_url: r.external_url,
      course_id: ctx?.course_id ?? null,
      course_code: ctx?.course_code ?? null,
      course_name: ctx?.course_name ?? null,
      lecture_key: ctx?.lecture_key ?? null,
      lecture_title: ctx?.lecture_title ?? null,
    });

    setFav(next);
  }

  function startEdit(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (!canManage) return;

    setErr(null);
    setOk(null);

    const next = !editing;
    setEditing(next);

    if (next) {
      setEditTitle(r.title);
      setEditType(r.type);
      setEditDescription(r.description ?? "");
      setEditExternalUrl(r.external_url ?? "");
      setEditFile(null);
      setDeleteOldFile(true);
    }
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setOk(null);

    if (!canManage) {
      setErr("مش مسموح. التعديل للمشرفين فقط.");
      return;
    }

    if (!editTitle.trim()) {
      setErr("اكتب عنوان.");
      return;
    }

    if (!editType.trim()) {
      setErr("اختار/اكتب نوع المحتوى.");
      return;
    }

    const nextExternal = editExternalUrl.trim() ? editExternalUrl.trim() : null;
    const prevStorage = r.storage_path;
    let nextStorage = r.storage_path;
    let uploadedPath: string | null = null;
    let warning: string | null = null;

    setMutating(true);
    try {
      if (editFile) {
        const courseSeg = ctx?.course_id ?? "misc";
        const lectureSeg = ctx?.lecture_key && ctx.lecture_key !== "__general__" ? ctx.lecture_key : "general";
        const path = `${courseSeg}/${lectureSeg}/${Date.now()}_${safeFileName(editFile.name)}`;

        const { error: upErr } = await supabase.storage.from("resources").upload(path, editFile, { upsert: false });

        if (upErr) {
          setErr("فشل رفع الملف الجديد. تأكد من سياسات Storage.");
          return;
        }

        uploadedPath = path;
        nextStorage = path;
      }

      if (!nextStorage && !nextExternal) {
        setErr("لازم يكون في ملف أو لينك خارجي.");
        return;
      }

      const { error: updErr } = await supabase
        .from("resources")
        .update({
          title: editTitle.trim(),
          type: editType.trim(),
          description: editDescription.trim() ? editDescription.trim() : null,
          external_url: nextExternal,
          storage_path: nextStorage,
        })
        .eq("id", r.id);

      if (updErr) {
        if (uploadedPath) {
          await supabase.storage.from("resources").remove([uploadedPath]);
        }
        setErr("فشل حفظ التعديل. تأكد من الصلاحيات (RLS). ");
        return;
      }

      if (uploadedPath && deleteOldFile && prevStorage) {
        const { error: rmOldErr } = await supabase.storage.from("resources").remove([prevStorage]);
        if (rmOldErr) {
          warning = "تم رفع الملف الجديد ✅ لكن حذف الملف القديم من Storage فشل. ممكن تحذفه يدويًا من Supabase.";
        }
      }

      if (isFavorite(r.id)) {
        updateFavoriteMeta(r.id, {
          title: editTitle.trim(),
          type: editType.trim(),
          description: editDescription.trim() ? editDescription.trim() : null,
          external_url: nextExternal,
          storage_path: nextStorage,
        });
      }

      setOk("تم تحديث المحتوى ✅");
      setEditing(false);
      setEditFile(null);

      if (warning) setErr(warning);
      if (onChanged) await onChanged();
    } finally {
      setMutating(false);
    }
  }

  async function deleteResource(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setErr(null);
    setOk(null);

    if (!canManage) {
      setErr("مش مسموح. الحذف للمشرفين فقط.");
      return;
    }

    const yes = confirm(
      "متأكد إنك عايز تحذف المحتوى ده؟\n\nهيتم حذفه من الداتا بيز، ولو فيه ملف مرفوع هيتحذف من الـ Storage كمان."
    );
    if (!yes) return;

    let warning: string | null = null;
    const oldPath = r.storage_path;

    setMutating(true);
    try {
      const { error: delErr } = await supabase.from("resources").delete().eq("id", r.id);
      if (delErr) {
        setErr("فشل حذف المحتوى من الداتا بيز. تأكد من الصلاحيات (RLS).");
        return;
      }

      if (oldPath) {
        const { error: stErr } = await supabase.storage.from("resources").remove([oldPath]);
        if (stErr) {
          warning = "ملاحظة: تم حذف المحتوى من الداتا بيز ✅ لكن حذف الملف من Storage فشل. ممكن تحذفه يدويًا من Supabase.";
        }
      }

      removeFavorite(r.id);
      setOk("تم حذف المحتوى ✅");
      setEditing(false);

      if (warning) setErr(warning);
      if (onChanged) await onChanged();
    } finally {
      setMutating(false);
    }
  }

  return (
    <div>
      <div className="fileRow" role="button" tabIndex={0} onClick={openResource} onKeyDown={onKeyDown} aria-disabled={busy}>
        <div className="fileRow__left">
          <div className={iconClass} aria-hidden>
            {iconSvg}
          </div>

          <div style={{ minWidth: 0 }}>
            <div className="fileRow__title">{r.title}</div>
            {r.description ? <div className="fileRow__sub">{r.description}</div> : null}
          </div>
        </div>

        <div className="fileRow__right">
          {canManage ? (
            <>
              <button
                type="button"
                className={editing ? "favBtn favBtn--edit isActive" : "favBtn favBtn--edit"}
                onClick={startEdit}
                aria-label={editing ? "إغلاق التعديل" : "تعديل"}
                title={editing ? "إغلاق التعديل" : "تعديل"}
              >
                ✏️
              </button>

              <button
                type="button"
                className="favBtn favBtn--danger"
                onClick={deleteResource}
                aria-label="حذف"
                title="حذف"
                disabled={busy}
              >
                🗑️
              </button>
            </>
          ) : null}

          <button
            type="button"
            className={fav ? "favBtn isActive" : "favBtn"}
            onClick={toggleFav}
            aria-label={fav ? "إزالة من المفضلة" : "إضافة للمفضلة"}
            title={fav ? "إزالة من المفضلة" : "إضافة للمفضلة"}
          >
            {fav ? <IconStarFilled size={18} /> : <IconStar size={18} />}
          </button>

          <span className="fileRow__badge">{r.type}</span>

          <span className="muted" style={{ fontSize: 12 }}>
            {opening ? "..." : "فتح"}
          </span>
        </div>
      </div>

      {editing && canManage ? (
        <div className="card card--soft" style={{ marginTop: 8 }}>
          <form onSubmit={saveEdit}>
            <div className="grid">
              <div className="col-12 col-6">
                <label className="label">العنوان</label>
                <input className="input" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} disabled={busy} />
              </div>

              <div className="col-12 col-6">
                <label className="label">نوع المحتوى</label>
                <select className="select" value={editType} onChange={(e) => setEditType(e.target.value)} disabled={busy}>
                  {Array.from(new Set([r.type, ...DEFAULT_TYPES])).map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-12">
                <label className="label">وصف (اختياري)</label>
                <textarea className="textarea" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={3} disabled={busy} />
              </div>

              <div className="col-12 col-6">
                <label className="label">لينك خارجي (اختياري)</label>
                <input
                  className="input"
                  value={editExternalUrl}
                  onChange={(e) => setEditExternalUrl(e.target.value)}
                  placeholder="https://..."
                  disabled={busy}
                />
                <p className="muted" style={{ marginTop: 6 }}>
                  {r.external_url ? "كان فيه لينك قبل كده. سيبه فاضي علشان يتم مسحه." : ""}
                </p>
              </div>

              <div className="col-12 col-6">
                <label className="label">استبدال الملف (اختياري)</label>
                <input className="input" type="file" onChange={(e) => setEditFile(e.target.files?.[0] ?? null)} disabled={busy} />

                {r.storage_path ? (
                  <label className="muted" style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
                    <input type="checkbox" checked={deleteOldFile} onChange={(e) => setDeleteOldFile(e.target.checked)} disabled={busy} />
                    حذف الملف القديم من Storage بعد الرفع
                  </label>
                ) : (
                  <p className="muted" style={{ marginTop: 8 }}>
                    لو المورد ده كان لينك بس، تقدر تضيف ملف جديد هنا.
                  </p>
                )}
              </div>
            </div>

            <div style={{ height: 12 }} />
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="btn" type="submit" disabled={busy}>
                {mutating ? "جاري الحفظ…" : "حفظ التعديل"}
              </button>
              <button
                className="btn btn--ghost"
                type="button"
                onClick={() => {
                  if (busy) return;
                  setEditing(false);
                  setErr(null);
                  setOk(null);
                }}
                disabled={busy}
              >
                إلغاء
              </button>
            </div>

            {ok ? <p className="success">{ok}</p> : null}
            {err ? <p className="error">{err}</p> : null}
          </form>
        </div>
      ) : null}

      {!editing && ok ? <p className="success">{ok}</p> : null}
      {!editing && err ? <p className="error">{err}</p> : null}
    </div>
  );
}
