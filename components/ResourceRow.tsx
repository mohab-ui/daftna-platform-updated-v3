"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { AttachmentIcon, AudioIcon, LinkIcon, PdfIcon } from "@/components/icons/FileIcons";
import { IconStar, IconStarFilled } from "@/components/icons";
import { FAVORITES_CHANGED_EVENT, isFavorite, toggleFavorite } from "@/lib/favorites";

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

export default function ResourceRow({ r, ctx }: { r: ResourceRowItem; ctx?: ResourceRowContext }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [fav, setFav] = useState(false);

  const iconClass = useMemo(() => iconClassFor(r.type), [r.type]);
  const iconSvg = useMemo(() => iconFor(r.type), [r.type]);

  useEffect(() => {
    // init favorite state + keep in sync
    const sync = () => setFav(isFavorite(r.id));
    sync();

    if (typeof window !== "undefined") {
      window.addEventListener(FAVORITES_CHANGED_EVENT, sync);
      return () => window.removeEventListener(FAVORITES_CHANGED_EVENT, sync);
    }
  }, [r.id]);

  async function openResource() {
    setErr(null);
    if (busy) return;

    if (r.external_url) {
      window.open(r.external_url, "_blank", "noopener,noreferrer");
      return;
    }

    if (!r.storage_path) {
      setErr("لا يوجد ملف مرتبط.");
      return;
    }

    setBusy(true);
    try {
      const { data, error } = await supabase.storage.from("resources").createSignedUrl(r.storage_path, 60);

      if (error || !data?.signedUrl) {
        setErr("مش قادر أفتح الملف. تأكد من سياسات Storage.");
        return;
      }

      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } finally {
      setBusy(false);
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

  return (
    <div>
      <div
        className="fileRow"
        role="button"
        tabIndex={0}
        onClick={openResource}
        onKeyDown={onKeyDown}
        aria-disabled={busy}
      >
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
            {busy ? "..." : "فتح"}
          </span>
        </div>
      </div>

      {err ? (
        <div className="muted" style={{ marginTop: 6, color: "var(--danger)" }}>
          {err}
        </div>
      ) : null}
    </div>
  );
}
