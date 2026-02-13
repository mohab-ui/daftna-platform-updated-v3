"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function SignupPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSignup(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    if (!fullName.trim()) {
      setErr("اكتب الاسم بالكامل.");
      return;
    }
    if (!email.trim()) {
      setErr("اكتب البريد الإلكتروني.");
      return;
    }
    if (!password || password.length < 6) {
      setErr("كلمة المرور لازم تكون 6 أحرف على الأقل.");
      return;
    }
    if (password !== confirmPassword) {
      setErr("تأكيد كلمة المرور غير مطابق.");
      return;
    }

    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
          },
        },
      });

      if (error) {
        // Keep it simple.
        setErr("تعذر إنشاء الحساب. تأكد من الإيميل أو جرّب إيميل مختلف.");
        return;
      }

      // If signUp returns a session, we can also update profiles immediately.
      // If not (email confirmation enabled), AuthGuard will sync later.
      const userId = data.session?.user?.id || data.user?.id;
      if (userId) {
        try {
          await supabase
            .from("profiles")
            .update({ full_name: fullName.trim() })
            .eq("id", userId);
        } catch {
          // ignore
        }
      }

      // Ensure we redirect to login as requested.
      try {
        await supabase.auth.signOut();
      } catch {
        // ignore
      }

      router.replace("/login?signup=success");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="authWrap">
      <div className="authCard">
        <div className="card">
          <div className="authBrand">
            <img className="authLogo" src="/logo.png" alt="" />
            <div className="authBrandText">
              <div className="authBrandTitle">دفعتنا</div>
              <div className="authBrandSub">منصة الدفعة</div>
            </div>
          </div>

          <h1 className="authTitle">إنشاء حساب</h1>
          <p className="authHint">اكتب بيانات بسيطة علشان تدخل المنصة.</p>

          {err ? <p className="error">{err}</p> : null}

          <form onSubmit={onSignup} style={{ marginTop: 12 }}>
            <label className="label">الاسم بالكامل</label>
            <input
              className="input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="مثال: Ahmed Mohamed"
              autoComplete="name"
              disabled={busy}
            />

            <div style={{ height: 10 }} />

            <label className="label">البريد الإلكتروني</label>
            <input
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              inputMode="email"
              autoComplete="email"
              disabled={busy}
            />

            <div style={{ height: 10 }} />

            <label className="label">كلمة المرور</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              disabled={busy}
            />

            <div style={{ height: 10 }} />

            <label className="label">تأكيد كلمة المرور</label>
            <input
              className="input"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              disabled={busy}
            />

            <div className="authActions">
              <button className="btn" type="submit" disabled={busy}>
                {busy ? "جاري إنشاء الحساب…" : "إنشاء الحساب"}
              </button>
              <Link className="btn btn--ghost" href="/login">
                رجوع لتسجيل الدخول
              </Link>
            </div>
          </form>
        </div>

        <p className="muted" style={{ marginTop: 12 }}>
          لديك حساب؟{" "}
          <Link href="/login" style={{ textDecoration: "underline" }}>
            سجل دخول
          </Link>
        </p>
      </div>
    </main>
  );
}
