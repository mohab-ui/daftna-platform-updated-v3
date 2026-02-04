"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    // If already logged in, go to dashboard.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/dashboard");
    });
  }, [router]);

  useEffect(() => {
    if (sp.get("signup") === "success") {
      setMsg("تم إنشاء الحساب بنجاح ✅ دلوقتي سجل دخول.");
    }
  }, [sp]);

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);

    if (!email.trim() || !password) {
      setErr("اكتب الإيميل وكلمة المرور.");
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        // Friendly + short.
        setErr("بيانات الدخول غير صحيحة أو الحساب غير مفعل.");
        return;
      }

      router.replace("/dashboard");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="authWrap">
      <div className="authCard">
        <div className="card">
          <div className="authBrand">
            <img className="authLogo" src="/logo.svg" alt="" />
            <div className="authBrandText">
              <div className="authBrandTitle">دفعتنا</div>
              <div className="authBrandSub">منصة الدفعة</div>
            </div>
          </div>

          <h1 className="authTitle">تسجيل الدخول</h1>
          <p className="authHint">منصة شامله لمحتوى الدفعة + بنوك أسئلة MCQ.</p>

          {msg ? <p className="success">{msg}</p> : null}
          {err ? <p className="error">{err}</p> : null}

          <form onSubmit={onLogin} style={{ marginTop: 12 }}>
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
              autoComplete="current-password"
              disabled={busy}
            />

            <div className="authActions">
              <button className="btn" type="submit" disabled={busy}>
                {busy ? "جاري الدخول…" : "دخول"}
              </button>
              <Link className="btn btn--ghost" href="/signup">
                إنشاء حساب
              </Link>
            </div>
          </form>

          <div className="divider" />

          <p className="muted" style={{ marginTop: 0 }}>
            لو دي أول مرة ليك هنا، اعمل{" "}
            <Link href="/signup" style={{ textDecoration: "underline" }}>
              حساب جديد
            </Link>
            .
          </p>
        </div>
      </div>
    </main>
  );
}
