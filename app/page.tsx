"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function HomePage() {
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setLoggedIn(!!data.session));
  }, []);

  return (
    <main className="container">
      <div className="card">
        <h1>دفعتنا</h1>
        <p className="muted">
          موقع بسيط ومنظم علشان الدفعة تلاقي كل ملفات المواد (سلايدات/ملخصات/امتحانات
          سابقة/ريكوردات) في مكان واحد مع بحث وفلاتر.
        </p>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {loggedIn ? (
            <Link className="btn" href="/dashboard">
              دخول لوحة المواد
            </Link>
          ) : (
            <Link className="btn" href="/login">
              تسجيل دخول
            </Link>
          )}
        </div>
      </div>

      <div className="grid" style={{ marginTop: 12 }}>
        <div className="col-12 col-6 card">
          <h2>تنظيم</h2>
          <p className="muted">
            تصنيف حسب المادة/الترم + نوع المحتوى (كتاب/ملخص/ريكورد/امتحان).
          </p>
        </div>
        <div className="col-12 col-6 card">
          <h2>بحث سريع</h2>
          <p className="muted">
            تقدر تدور بكلمة في عنوان الملف أو الوصف وتفلتر على طول.
          </p>
        </div>
      </div>

      <p className="muted" style={{ marginTop: 12 }}>
        ملاحظة قانونية: كل حقوق الطبع والنشر محفوظة لدى طلاب الدفعة الرابعة.
      </p>
    </main>
  );
}
