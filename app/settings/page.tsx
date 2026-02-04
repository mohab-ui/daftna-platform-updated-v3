"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import ThemeToggle from "@/components/ThemeToggle";
import { supabase } from "@/lib/supabase";
import { getMyProfile } from "@/lib/profile";

export default function SettingsPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      const [userRes, profile] = await Promise.all([
        supabase.auth.getUser(),
        getMyProfile(),
      ]);

      if (!mounted) return;
      setEmail(userRes.data.user?.email ?? null);
      setFullName(profile?.full_name ?? null);
      setRole(profile?.role ?? null);
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <AppShell>
      <main className="container">
        <div className="card">
          <h1>الإعدادات</h1>
          <p className="muted" style={{ marginTop: 0 }}>
            إعدادات بسيطة علشان التجربة تبقى هادئة وسريعة.
          </p>

          <div className="grid" style={{ marginTop: 12 }}>
            <div className="col-12 col-6">
              <div className="card card--soft">
                <h2 style={{ marginBottom: 6 }}>المظهر</h2>
                <p className="muted" style={{ marginTop: 0 }}>
                  بدّل بين الوضع الفاتح والداكن.
                </p>

                <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 10 }}>
                  <ThemeToggle />
                  <span className="muted">(يتم حفظ الاختيار تلقائياً)</span>
                </div>
              </div>
            </div>

            <div className="col-12 col-6">
              <div className="card card--soft">
                <h2 style={{ marginBottom: 6 }}>حسابي</h2>
                <p className="muted" style={{ marginTop: 0 }}>
                  معلومات عامة عن الحساب.
                </p>

                <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                  <div className="kpi">👤 {fullName || "-"}</div>
                  <div className="kpi">📧 {email || "-"}</div>
                  <div className="kpi">🔐 {role || "student"}</div>
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
                  <Link className="btn btn--ghost" href="/mcq/history">
                    سجل المحاولات
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </AppShell>
  );
}
