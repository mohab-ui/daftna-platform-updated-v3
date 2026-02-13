"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import ThemeToggle from "@/components/ThemeToggle";
import { supabase } from "@/lib/supabase";
import { getMyProfile, isModerator, type UserRole } from "@/lib/profile";
import {
  IconBook,
  IconHome,
  IconLogout,
  IconQuiz,
  IconSettings,
  IconShield,
  IconStar,
  IconUpload,
} from "@/components/icons";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  match?: (pathname: string) => boolean;
};

function isActive(item: NavItem, pathname: string) {
  if (item.match) return item.match(pathname);
  // Exact match for dashboard-like pages, prefix match otherwise.
  if (item.href === "/dashboard") return pathname === "/dashboard";
  return pathname === item.href || pathname.startsWith(item.href + "/");
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [role, setRole] = useState<UserRole | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function load() {
      const [profile, userRes] = await Promise.all([
        getMyProfile(),
        supabase.auth.getUser(),
      ]);

      if (!mounted) return;

      setRole(profile?.role ?? null);
      setFullName(profile?.full_name ?? null);
      setEmail(userRes.data.user?.email ?? null);
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const canManage = useMemo(() => isModerator(role as any), [role]);

  const primaryNav: NavItem[] = useMemo(
    () => [
      { href: "/dashboard", label: "الرئيسية", icon: <IconHome /> },
      {
        href: "/dashboard",
        label: "المحاضرات",
        icon: <IconBook />,
        match: (p) => p === "/dashboard" || p.startsWith("/courses/"),
      },
      { href: "/mcq", label: "بنك الأسئلة", icon: <IconQuiz /> },
      { href: "/favorites", label: "المفضلة", icon: <IconStar /> },
      { href: "/settings", label: "الإعدادات", icon: <IconSettings /> },
    ],
    []
  );

  const adminNav: NavItem[] = useMemo(
    () =>
      canManage
        ? [
            {
              href: "/admin/courses",
              label: "إدارة المواد",
              icon: <IconShield />,
            },
            {
              href: "/admin/mcq",
              label: "إدارة MCQ",
              icon: <IconShield />,
              match: (p) => p.startsWith("/admin/mcq"),
            },
            { href: "/upload", label: "رفع محتوى", icon: <IconUpload /> },
          ]
        : [],
    [canManage]
  );

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <AuthGuard>
      <div className="shell">
        {/* Overlay for mobile */}
        <button
          className={mobileOpen ? "shellOverlay isOpen" : "shellOverlay"}
          aria-label="إغلاق القائمة"
          onClick={() => setMobileOpen(false)}
        />

        <aside className={mobileOpen ? "sidebar isOpen" : "sidebar"}>
          <div className="sidebar__inner">
            <div className="sidebar__brand">
              <div className="brandMark" aria-hidden>
                <img className="brandLogo" src="/logo.png" alt="" />
              </div>
              <div className="sidebar__brandText">
                <div className="sidebar__title">منصة دفعتنا</div>
                <div className="sidebar__subtitle">محتوى + محاضرات + MCQ</div>
              </div>

              <div className="sidebar__brandActions">
                <ThemeToggle compact />
              </div>
            </div>

            <nav className="nav">
              <div className="nav__section">
                {primaryNav.map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={
                      isActive(item, pathname)
                        ? "navItem isActive"
                        : "navItem"
                    }
                    onClick={() => setMobileOpen(false)}
                  >
                    <span className="navItem__icon">{item.icon}</span>
                    <span className="navItem__label">{item.label}</span>
                  </Link>
                ))}
              </div>

              {adminNav.length ? (
                <div className="nav__section">
                  <div className="nav__sectionTitle">لوحة الإدارة</div>
                  {adminNav.map((item) => (
                    <Link
                      key={item.label}
                      href={item.href}
                      className={
                        isActive(item, pathname)
                          ? "navItem isActive"
                          : "navItem"
                      }
                      onClick={() => setMobileOpen(false)}
                    >
                      <span className="navItem__icon">{item.icon}</span>
                      <span className="navItem__label">{item.label}</span>
                    </Link>
                  ))}
                </div>
              ) : null}
            </nav>

            <div className="sidebar__footer">
              <div className="userCard">
                <div className="userCard__avatar" aria-hidden>
                  👤
                </div>
                <div className="userCard__meta">
                  <div className="userCard__name">
                    {fullName || "طالب"}
                  </div>
                  <div className="userCard__sub">
                    {email || ""} {role ? `• ${role}` : ""}
                  </div>
                </div>
              </div>

              <div className="sidebar__footerRow">
                <button className="navItem navItem--btn" onClick={logout}>
                  <span className="navItem__icon">
                    <IconLogout />
                  </span>
                  <span className="navItem__label">تسجيل خروج</span>
                </button>
              </div>
            </div>
          </div>
        </aside>

        <div className="shellMain">
          <header className="topbar">
            <div className="topbar__left">
              <button
                className="iconBtn navToggle"
                onClick={() => setMobileOpen((v) => !v)}
                aria-label={mobileOpen ? "إغلاق القائمة" : "فتح القائمة"}
                aria-expanded={mobileOpen}
              >
                {mobileOpen ? "✕" : "☰"}
              </button>

              <div className="topbar__breadcrumb">
                {pathname.startsWith("/admin") ? (
                  <>
                    <IconShield />
                    <span>الإدارة</span>
                  </>
                ) : pathname.startsWith("/mcq") ? (
                  <>
                    <IconQuiz />
                    <span>MCQ</span>
                  </>
                ) : pathname.startsWith("/courses") ? (
                  <>
                    <IconBook />
                    <span>المحاضرات</span>
                  </>
                ) : (
                  <>
                    <IconHome />
                    <span>الرئيسية</span>
                  </>
                )}
              </div>
            </div>

            <div className="topbar__right">
              <div className="topbar__hideMobile">
                <ThemeToggle />
              </div>
              <Link href="/settings" className="iconBtn" aria-label="الإعدادات" title="الإعدادات">
                ⚙️
              </Link>
            </div>
          </header>

          <div className="shellContent">{children}</div>
        </div>
      </div>
    </AuthGuard>
  );
}
