"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getMyProfile, isModerator, UserRole } from "@/lib/profile";

function roleLabel(role: UserRole | null) {
  if (role === "admin") return "Admin";
  if (role === "moderator") return "مشرف";
  if (role === "student") return "طالب";
  return "...";
}

export default function TopNav() {
  const router = useRouter();
  const [role, setRole] = useState<UserRole | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    getMyProfile().then((p) => {
      if (!mounted) return;
      setRole(p?.role ?? null);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const canManage = useMemo(() => isModerator(role as any), [role]);

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <header className="topnav">
      <div className="container topnav__inner">
        <Link className="brand" href="/dashboard" title="العودة للمواد">
          <span className="brand__dot" aria-hidden />
          دفعتنا
        </Link>

        <button
          className="iconBtn navToggle"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "إغلاق القائمة" : "فتح القائمة"}
          aria-expanded={open}
        >
          {open ? "✕" : "☰"}
        </button>

        <nav
          className={`topnav__links ${open ? "isOpen" : ""}`}
          onClick={() => setOpen(false)}
        >
          <Link className="navLink" href="/dashboard">
            المواد
          </Link>

          <Link className="navLink" href="/mcq">
            اختبارات MCQ
          </Link>

          {canManage ? (
            <>
              <Link className="navLink" href="/upload">
                رفع محتوى
              </Link>
              <Link className="navLink" href="/admin/courses">
                إدارة المواد
              </Link>
              <Link className="navLink" href="/admin/mcq">
                إدارة الأسئلة
              </Link>
            </>
          ) : null}

          <span className="chip" title="الدور الحالي">
            👤 {roleLabel(role)}
          </span>

          <button className="btn btn--ghost" onClick={logout}>
            تسجيل خروج
          </button>
        </nav>
      </div>
    </header>
  );
}
