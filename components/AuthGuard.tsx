"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function check() {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      if (!data.session) {
        router.replace("/login");
        return;
      }

      // Best-effort: sync full_name from user_metadata into profiles if empty.
      // This keeps DB intact and improves UX without migrations.
      try {
        const userRes = await supabase.auth.getUser();
        const fullName = (userRes.data.user?.user_metadata as any)?.full_name as
          | string
          | undefined;

        if (fullName && fullName.trim()) {
          const { data: prof } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", data.session.user.id)
            .single();

          if (!prof?.full_name) {
            await supabase
              .from("profiles")
              .update({ full_name: fullName.trim() })
              .eq("id", data.session.user.id);
          }
        }
      } catch {
        // ignore
      }

      setReady(true);
    }

    check();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace("/login");
    });

    return () => {
      mounted = false;
      sub?.subscription.unsubscribe();
    };
  }, [router]);

  if (!ready) {
    return (
      <main className="container">
        <div className="card">
          <h2>جاري التحميل…</h2>
          <p>بنجهز حسابك.</p>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
