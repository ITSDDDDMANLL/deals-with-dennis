import { cookies } from "next/headers";
import type { Metadata } from "next";
import { AdminHeader } from "../AdminHeader";
import { AdminLogin } from "../AdminLogin";
import { BulkInventoryEditor } from "./BulkInventoryEditor";
import { getFeaturedVehicles } from "../../data/inventory";
import {
  getAdminCookieName,
  isAdminSessionValueValid,
} from "../../../lib/admin-auth";
import { getInventoryVehicles } from "../../../lib/inventory-store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
  title: "Bulk Inventory Editor · Deals with Dennis",
};

export default async function AdminBulkPage() {
  const cookieStore = await cookies();
  const isAuthenticated = isAdminSessionValueValid(
    cookieStore.get(getAdminCookieName())?.value,
  );
  const vehicles = isAuthenticated
    ? await getInventoryVehicles(getFeaturedVehicles(), { includeHidden: true })
    : [];

  return (
    <main className="admin-page">
      <AdminHeader section="Bulk Editor" />

      <div className="page-shell">
        {isAuthenticated ? (
          <>
            <section className="admin-hero">
              <div>
                <p className="eyebrow">Fast inventory updates</p>
                <h1>Bulk Editor</h1>
              </div>
            </section>

            <BulkInventoryEditor initialVehicles={vehicles} />
          </>
        ) : (
          <AdminLogin />
        )}
      </div>
    </main>
  );
}
