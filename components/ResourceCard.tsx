"use client";

import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

export type Resource = {
  id: string;
  lecture_id?: string | null;
  title: string;
  type: string;
  description: string | null;
  storage_path: string | null;
  external_url: string | null;
  created_at: string;
};

function niceDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("ar-EG", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

function shortHost(url: string) {
  try {
    const u = new URL(url);
    return u.host.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export default function ResourceCard({ r }: { r: Resource }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const meta = useMemo(() => {
    if (r.external_url) return `🌐 ${shortHost(r.external_url)}`;
    if (r.storage_path) return "📄 ملف";
    return "—";
  }, [r.external_url, r.storage_path]);

  async function openOrDownload() {
    setErr(null);

    // External link resource
    if (r.external_url) {
      window.open(r.external_url, "_blank", "noopener,noreferrer");
      return;
    }

    if (!r.storage_path) {
      setErr("لا يوجد ملف مرتبط بالمحتوى ده.");
      return;
    }

    setBusy(true);
    try {
      const { data, error } = await supabase.storage
        .from("resources")
        .createSignedUrl(r.storage_path, 60);

      if (error || !data?.signedUrl) {
        setErr("حصلت مشكلة أثناء تجهيز رابط التحميل.");
        return;
      }

      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <div className="resource__row">
        <div style={{ minWidth: 0 }}>
          <h3 className="resource__title">{r.title}</h3>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            <span className="pill">{r.type}</span>
            <span className="pill">{meta}</span>
            <span className="pill">🗓 {niceDate(r.created_at)}</span>
          </div>
        </div>

        <button className="btn" onClick={openOrDownload} disabled={busy}>
          {busy ? "..." : r.external_url ? "فتح" : "تحميل"}
        </button>
      </div>

      {r.description ? <p className="muted">{r.description}</p> : null}
      {err ? <p className="error">{err}</p> : null}
    </div>
  );
}
