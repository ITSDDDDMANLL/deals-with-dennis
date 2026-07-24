import { cookies } from "next/headers";
import type { Metadata } from "next";
import { AdminInventoryManager } from "./AdminInventoryManager";
import { AdminHeader } from "./AdminHeader";
import { AdminLogin } from "./AdminLogin";
import { getFeaturedVehicles } from "../data/inventory";
import { getAdminCookieName, isAdminSessionValueValid } from "../../lib/admin-auth";
import { getInventoryVehicles } from "../../lib/inventory-store";

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

  return (
    <main className="admin-page">
      <AdminHeader section="Inventory Admin" />

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
                Website videos, photos, and text live in Content Admin.
              </p>
            </section>

            <AdminInventoryManager initialVehicles={vehicles} />
          </>
        ) : (
          <AdminLogin />
        )}
      </div>
    </main>
  );
}
