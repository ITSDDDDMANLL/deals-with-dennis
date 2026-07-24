"use client";

import { useEffect, useState } from "react";

const ADMIN_WIDE_KEY = "deals-with-dennis-admin-wide";

const adminLinks = [
  { href: "/admin", label: "Inventory" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/content", label: "Content" },
  { href: "/admin/inquiries", label: "Inquiries" },
  { href: "/admin/appointments", label: "Appointments" },
  { href: "/admin/history", label: "History" },
  { href: "/", label: "Public Site" },
];

export function AdminHeader({ section }: { section: string }) {
  const [isWide, setIsWide] = useState(false);

  useEffect(() => {
    const storedValue = window.localStorage.getItem(ADMIN_WIDE_KEY);
    const nextIsWide = storedValue === "true";
    setIsWide(nextIsWide);
    document.documentElement.classList.toggle("admin-wide", nextIsWide);

    return () => {
      document.documentElement.classList.remove("admin-wide");
    };
  }, []);

  function toggleWideMode() {
    const nextIsWide = !isWide;
    setIsWide(nextIsWide);
    window.localStorage.setItem(ADMIN_WIDE_KEY, String(nextIsWide));
    document.documentElement.classList.toggle("admin-wide", nextIsWide);
  }

  return (
    <header className="site-header admin-site-header">
      <nav className="nav-shell admin-nav-shell" aria-label="Admin navigation">
        <a className="brand" href="/admin">
          Deals with Dennis <span>{section}</span>
        </a>
        <div className="nav-links admin-nav-links">
          {adminLinks.map((link) => (
            <a href={link.href} key={link.href}>
              {link.label}
            </a>
          ))}
          <button
            aria-pressed={isWide}
            className="nav-mode-toggle"
            onClick={toggleWideMode}
            type="button"
          >
            {isWide ? "Comfort Width" : "Full Width"}
          </button>
          <a className="nav-cta" href="/inventory">
            View Inventory
          </a>
        </div>
      </nav>
    </header>
  );
}
