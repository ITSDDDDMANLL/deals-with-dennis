"use client";

import { useEffect, useState } from "react";

const ADMIN_WIDE_KEY = "deals-with-dennis-admin-wide";

const adminGroups = [
  {
    label: "Inventory",
    links: [
      { href: "/admin", label: "Inventory Management" },
      { href: "/admin/bulk", label: "Bulk Editor" },
      { href: "/admin/history", label: "History" },
    ],
  },
  {
    label: "Leads",
    links: [
      { href: "/admin/inquiries", label: "Inquiries" },
      { href: "/admin/appointments", label: "Appointments" },
      { href: "/admin/analytics", label: "Analytics" },
    ],
  },
  {
    label: "Website",
    links: [
      { href: "/admin/content", label: "Content" },
      { href: "/", label: "Public Site" },
      { href: "/inventory", label: "View Inventory" },
    ],
  },
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
          <span className="brand-mark">DWD</span>
          <span className="brand-copy">
            Deals with Dennis <span>{section}</span>
          </span>
        </a>
        <div className="admin-nav-menu">
          {adminGroups.map((group) => (
            <div className="admin-nav-group" key={group.label}>
              <button className="admin-nav-trigger" type="button">
                {group.label}
              </button>
              <div className="admin-nav-dropdown">
                {group.links.map((link) => (
                  <a href={link.href} key={link.href}>
                    {link.label}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="admin-nav-actions">
          <button
            aria-pressed={isWide}
            className="nav-mode-toggle"
            onClick={toggleWideMode}
            type="button"
          >
            {isWide ? "Comfort Width" : "Full Width"}
          </button>
          <a className="nav-cta admin-primary-cta" href="/inventory">
            View Inventory
          </a>
        </div>
      </nav>
    </header>
  );
}
