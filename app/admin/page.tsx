import { cookies } from "next/headers";
import type { Metadata } from "next";
import { AdminInventoryManager } from "./AdminInventoryManager";
import { AdminLogin } from "./AdminLogin";
import { getFeaturedVehicles } from "../data/inventory";
import { getAdminCookieName, isAdminSessionValueValid } from "../../lib/admin-auth";
import { getInventoryVehicles } from "../../lib/inventory-store";
import { getSiteVideos } from "../../lib/video-store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
  title: "Inventory Admin · Deals with Dennis",
};

export default async function AdminPage() {
  const cookieStore = await cookies();
  const isAuthenticated = isAdminSessionValueValid(
    cookieStore.get(getAdminCookieName())?.value,
  );
  const vehicles = isAuthenticated
    ? await getInventoryVehicles(getFeaturedVehicles(), { includeHidden: true })
    : [];
  const videos = isAuthenticated
    ? await getSiteVideos([], { includeHidden: true })
    : [];

  return (
    <main className="admin-page">
      <header className="site-header">
        <nav className="nav-shell" aria-label="Admin navigation">
          <a className="brand" href="/">
            Dennis Liu <span>Inventory Admin</span>
          </a>
          <div className="nav-links">
            <a href="/admin/inquiries">Inquiries</a>
            <a href="/admin/history">History</a>
            <a href="/">Public Site</a>
            <a className="nav-cta" href="/#inventory">
              View Inventory
            </a>
          </div>
        </nav>
      </header>

      <div className="page-shell">
        {isAuthenticated ? (
          <>
            <section className="admin-hero">
              <div>
                <p className="eyebrow">Private workspace</p>
                <h1>Inventory management</h1>
              </div>
              <p>
                Manage the Supabase inventory that powers the public website.
                Vehicle changes and homepage videos are saved separately.
              </p>
            </section>

            <AdminInventoryManager
              initialVehicles={vehicles}
              initialVideos={videos}
            />
          </>
        ) : (
          <AdminLogin />
        )}
      </div>
    </main>
  );
}
